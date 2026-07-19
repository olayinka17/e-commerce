import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { ShoppingService } from "../service/shopping.js";
import type { Decimal } from "@prisma/client/runtime/client";

export interface PaginateI {
  limit: number;
  beforeTimestamp: string;
  status: string;
}

export interface OrderI {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_price: Decimal;
  created_at: String;
}

export interface OrdersI {
  orders: OrderI[];
  nextCursor: number | null;
}

export interface now_toI {
  now: Date;
  to: Date;
}

export interface revenueI {
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

export class Observer {
  constructor(private service: ShoppingService) {
    this.service = service;
  }

  // async totalOrders(
  //   call: ServerUnaryCall<PaginateI, OrdersI>,
  //   callback: sendUnaryData<OrdersI>,
  // ) {
  //   const orders: OrdersI = await this.service.total_orders({
  //     limit: Number(call.request.limit),
  //     beforeTimestamp: Number(call.request.beforeTimestamp),
  //     status: call.request.status,
  //   });
  //   callback(null, orders);
  // }

  totalOrders = async (
    call: ServerUnaryCall<
      PaginateI,
      { orders: OrderI[], nextCursor: string | null }
    >,
  ): Promise<{ orders: OrderI[], nextCursor: string | null }> => {
    const result = await this.service.total_orders(call);
    return result;
  
  };

  // async totalRevenue(
  //   call: ServerUnaryCall<now_toI, revenueI>,
  //   callback: sendUnaryData<revenueI>,
  // ) {
  //   const revenue: revenueI = await this.service.total_revenue(
  //     call.request.now,
  //     call.request.to,
  //   );

  //   callback(null, revenue);
  // }

  totalRevenue = async (
    call: ServerUnaryCall<now_toI, revenueI>,
  ): Promise<revenueI> => {
    const result = await this.service.total_revenue(call);
    return result;
  };

  // async recentTransactions(
  //   call: ServerUnaryCall<PaginateI, TransactionsI>,
  //   callback: sendUnaryData<TransactionsI>,
  // ) {
  //   const transactions = await this.service.recent_transactions({
  //     limit: Number(call.request.limit),
  //     beforeTimestamp: Number(call.request.beforeTimestamp),
  //     status: call.request.status,
  //   });

  //   callback(null, transactions);
  // }

  recentTransactions = async (
    call: ServerUnaryCall<
      PaginateI,
      { transactions: TransactionI[]; nextCursor: string | null }
    >,
  ): Promise<{ transactions: TransactionI[]; nextCursor: string | null }> => {
    const result = await this.service.recent_transactions(call);
    return result;
  };
}
