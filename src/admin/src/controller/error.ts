import type { NextFunction, Request, Response } from "express";
import CustomError from "../utils/CustomError.js";
import "dotenv/config.js"


const sendErrorDev = (err: CustomError, req: Request, res: Response) => {
    console.log(err)
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        err: err,
        stack: err.stack
    })
}

const sendErrorProd = (err: CustomError, req: Request, res: Response) => {
    if(err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        })
    }

    return res.status(500).json({
        status: "error",
        message: "something went wrong"
    })
} 

export const globalErrorHandler =  (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error"

    if(process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
        sendErrorDev(err, req, res)
    } else if (process.env.NODE_ENV === "production") {
        sendErrorProd(err, req, res)
    }
    
};
