import type { ServiceError } from "@grpc/grpc-js";
import type { Decimal } from "../generated/prisma/internal/prismaNamespace.js";
import { client, InventoryClient, ProductClient } from "../utils/bootstrap.js";
import type { ProductI } from "../service/admin.js";
import CustomError from "./CustomError.js";

export interface PaginateI {
  limit?: number;
  beforeTimestamp?: number;
  status?: string;
}

export interface OrderI {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_price: Decimal;
  created_at: string;
}

export interface OrdersI {
  orders: OrderI[];
  nextCursor: number | null;
}

export interface now_toI {
  now: Date;
  to: Date;
}

export interface RevenueI {
  total_amount: number;
}

export interface TransactionI {
  id: string;
  created_at: string;
  amount: Decimal;
  order_id: string;
  status: string;
  update_at: string;
}
export interface TransactionsI {
  transactions: TransactionI[];
  nextCursor: number | null;
}

export interface ProductsI extends ProductI {
  created_at: string;
  updated_at: string;
}

export interface ProductUI extends ProductI {
  product_id: string;
}

export interface ResponseI {
  success: boolean;
}
export interface CategoryResI {
  id: string;
  name: string;
  description: string;
}

export function totalOrders(
  limit?: number,
  beforeTimestamp?: string,
  status?: string,
): Promise<{ orders: OrderI[], nextCursor: string | null } | null> {
  console.log(limit, beforeTimestamp, status)
  return new Promise((resolve, reject) => {
    client.totalOrders(
      {
        limit,
        beforeTimestamp,
        status,
      },
      (
        err: ServiceError | null,
        response: { orders: OrderI[], nextCursor: string | null } | null,
      ) => {
        if (err) {
          console.log(err)
          return reject(err);
        }

        console.log("response from grpc", response);
        resolve(response);
      },
    );
  });
}

export function totalRevenue({ now, to }: now_toI): Promise<RevenueI | null> {
  return new Promise((resolve, reject) => {
    client.totalRevenue(
      {
        now,
        to,
      },
      (err: ServiceError | null, response: RevenueI | null) => {
        if (err) {
          return reject(err);
        }

        resolve(response);
      },
    );
  });
}

export function recentTransactions(
  limit?: number,
  beforeTimestamp?: string,
  status?: string,
): Promise<{ transactions: TransactionI[], nextCursor: string | null } | null> {
  return new Promise((resolve, reject) => {
    client.recentTransactions(
      {
        limit,
        beforeTimestamp,
        status,
      },
      (
        err: ServiceError | null,
        response: {
          transactions: TransactionI[];
          nextCursor: string | null;
        } | null,
      ) => {
        if (err) {
          reject(err);
        }

        resolve(response);
      },
    );
  });
}

export function createProducts({
  name,
  category_id,
  description,
  price,
  sku,
}: ProductI): Promise<ProductsI> {
  console.log(price);
  return new Promise((resolve, reject) => {
    ProductClient.createProducts(
      {
        name,
        category_id,
        description,
        price,
        sku,
      },
      (err: ServiceError | null, response: ProductsI) => {
        if (err) {
          console.log("error from grpc", err);
          return reject(new CustomError(err.details, 400));
        }

        console.log("response from grpc", response.price);
        resolve(response);
      },
    );
  });
}

export function updateProduct({
  product_id,
  name,
  category_id,
  description,
  price,
  sku,
}: ProductUI): Promise<ProductsI> {
  return new Promise((resolve, reject) => {
    ProductClient.updateProduct(
      {
        product_id,
        name,
        category_id,
        description,
        price,
        sku,
      },
      (err: ServiceError | null, response: ProductsI) => {
        if (err) {
          return reject(err);
        }

        resolve(response);
      },
    );
  });
}

export function addMoreStock(
  product_id: string,
  qty: number,
  reference_type: string,
  reference_id: string,
  type: string,
) {
  return new Promise((resolve, reject) => {
    InventoryClient.addMoreStock(
      {
        product_id,
        quantity: qty,
        reference_type,
        reference_id,
        type,
      },
      (err: ServiceError | null, response: ResponseI) => {
        if (err) {
          return reject(err);
        }
        console.log(response);

        resolve(response);
      },
    );
  });
}
export function archiveProduct(id: string) {
  return new Promise((resolve, reject) => {
    ProductClient.archiveProduct(
      { id },
      (err: ServiceError | null, response: ResponseI) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      },
    );
  });
}

export function unarchiveProduct(id: string) {
  return new Promise((resolve, reject) => {
    ProductClient.unarchiveProduct(
      { id },
      (err: ServiceError | null, response: ResponseI) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      },
    );
  });
}

export function createCategory(name: string, description: string) {
  return new Promise((resolve, reject) => {
    ProductClient.createCategory(
      {
        name,
        description,
      },
      (err: ServiceError | null, response: CategoryResI) => {
        if (err) {
          return reject(new CustomError(err.details, 400));
        }
       // console.log("response from grpc", response);
        resolve(response);
      },
    );
  });
}
