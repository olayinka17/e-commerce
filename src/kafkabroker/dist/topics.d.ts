export declare const Topics: {
    readonly ORDER_CREATED: "order.created";
    readonly INVENTORY_RESERVE: "inventory.reserve";
    readonly INVENTORY_RESERVED: "inventory.reserved";
    readonly INVENTORY_FAILED: "inventory.failed";
    readonly INVENTORY_FAILURE: "inventory.failure";
    readonly PAYMENT_PROCESS: "payment.process";
    readonly PAYMENT_SUCCESS: "payment.success";
    readonly PAYMENT_SUCCESSFUL: "payment.successful";
    readonly PAYMENT_FAILURE: "payment.failure";
    readonly PAYMENT_FAILED: "payment.failed";
    readonly INVENTORY_FAILED_RETRY: "inventory.failed.retry";
    readonly ORDER_FAILED_RETRY: "order.failed.retry";
    readonly PAYMENT_PROCESS_DLQ: "payment.process_DLQ";
    readonly INVENTORY_RESERVE_DLQ: "inventory.reserve_DLQ";
    readonly PAYMENT_FAILED_DLQ: "payment.failed_DLQ";
    readonly PAYMENT_SUCCESS_DLQ: "payment.success_DLQ";
    readonly OUTBOX_EVENT_EMAIL_DLQ: "outbox.event.email_DLQ";
    readonly OUTBOX_EVENT_PRODUCTS_DLQ: "outbox.event.products_DLQ";
};
export declare const TOPIC_CONFIGS: ({
    topic: "order.created";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.reserve";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.reserved";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.failure";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.failed";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.failed.retry";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "order.failed.retry";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.failed";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.failure";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.process";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.success";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.successful";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.reserve_DLQ";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "outbox.event.email_DLQ";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "outbox.event.products_DLQ";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.failed_DLQ";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.process_DLQ";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "payment.success_DLQ";
    numPartitions: number;
    replicationFactor: number;
})[];
export type Topic = (typeof Topics)[keyof typeof Topics];
//# sourceMappingURL=topics.d.ts.map