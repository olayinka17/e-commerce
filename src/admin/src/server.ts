import app from "./app.js";
import "dotenv/config";
import { boostrap } from "./utils/bootstrap.js";
// import { KafkaService } from "@enterprise/kafka-common";
// const kafkaService = new KafkaService("admin-service");

// await kafkaService.connect();


// export default kafkaService;

await boostrap()

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
