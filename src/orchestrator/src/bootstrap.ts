import { KafkaService } from "@enterprise/kafka-common";
import { subscribeEvent } from "./subscriber.js";

let kafkaService: KafkaService;

export async function bootstrap() {
  kafkaService = new KafkaService({
    clientId: "orchestrator-service",
    brokers: process.env.KAFKA_BROKERS
      ? process.env.KAFKA_BROKERS.split(",")
      : [],
  });

  await kafkaService.connect();
  await subscribeEvent(kafkaService).catch(async(error) => {
    await kafkaService.disconnect();
    await kafkaService.disconnectConsumer();
    console.error("Error subscribing to events:", error);
  });
}

export async function shutdown() {
  await kafkaService.disconnect();
  await kafkaService.disconnectConsumer();
  console.log("Kafka service disconnected. Shutting down...");
 // process.exit(0);
}
// await subscribeEvent(kafkaService).catch((error) => {
//   kafkaService.disconnect();
//   console.error("Error subscribing to events:", error);
// });
