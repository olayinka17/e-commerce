import { type Consumer } from "kafkajs";
import { Topics } from "@enterprise/kafka-common";
import { InventoryService } from "../service/inventory.js";
import { prisma } from "./prisma.js";
import type { KafkaService } from "@enterprise/kafka-common";
import { v4 as uuidv4 } from "uuid";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import InventoryError from "./InventoryError.js";

export const subscribeEvent = async (
  inventory: InventoryService,
  kafkaService: KafkaService,
) => {
  try {
    const consumer: Consumer = kafkaService.createConsumer(
      "inventory-service-consumer",
    );
    await consumer.connect();
    await consumer.subscribe({ topic: Topics.INVENTORY_RESERVE });
    await consumer.subscribe({ topic: Topics.PAYMENT_SUCCESS });
    await consumer.subscribe({ topic: Topics.INVENTORY_FAILED_RETRY });
    await consumer.subscribe({ topic: Topics.PAYMENT_FAILED });
    await consumer.subscribe({ topic: "outbox.event.products" });

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        const key: string | undefined = message.key?.toString();
        const payload = JSON.parse(message.value!.toString());
        const event_id =
          (message.headers?.event_id?.toString() as string) ?? uuidv4();
        const attempt = Number(message.headers?.retry?.toString() ?? "1");
        const max_retry = Number(message.headers?.max_retry?.toString() ?? "5");

        const outboxType: string | undefined =
          message.headers?.type?.toString();
        let lastError: string | undefined = message.headers?.error?.toString();

        const is_processed = await prisma.processed_events.findFirst({
          where: {
            event_id,
          },
        });

        if (is_processed) {
          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (Number(message.offset) + 1).toString(),
            },
          ]);
          return;
        }
        switch (topic) {
          case Topics.INVENTORY_RESERVE:
            try {
              await inventory.manageOrder(
                payload.order.id,
                payload.order.products,
                event_id,
              );
              const uuid = uuidv4();
              await kafkaService.publish(Topics.INVENTORY_RESERVED, [
                {
                  value: payload,
                  headers: {
                    event_id: uuid,
                  },
                },
              ]);
              await prisma.processed_events.create({
                data: {
                  event_id,
                  processed_at: new Date(),
                },
              });
            } catch (err: any) {
              if (err instanceof PrismaClientKnownRequestError) {
                if (err.code === "P2010") {
                  const cause = (err.meta as any)?.driverAdapterError?.cause;

                  if (cause?.code === "23514") {
                    const constraintRegex =
                      /violates check constraint "([^"]+)"/;
                    const constraintMatch =
                      cause.message.match(constraintRegex);
                    const constraintName = constraintMatch
                      ? constraintMatch[1]
                      : "Unknown Constraint";

                    const detailRegex = /Failing row contains \(([^]+)\)/;
                    const detailMatch = cause.detail?.match(detailRegex);
                    const failingRow: string = detailMatch
                      ? detailMatch[1]
                      : "Unknown Values";

                    const row: string[] = failingRow
                      .split(", ")
                      .map((v) => v.trim());
                    console.error(
                      `Database Check Failed! Constraint: [${constraintName}]. Raw Input: (${row[1]})`,
                    );

                    await kafkaService.publish(Topics.INVENTORY_FAILED, [
                      {
                        value: {
                          message: `Database Check Failed! Constraint: [${constraintName}]. Raw Input: (${row[1]})`,
                          product_id: row[1],
                        },
                        headers: {
                          event_id: uuidv4(),
                        },
                      },
                    ]);
                  }

                  await prisma.processed_events.create({
                    data: {
                      event_id,
                      processed_at: new Date(),
                    },
                  });
                }

                await consumer.commitOffsets([
                  {
                    topic,
                    partition,
                    offset: (Number(message.offset) + 1).toString(),
                  },
                ]);
                return;
              }
              if (err instanceof InventoryError) {
                await kafkaService.publish(Topics.INVENTORY_FAILED, [
                  {
                    value: {
                      message: err.message.toString(),
                    },
                    headers: {
                      event_id: uuidv4(),
                    },
                  },
                ]);
                await prisma.processed_events.create({
                  data: {
                    event_id,
                    processed_at: new Date(),
                  },
                });

                await consumer.commitOffsets([
                  {
                    topic,
                    partition,
                    offset: (Number(message.offset) + 1).toString(),
                  },
                ]);
                return;
              }
              const backoff = 1000 * Math.pow(2, attempt - 1);
              await kafkaService.publish(Topics.INVENTORY_FAILED_RETRY, [
                {
                  value: payload,
                  headers: {
                    event_id: event_id.toString(),
                    original_topic: topic.toString(),
                    retry: String(attempt + 1),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    error: err.message,
                  },
                },
              ]);
              await consumer.commitOffsets([
                {
                  topic,
                  partition,
                  offset: (Number(message.offset) + 1).toString(),
                },
              ]);
              return;
            }

            break;
          case Topics.PAYMENT_FAILED:
            try {
              await inventory.manage_errors(
                payload.order_id,
                payload.products,
                event_id,
              );
            } catch (err: any) {
              const backoff = 1000 * Math.pow(2, attempt - 1);
              await kafkaService.publish(Topics.INVENTORY_FAILED_RETRY, [
                {
                  value: payload,
                  headers: {
                    event_id: event_id.toString(),
                    original_topic: topic.toString(),
                    retry: String(attempt + 1),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    error: err.message.toString(),
                  },
                },
              ]);
            }

            // // format the error response from inventory
            // throw new CustomError(`order failed cos of ${payload}`, 403)
            break;
          case Topics.INVENTORY_FAILED_RETRY:
            const retry_at = Number(message.headers?.retry_after?.toString());

            if (Date.now() < retry_at) {
              return;
            }
            if (attempt < max_retry) {
              const backoff = 1000 * Math.pow(2, attempt - 1);
              await kafkaService.publish(
                message.headers?.original_topic?.toString() as string,
                [
                  {
                    value: payload,
                    headers: {
                      event_id: event_id.toString(),
                      retry: String(attempt + 1),
                      max_retry: max_retry.toString(),
                      retry_after: String(Date.now() + backoff),
                      type: outboxType?.toString(),
                      err: lastError?.toString(),
                    },
                    key: key?.toString(),
                  },
                ],
              );
              await consumer.commitOffsets([
                {
                  topic,
                  partition,
                  offset: (Number(message.offset) + 1).toString(),
                },
              ]);
              return;
            }

            // handle DLQ topics

            const dlePayload = {
              value: payload,
              error: lastError,
              retries_exhausted: max_retry,
              sent_at: new Date().toISOString(),
            };

            kafkaService.publish(
              `${message.headers?.original_topic?.toString()}_DLQ `,
              [{ key: payload.order.id, value: JSON.stringify(dlePayload) }],
            );

            break;
          case Topics.PAYMENT_SUCCESS:
            try {
              await inventory.manage_payment_successful(
                payload.order_id,
                payload.products,
                event_id,
              );
            } catch (err: any) {
              if (err instanceof PrismaClientKnownRequestError) {
                if (err.code === "P2010") {
                  console.dir(err.meta?.driverAdapterError, { depth: null });

                  const cause = (err.meta as any)?.driverAdapterError?.cause;

                  if (cause?.code === "23514") {
                    const constraintRegex =
                      /violates check constraint "([^"]+)"/;
                    const constraintMatch =
                      cause.message.match(constraintRegex);
                    const constraintName = constraintMatch
                      ? constraintMatch[1]
                      : "Unknown Constraint";

                    const detailRegex = /Failing row contains \(([^]+)\)/;
                    const detailMatch = cause.detail?.match(detailRegex);
                    const failingRow: string = detailMatch
                      ? detailMatch[1]
                      : "Unknown Values";

                    const row: string[] = failingRow
                      .split(", ")
                      .map((v) => v.trim());

                    console.error(
                      `Database Check Failed! Constraint: [${constraintName}]. Raw Input: (${row[1]})`,
                    );

                    // Publish to a topic to refund the payment and notify the user about the failure
                  }

                  await prisma.processed_events.create({
                    data: {
                      event_id,
                      processed_at: new Date(),
                    },
                  });
                }

                await consumer.commitOffsets([
                  {
                    topic,
                    partition,
                    offset: (Number(message.offset) + 1).toString(),
                  },
                ]);
                return;
              }
              const backoff = 1000 * Math.pow(2, attempt - 1);
              console.log(err.message.toString());
              await kafkaService.publish(Topics.INVENTORY_FAILED_RETRY, [
                {
                  value: payload,
                  headers: {
                    event_id: event_id.toString(),
                    original_topic: topic.toString(),
                    retry: String(attempt + 1),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    error: err.message.toString(),
                  },
                },
              ]);
            }
            break;
          case "outbox.event.products":
            const product_id: string = payload.product_id;
            try {
              if (outboxType === "PRODUCT_ARCHIVE") {
                await inventory.manage_delete_product(product_id, event_id);
              } else if (outboxType === "PRODUCT_UNARCHIVE") {
                await inventory.unachive_product(product_id, event_id);
              } else if (outboxType === "PRODUCT_CREATE") {
                await inventory.createInventory(product_id, event_id);
              }
            } catch (err: any) {
              const backoff = 1000 * Math.pow(2, attempt + 1);
              await kafkaService.publish(Topics.INVENTORY_FAILED_RETRY, [
                {
                  value: payload,
                  headers: {
                    event_id: key,
                    original_topic: topic.toString(),
                    retry: String(attempt),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    type: outboxType?.toString(),
                    error: err.message,
                  },
                  key,
                },
              ]);
            }
            break;
          default:
            break;
        }

        await consumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() },
        ]);
      },
    });
  } catch (error: any) {
    console.log(`event handler err ${error}`);
  }
};
