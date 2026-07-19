import { Kafka } from "kafkajs";
import { TOPIC_CONFIGS } from "./topics.js";
const kafka = new Kafka({
    clientId: "admin-app",
    brokers: [
        "localhost:9092",
        "localhost:9093",
        "localhost:9094",
        "localhost:9095",
    ],
});
// export const createKafka = (clientId) => {
//   new Kafka({
//     clientId,
//     brokers: [
//       "localhost:9092",
//       "localhost:9093",
//       "localhost:9094",
//       "localhost:9095",
//     ],
//   });
// };
class KafkaAdmin {
    admin;
    constructor() {
        const kafka = new Kafka({
            clientId: "admin-app",
            brokers: [
                "localhost:9092",
                "localhost:9093",
                "localhost:9094",
                "localhost:9095",
            ],
        });
        this.admin = kafka.admin();
    }
    async connect() {
        await this.admin.connect();
    }
    async disconnect() {
        await this.admin.disconnect();
    }
    async createTopics() {
        await this.admin.createTopics({
            topics: TOPIC_CONFIGS,
        });
    }
}
const kafkaAdmin = new KafkaAdmin();
await kafkaAdmin.connect();
await kafkaAdmin.createTopics().catch(console.error);
await kafkaAdmin.disconnect();
//# sourceMappingURL=admin.js.map