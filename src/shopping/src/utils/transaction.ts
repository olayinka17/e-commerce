import { prisma } from "./prisma.js";
import { Decimal } from "@prisma/client/runtime/index-browser";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { retry_function } from "../utils/retry.js";
import type { transaction_status } from "../generated/prisma/enums.js";
import type { Transactions } from "../generated/prisma/client.js";
import { acquireLock, release_lock } from "./lock.js";
import { invalidateCacheByPattern } from "./invalidateCache.js";
import { createHash, createHmac } from "node:crypto";
import { redis } from "./redis.js";
import { Redis } from "ioredis";
import { Topics } from "@enterprise/kafka-common";

interface TransactionI {
  id: string;
  status: transaction_status;
}
interface Order_productsI {
  id: string;
  product_id: string;
  quantity: number;
  price: Decimal;
  order_id: string;
}
interface OrderI {
  id: string;
  user_id: string;
  status: string;
  products?: Order_productsI[];
  transaction?: TransactionI[] | null;
  payment_status: string;
  total_price: Decimal;
  created_at: Date;
}

type paystackEvent =
  | "charge.success"
  | "charge.failed"
  | "transfer.failed"
  | "transfer.success"
  | "transfer.reversed";
interface ResponseI<T = any> {
  event: paystackEvent;
  data: T;
}

function should_retry_payment(err: any) {
  if (err.request) {
    return true;
  }
  return false;
}

const paystack_request = async (data: object, headers: object) => {
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    data,
    { headers },
  );

  return response;
};

const verify_request = async (reference: string, headers: object) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers },
  );
  return response;
};
const retry = await retry_function(
  paystack_request,
  should_retry_payment,
  1,
  2,
  3,
  2,
  [1, 300],
  [503, 429, 500],
  ["ECONNABORTED", "ECONNRESET", "ENOTFOUND", "ETIMEOUT"],
);

const retry_verify = await retry_function(
  verify_request,
  should_retry_payment,
  1,
  2,
  3,
  2,
  [1, 300],
  [503, 429, 500],
  ["ECONNABORTED", "ECONNRESET", "ENOTFOUND", "ETIMEOUT"],
);

