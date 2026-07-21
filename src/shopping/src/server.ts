import app from "./app.js";
import "./utils/background-job.js";
import "dotenv/config";
import { kafkaService } from "./utils/kafka.js";
import { startGrpcServer } from "./grpc/grpc-server.js";
import { bootstrap } from "./utils/bootstrap.js";

await kafkaService.connect();

await bootstrap();
await startGrpcServer();

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
