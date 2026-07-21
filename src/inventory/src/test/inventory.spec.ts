import { execSync } from "child_process";
import path from "path";
import { Network } from "testcontainers";
import type { ServiceError } from "@grpc/grpc-js";
import { KafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import { Topics } from "@enterprise/kafka-common";
import { v4 as uuidv4 } from "uuid";
import { startServer, stopServer } from "../server.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";

export interface ResponseI {
  success: boolean;
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

const Topic_config = [
  "outbox.event.products",
  Topics.INVENTORY_FAILED,
  Topics.INVENTORY_FAILED_RETRY,
  Topics.INVENTORY_RESERVE,
  Topics.INVENTORY_RESERVED,
  Topics.PAYMENT_FAILED,
  Topics.PAYMENT_SUCCESS,
];
const PROTO_PATH = path.join(process.cwd(), "src/inventory.proto");
const packageDef = protoloader.loadSync(PROTO_PATH, {
  longs: String,
  keepCase: true,
});

const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

const inventoryPackage = grpcObject.inventoryPackage;

describe("inventory test", () => {
  let network: any;
  let postgresqlContainer: any;
  let kafkaContainer: any;
  let kafkaClient: Kafka;
  let producer: Producer;
  let prisma: PrismaClient;
  let first_order_id: string;
  let second_order_id: string;

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
        .withDatabase("inventory")
        .withUsername("postgres")
        .withPassword("password")
        .start();

      const dynamicDbUrl = `postgresql://postgres:password@${postgresqlContainer.getHost()}:${postgresqlContainer.getMappedPort(5432)}/inventory`;
      process.env.DATABASE_URL = dynamicDbUrl;
      console.log("pushing Prisma schema to test container...");
      console.log(process.env.DATABASE_URL);
      execSync("npx prisma db push", {
        env: {
          ...process.env,
        },
        stdio: "inherit",
      });
      console.log("Prisma schema synchronized successfully");

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

      const prismaModule = await import("../util/prisma.js");
      prisma = prismaModule.prisma;

      first_order_id = uuidv4();
      second_order_id = uuidv4();

      await startServer(false);
      await new Promise((resolve) => setTimeout(resolve, 100000));
    },
    50 * 60 * 1000,
  );

  afterAll(
    async () => {
      if (producer) await producer.disconnect();
      if (kafkaContainer) await kafkaContainer.stop();
      if (postgresqlContainer) await postgresqlContainer.stop();
      await prisma.inventory.deleteMany();
      await prisma.inventory_reservation.deleteMany();
      await prisma.inventory_movement.deleteMany();
      await prisma.$disconnect();
      await network.stop();
      await stopServer();
    },
    50 * 60 * 1000,
  );

  it("should process product created outbox event", async () => {
    const product_id = uuidv4();
    await producer.send({
      topic: "outbox.event.products",
      messages: [
        {
          key: product_id,
          value: JSON.stringify({ product_id }),
          headers: { type: "PRODUCT_CREATE" },
        },
      ],
    });
    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id },
        });

        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(0);
        expect(new_inventory?.reserved_quantity).toBe(0);
        expect(new_inventory?.is_active).toBe(true);
        expect(new_inventory?.product_id).toBe(product_id);
      },
      5000,
      200,
    );
  }, 10000);

  it("should add more stock to the inventory", async () => {
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const client = new inventoryPackage.Inventory(
      "localhost:40100",
      grpc.credentials.createInsecure(),
    );

    const grpcResponse: ResponseI = await new Promise((resolve, reject) => {
      client.addMoreStock(
        {
          product_id: inventory[0]?.product_id as string,
          quantity: 4,
          reference_type: "purcha123",
          reference_id: uuidv4(),
          type: "purchase",
        },
        (err: ServiceError | null, response: ResponseI) => {
          if (err) {
            return reject(err);
          }
          console.log(response);

          resolve(response);
        },
      );
    });

    expect(grpcResponse.success).toBe(true);

    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: inventory[0]?.product_id as string },
        });

        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.product_id).toBe(
          inventory[0]?.product_id as string,
        );
        expect(new_inventory?.available_quantity).toBe(4);
        expect(new_inventory?.physical_stock).toBe(4);
        expect(new_inventory?.reserved_quantity).toBe(0);
      },
      5000,
      200,
    );
  });

  it("should process inventory reserve events", async () => {
    const consumer: Consumer = kafkaClient.consumer({
      groupId: `inventory-service-test?${Date.now()}`,
    });
    await consumer.connect();

    await consumer.subscribe({
      topic: Topics.INVENTORY_RESERVED,
      fromBeginning: true,
    });
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const order = {
      id: first_order_id,
      products: [
        {
          product_id: inventory[0]?.product_id,
          quantity: inventory[0]?.available_quantity,
        },
      ],
    };
    const correlation_id = uuidv4();
    const event_id = uuidv4();
    await producer.send({
      topic: "inventory.reserve",
      messages: [
        {
          value: JSON.stringify({
            order,
            email: "ola@email.com",
            correlation_id,
          }),
          headers: { event_id },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
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
        const reservation = await prisma.inventory_reservation.findFirst({
          where: { product_id: order.products[0]?.product_id as string },
        });
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: order.products[0]?.product_id as string },
        });

        const processed = await prisma.processed_events.findFirst({
          where: { event_id },
        });

        expect(reservation).toBeTruthy();
        expect(reservation?.order_id).toBe(order.id);
        expect(reservation?.product_id).toBe(order.products[0]?.product_id);
        expect(reservation?.status).toBe("pending");
        expect(reservation?.quantity).toBe(new_inventory?.reserved_quantity);

        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(
          inventory[0]?.physical_stock,
        );
        expect(new_inventory?.reserved_quantity).toBe(
          inventory[0]?.available_quantity as number,
        );
        expect(new_inventory?.is_active).toBe(true);
        expect(new_inventory?.product_id).toBe(
          order.products[0]?.product_id as string,
        );

        expect(processed).toBeTruthy();
        expect(processed?.event_id).toBe(event_id);
        expect(processed).toHaveProperty("event_id");

        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toEqual({
          order,
          email: "ola@email.com",
          correlation_id,
        });
        expect(receivedKafkaHeaders.length).toBe(1);
      },
      5000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 10000);

  it("should process product archived outbox event", async () => {
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });
    await producer.send({
      topic: "outbox.event.products",
      messages: [
        {
          key: inventory[0]?.product_id as string,
          value: JSON.stringify({
            product_id: inventory[0]?.product_id as string,
          }),
          headers: { type: "PRODUCT_ARCHIVE" },
        },
      ],
    });

    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: {
            product_id: inventory[0]?.product_id as string,
            is_active: true,
          },
        });

        expect(new_inventory).toBeFalsy();
      },
      5000,
      200,
    );
  }, 10000);

  it("should return  inventory failed events because it has been archived", async () => {
    const consumer: Consumer = kafkaClient.consumer({
      groupId: `inventory-service-test:${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.INVENTORY_FAILED,
      fromBeginning: true,
    });
    const inventory = await prisma.inventory.findFirst({
      where: { is_active: false },
    });

    const correlation_id = uuidv4();
    const event_id = uuidv4();
    const order_id = uuidv4();
    const order = {
      id: order_id,
      products: [
        {
          product_id: inventory?.product_id,
          quantity: inventory?.reserved_quantity,
        },
      ],
    };
    await producer.send({
      topic: "inventory.reserve",
      messages: [
        {
          value: JSON.stringify({
            order,
            email: "ola@email.com",
            correlation_id,
          }),
          headers: { event_id },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
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
        const reservation = await prisma.inventory_reservation.findFirst({
          where: {
            product_id: order.products[0]?.product_id as string,
            order_id,
          },
        });
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: order.products[0]?.product_id as string },
        });

        const processed = await prisma.processed_events.findFirst({
          where: { event_id },
        });

        expect(reservation).toBeFalsy();
        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(4);
        expect(new_inventory?.reserved_quantity).toBe(4);
        expect(new_inventory?.is_active).toBe(false);
        expect(new_inventory?.product_id).toBe(
          order.products[0]?.product_id as string,
        );

        expect(processed).toBeTruthy();
        expect(processed?.event_id).toBe(event_id);
        expect(processed).toHaveProperty("event_id");

        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toEqual({
          message: "Product state changed since you last added to cart",
        });
        expect(receivedKafkaHeaders.length).toBe(1);
      },
      15000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 18000);

  it("should process product unarchived outbox event", async () => {
    const inventory = await prisma.inventory.findMany({
      where: { is_active: false },
    });
    await producer.send({
      topic: "outbox.event.products",
      messages: [
        {
          key: inventory[0]?.product_id as string,
          value: JSON.stringify({
            product_id: inventory[0]?.product_id as string,
          }),
          headers: { type: "PRODUCT_UNARCHIVE" },
        },
      ],
    });
    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: inventory[0]?.product_id as string },
        });

        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(4);
        expect(new_inventory?.reserved_quantity).toBe(4);
        expect(new_inventory?.archived_quantity).toBe(0);
        expect(new_inventory?.is_active).toBe(true);
        expect(new_inventory?.product_id).toBe(
          inventory[0]?.product_id as string,
        );
      },
      5000,
      200,
    );
  }, 10000);

  it("should failed the database constraint because available quantity is zero", async () => {
    const consumer: Consumer = kafkaClient.consumer({
      groupId: `inventory-service-test|:${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.INVENTORY_FAILED,
      fromBeginning: true,
    });

    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const correlation_id = uuidv4();
    const event_id = uuidv4();
    const order = {
      id: uuidv4(),
      products: [
        {
          product_id: inventory[0]?.product_id,
          quantity: 4,
        },
      ],
    };
    await producer.send({
      topic: "inventory.reserve",
      messages: [
        {
          value: JSON.stringify({
            order,
            email: "ola@email.com",
            correlation_id,
          }),
          headers: { event_id },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
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
        const reservation = await prisma.inventory_reservation.findFirst({
          where: {
            product_id: order.products[0]?.product_id as string,
            order_id: order.id,
          },
        });
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: order.products[0]?.product_id as string },
        });

        const processed = await prisma.processed_events.findFirst({
          where: { event_id },
        });

        expect(reservation).toBeFalsy();
        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(4);
        expect(new_inventory?.reserved_quantity).toBe(4);
        expect(new_inventory?.is_active).toBe(true);
        expect(new_inventory?.product_id).toBe(
          order.products[0]?.product_id as string,
        );

        expect(processed).toBeTruthy();
        expect(processed?.event_id).toBe(event_id);
        expect(processed).toHaveProperty("event_id");

        expect(receivedKafkaMessages.length).toBe(2);
        expect(receivedKafkaMessages[1]).toEqual({
          message: `Database Check Failed! Constraint: [chk_available_quantity_positive]. Raw Input: (${order.products[0]?.product_id as string})`,
          product_id: order.products[0]?.product_id as string,
        });
        expect(receivedKafkaHeaders.length).toBe(2);
      },
      50000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 55000);

  it("should process payment failed event", async () => {
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const order = {
      id: first_order_id,
      products: [
        {
          product_id: inventory[0]?.product_id,
          quantity: inventory[0]?.reserved_quantity,
        },
      ],
    };
    const event_id = uuidv4();
    await producer.send({
      topic: Topics.PAYMENT_FAILED,
      messages: [
        {
          value: JSON.stringify({
            order_id: order.id,
            products: order.products,
          }),
          headers: { event_id },
        },
      ],
    });
    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: inventory[0]?.product_id as string },
        });

        const reservation = await prisma.inventory_reservation.findFirst({
          where: { order_id: first_order_id, status: "cancelled" },
        });

        expect(new_inventory?.available_quantity).toBe(
          inventory[0]?.reserved_quantity as number,
        );
        expect(new_inventory?.reserved_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(
          inventory[0]?.physical_stock,
        );
        expect(reservation).toBeTruthy();
      },
      5000,
      200,
    );
  }, 10000);

  it("should process inventory reserve events", async () => {
    const consumer: Consumer = kafkaClient.consumer({
      groupId: `inventory-service-test${Date.now()}`,
    });
    await consumer.connect();

    await consumer.subscribe({ topic: Topics.INVENTORY_RESERVED });
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const order = {
      id: second_order_id,
      products: [
        {
          product_id: inventory[0]?.product_id,
          quantity: inventory[0]?.available_quantity,
        },
      ],
    };
    const correlation_id = uuidv4();
    const event_id = uuidv4();
    await producer.send({
      topic: "inventory.reserve",
      messages: [
        {
          value: JSON.stringify({
            order,
            email: "ola@email.com",
            correlation_id,
          }),
          headers: { event_id },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
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
        const reservation = await prisma.inventory_reservation.findFirst({
          where: {
            product_id: order.products[0]?.product_id as string,
            order_id: second_order_id,
          },
        });
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: order.products[0]?.product_id as string },
        });

        const processed = await prisma.processed_events.findFirst({
          where: { event_id },
        });

        expect(reservation).toBeTruthy();
        expect(reservation?.order_id).toBe(order.id);
        expect(reservation?.product_id).toBe(order.products[0]?.product_id);
        expect(reservation?.status).toBe("pending");
        expect(reservation?.quantity).toBe(new_inventory?.reserved_quantity);

        expect(new_inventory).toBeTruthy();
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(
          inventory[0]?.physical_stock,
        );
        expect(new_inventory?.reserved_quantity).toBe(
          inventory[0]?.available_quantity as number,
        );
        expect(new_inventory?.is_active).toBe(true);
        expect(new_inventory?.product_id).toBe(
          order.products[0]?.product_id as string,
        );

        expect(processed).toBeTruthy();
        expect(processed?.event_id).toBe(event_id);
        expect(processed).toHaveProperty("event_id");

        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toEqual({
          order,
          email: "ola@email.com",
          correlation_id,
        });
        expect(receivedKafkaHeaders.length).toBe(1);
      },
      10000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 15000);

  it("should processed payment succesful event", async () => {
    const inventory = await prisma.inventory.findMany({
      where: { is_active: true },
    });

    const order = {
      id: second_order_id,
      products: [
        {
          product_id: inventory[0]?.product_id,
          quantity: inventory[0]?.reserved_quantity,
        },
      ],
    };
    const event_id = uuidv4();
    await producer.send({
      topic: Topics.PAYMENT_SUCCESS,
      messages: [
        {
          value: JSON.stringify({
            order_id: order.id,
            products: order.products,
          }),
          headers: { event_id },
        },
      ],
    });
    await waitForExpect(
      async () => {
        const new_inventory = await prisma.inventory.findFirst({
          where: { product_id: inventory[0]?.product_id as string },
        });

        const reservation = await prisma.inventory_reservation.findFirst({
          where: { order_id: second_order_id, status: "confirmed" },
        });

        expect(new_inventory?.reserved_quantity).toBe(0);
        expect(new_inventory?.available_quantity).toBe(0);
        expect(new_inventory?.physical_stock).toBe(0);
        expect(reservation).toBeTruthy();
      },
      5000,
      200,
    );
  }, 10000);
});
