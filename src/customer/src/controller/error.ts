import type { NextFunction, Request, Response } from "express";
import CustomError from "../utils/customError.js";
import type { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import "dotenv/config.js";
const handleDupicateFiedDb = (
  err: PrismaClientKnownRequestError,
): CustomError => {
  const value = err.meta?.target as string[];
  const message = `Dupicate field value: ${value.join(", ")}. Please use another value`;
  return new CustomError(message, 400);
};

const handleCastErrorDb = (err: PrismaClientKnownRequestError): CustomError => {
  const field = err.meta?.field_name;
  const value = err.meta?.field_value;
  const message = `Invalid value: ${value} provided for ${field}`;
  return new CustomError(message, 400);
};

const handleValidationErrorDb = (
  err: PrismaClientKnownRequestError,
): CustomError => {
  const field = err.meta?.field_name;
  const message = `Validation Error: Invalid format proviided for ${field}`;
  return new CustomError(message, 400);
};
const handleJWTError = (): void => {
  new CustomError("Invalid Token. Please login again", 401);
};

const handleExpiredJWTError = (): void => {
  new CustomError("Your token has expired. please login again", 401);
};

const sendErrorDev = (err: CustomError, req: Request, res: Response) => {
  //console.log(err);
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    err: err,
    stack: err.stack,
  });
};

const sendErrorProd = (err: CustomError, req: Request, res: Response) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  return res.status(500).json({
    status: "error",
    message: "something went wrong",
  });
};

export default (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  ) {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === "production") {
    let error: any = Object.create(err);

    if (error.name === "TokenExpiredError") error = handleExpiredJWTError();
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.code === "P2005") error = handleCastErrorDb(error);
    if (error.code === "P2006") error = handleValidationErrorDb(error);
    if (error.code === "P2002") error = handleDupicateFiedDb(error);
    sendErrorProd(error, req, res);
  }
};
