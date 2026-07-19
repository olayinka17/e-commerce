import type { Request, NextFunction, Response } from "express";
import { CatchAsync } from "../utils/CatchAsync.js";
import CustomError from "../utils/CustomError.js";
import { redis } from "../utils/redis.js";

export const orderCached = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const redisKey: string = `orders:user${req.user.id}:${req.originalUrl}`;

  const cachedOrders = await redis.get(redisKey);

  if (cachedOrders) {
    const parsedOrders = JSON.parse(cachedOrders);
    if (parsedOrders.user_id.toString() !== req.user.id) {
      return next(
        new CustomError("You do not have permission to view this order", 403),
      );
    }
    return res.status(200).json({
      status: "success",
      data: parsedOrders,
    });
  }

  next();
};
