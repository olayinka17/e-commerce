import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { toGrpcError } from "./grpc-error-mapper.js";

export function grpcHandler<Req, Res>(fn: (call: ServerUnaryCall<Req, Res>)  => Promise<Res>) {
    return async (
        call: ServerUnaryCall<Req, Res>,
        callback: sendUnaryData<Res>
    ) => {
        try {
            console.log(call.request)
            const result = await fn(call)
            console.log(result)
            callback(null, result)
        } catch (error) {
            console.log(error)
            callback(toGrpcError(error), undefined)
        }
    }
}