export const payment = async (
  order: OrderI,
  email: string,
  correlation_id: string,
  event_id: string,
) => {
  let transaction: Partial<Transactions> | null = null;
  const headers = {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  };

  const publisher = new Redis({
    host: "localhost",
    port: 6379,
  });
  const channelName = `order_payment_url:${correlation_id}`;

  if (order.transaction?.length === 0) {
    transaction = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transactions.create({
        data: {
          amount: order.total_price,
          order_id: order.id,
        },
      });

      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });

      return transaction;
    });
    await invalidateCacheByPattern(`transactions:admin:*`);
  } else {
    const key = `lock:${order.id}`;
    const token = uuidv4();
    await acquireLock(key, token, 5, 6);

    const last_transaction = await prisma.transactions.findMany({
      where: {
        order_id: order.id,
      },
      orderBy: { created_at: "desc" },
      take: 1,
    });

    if (last_transaction[0]?.status === "successful") {
      await publisher.publish(
        channelName,
        JSON.stringify({
          is_successful: "your last transaction was successful",
        }),
      );
      await release_lock(key, token);

      await prisma.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
      return;
    } else if (
      last_transaction[0]?.status === "failed" ||
      last_transaction[0]?.status === "cancelled"
    ) {
      transaction = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transactions.create({
          data: {
            amount: order.total_price,
            order_id: order.id,
          },
        });

        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
        return transaction;
      });
      await invalidateCacheByPattern(`transactions:admin:*`);
      await release_lock(key, token);
    } else if (last_transaction[0]?.status === "pending") {
      // verify the transaction status with the payment gateway first before making the same  transaction to them
      // if the transaction get to the gateway then set the status to idempotency cache and update the order and transaction status the return
      try {
        const verify = await retry_verify(last_transaction[0]?.id, headers);

        if (
          verify.data.data.status === "ongoing" ||
          verify.data.data.status === "pending"
        ) {
          await publisher.publish(
            channelName,
            JSON.stringify({
              is_ongoing: "Kindly complete the ongoing transaction",
            }),
          );
          await release_lock(key, token);
          await prisma.processed_events.create({
            data: {
              event_id,
              processed_at: new Date(),
            },
          });
          return;
        } else if (verify.data.data.status === "success") {
          //wait for webhook to complete
          await publisher.publish(
            channelName,
            JSON.stringify({
              is_successful: "your last transaction was successful",
            }),
          );
          await release_lock(key, token);
          await prisma.processed_events.create({
            data: {
              event_id,
              processed_at: new Date(),
            },
          });
          return;
        } else if (verify.data.data.status === "abandoned") {
          transaction = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`
             SELECT * FROM "Transactions"
             WHERE id = ${last_transaction[0]?.id}
             FOR UPDATE
           `;

            const is_order_pending = await tx.orders.findFirst({
              where: {
                id: order.id,
                status: "pending",
              },
            });

            if (!is_order_pending) {
              await tx.orders.update({
                where: {
                  id: order.id,
                },
                data: {
                  status: "pending",
                  payment_status: "pending",
                },
              });
            }
            await tx.transactions.update({
              where: {
                id: last_transaction[0]?.id as string,
              },
              data: {
                status: "cancelled",
              },
            });

            const transaction = await tx.transactions.create({
              data: {
                amount: order.total_price,
                order_id: order.id,
              },
            });

            await tx.processed_events.create({
              data: {
                event_id,
                processed_at: new Date(),
              },
            });
            return transaction;
          });
          await invalidateCacheByPattern(`transactions:admin:*`);
          await release_lock(key, token);
        } else if (verify.data.data.status === "failed") {
          transaction = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`
             SELECT * FROM "Transactions"
             WHERE id = ${last_transaction[0]?.id}
             FOR UPDATE
           `;

            const is_order_pending = await tx.orders.findFirst({
              where: {
                id: order.id,
                status: "pending",
              },
            });

            if (!is_order_pending) {
              await tx.orders.update({
                where: {
                  id: order.id,
                },
                data: {
                  status: "pending",
                  payment_status: "pending",
                },
              });
            }
            await tx.transactions.update({
              where: {
                id: last_transaction[0]?.id as string,
              },
              data: {
                status: "failed",
              },
            });

            const transaction = await tx.transactions.create({
              data: {
                amount: order.total_price,
                order_id: order.id,
              },
            });

            await tx.processed_events.create({
              data: {
                event_id,
                processed_at: new Date(),
              },
            });
            return transaction;
          });
          await invalidateCacheByPattern(`transactions:admin:*`);
          await release_lock(key, token);
        }
      } catch (error: any) {
        console.log("error", error);
        if (error.response?.status === 400) {
          console.log("ooo");
          transaction = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`
              SELECT * FROM "Transactions"
              WHERE id = ${last_transaction[0]?.id} 
              FOR UPDATE
            `;
            await tx.transactions.update({
              where: {
                id: last_transaction[0]?.id as string,
              },
              data: {
                status: "cancelled",
              },
            });
            const transaction = await tx.transactions.create({
              data: {
                amount: order.total_price,
                order_id: order.id,
              },
            });
            await tx.processed_events.create({
              data: {
                event_id,
                processed_at: new Date(),
              },
            });
            return transaction;
          });
          await invalidateCacheByPattern(`transactions:admin:*`);
          await release_lock(key, token);
        }
      }
    }
  }

  const data = {
    amount: (transaction?.amount as unknown as number) * 100,
    email,
    reference: transaction?.id,
  };
  const response = await retry(data, headers);

  const paymentUrl = response.data.data.authorization_url;

  await prisma.orders.update({
    where: {
      id: order.id,
    },
    data: {
      payment_url: paymentUrl,
    },
  });

  await publisher.publish(channelName, JSON.stringify({ paymentUrl }));
};

