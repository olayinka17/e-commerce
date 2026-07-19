import { prisma } from "./prisma.js";
import type { Inventory } from "../generated/prisma/client.js";
import schedule from "node-schedule";
export const reservation_job = async () => {
  const expiredReservations = await prisma.inventory_reservation.findMany({
    where: {
      status: "pending",
      expires_at: {
        lte: Date.now(),
      },
    },
  });

  for (const reservation of expiredReservations) {
    try {
      await prisma.$transaction(async (tx) => {
        const inventory = await tx.$queryRaw<Inventory>`
        SELECT *
        FROM "Inventory"
        WHERE id = ${reservation.product_id}
        FOR UPDATE 
        `;
        const lockResult = await tx.inventory_reservation.updateMany({
          where: {
            id: reservation.id,
            status: "pending",
          },
          data: {
            status: "expired_processing",
          },
        });

        if (lockResult.count === 0) {
          return;
        }

        if (inventory.is_active) {
          await tx.inventory.update({
            where: {
              product_id: reservation.product_id,
            },
            data: {
              available_quantity: {
                increment: reservation.quantity,
              },
              reserved_quantity: {
                decrement: reservation.quantity,
              },
            },
          });

          await tx.inventory_reservation.update({
            where: {
              id: reservation.id,
            },
            data: {
              status: "expired",
            },
          });
        } else {
          await tx.inventory.update({
            where: {
              product_id: reservation.product_id,
            },
            data: {
              archived_quantity: {
                increment: reservation.quantity,
              },
              reserved_quantity: {
                decrement: reservation.quantity,
              },
            },
          });

          await tx.inventory_reservation.update({
            where: {
              id: reservation.id,
            },
            data: {
              status: "expired",
            },
          });
        }
      });
    } catch (err) {
      console.error(`Failed to process reservation ${reservation.id}:`, err);
    }
  }
};

schedule.scheduleJob("* * * * *", () => {
  reservation_job();
});
