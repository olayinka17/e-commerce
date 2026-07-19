import { type ServiceError, Metadata, status } from "@grpc/grpc-js";
import { GrpcException } from "./GrpcError.js"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

const handleDupicateFiedDb = (
  err: PrismaClientKnownRequestError,
  metadata: Metadata,
): ServiceError => {
  const value = err.meta?.target as string[];
  const message = `Dupicate field value: ${value.join(", ")}. Please use another value`;
  return {
    name: "DBException",
    message,
    code: status.ALREADY_EXISTS,
    metadata,
  } as ServiceError;
};

const handleCastErrorDb = (
  err: PrismaClientKnownRequestError,
  metadata: Metadata,
): ServiceError => {
  const field = err.meta?.field_name;
  const value = err.meta?.field_value;
  const message = `Invalid value: ${value} provided for ${field}`;
  return {
    name: "DBException",
    message,
    code: status.INVALID_ARGUMENT,
    metadata,
  } as ServiceError;
};

const handleValidationErrorDb = (
  err: PrismaClientKnownRequestError,
  metadata: Metadata,
): ServiceError => {
  const field = err.meta?.field_name;
  const message = `Validation Error: Invalid format proviided for ${field}`;
  return {
    name: "DBException",
    message,
    code: status.INVALID_ARGUMENT,
    metadata,
  } as ServiceError;
};
export function toGrpcError(err: unknown): ServiceError {
  const metadata = new Metadata();

  if (err instanceof GrpcException) {
    return {
      name: "GrpcException",
      message: err.message,
      code: err.code,
      metadata,
    } as ServiceError;
  }

  if (err instanceof PrismaClientKnownRequestError) {
    //let error: any = Object.create(err)
    if (err.code === "P2005") return handleCastErrorDb(err, metadata);
    if (err.code === "P2006") return handleValidationErrorDb(err, metadata);
    if (err.code === "P2002") return handleDupicateFiedDb(err, metadata);
    //return err;
  }
  console.log(err)

  return {
    name: "Internal",
    message: "Internal server error",
    code: status.INTERNAL,
    metadata,
  } as ServiceError;
}
