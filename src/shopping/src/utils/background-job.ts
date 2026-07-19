import { prisma } from "./prisma.js";
import axios from "axios";
import schedule from "node-schedule";
import { retry_function } from "./retry.js";

function should_retry_payment(err: any) {
  if (err.request) {
    return true;
  }
  return false;
}

const verify_request = async (reference: string, headers: object) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers },
  );
  return response;
};

const retry_verify = await retry_function(
  verify_request,
  should_retry_payment,
  4,
  2,
  30,
  2,
  [1, 300],
  [503, 429, 500],
  ["ECONNABORTED", "ECONNRESET", "ENOTFOUND", "ETIMEOUT"],
);
export const transaction_job = async () => {
  const headers = {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  };
  const pendingTransactions = await prisma.transactions.findMany({
    where: {
      status: "pending",
      created_at: {
        lte: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
    },
  });

  for (const transaction of pendingTransactions) {
    try {
      const verify = await retry_verify(transaction.id, headers);
      if (
        verify.data.data.status === "ongoing" ||
        verify.data.data.status === "pending"
      ) {
        continue;
      } else if (verify.data.data.status === "success") {
        await prisma.$transaction(async (tx) => {
          await tx.transactions.update({
            where: {
              id: transaction.id,
            },
            data: {
              status: "successful",
            },
          });

          await tx.orders.update({
            where: {
              id: transaction.order_id,
            },
            data: {
              status: "successful",
              payment_status: "successful",
            },
          });
        });
      } else if (verify.data.data.status === "failed") {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
          SELECT * FROM "Transactions"
          WHERE id = ${transaction.id}
          FOR UPDATE
          `;

          const is_still_pending = await tx.transactions.findFirst({
            where: {
              id: transaction.id,
              status: "pending",
            },
          });

          if (!is_still_pending) {
            return;
          }
          await tx.transactions.update({
            where: {
              id: transaction.id,
            },
            data: {
              status: "cancelled",
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

          await tx.orders.update({
            where: {
              id: transaction.order_id,
            },
            data: {
              status: "failed",
              payment_status: "unsuccessful",
            },
          });
        });
      } else if (verify.data.data.status === "abandoned") {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
          SELECT * FROM "Transactions"
          WHERE id = ${transaction.id}
          FOR UPDATE
          `;

          const is_still_pending = await tx.transactions.findFirst({
            where: {
              id: transaction.id,
              status: "pending",
            },
          });

          if (!is_still_pending) {
            return;
          }
          await tx.transactions.update({
            where: {
              id: transaction.id,
            },
            data: {
              status: "cancelled",
            },
          });

          await tx.orders.update({
            where: {
              id: transaction.order_id,
            },
            data: {
              status: "cancelled",
              payment_status: "cancelled",
            },
          });
        });
      }
    } catch (err: any) {
      if (err.response.status === 400) {
        await prisma.$transaction(async (tx) => {
          await tx.transactions.update({
            where: {
              id: transaction.id,
            },
            data: {
              status: "cancelled",
            },
          });

          await tx.orders.update({
            where: {
              id: transaction.order_id,
            },
            data: {
              status: "cancelled",
              payment_status: "cancelled",
            },
          });
        });
      }
      console.log("error", err);
    }
  }
};

schedule.scheduleJob("*/30 * * * *", () => {
  transaction_job();
});
