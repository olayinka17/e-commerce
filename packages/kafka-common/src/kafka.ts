import { Kafka, logLevel, type Producer, type Consumer } from "kafkajs";

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
}

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer | null;

  constructor(kafkaconfig: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: kafkaconfig.clientId,
      brokers: kafkaconfig.brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer();
    this.consumer = null;
  }

  async connect() {
    await this.producer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
  }

  async publish(
    topic: string,
    messages: Array<{ value: any; headers?: any; key?: any }>,
  ) {
    const formattedMessages = messages.map((msg) => ({
      ...msg,
      value: JSON.stringify(msg.value),
      headers: msg.headers,
    }));
    await this.producer.send({
      topic,
      messages: formattedMessages,
    });
  }

  createConsumer(groupId: string): Consumer {
    return (this.consumer = this.kafka.consumer({ groupId }));
  }

  async disconnectConsumer() {
    await this.consumer!.stop();
    await this.consumer!.disconnect();
  }
}
