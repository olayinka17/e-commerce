import { execSync, execFileSync } from "child_process";
import { readFileSync as fsReadFileSync } from "fs";
import path from "path";
import request from "supertest";
import { Network, GenericContainer, Wait } from "testcontainers";
import { KafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kafka, logLevel, type Producer } from "kafkajs";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import axios from "axios";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { ServiceError } from "@grpc/grpc-js";
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { v4 as uuidv4 } from "uuid";
import { Topics } from "@enterprise/kafka-common";
import { bootstrap } from "../utils/bootstrap.js";

interface ProductRequest {
  id: string;
}

interface ProductsRequest {
  ids: string[];
}

interface CurrentProducts {
  name: string;
  id: string;
  category_id: string;
  description: string;
  price: Number;
  sku: string;
  category: string;
}
interface OrderI {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_price: number;
  created_at: String;
}

export interface revenueI {
  total_amount: number;
}

export interface TransactionI {
  id: string;
  created_at: string;
  amount: number;
  order_id: string;
  status: string;
  update_at: string;
}

function bindServer(server: grpc.Server, address: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      },
    );
  });
}
async function waitForExpect(
  assertionFn: (...args: any[]) => any,
  timeout = 5000,
  interval = 200,
) {
  const startTime = Date.now();
  while (true) {
    try {
      await assertionFn();
      return;
    } catch (err) {
      if (Date.now() - startTime > timeout) throw err;
      await new Promise((res) => setTimeout(res, interval));
    }
  }
}

const PROTO_PATH = path.join(process.cwd(), "src/grpc/products.proto");
const CLIENT_PROTO_PATH = path.join(process.cwd(), "src/grpc/shopping.proto");

const AdminpackageDef = protoloader.loadSync(CLIENT_PROTO_PATH, {
  keepCase: true,
});

const AdmingrpcObject = grpc.loadPackageDefinition(AdminpackageDef) as any;

const AdminPackage = AdmingrpcObject.AdminPackage;

const packageDef = protoloader.loadSync(PROTO_PATH, {
  longs: String,
  keepCase: true,
});
const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
const productsPackage = grpcObject.productsPackage;

const Topic_config = [
  Topics.ORDER_CREATED,
  Topics.ORDER_FAILED_RETRY,
  Topics.PAYMENT_PROCESS,
  Topics.INVENTORY_FAILED,
];

