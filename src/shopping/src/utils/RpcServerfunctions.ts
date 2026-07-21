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


  totalOrders = async (
    call: ServerUnaryCall<
      PaginateI,
      { orders: OrderI[], nextCursor: string | null }
    >,
  ): Promise<{ orders: OrderI[], nextCursor: string | null }> => {
    const result = await this.service.total_orders(call);
    return result;
  
  };


  totalRevenue = async (
    call: ServerUnaryCall<now_toI, revenueI>,
  ): Promise<revenueI> => {
    const result = await this.service.total_revenue(call);
    return result;
  };
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
