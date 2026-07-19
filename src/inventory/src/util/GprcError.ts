import type { ServiceError, status } from "@grpc/grpc-js";

export class GrpcException extends Error {
    constructor(
        public code: status,
        message: string,
        public metadata?: any
    ) {
        super(message)
    }
}