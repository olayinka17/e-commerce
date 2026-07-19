import type { NextFunction, Request, Response } from "express";
import { AdminService } from "../service/admin.js";
import type { RevenueI } from "../utils/RpcClientFunctions.js";
import { redis } from "../utils/redis.js";
import { invalidateCacheByPattern } from "../utils/invalidateCache.js";

interface now_toI {
  now: string;
  to: string;
}

interface PaginateI {
  limit?: string;
  beforeTimestamp?: string;
  status?: string;
}

export class AdminController {
  private service = new AdminService();

  constructor() {}

  total_revenue = async (req: Request, res: Response) => {
    const { now, to }: now_toI = req.query as unknown as now_toI;

    const revenue: RevenueI | null = await this.service.total_revenue(
      new Date(now),
      new Date(to),
    );
    res.status(200).json({
      status: "success",
      data: {
        revenue,
      },
    });
  };

  Orders = async (req: Request, res: Response) => {
    const { limit, beforeTimestamp, status }: Partial<PaginateI> =
      req.query as unknown as PaginateI;

    const redisKey: string = `orders:admin:${req.originalUrl}`;

    const orders = await this.service.total_orders({
       ...(status && { status }),
      ...(limit && { limit }),
      ...(beforeTimestamp && { beforeTimestamp }),

    });

    await redis.setex(redisKey, 60, JSON.stringify(orders));

    res.status(200).json({
      status: "success",
      data: {
        orders,
      },
    });
  };

  Transactions = async (req: Request, res: Response) => {
    const { limit, beforeTimestamp, status }: Partial<PaginateI> =
      req.query as unknown as PaginateI;

    const redisKey: string = `transactions:admin:${req.originalUrl}`;
    const transactions = await this.service.recent_transactions({
      ...(status && { status }),
      ...(limit && { limit }),
      ...(beforeTimestamp && { beforeTimestamp }),
      
    });
    await redis.setex(redisKey, 60, JSON.stringify(transactions));

    res.status(200).json({
      status: "success",
      data: {
        transactions,
      },
    });
  };

  createProducts = async (req: Request, res: Response, next: NextFunction) => {
    const { name, category_id, description, price, sku } = req.body;
    

    const product = await this.service.create_products({
      name,
      category_id,
      description,
      price,
      sku,
    });
    //invalidate product cache
    await invalidateCacheByPattern(`products:*`);
    res.status(201).json({
      status: "success",
      data: {
        product,
      },
    });
  };

  addMoreStock = async (req: Request, res: Response) => {
    const { product_id, qty, reference_type, reference_id, type } = req.body;

    const response = await this.service.update_stock(
      product_id,
      qty,
      reference_type,
      reference_id,
      type,
    );

    res.status(200).json({
      status: "success",
      data: {
        response,
      },
    });
  };

  archiveProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const response = await this.service.achive_product(id);

    res.status(200).json({
      status: "success",
      data: {
        response,
      },
    });
  };
  unarchiveProduct = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const response = await this.service.unarchive_product(id);

    res.status(200).json({
      status: "success",
      data: {
        response,
      },
    });
  };

  createCategory = async (req: Request, res: Response) => {
    const { name, description } = req.body;

    const category = await this.service.create_categories(name, description);
    res.status(200).json({
      status: "success",
      data: {
        category,
      },
    });
  };

  updateProductInfo = async (req: Request, res: Response) => {
    const {id } = req.params as { id: string}

    const { name, category_id, description, price, sku } = req.body;

    const products = await this.service.update_products({product_id: id, name, category_id, description, price, sku})
    res.status(200).json({
      status: "success",
      data: {
        products,
      },
    });
  }
}
