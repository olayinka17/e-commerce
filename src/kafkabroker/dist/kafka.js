// import {Kafka, type Producer, type Consumer} from "kafkajs"
export {};
// const kafka = new Kafka({
//     clientId: "my-app",
//     brokers: [
//         "localhost:9092",
//         "localhost:9093",
//         "localhost:9094",
//         "localhost:9095",
//     ]
// })
// export class KafkaService {
//     private kafka: Kafka
//     private producer: Producer
//     constructor(clientId: string) {
//         this.kafka = new Kafka({
//             clientId,
//             brokers: [
//                 "localhost:9092",
//                 "localhost:9093",
//                 "localhost:9094",
//                 "localhost:9095",
//             ]
//         })
//         this.producer = this.kafka.producer()
//     }
//     async connect() {
//         await this.producer.connect()
//     }
//     async disconnect() {
//         await this.producer.disconnect()
//     }
//     async publish(topic: string, message: unknown) {
//         await this.producer.send({
//             topic,
//             messages: [
//                 {
//                     value: JSON.stringify(message),
//                 }
//             ]
//         })
//     }
//     createConsumer(groupId: string): Consumer {
//         return this.kafka.consumer({ groupId})
//     }
// }
//# sourceMappingURL=kafka.js.map