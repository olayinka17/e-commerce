import { KafkaService } from "@enterprise/kafka-common";
import { subscribeEvent } from "./subscriber.js";
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log("UNCAUGHT EXCEPTION. Shutting down...");
  process.exit(1);
});
const kafkaService = new KafkaService("orchestrator-service");

await kafkaService.connect();


await subscribeEvent(kafkaService).catch((error) => {
  kafkaService.disconnect()
  console.error("Error subscribing to events:", error);
  
});
process.on("unhandledRejection", (err: any) => {
  console.log(err.name, err.message);
  console.log("UNHANDLED REJECTION. Shutting down...");
  kafkaService.disconnect();
  process.exit(1)
});
