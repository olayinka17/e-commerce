import { execSync } from "child_process";
import { KafkaContainer } from "@testcontainers/kafka";
import { Kafka, logLevel, type Producer } from "kafkajs";
import { Topics } from "@enterprise/kafka-common";
import { v4 as uuidv4 } from "uuid";
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
  Topics.ORDER_CREATED,
  Topics.INVENTORY_RESERVED,
  Topics.PAYMENT_SUCCESSFUL,
  Topics.INVENTORY_FAILURE,
  Topics.PAYMENT_FAILURE,
  "outbox.event.payments",
  Topics.INVENTORY_RESERVE,
  Topics.PAYMENT_PROCESS,
  Topics.PAYMENT_SUCCESS,
  Topics.INVENTORY_FAILED,
  Topics.PAYMENT_FAILED,
];

describe("orchestrator", () => {
  let kafkaContainer: any;
  let kafkaClient: Kafka;
  let producer: Producer;
  let bootstrap: any;
  beforeAll(async () => {
    kafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:7.8.0")
      .withKraft()
      .withNetworkAliases("kafka-broker")
      .start();

    const kafkaPort = kafkaContainer.getMappedPort(9093);
    const kafkaHost = kafkaContainer.getHost();
    const kafkaName = kafkaContainer.getName();

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
    bootstrap = await import("../bootstrap.js");
    await bootstrap.bootstrap()
    await new Promise((resolve) => setTimeout(resolve, 50000));
  }, 120000);

  afterAll(async () => {
    await bootstrap
    if (kafkaContainer) await kafkaContainer.stop();
    if (bootstrap) await bootstrap.shutdown()

  }, 80000);

  it("should process order created events", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.INVENTORY_RESERVE,
      fromBeginning: true,
    });

    await producer.send({
      topic: Topics.ORDER_CREATED,
      messages: [
        {
          value: JSON.stringify({ product_id: "i know" }),
          headers: { event_id: "okay" },
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
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(1);
        expect(receivedKafkaHeaders[0]).toEqual("okay");
      },
      9000,
      200,
    );

    await consumer.stop();
    await consumer.disconnect();
  }, 20000);

  it("should process inventory reserved events", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:%5&${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.PAYMENT_PROCESS,
      fromBeginning: true,
    });

    await producer.send({
      topic: Topics.INVENTORY_RESERVED,
      messages: [
        {
          value: JSON.stringify({ product_id: "i know" }),
          headers: { event_id: "okay" },
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
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(1);
        expect(receivedKafkaHeaders[0]).toEqual("okay");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);

  it("should process payment successful events", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:&gteh-${uuidv4()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.PAYMENT_SUCCESS,
      fromBeginning: true,
    });

    await producer.send({
      topic: Topics.PAYMENT_SUCCESSFUL,
      messages: [
        {
          value: JSON.stringify({ product_id: "i know oka" }),
          headers: { event_id: "okay" },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        // console.log(message.value!.toString())
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaHeaders.push(
          message.headers?.event_id?.toString() as string,
        );
      },
    });

    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(1);
        expect(receivedKafkaHeaders[0]).toEqual("okay");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);
  it("should process inventory failure events", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:&@${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.INVENTORY_FAILED,
      fromBeginning: true,
    });

    await producer.send({
      topic: Topics.INVENTORY_FAILURE,
      messages: [
        {
          value: JSON.stringify({ product_id: "i know" }),
          headers: { event_id: "okay" },
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
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(1);
        expect(receivedKafkaHeaders[0]).toEqual("okay");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);

  it("should process payment failure events", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:%=${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.PAYMENT_FAILED,
      fromBeginning: true,
    });

    await producer.send({
      topic: Topics.PAYMENT_FAILURE,
      messages: [
        {
          value: JSON.stringify({ product_id: "i know" }),
          headers: { event_id: "okay" },
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
        expect(receivedKafkaMessages.length).toBe(1);
        expect(receivedKafkaMessages[0]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(1);
        expect(receivedKafkaHeaders[0]).toEqual("okay");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);

  it("should process outbox events for payment sucessful", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:%$3!~~3${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.PAYMENT_SUCCESS,
      fromBeginning: true,
    });

    await producer.send({
      topic: "outbox.event.payments",
      messages: [
        {
          key: "12345678",
          value: JSON.stringify({ product_id: "i know you" }),
          headers: { type: Topics.PAYMENT_SUCCESSFUL },
        },
      ],
    });

    const receivedKafkaMessages: Record<string, string>[] = [];
    const receivedKafkaHeaders: string[] = [];

    await consumer.run({
      eachMessage: async ({ message }) => {
        // console.log(message.value!.toString())
        receivedKafkaMessages.push(JSON.parse(message.value!.toString()));
        receivedKafkaHeaders.push(
          message.headers?.event_id?.toString() as string,
        );
      },
    });

    await waitForExpect(
      async () => {
        expect(receivedKafkaMessages.length).toBe(2);
        expect(receivedKafkaMessages[1]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(2);
        expect(receivedKafkaHeaders[1]).toEqual("12345678");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);
  it("should process outbox events for payment failure", async () => {
    const consumer = kafkaClient.consumer({
      groupId: `orchestrator-service-test:&7876$=-${Date.now()}`,
    });
    await consumer.connect();
    await consumer.subscribe({
      topic: Topics.PAYMENT_FAILED,
      fromBeginning: true,
    });

    await producer.send({
      topic: "outbox.event.payments",
      messages: [
        {
          key: "12345678",
          value: JSON.stringify({ product_id: "i know" }),
          headers: { type: Topics.PAYMENT_FAILURE },
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
        expect(receivedKafkaMessages.length).toBe(2);
        expect(receivedKafkaMessages[1]).toHaveProperty("product_id");
        expect(receivedKafkaHeaders.length).toBe(2);
        expect(receivedKafkaHeaders[1]).toEqual("12345678");
      },
      7000,
      200,
    );
    await consumer.stop();
    await consumer.disconnect();
  }, 20000);
});
