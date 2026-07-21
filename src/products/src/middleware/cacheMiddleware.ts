import type { Request, Response, NextFunction } from "express";
import { redis } from "../utils/redis.js";
import { CatchAsync } from "../utils/CatchAsync.js";

export const productCache = CatchAsync<{}, any, {}, {}>(
  async (req: Request, res: Response, next: NextFunction) => {
    const redisKey: string = `products:${req.originalUrl}`;
    await redis.del(redisKey);
    const cachedResponse = await redis.get(redisKey);

    if (cachedResponse) {
      const parsedOrders = JSON.parse(cachedResponse);

      return res.status(200).json({
        status: "success",
        data: parsedOrders,
      });
    }
    next();
  },
);
