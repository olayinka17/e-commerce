import type { Request, NextFunction, Response } from "express";
import { CatchAsync } from "../utils/CatchAsync.js";
import CustomError from "../utils/CustomError.js";
import { redis } from "../utils/redis.js";

export const orderCache = CatchAsync<{}, any, {}, {}>(async (req: Request, res: Response, next: NextFunction) => {
    const redisKey: string = `orders:admin:${req.originalUrl}`

    const cachedResponse = await redis.get(redisKey)

    if (cachedResponse) {
        const parsedOrders = JSON.parse(cachedResponse)

        return res.status(200).json({
            status: "success",
            data: parsedOrders
        })
    }

    next()
})

export const transactionCache = CatchAsync<{}, any, {}, {}>(async (req: Request, res: Response, next: NextFunction) => {
    const redisKey: string = `transactions:admin:${req.originalUrl}`

    const cachedResponse = await redis.get(redisKey)

    if (cachedResponse) {
        const parsedTransaction = JSON.parse(cachedResponse)

        return res.status(200).json({
            status: "success",
            data: parsedTransaction
        })
    }

    next()
})


