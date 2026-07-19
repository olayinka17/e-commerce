import { KafkaService } from "@enterprise/kafka-common";
import { type Consumer } from "kafkajs";
import { Topics } from "@enterprise/kafka-common";

export const subscribeEvent = async (kafkaService: KafkaService) => {
  const consumer: Consumer = kafkaService.createConsumer(
    "orchestrator-service",
  );
  await consumer.connect();
  await consumer.subscribe({ topic: Topics.ORDER_CREATED });
  await consumer.subscribe({ topic: Topics.INVENTORY_RESERVED });
  await consumer.subscribe({ topic: Topics.PAYMENT_SUCCESSFUL });
  await consumer.subscribe({ topic: Topics.INVENTORY_FAILURE });
  await consumer.subscribe({ topic: Topics.PAYMENT_FAILURE });
  await consumer.subscribe({ topic: "outbox.event.payments" });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      console.log(topic)
      console.log(message.headers)
      switch (topic) {
        case Topics.ORDER_CREATED:
          console.log("topic")
          kafkaService.publish(Topics.INVENTORY_RESERVE, [
            {
              value: JSON.parse(message.value!.toString()),
              headers: message.headers,
            },
          ]);
          break;
        case Topics.INVENTORY_RESERVED:
          kafkaService.publish(Topics.PAYMENT_PROCESS, [
            {
               value: JSON.parse(message.value!.toString()),
              headers: message.headers,
            },
          ]);
          break;
        case Topics.PAYMENT_SUCCESSFUL:
          kafkaService.publish(Topics.PAYMENT_SUCCESS, [
            {
               value: JSON.parse(message.value!.toString()),
              headers: message.headers,
            },
          ]);
          break;
        case Topics.INVENTORY_FAILURE:
          kafkaService.publish(Topics.INVENTORY_FAILED, [
            {
               value: JSON.parse(message.value!.toString()),
              headers: message.headers,
            },
          ]);
          break;
        case Topics.PAYMENT_FAILURE:
          kafkaService.publish(Topics.PAYMENT_FAILED, [
            {
               value: JSON.parse(message.value!.toString()),
              headers: message.headers,
            },
          ]);
          break;
        case "outbox.event.payments":
          const outboxType = message.headers?.type?.toString();
          const key = message.key!.toString();

          if (outboxType === Topics.PAYMENT_SUCCESSFUL) {
            kafkaService.publish(Topics.PAYMENT_SUCCESS, [
              {
                value: JSON.parse(message.value!.toString()),
                headers: {
                  event_id: key,
                },
              },
            ]);
          } else if (outboxType === Topics.PAYMENT_FAILURE) {
            kafkaService.publish(Topics.PAYMENT_FAILED, [
              {
                value: JSON.parse(message.value!.toString()),
                headers: { event_id: key },
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
};
