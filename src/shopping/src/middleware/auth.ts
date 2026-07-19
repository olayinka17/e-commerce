import type { Request, NextFunction, Response } from "express";
import { CatchAsync } from "../utils/CatchAsync.js"
import CustomError from "../utils/CustomError.js";

export const protect = CatchAsync<{}, any, {}, {}>(
  async (req: Request, res: Response, next: NextFunction) => {
    let user;
    console.log(req.headers)
    if (!req.headers["x-user"]) {
      return next(new CustomError("Invalid request", 400));
    }

    const userInfo: string = req.headers["x-user"] as string;
    console.log(userInfo)
    user = JSON.parse(userInfo);
    console.log(user)
    req.user = user;
    next();
  },
);
