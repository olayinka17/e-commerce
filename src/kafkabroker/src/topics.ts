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
  ORDER_FAILED_RETRY: "order.failed.retry",
  PAYMENT_PROCESS_DLQ: "payment.process_DLQ",
  INVENTORY_RESERVE_DLQ: "inventory.reserve_DLQ",
  PAYMENT_FAILED_DLQ: "payment.failed_DLQ",
  PAYMENT_SUCCESS_DLQ: "payment.success_DLQ",
  OUTBOX_EVENT_EMAIL_DLQ: "outbox.event.email_DLQ",
  OUTBOX_EVENT_PRODUCTS_DLQ: "outbox.event.products_DLQ",
} as const;

export const TOPIC_CONFIGS = [
  {
    topic: Topics.ORDER_CREATED,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_RESERVE,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_RESERVED,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_FAILURE,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_FAILED,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_FAILED_RETRY,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.ORDER_FAILED_RETRY,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.PAYMENT_FAILED,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.PAYMENT_FAILURE,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.PAYMENT_PROCESS,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.PAYMENT_SUCCESS,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.PAYMENT_SUCCESSFUL,
    numPartitions: 3,
    replicationFactor: 3,
  },
  {
    topic: Topics.INVENTORY_RESERVE_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
  {
    topic: Topics.OUTBOX_EVENT_EMAIL_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
  {
    topic: Topics.OUTBOX_EVENT_PRODUCTS_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
  {
    topic: Topics.PAYMENT_FAILED_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
  {
    topic: Topics.PAYMENT_PROCESS_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
  {
    topic: Topics.PAYMENT_SUCCESS_DLQ,
    numPartitions: 2,
    replicationFactor: 2,
  },
];

export type Topic = (typeof Topics)[keyof typeof Topics];