export const paystackWebhook = async (body: ResponseI, signature: string) => {
  const hash = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
    .update(JSON.stringify(body))
    .digest("hex");

  if (hash !== signature) {
    return;
  }
  const transaction = await prisma.transactions.findUnique({
    where: {
      id: body.data.reference,
      status: "pending",
    },
  });

  if (!transaction) {
    return;
  }

  let idempotency_key: string;
  if (body.event === "charge.success" || body.event === "transfer.success") {
    const order = await prisma.orders.findUnique({
      where: {
        id: transaction?.order_id as string,
      },
      include: {
        products: true,
      },
    });

    const cartItems = order?.products?.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price.toNumber(),
    }));

    idempotency_key = createHash("sha256")
      .update(order!.user_id)
      .update(JSON.stringify(cartItems))
      .update(order!.total_price.toString())
      .digest("hex");

    if (order) {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const updatedorder = await tx.orders.update({
          where: {
            id: order.id,
          },
          data: {
            payment_status: "successful",
            status: "successful",
          },
        });

        await tx.transactions.update({
          where: {
            id: transaction?.id as string,
          },
          data: {
            status: "successful",
          },
        });
        await tx.cart_Items.deleteMany({
          where: {
            cart: {
              user_id: order.user_id,
            },
          },
        });

        // outbox pattern to send message to orchestrator
        await tx.paymentOutox.create({
          data: {
            aggregatetype: "payments",
            aggregateid: transaction.id,
            eventtype: Topics.PAYMENT_SUCCESSFUL,
            payload: {
              order_id: order.id,
              products: order.products,
            },
          },
        });

        return updatedorder;
      });
      const redisKey: string = `orders:user${order.user_id}:*`;
      await invalidateCacheByPattern(redisKey);
      await invalidateCacheByPattern(`transactions:admin:*`);
      await invalidateCacheByPattern(`orders:admin:*`);
      const idemKey: string = `shopping-service:idemkey:${idempotency_key}`;
      await redis.hset(idemKey, {
        order_id: order.id,
        amount: order.total_price.toString(),
        status: updatedOrder.status,
      });
    }
  }
  if (
    body.event === "charge.failed" ||
    body.event === "transfer.failed" ||
    body.event === "transfer.reversed"
  ) {
    const order = await prisma.orders.findUnique({
      where: {
        id: transaction.order_id as string,
      },
      include: {
        products: true,
      },
    });

    idempotency_key = createHash("sha256")
      .update(order!.user_id)
      .update(JSON.stringify(order?.products))
      .update(order!.total_price.toString())
      .digest("hex");

    if (order) {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.orders.update({
          where: {
            id: order.id,
          },
          data: {
            payment_status: "unsuccessful",
            status: "failed",
          },
        });
        await tx.transactions.update({
          where: {
            id: transaction.id,
          },
          data: {
            status: "failed",
          },
        });

        //outbox event for payment failed to orchestrator
        await tx.paymentOutox.create({
          data: {
            aggregatetype: "payments",
            aggregateid: transaction.id,
            eventtype: Topics.PAYMENT_FAILURE,
            payload: {
              order_id: order.id,
              products: order.products,
            },
          },
        });
        return updatedOrder;
      });
      const redisKey: string = `orders:user${order.user_id}:*`;
      await invalidateCacheByPattern(redisKey);
      await invalidateCacheByPattern(`transactions:admin:*`);
      await invalidateCacheByPattern(`orders:admin:*`);
      const idemKey: string = `shopping-service:idemkey:${idempotency_key}`;
      await redis.hset(idemKey, {
        order_id: order.id,
        amount: order.total_price.toString(),
        status: updatedOrder.status,
      });
    }

    return;
  }
};
