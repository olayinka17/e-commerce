import { execSync, spawnSync } from "child_process";
import { execFileSync } from "node:child_process";
import { readFileSync as fsReadFileSync } from "node:fs";
import path from "path";
import request from "supertest";
// import app from "../app.js";
import { Network, GenericContainer, Wait } from "testcontainers";
import { KafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import axios from "axios";
//import { startGrpcServer } from "../grpc/grpc-server.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { ServiceError } from "@grpc/grpc-js";
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import type { CurrentProducts, Products } from "../generated/prisma/client.js";
import type {
  ProductRequest,
  ProductsRequest,
  achiveResponseI,
} from "../utils/RpcFunctions.js";
import type {
  CategoriesI,
  CategoryResI,
  ProductI,
  ProductsI,
  ProductUI,
} from "../service/products.js";

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

const packageDef = protoloader.loadSync(PROTO_PATH, {
  longs: String,
  keepCase: true,
});
const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
const productsPackage = grpcObject.productsPackage;

describe("product test", () => {
  let network: any;
  let postgresqlContainer: any;
  let kafkaContainer: any;
  let debeziumContainer: any;
  let kafkaClient: Kafka;
  let prisma: PrismaClient;
  let ProductClient: any;
  let AdminClient: any;
  let category_id: string;
  let product_id: string;
  beforeAll(
    async () => {
      // Initializing shared Docker network
      network = await new Network().start();

      kafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:7.8.0")
        .withKraft()
        .withNetworkMode(network.getName())
        .withNetworkAliases("kafka-broker")
        .start();

      // const startedKafkaContainer = await kafkaContainer.start();

      const kafkaPort = kafkaContainer.getMappedPort(9093);
      const kafkaHost = kafkaContainer.getHost();
      const kafkaName = kafkaContainer.getName();

      // starting PostgreSql with Logical replication enabled
      postgresqlContainer = await new PostgreSqlContainer("postgres:18-alpine")
        .withNetwork(network)
        .withNetworkAliases("postgres-db")
        .withDatabase("products")
        .withUsername("postgres")
        .withPassword("password")
        .withCommand(["postgres", "-c", "wal_level=logical"])
        .start();
      const dbName = postgresqlContainer.getName().replace(/^\//, "");

      const dynamicDbUrl = `postgresql://postgres:password@${postgresqlContainer.getHost()}:${postgresqlContainer.getMappedPort(5432)}/products`;
      process.env.DATABASE_URL = dynamicDbUrl;
      console.log("pushing Prisma schema to test container...");
      console.log(process.env.DATABASE_URL);
      execSync("npx prisma migrate dev", {
        env: {
          ...process.env,
        },
        stdio: "inherit",
      });
      console.log("Prisma schema synchronized successfully");

      //   execSync(
      //     `docker exec ${dbName} \
      //     psql -U postgres -d products \
      //     -c 'CREATE PUBLICATION product_publication FOR TABLE "InventoryOutbox";'
      // `,
      //     { stdio: "inherit" },
      //   );

      // const result = spawnSync(
      //   "docker",
      //   [
      //     "exec",
      //     dbName,
      //     "psql",
      //     "-U",
      //     "postgres",
      //     "-d",
      //     "products",
      //     "-c",
      //     'CREATE PUBLICATION product_publication FOR TABLE "InventoryOutbox";',
      //   ],
      //   {
      //     stdio: "inherit",
      //   },
      // );

      // if (result.status !== 0) {
      //   throw new Error("Failed to create publication");
      // }

      // const sql = fsReadFileSync("publication.sql", "utf8");
      const sql = fsReadFileSync(
        path.join(process.cwd(), "src", "test", "publication.sql"),
        "utf8",
      );

      execFileSync(
        "docker",
        ["exec", "-i", dbName, "psql", "-U", "postgres", "-d", "products"],
        {
          input: sql,
          stdio: ["pipe", "inherit", "inherit"],
        },
      );

      // execSync(`docker exec ${dbName} psql -U postgres -d products -c `)
      // execSync(
      //   `docker exec -i ${dbName} psql -U postgres -d products < publication.sql`,
      //   { stdio: "inherit", shell: true as any},
      // );
      // execSync(
      //   `docker exec ${dbName} psql -U postgres -d products -c "CREATE PUBLICATION product_publication FOR TABLE \\"InventoryOutbox\\";"`,
      //   { stdio: "inherit" },
      // );

      //const pluginpath = path.resolve(__dirname, "./connector");

      debeziumContainer = await new GenericContainer(
        "quay.io/debezium/connect:3.6",
      )
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
            --topic outbox.event.products \
            --bootstrap-server ${kafkaHost}:${9092} \
            --partitions 1 \
            --replication-factor 1`,
        { stdio: "inherit" },
      );

      const connectUrl = `http://${debeziumContainer.getHost()}:${debeziumContainer.getMappedPort(8083)}`;

      try {
        await axios.post(`${connectUrl}/connectors`, {
          name: "product-outbox-connector",
          config: {
            "connector.class":
              "io.debezium.connector.postgresql.PostgresConnector",
            "database.hostname": "postgres-db",
            "database.port": "5432",
            "database.user": "postgres",
            "database.password": "password",
            "database.dbname": "products",
            "topic.prefix": "products",
            "plugin.name": "pgoutput",
            "publication.name": "product_publication",
            "table.include.list": "public.InventoryOutbox",
            "slot.name": "product_slot",
            "snapshot.mode": "no_data",
            "key.converter.schemas.enable": "false",
            "value.converter.schemas.enable": "false",
            transforms: "outbox",
            "transforms.outbox.type":
              "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.table.expand.json.payload": "true",
            "key.converter": "org.apache.kafka.connect.storage.StringConverter",
            "value.converter": "org.apache.kafka.connect.json.JsonConverter",
            "transforms.outbox.table.fields.additional.placement":
              "eventtype:header:type",
          },
        });
        // console.log(response.status);
        // console.log(response.data);

        // await new Promise((resolve) => setTimeout(resolve, 10000));
        // const { data } = await axios.get(
        //   `${connectUrl}/connectors/product-outbox-connector/status`,
        // );
        // console.dir(data, { depth: null });

        // console.dir(data, { depth: null });
        // const plugins = await axios.get(`${connectUrl}/connector-plugins`);

        // console.dir(plugins.data, { depth: null });
      } catch (err: any) {
        console.log(err.response?.status);
        console.log(err.response?.data);
        throw err;
      }

      // const { data } = await axios.get(
      //   `${connectUrl}/connectors/product-outbox-connector/config`,
      // );

      // console.dir(data);

      // const chksql = fsReadFileSync(
      //   path.join(process.cwd(), "src", "test", "check.sql"),
      // );
      // execFileSync(
      //   "docker",
      //   ["exec", "-i", dbName, "psql", "-U", "postgres", "-d", "products"],
      //   {
      //     input: chksql,
      //     stdio: ["pipe", "inherit", "inherit"],
      //   },
      // );
      const broker = `${kafkaHost}:${kafkaPort}`;

      kafkaClient = new Kafka({
        clientId: "shopping-test-service",
        brokers: [broker],
        // logLevel: logLevel.ERROR,
      });

      const admin = kafkaClient.admin();
      await admin.connect();

      console.log(await admin.listTopics());

      await admin.disconnect();

      const prismaModule = await import("../utils/prisma.js");
      prisma = prismaModule.prisma;

      const serverModule = await import("../grpc/grpc-server.js");
      const server = serverModule.startGrpcServer;

      await server();
      //await startGrpcServer();

      ProductClient = new productsPackage.Products(
        "localhost:40098",
        grpc.credentials.createInsecure(),
      );

      AdminClient = new productsPackage.AdminProduct(
        "localhost:40098",
        grpc.credentials.createInsecure(),
      );
    },
    50 * 60 * 1000,
  );

  afterAll(
    async () => {
      if (kafkaContainer) await kafkaContainer.stop();
      await prisma.products.deleteMany();
      await prisma.categories.deleteMany();
      await prisma.inventoryOutbox.deleteMany();
      if (postgresqlContainer) await postgresqlContainer.stop();
      if (debeziumContainer) await debeziumContainer.stop();
      await network.stop();
    },
    50 * 60 * 1000,
  );

  it("should create category", async () => {
    const grpcResponse: CategoryResI = await new Promise((resolve, reject) => {
      AdminClient.createCategory(
        {
          name: "Electronics",
          description: "The best ever",
        },
        (err: ServiceError | null, response: CategoryResI) => {
          if (err) {
            return reject(err);
          }
          resolve(response);
        },
      );
    });

    expect(grpcResponse.name).toBe("Electronics");
    expect(grpcResponse.description).toBe("The best ever");
    category_id = grpcResponse.id;
  });

  it("should create product", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `products-service-test:?${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: "outbox.event.products" });

    const grpcResponse: ProductsI = await new Promise((resolve, reject) => {
      AdminClient.createProducts(
        {
          name: "socket",
          description: "The best ever",
          price: 250,
          sku: "skuyt",
          category_id,
        },
        (err: ServiceError | null, response: ProductsI) => {
          if (err) {
            return reject(err);
          }

          resolve(response);
        },
      );
    });

    expect(grpcResponse.name).toBe("socket");
    expect(grpcResponse.category_id).toBe(category_id);

    product_id = grpcResponse.id as string;
    const outbox = await prisma.inventoryOutbox.findMany();
    console.log(outbox);
    const receivedKafkaMessages: Record<string, string>[] = [];
    const receivedKafkaKey: string[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaKey.push(message.key?.toString() as string);
        receivedKafkaHeaders.push(message?.headers?.type?.toString() as string);
      },
    });
    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages[0]).toEqual({
          product_id: grpcResponse.id,
        });
        expect(receivedKafkaKey[0]).toEqual(grpcResponse.id);
        expect(receivedKafkaHeaders[0]).toEqual("PRODUCT_CREATE");
      },
      20000,
      200,
    );

    await consumer.stop();
    await consumer.disconnect();
  }, 22000);

  it("should update product", async () => {
    const grpcResponse: ProductsI = await new Promise((resolve, reject) => {
      AdminClient.updateProduct(
        {
          product_id,
          price: 300,
        },
        (err: ServiceError | null, response: ProductsI) => {
          if (err) return reject(err);
          resolve(response);
        },
      );
    });

    expect(grpcResponse.price).toBe("300");
    expect(grpcResponse.category_id).toBe(category_id);
  });

  it("should archive product", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `products-service-test:%#${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: "outbox.event.products" });
    const receivedKafkaMessages: Record<string, string>[] = [];
    const receivedKafkaKey: string[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaKey.push(message.key?.toString() as string);
        receivedKafkaHeaders.push(message?.headers?.type?.toString() as string);
      },
    });

    const grpcResponse: achiveResponseI = await new Promise(
      (resolve, reject) => {
        AdminClient.archiveProduct(
          {
            id: product_id,
          },
          (err: ServiceError | null, response: achiveResponseI) => {
            if (err) {
              return reject(err);
            }

            resolve(response);
          },
        );
      },
    );

    expect(grpcResponse.success).toBe(true);

    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages[0]).toEqual({
          product_id,
        });
        expect(receivedKafkaKey[0]).toEqual(product_id);
        expect(receivedKafkaHeaders[0]).toEqual("PRODUCT_ARCHIVE");
      },
      20000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 22000);

  it("should unarchive product", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `products-service-test:@[]${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: "outbox.event.products" });

    const grpcResponse: achiveResponseI = await new Promise(
      (resolve, reject) => {
        AdminClient.unarchiveProduct(
          {
            id: product_id,
          },
          (err: ServiceError | null, response: achiveResponseI) => {
            if (err) {
              return reject(err);
            }

            resolve(response);
          },
        );
      },
    );

    expect(grpcResponse.success).toBe(true);

    const receivedKafkaMessages: Record<string, string>[] = [];
    const receivedKafkaKey: string[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaKey.push(message.key?.toString() as string);
        receivedKafkaHeaders.push(message?.headers?.type?.toString() as string);
      },
    });
    await waitForExpect(
      async () => {
        //console.log(receivedKafkaMessages)
        expect(receivedKafkaMessages[0]).toEqual({
          product_id,
        });
        expect(receivedKafkaKey[0]).toEqual(product_id);
        expect(receivedKafkaHeaders[0]).toEqual("PRODUCT_UNARCHIVE");
      },
      20000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 22000);

  it("should get product", async () => {
    const grpcResponse: Partial<CurrentProducts> | null = await new Promise(
      (resolve, reject) => {
        ProductClient.getProduct(
          {},
          (
            err: ServiceError | null,
            response: Partial<CurrentProducts> | null,
          ) => {
            if (err) return reject(err);
            resolve(response);
          },
        );
      },
    );

    console.log(grpcResponse);
    expect(grpcResponse?.category_id).toBe(category_id);
    expect(grpcResponse?.description).toBe("The best ever");
    expect(grpcResponse?.price).toBe(300);
    expect(grpcResponse?.name).toBe("socket");
  });

  it("should get products", async () => {
    const grpcResponse: { items: Partial<CurrentProducts>[] } =
      await new Promise((resolve, reject) => {
        ProductClient.getProducts(
          {
            ids: [product_id].map((id) => ({ id })),
          },
          (
            err: ServiceError | null,
            response: { items: Partial<CurrentProducts>[] },
          ) => {
            if (err) return reject(err);
            resolve(response);
          },
        );
      });
    const Responsemaps = grpcResponse?.items.map((item: any) => item);

    expect(Responsemaps[0]?.category_id).toBe(category_id);
    expect(Responsemaps[0]?.description).toBe("The best ever");
    expect(Responsemaps[0]?.price).toBe(300);
    expect(Responsemaps[0]?.name).toBe("socket");
  });
});
