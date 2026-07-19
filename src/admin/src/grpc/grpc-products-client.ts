import path from "path"
import * as grpc from "@grpc/grpc-js"
import * as protoloader from "@grpc/proto-loader"

const PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/product.proto"
)

export const startPrductsGrpcClient = async () => {
    const packageDef = protoloader.loadSync(PROTO_PATH, {longs: String,keepCase: true})

    const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

    const adminProductPackage = grpcObject.productsPackage

    const client = new adminProductPackage.AdminProduct(
        "localhost:40098",
        grpc.credentials.createInsecure()
    )

    return client
}