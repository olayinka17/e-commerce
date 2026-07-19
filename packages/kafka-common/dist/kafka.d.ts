import { type Consumer } from "kafkajs";
export interface KafkaConfig {
    clientId: string;
    brokers: string[];
}
export declare class KafkaService {
    private kafka;
    private producer;
    private consumer;
    constructor(config: KafkaConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(topic: string, messages: Array<{
        value: any;
        headers?: any;
        key?: any;
    }>): Promise<void>;
    createConsumer(groupId: string): Consumer;
    disconnectConsumer(): Promise<void>;
}
//# sourceMappingURL=kafka.d.ts.map