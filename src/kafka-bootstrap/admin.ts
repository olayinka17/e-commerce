// import { Kafka, type Admin } from "kafkajs";

// class KafkaAdmin {
//   private admin: Admin;

//   constructor() {
//     const kafka = new Kafka({
//       clientId: "admin-app",
//       brokers: [
//         "localhost:9092",
//         "localhost:9093",
//         "localhost:9094",
//         "localhost:9095",
//       ],
//     });

//     this.admin = kafka.admin();
//   }

//   async connect() {
//     await this.admin.connect()
//   }

//   async disconnect() {
//     await this.admin.disconnect()
//   }

//   async createTopics() {
//     await this.admin.createTopics({
//         topics
//     })
//   }
// }