describe("shopping test", () => {
  let network: any;
  let postgresqlContainer: any;
  let kafkaContainer: any;
  let debeziumContainer: any;
  let kafkaClient: Kafka;
  let producer: Producer;
  let prisma: PrismaClient;
  let AdminClient: any;
  let ProductsServer: grpc.Server;
  let app: any;
  let serverConfig: any;
  let product_id: string = uuidv4();
  let order_id: string;
  beforeAll(
    async () => {
      // Initializing shared Docker network
      network = await new Network().start();

      kafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:7.8.0")
        .withKraft()
        .withNetwork(network)
        .withNetworkAliases("kafka-broker")
        .start();

      const kafkaPort = kafkaContainer.getMappedPort(9093);
      const kafkaHost = kafkaContainer.getHost();
      const kafkaName = kafkaContainer.getName();

      postgresqlContainer = await new PostgreSqlContainer("postgres:18-alpine")
        .withNetwork(network)
        .withNetworkAliases("postgres-db")
        .withDatabase("shopping")
        .withUsername("postgres")
        .withPassword("password")
        .withCommand(["postgres", "-c", "wal_level=logical"])
        .start();

      const dbName = postgresqlContainer.getName().replace(/^\//, "");
      const dynamicUrl = `postgresql://postgres:password@${postgresqlContainer.getHost()}:${postgresqlContainer.getMappedPort(5432)}/shopping`;
      process.env.DATABASE_URL = dynamicUrl;
      execSync("npx prisma migrate dev", {
        env: {
          ...process.env,
        },
        stdio: "inherit",
      });
      console.log("Prisma schema synchronized successfully");

      const sql = fsReadFileSync(
        path.join(process.cwd(), "src", "test", "publication.sql"),
        "utf8",
      );

      execFileSync(
        "docker",
        ["exec", "-i", dbName, "psql", "-U", "postgres", "-d", "shopping"],
        {
          input: sql,
          stdio: ["pipe", "inherit", "inherit"],
        },
      );

      debeziumContainer = await new GenericContainer("quay.io/debezium/connect@sha256:bd0ef1f8aa0690bc9bc0dec78c209f24f5d53ffd40fe5bc36c22db87052a51ad")
        .withNetwork(network)
        .withExposedPorts(8083)
        .withEnvironment({
          BOOTSTRAP_SERVERS: `kafka-broker:9092`,
          GROUP_ID: "connect-cluster",
          CONFIG_STORAGE_TOPIC: "connect-configs",
          OFFSET_STORAGE_TOPIC: "connect-offsets",
          STATUS_STORAGE_TOPIC: "connect-status",
          CONFIG_STORAGE_REPLICATION_FACTOR: "1",
          OFFSET_STORAGE_REPLICATION_FACTOR: "1",
          STATUS_STORAGE_REPLICATION_FACTOR: "1",
          KEY_CONVERTER: "org.apache.kafka.connect.json.JsonConverter",
          VALUE_CONVERTER: "org.apache.kafka.connect.json.JsonConverter",
          KEY_CONVERTER_SCHEMAS_ENABLE: "false",
          VALUE_CONVERTER_SCHEMAS_ENABLE: "false",
        })
        .withWaitStrategy(Wait.forHttp("/connectors", 8083).forStatusCode(200))
        .start();
      execSync(
        `docker exec ${kafkaName} /usr/bin/kafka-topics \
            --create \
            --if-not-exists \
            --topic outbox.event.payments \
            --bootstrap-server ${kafkaHost}:${9092} \
            --partitions 1 \
            --replication-factor 1`,
        { stdio: "inherit" },
      );

      const connectUrl = `http://${debeziumContainer.getHost()}:${debeziumContainer.getMappedPort(8083)}`;

      await axios.post(`${connectUrl}/connectors`, {
        name: "payment-outbox-connector",
        config: {
          "connector.class":
            "io.debezium.connector.postgresql.PostgresConnector",
          "database.hostname": "postgres-db",
          "database.port": "5432",
          "database.user": "postgres",
          "database.password": "password",
          "database.dbname": "shopping",
          "topic.prefix": "payment",
          "plugin.name": "pgoutput",
          "publication.name": "payment_publication",
          "table.include.list": "public.PaymentOutox",
          "slot.name": "payment_slot",
          "snapshot.mode": "no_data",
          "key.converter.schemas.enable": "false",
          "value.converter.schemas.enable": "false",
          transforms: "outbox",
          "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
          "transforms.outbox.table.expand.json.payload": "true",
          "key.converter": "org.apache.kafka.connect.storage.StringConverter",
          "value.converter": "org.apache.kafka.connect.json.JsonConverter",
          "transforms.outbox.table.fields.additional.placement":
            "eventtype:header:type",
        },
      });

      const broker = `${kafkaHost}:${kafkaPort}`;
      for (const topic of Topic_config) {
        execSync(
          `docker exec ${kafkaName} /usr/bin/kafka-topics \
            --create \
            --if-not-exists \
            --topic ${topic} \
            --bootstrap-server ${kafkaHost}:${9092} \
            --partitions 1 \
            --replication-factor 1`,
          { stdio: "inherit" },
        );
      }
      kafkaClient = new Kafka({
        clientId: "shopping-test-service",
        brokers: [broker],
        logLevel: logLevel.NOTHING,
      });
      producer = kafkaClient.producer();
      await producer.connect();
      process.env.KAFKA_BROKERS = broker;

      const prismaModule = await import("../utils/prisma.js");

      prisma = prismaModule.prisma;

      const kafkaModule = await import("../utils/kafka.js");
      const kafkaService = kafkaModule.kafkaService;

      await kafkaService.connect();

      const appModule = await import("../app.js");
      app = appModule.default;

      serverConfig = await import("../grpc/grpc-server.js");
      await serverConfig.startGrpcServer();

      AdminClient = new AdminPackage.Admin(
        "localhost:40099",
        grpc.credentials.createInsecure(),
      );

      const category_id = uuidv4();
      ProductsServer = new grpc.Server();
      ProductsServer.addService(productsPackage.Products.service, {
        getProduct: (
          call: ServerUnaryCall<ProductRequest, CurrentProducts | null>,
          callback: sendUnaryData<CurrentProducts | null>,
        ) => {
          callback(null, {
            id: call.request.id,
            name: "socket",
            category_id,
            price: 350,
            sku: "ososo",
            category: "dkdkd",
            description: "the best ever",
          });
        },
        getProducts: (
          call: ServerUnaryCall<ProductsRequest, { items: CurrentProducts[] }>,
          callback: sendUnaryData<{ items: CurrentProducts[] }>,
        ) => {
          callback(null, {
            items: [
              {
                id: call.request.ids[0] as string,
                name: "socket",
                category_id,
                price: 350,
                sku: "ososo",
                category: "dkdkd",
                description: "the best ever",
              },
            ],
          });
        },
      });
      await bindServer(ProductsServer, "localhost:40098");
      await bootstrap();
    },
    50 * 60 * 1000,
  );

  afterAll(
    async () => {
      if (kafkaContainer) await kafkaContainer.stop();

      if (postgresqlContainer) await postgresqlContainer.stop();
      if (debeziumContainer) await debeziumContainer.stop();
      await producer.disconnect();
      await network.stop();
      await serverConfig.stopServer();
    },
    50 * 60 * 1000,
  );

  it("should add to cart", async () => {
    const response = await request(app)
      .post("/api/v1/shopping/carts")
      .send({
        product_id,
        qty: 4,
      })
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("cart");
    expect(response.body.data.cart).toHaveProperty("cart_items");
    expect(response.body.data.cart.cart_items[0]).toHaveProperty(
      "product_id",
      product_id,
    );
  }, 12000);

  it("should create order", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `shopping-service-test:?${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.ORDER_CREATED,
      fromBeginning: true,
    });

    const response = await request(app)
      .post("/api/v1/shopping/orders")
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(504);

    const receivedKafkaMessages: Record<string, string | OrderI>[] = [];

    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaHeaders.push(
          message.headers?.event_id?.toString() as string,
        );
      },
    });
    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("order");
        expect(receivedKafkaMessages[0]).toHaveProperty("correlation_id");
        const order = receivedKafkaMessages[0]?.order as OrderI;
        order_id = order.id;
        console.log(order_id);

        await producer.send({
          topic: Topics.PAYMENT_PROCESS,
          messages: [
            {
              value: JSON.stringify(receivedKafkaMessages[0]),
              headers: { event_id: receivedKafkaHeaders[0] },
            },
          ],
        });
      },
      7000,
      200,
    );
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await consumer.stop();
    await consumer.disconnect();
  }, 17000);

  it("should return order status", async () => {
    const response = await request(app)
      .get(`/api/v1/shopping/status/${order_id}`)
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("order");
    expect(response.body.data.order).toHaveProperty("payment_url");
  });

  it("should be idempotent", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `shopping-service-test:?${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.ORDER_CREATED,
      fromBeginning: true,
    });

    const response = await request(app)
      .post("/api/v1/shopping/orders")
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(504);

    const receivedKafkaMessages: Record<string, string | OrderI>[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaHeaders.push(
          message.headers?.event_id?.toString() as string,
        );
      },
    });
    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages.length).toBe(2);
        expect(receivedKafkaMessages[1]).toHaveProperty("order");
        expect(receivedKafkaMessages[1]).toHaveProperty("correlation_id");
        const order = receivedKafkaMessages[0]?.order as OrderI;
        expect(order_id).toBe(order.id);
      },
      5000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 11000);

  it("should return total orders", async () => {
    const grpcResponse: { orders: OrderI[]; nextCursor: string | null } =
      await new Promise((resolve, reject) => {
        AdminClient.totalOrders(
          {
            limit: 10,
            beforeTimestamp: String(Date.now()),
            status: "undefined",
          },
          (
            err: ServiceError | null,
            response: { orders: OrderI[]; nextCursor: string | null },
          ) => {
            if (err) return reject(err);
            resolve(response);
          },
        );
      });

    expect(grpcResponse.orders[0]).toHaveProperty("total_price", 1400);
    expect(grpcResponse.orders[0]).toHaveProperty("id", order_id);
    expect(grpcResponse.nextCursor).toBeTruthy();
  });

  it("should return total transactions", async () => {
    const grpcResponse: {
      transactions: TransactionI[];
      nextCursor: string | null;
    } = await new Promise((resolve, reject) => {
      AdminClient.recentTransactions(
        {
          limit: 10,
          beforeTimestamp: String(Date.now()),
          status: "undefined",
        },
        (
          err: ServiceError | null,
          response: { transactions: TransactionI[]; nextCursor: string | null },
        ) => {
          if (err) return reject(err);
          resolve(response);
        },
      );
    });

    expect(grpcResponse.transactions[0]).toHaveProperty("amount", 1400);
    expect(grpcResponse.transactions[0]).toHaveProperty("order_id", order_id);
    expect(grpcResponse.nextCursor).toBeTruthy();
  });
  it("should return total revenue", async () => {
    const grpcResponse: revenueI = await new Promise((resolve, reject) => {
      AdminClient.totalRevenue(
        {
          now: new Date(),
          to: new Date(),
        },
        (err: ServiceError | null, response: revenueI) => {
          if (err) return reject(err);
          resolve(response);
        },
      );
    });

    expect(grpcResponse.total_amount).toBe(0);
  });
  it("should get carts", async () => {
    const response = await request(app)
      .get("/api/v1/shopping/carts")
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("cart");
  });
  it("should delete from carts", async () => {
    const response = await request(app)
      .delete(`/api/v1/shopping/carts/${product_id}`)
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
  });
  it("should get order by id", async () => {
    const response = await request(app)
      .get(`/api/v1/shopping/orders/${order_id}`)
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("order");
  });
  it("should get all orders", async () => {
    const response = await request(app)
      .get("/api/v1/shopping/orders")
      .set(
        "x-user",
        JSON.stringify({
          id: "152e703e-df22-4f95-9585-a2779e1354eb",
          email: "olayinkaolaniyi2000@gmail.com",
          role: "admin",
        }),
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("orders");
  });
});
