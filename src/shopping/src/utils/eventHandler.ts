import { type Consumer } from "kafkajs";
import { kafkaService } from "../utils/kafka.js";
import { prisma } from "./prisma.js";
import { Topics } from "@enterprise/kafka-common";
import { ShoppingService } from "../service/shopping.js";


export const subscribeEvent = async (shopping: ShoppingService) => {
  try {
    const consumer: Consumer = kafkaService.createConsumer("shopping-service");
    await consumer.connect();
    await consumer.subscribe({ topic: Topics.PAYMENT_PROCESS });
    await consumer.subscribe({ topic: Topics.INVENTORY_FAILED });
    await consumer.subscribe({ topic: Topics.ORDER_FAILED_RETRY });
    

    await consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        const payload = JSON.parse(message.value!.toString());
        const event_id = message.headers?.event_id?.toString() as string;
        const attempt = Number(message.headers?.retry?.toString() ?? "0");
        const max_retry = Number(message.headers?.max_retry?.toString() ?? "5");
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
        console.log(`Processing event ${event_id} for topic ${topic}`);
        switch (topic) {
          case Topics.PAYMENT_PROCESS:
            try {
              await shopping.payment_service(
                payload.order,
                payload.email,
                payload.correlation_id,
                event_id,
              );
            } catch (err: any) {
              const backoff = 1000 * Math.pow(2, attempt + 1);
              await kafkaService.publish(Topics.ORDER_FAILED_RETRY, [
                {
                  value: payload,
                  headers: {
                    event_id: event_id.toString(),
                    original_topic: topic.toString(),
                    retry: String(attempt),
                    max_retry: max_retry.toString(),
                    retry_after: String(Date.now() + backoff),
                    error: err.toString(),
                  },
                },
              ]);
            }
            break;
          case Topics.INVENTORY_FAILED:
            // format the error response from inventory
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (Number(message.offset) + 1).toString(),
              },
            ]);
            console.log(`${payload.message} for ${payload.product_id}`)
          // throw new CustomError(
          //   `${payload.message} for ${payload.product_id}`,
          //   403,
          // );
          break;
          case Topics.ORDER_FAILED_RETRY:
            const retry_at = Number(message.headers?.retry_after?.toString());

            if (Date.now() < retry_at) {
              console.log(Date.now())
              return;
            }

            if (attempt >= max_retry) {
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
                      err: lastError?.toString()
                    },
                  },
                ],
              );
            }

            //DLQ

              const dlePayload = {
              value: payload,
              error: lastError,
              retries_exhausted: max_retry,
              sent_at: new Date().toISOString(),
            };

            console.log(`${message.headers?.original_topic?.toString()}_DLQ`)
            await kafkaService.publish(
              `${message.headers?.original_topic?.toString()}_DLQ`,
              [{ key: payload.order.id, value: dlePayload }],
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
  } catch (error: any) {
    console.log(`event handler err ${error}`)
    //error thrown from the stock not enough
    if (error.statuscode === 403) {
      //send the error to the user as push notification 
      console.log(error.message)
    }
  }
};
