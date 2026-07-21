import "dotenv/config";
import { KafkaService } from "@enterprise/kafka-common";

export const kafkaService = new KafkaService({
  clientId: "shopping-service",
  brokers: process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(",")
    : [],
});
