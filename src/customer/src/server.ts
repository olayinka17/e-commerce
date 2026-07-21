import app from "./app.js";
import "dotenv/config";
import { KafkaService } from "@enterprise/kafka-common";

const kafkaService = new KafkaService({
  clientId: "customer-service",
  brokers: process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(",")
    : [],
});

await kafkaService.connect();

export default kafkaService;

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
