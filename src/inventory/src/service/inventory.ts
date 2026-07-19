import { prisma } from "../util/prisma.js";
import type { ServerUnaryCall } from "@grpc/grpc-js";
import { movement_types } from "../generated/prisma/enums.js";
import InventoryError from "../util/InventoryError.js";
import {
  Prisma,
  type Inventory,
  type Inventory_reservation,
} from "../generated/prisma/client.js";

interface params {
  product_id: string;
  quantity: number;
  reference_type: string;
  reference_id: string;
  type: movement_types;
}

interface response {
  success: boolean;
}
interface InventoryI {
  product_id: string;
  available_quantity: number;
  reserved_quantity: number;
  physical_stock: number;
}
interface Cart_itemsI {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

export class InventoryService {
  private prisma;

  constructor() {
    this.prisma = prisma;
  }

  // change it to transaction so you can add inventory_movement for the product
  async createInventory(product_id: string, event_id: string) {
    return await this.prisma.$transaction(async (tx) => {
      await tx.inventory.create({
        data: {
          product_id,
          available_quantity: 0,
          reserved_quantity: 0,
          physical_stock: 0,
          archived_quantity: 0,
        },
      });

      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
    });
  }

  async manageOrder(order_id: string, items: Cart_itemsI[], event_id: string) {
    const sortedItems = [...items].sort((a, b) =>
      String(a.product_id).localeCompare(String(b.product_id)),
    );
    const productIds = sortedItems.map((item) => item.product_id);
    console.log(productIds);
    // console.log(typeof productIds[0]);
    // console.log(items);
    return await this.prisma.$transaction(async (tx) => {
      const existingReservation: Inventory_reservation[] | [] =
        await tx.$queryRaw<Inventory_reservation[] | []>`
      SELECT * FROM "Inventory_reservation"
      WHERE order_id = ${order_id}
      FOR UPDATE
      `;


      if (existingReservation.length > 0) {
        if (existingReservation[0]?.status === "confirmed") return;
        if (
          existingReservation[0]?.status === "expired" ||
          existingReservation[0]?.status === "cancelled"
        ) {
          await tx.$queryRaw`
          SELECT *
          FROM "Inventory"
          WHERE product_id IN (${Prisma.join(productIds)})
          FOR UPDATE
          `;
          
          const values = Prisma.join(
            sortedItems.map(
              (item) =>
                Prisma.sql`(${item.product_id}, ${Number(item.quantity)})`,
            ),
          );
          const updated = await tx.$queryRaw<{ product_id: string }[]>`
          UPDATE "Inventory" AS i
          SET 
            reserved_quantity = i.reserved_quantity + v.quantity::int,
            available_quantity = i.available_quantity - v.quantity::int
          FROM (
            VALUES
              ${values}
          ) AS v(product_id, quantity)
          WHERE i.product_id = v.product_id AND i.is_active = true
          RETURNING i.product_id;
          `;

          if (updated.length !== items.length) {
            throw new InventoryError(
              "Product state changed since you last added to cart",
            );
          }
         
          console.log("let");
          await tx.inventory_reservation.updateMany({
            where: {
              order_id,
            },
            data: {
              status: "pending",
              expires_at: Date.now() + 10 * 60 * 1000,
            },
          });
        }
      } else {
        await tx.$queryRaw`
        SELECT * FROM "Inventory"
        WHERE product_id IN (${Prisma.join(productIds)})
        FOR UPDATE
        `;


        const values = Prisma.join(
          sortedItems.map(
            (item) => Prisma.sql`(${item.product_id}, ${item.quantity})`,
          ),
        );
        const updated = await tx.$queryRaw<{ product_id: string }[]>`
          UPDATE "Inventory" AS i
          SET 
            reserved_quantit = i.reserved_quantity + v.quantity::int,
            available_quantity = i.available_quantity - v.quantity::int
          FROM (
            VALUES
              ${values}
          ) AS v(product_id, quantity)
          WHERE i.product_id = v.product_id AND i.is_active = true
          RETURNING i.product_id
          ;
          `;
        
        

        if (updated.length !== items.length) {
          throw new InventoryError(
            "Product state changed since you last added to cart",
          );
        }
        await tx.inventory_reservation.createMany({
          data: sortedItems.map((item) => ({
            product_id: item.product_id,
            order_id,
            expires_at: Date.now() + 10 * 60 * 1000,
            quantity: item.quantity,
          })),
        });
      }
      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
      return;
    });
  }

