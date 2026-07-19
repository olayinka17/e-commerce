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
};
export declare const TOPIC_CONFIGS: ({
    topic: "order.created";
    numPartitions: number;
    replicationFactor: number;
} | {
    topic: "inventory.reserve";
    numPartitions: number;
    replicationFactor: number;
})[];
export type Topic = typeof Topics[keyof typeof Topics];
//# sourceMappingURL=Topic.d.ts.map