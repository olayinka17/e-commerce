import type { Decimal } from "../generated/prisma/internal/prismaNamespace.js";
import {
  totalOrders,
  totalRevenue,
  recentTransactions,
  createProducts,
  updateProduct,
  addMoreStock,
  archiveProduct,
  unarchiveProduct,
  createCategory,
} from "../utils/RpcClientFunctions.js";
import type {
  RevenueI,
  OrderI,
  TransactionsI,
  ProductsI,
  ProductUI,
  TransactionI,
} from "../utils/RpcClientFunctions.js";

export interface ProductI {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  price: Decimal;
  sku: string;
}

interface PaginateI {
  limit?: string;
  beforeTimestamp?: string;
  status?: string;
}
export class AdminService {
  constructor() {}

  total_revenue = async (now: Date, to: Date) => {
    const revenue: RevenueI | null = await totalRevenue({ now, to });

    return revenue;
  };

  total_orders = async ({
    status,
    limit = "10",
    beforeTimestamp = String(Date.now()),
  }: Partial<PaginateI>) => {
    const orders: { orders: OrderI[]; nextCursor: string | null } | null =
      await totalOrders(Number(limit), String(beforeTimestamp), String(status));

    //console.log(orders)
    return orders;
  };

  recent_transactions = async ({
    status,
    limit = "10",
    beforeTimestamp = String(Date.now()),
  }: Partial<PaginateI>) => {
    const transactions: {
      transactions: TransactionI[];
      nextCursor: string | null;
    } | null = await recentTransactions(
      Number(limit),
      String(beforeTimestamp),
      String(status),
    );

    return transactions;
  };

  create_products = async ({
    name,
    category_id,
    description,
    price,
    sku,
  }: ProductI) => {
    console.log(category_id);
    const product: ProductsI = await createProducts({
      name,
      category_id,
      description,
      price,
      sku,
    });
    console.log(product.price);
    return { ...product, price: Number(product.price) };
  };

  update_products = async ({
    product_id,
    name,
    category_id,
    description,
    price,
    sku,
  }: ProductUI) => {
    const product: ProductsI = await updateProduct({
      product_id,
      name,
      category_id,
      description,
      price,
      sku,
    });

    return { ...product, price: Number(product.price) };
  };

  update_stock = async (
    product_id: string,
    qty: number,
    reference_type: string,
    reference_id: string,
    type: string,
  ) => {
    const response = await addMoreStock(
      product_id,
      qty,
      reference_type,
      reference_id,
      type,
    );

    return response;
  };
  achive_product = async (product_id: string) => {
    const response = await archiveProduct(product_id);
    return response;
  };

  unarchive_product = async (product_id: string) => {
    const response = await unarchiveProduct(product_id);
    return response;
  };

  create_categories = async (name: string, description: string) => {
    const category = await createCategory(name, description);

    return category;
  };
}
