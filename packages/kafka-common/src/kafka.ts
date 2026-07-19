import {Kafka, logLevel, type Producer, type Consumer} from "kafkajs"

// const kafka = new Kafka({
//     clientId: "my-app",
//     brokers: [
//         "localhost:9092",
//         "localhost:9093",
//         "localhost:9094",
//         "localhost:9095",
//     ]
// })
export interface KafkaConfig {
  clientId: string;
  brokers: string[];
}

export class KafkaService {
    private kafka: Kafka
    private producer: Producer
    private consumer: Consumer | null

    constructor(config: KafkaConfig) {
        this.kafka = new Kafka({
            clientId: config.clientId,
            brokers: config.brokers,
            logLevel: logLevel.NOTHING
        })
        this.producer = this.kafka.producer()
        this.consumer = null;
    }

    async connect() {
        await this.producer.connect()
    }

    async disconnect() {
        await this.producer.disconnect()
    }

    
    async publish(topic: string, messages: Array<{ value: any, headers?: any, key?: any}>) {
        //console.log(JSON.stringify(messages, null, 2));
        
        
        const formattedMessages = messages.map(msg => ({
            ...msg,
            value: JSON.stringify(msg.value),
            headers: msg.headers
        }))
        //console.log(formattedMessages)
        await this.producer.send({
            topic,
            messages: formattedMessages
        })
    }

    createConsumer(groupId: string): Consumer {
        return this.consumer = this.kafka.consumer({ groupId})
    }

    async disconnectConsumer() {
        await this.consumer!.stop()
        await this.consumer!.disconnect()
    }
}