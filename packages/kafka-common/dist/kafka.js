import { Kafka, logLevel } from "kafkajs";
export class KafkaService {
    kafka;
    producer;
    consumer;
    constructor(kafkaconfig) {
        this.kafka = new Kafka({
            clientId: kafkaconfig.clientId,
            brokers: kafkaconfig.brokers,
            logLevel: logLevel.NOTHING,
        });
        this.producer = this.kafka.producer();
        this.consumer = null;
    }
    async connect() {
        await this.producer.connect();
    }
    async disconnect() {
        await this.producer.disconnect();
    }
    async publish(topic, messages) {
        const formattedMessages = messages.map((msg) => ({
            ...msg,
            value: JSON.stringify(msg.value),
            headers: msg.headers,
        }));
        await this.producer.send({
            topic,
            messages: formattedMessages,
        });
    }
    createConsumer(groupId) {
        return (this.consumer = this.kafka.consumer({ groupId }));
    }
    async disconnectConsumer() {
        await this.consumer.stop();
        await this.consumer.disconnect();
    }
}
//# sourceMappingURL=kafka.js.map