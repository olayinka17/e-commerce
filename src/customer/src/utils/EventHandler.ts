import { type Consumer } from "kafkajs";
import kafkaService from "../server.js";
import { prisma } from "./prisma.js";
import { sendWelcome } from "./email.js";

export const subscribeEvent = async () => {
  try {
  } catch (err: any) {
    console.log("err:", err);
  }
  const consumer: Consumer = kafkaService.createConsumer("email-service");
  await consumer.connect();
  await consumer.subscribe({ topic: "outbox.event.email" });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = JSON.parse(message.value!.toString());
      const key = message.key!.toString();
      const attempt = Number(message.headers?.retry?.toString() ?? "0");
      const max_retry = Number(message.headers?.max_retry?.toString() ?? "5");
      const outboxType = message.headers?.type?.toString();
      let lastError: string | undefined = message.headers?.error?.toString();
      const is_processed = await prisma.processed_events.findFirst({
        where: {
          event_id: key,
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
        case "outbox.event.email":
          try {
            await sendWelcome(value.payload?.email);
          } catch (err: any) {
            const backoff = 1000 * Math.pow(2, attempt + 1);
            await kafkaService.publish("email_failed_retry", [
              {
                value,
                headers: {
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
        case "email_failed_retry":
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
                  value: value,
                  headers: {
                    retry: String(attempt + 1),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    type: outboxType,
                    error: lastError?.toString(),
                  },

                  key,
                },
              ],
            );
          }

          const dlePayload = {
            value: value,
            error: lastError,
            retries_exhausted: max_retry,
            sent_at: new Date().toISOString(),
          };

          kafkaService.publish(
            `${message.headers?.original_topic?.toString()}_DLQ `,
            [{ key, value: JSON.stringify(dlePayload) }],
          );
          break;
        default:
          break;
      }
      await consumer.commitOffsets([
        { topic, partition, offset: (Number(message.offset) + 1).toString() },
      ]);
    },
  });
};
