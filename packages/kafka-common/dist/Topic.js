export const Topics = {
    ORDER_CREATED: "order.created",
    INVENTORY_RESERVE: "inventory.reserve",
    INVENTORY_RESERVED: "inventory.reserved",
    INVENTORY_FAILED: "inventory.failed",
    INVENTORY_FAILURE: "inventory.failure",
    PAYMENT_PROCESS: "payment.process",
    PAYMENT_SUCCESS: "payment.success",
    PAYMENT_SUCCESSFUL: "payment.successful",
    PAYMENT_FAILURE: "payment.failure",
    PAYMENT_FAILED: "payment.failed",
    INVENTORY_FAILED_RETRY: "inventory.failed.retry",
    ORDER_FAILED_RETRY: "order.failed.retry"
};
export const TOPIC_CONFIGS = [
    {
        topic: Topics.ORDER_CREATED,
        numPartitions: 3,
        replicationFactor: 3
    },
    {
        topic: Topics.INVENTORY_RESERVE,
        numPartitions: 3,
        replicationFactor: 3
    }
];
//# sourceMappingURL=Topic.js.map