  async manage_payment_successful(
    order_id: string,
    items: Cart_itemsI[],
    event_id: string,
  ) {
    const sortedItems = [...items].sort((a, b) =>
      String(a.product_id).localeCompare(String(b.product_id)),
    );
    const productIds = sortedItems.map((item) => item.product_id);
    await this.prisma.$transaction(async (tx) => {
      const reservations: Inventory_reservation[] = await tx.$queryRaw`
      SELECT * FROM "Inventory_reservation"
      WHERE order_id = ${order_id}
      FOR UPDATE
      `;
      if (reservations.length === 0) return;
      if (
        reservations[0]?.status === "confirmed" ||
        reservations[0]?.status === "cancelled"
      )
        return;
      if (reservations[0]?.status === "expired") {
        await tx.$queryRaw`
        SELECT *
        FROM "Inventory"
        WHERE product_id IN (${Prisma.join(productIds)})
        FOR UPDATE
        `;

        const values = Prisma.join(
          sortedItems.map(
            (item) => Prisma.sql`(${item.product_id}, ${item.quantity})`,
          ),
        );
        await tx.$executeRaw`
          UPDATE "Inventory" AS i
          SET 
            physical_stock = i.physical_stock - v.quantity::int,
            available_quantity = i.available_quantity - v.quantity::int
          FROM (
            VALUES
              ${values}
          ) AS v(product_id, quantity)
          WHERE i.product_id = v.product_id;
          `;

        await tx.inventory_reservation.updateMany({
          where: {
            order_id,
          },
          data: {
            status: "confirmed",
            expires_at: Date.now(),
          },
        });

        await tx.inventory_movement.createMany({
          data: sortedItems.map((item) => ({
            product_id: item.product_id,
            type: "sale",
            quantity: item.quantity,
            reference_type: "order",
            reference_id: order_id,
          })),
        });
        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
      } else {
        const values = Prisma.join(
          sortedItems.map(
            (item) => Prisma.sql`(${item.product_id}, ${item.quantity})`,
          ),
        );
        await tx.$executeRaw`
          UPDATE "Inventory" AS i
          SET 
            reserved_quantity = i.reserved_quantity - v.quantity::int,
            physical_stock = i.physical_stock - v.quantity::int
          FROM (
            VALUES
              ${values}
          ) AS v(product_id, quantity)
          WHERE i.product_id = v.product_id;
          `;

        await tx.inventory_reservation.updateMany({
          where: {
            order_id,
          },
          data: {
            status: "confirmed",
          },
        });
        await tx.inventory_movement.createMany({
          data: sortedItems.map((item) => ({
            product_id: item.product_id,
            type: "sale",
            quantity: item.quantity,
            reference_type: "order",
            reference_id: order_id,
          })),
        });
        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
      }
    });
  }

  async manage_errors(
    order_id: string,
    items: Cart_itemsI[],
    event_id: string,
  ) {
    const sortedItems = [...items].sort((a, b) =>
      String(a.product_id).localeCompare(String(b.product_id)),
    );
    const productIds = sortedItems.map((item) => item.product_id);
    return await this.prisma.$transaction(async (tx) => {
      const reservations: Inventory_reservation[] = await tx.$queryRaw`
      SELECT * FROM "Inventory_reservation"
      WHERE order_id = ${order_id}
      FOR UPDATE
      `;

      if (reservations.length === 0) return;

      if (reservations[0]?.status !== "pending") return;

      await tx.$queryRaw`
        SELECT *
        FROM "Inventory"
        WHERE product_id IN (${Prisma.join(productIds)})
        FOR UPDATE
        `;

      const values = Prisma.join(
        sortedItems.map(
          (item) => Prisma.sql`(${item.product_id}, ${item.quantity})`,
        ),
      );
      await tx.$executeRaw`
          UPDATE "Inventory" AS i
          SET 
            reserved_quantity = i.reserved_quantity - v.quantity::int,
            available_quantity = CASE 
              WHEN i.is_active
              THEN i.available_quantity + v.quantity::int
              ELSE i.available_quantity
            END,
            archived_quantity = CASE
              WHEN NOT i.is_active
              THEN i.archived_quantity + v.quantity::int
              ELSE i.archived_quantity
            END
          FROM (
            VALUES
              ${values}
          ) AS v(product_id, quantity)
          WHERE i.product_id = v.product_id ;
          `;

      await tx.inventory_reservation.updateMany({
        where: {
          order_id,
        },
        data: {
          status: "cancelled",
        },
      });

      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
    });
  }

