import type { Request, NextFunction, Response } from "express";
import { CatchAsync } from "../utils/CatchAsync.js";
import CustomError from "../utils/CustomError.js";

export const protect = CatchAsync<{}, any, {}, {}>(
  async (req: Request, res: Response, next: NextFunction) => {
    let user;
    if (!req.headers["x-user"]) {
      return next(new CustomError("Invalid request", 400));
    }

    const userInfo: string = req.headers["x-user"] as string;
    user = JSON.parse(userInfo);
    req.user = user;
    next();
  },
);
