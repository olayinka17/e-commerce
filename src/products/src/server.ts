import app from "./app.js";
import "dotenv/config";
import { KafkaService } from "@enterprise/kafka-common";
import { startGrpcServer } from "./grpc/grpc-server.js";


await startGrpcServer();

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