  async create_inventory_movement(
    product_id: string,
    type: movement_types,
    qty: number,
    reference_type: string,
    reference_id: string,
  ) {
    const movement = this.prisma.inventory_movement.create({
      data: {
        product_id,
        type,
        quantity: qty,
        reference_type,
        reference_id,
      },
    });

    return movement;
  }


  async manage_inventory(
    product_id: string,
    qty: number,
    reference_type: string,
    reference_id: string,
    type: movement_types,
    is_remove = false,
  ) {
    if (is_remove) {
      await this.prisma.$transaction(async (tx) => {
        // check if there is enough stock to deduct
        
        await tx.inventory.update({
          where: { product_id },
          data: {
            available_quantity: {
              decrement: qty,
            },
            physical_stock: {
              decrement: qty,
            },
          },
        });

        await tx.inventory_movement.create({
          data: {
            product_id,
            type,
            reference_id,
            reference_type,
            quantity: qty,
          },
        });
      });
      return {
        success: true,
      };
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { product_id },
          data: {
            available_quantity: {
              increment: qty,
            },
            physical_stock: {
              increment: qty,
            },
          },
        });

        await tx.inventory_movement.create({
          data: {
            product_id,
            type,
            reference_type,
            reference_id,
            quantity: qty,
          },
        });
      });
      return { success: true };
    }
  }

  async manage_delete_product(product_id: string, event_id: string) {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.$queryRaw<Inventory[]>`
      SELECT * FROM "Inventory"
      WHERE product_id = ${product_id}
      FOR UPDATE`;
      console.log(inventory)

      if (!inventory[0]?.is_active) {
        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
        return;
      }

      if (inventory[0]?.available_quantity === 0) {
        const ine = await tx.inventory.update({
          where: { product_id },
          data: {
            is_active: false,
          },
        });
        console.log(ine)

        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
        return;
      }

      const new_ine = await tx.inventory.update({
        where: { product_id },
        data: {
          is_active: false,
          archived_quantity: {
            increment: inventory[0]?.available_quantity as number,
          },
          available_quantity: 0,
        },
      });

      console.log(new_ine)
      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
    });
  }
  async unachive_product(product_id: string, event_id: string) {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.$queryRaw<Inventory[]>`
      SELECT * 
      FROM "Inventory"
      WHERE product_id = ${product_id}
      FOR UPDATE;
      `;
      if (inventory[0]?.archived_quantity !== 0) {
        await tx.inventory.update({
          where: {
            product_id,
          },
          data: {
            is_active: true,
            available_quantity: {
              increment: inventory[0]?.archived_quantity as number,
            },
            archived_quantity: {
              decrement: inventory[0]?.archived_quantity as number,
            },
          },
        });
        await tx.processed_events.create({
          data: {
            event_id,
            processed_at: new Date(),
          },
        });
        return;
      }
      await tx.inventory.update({
        where: {
          product_id,
        },
        data: {
          is_active: true,
        },
      });

      await tx.processed_events.create({
        data: {
          event_id,
          processed_at: new Date(),
        },
      });
    });
  }

  async add_more_stock(call: ServerUnaryCall<params, response>) {
    const data = this.manage_inventory(
      call.request.product_id,
      call.request.quantity,
      call.request.reference_type,
      call.request.reference_id,
      call.request.type,
    );
    return data;
  }

  async remove_from_stock(
    product_id: string,
    qty: number,
    reference_type: string,
    reference_id: string,
    type: movement_types,
  ) {
    const data = this.manage_inventory(
      product_id,
      qty,
      reference_type,
      reference_id,
      type,
    );

    return data;
  }
}
