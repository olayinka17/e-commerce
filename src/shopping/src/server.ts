import app from "./app.js";
import "./utils/background-job.js"
import "dotenv/config";
import { kafkaService } from "./utils/kafka.js"
import { startGrpcclient } from "./grpc/grpc-client.js";
import { startGrpcServer } from "./grpc/grpc-server.js";


await kafkaService.connect();

export const client = await startGrpcclient();
await startGrpcServer();





const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
