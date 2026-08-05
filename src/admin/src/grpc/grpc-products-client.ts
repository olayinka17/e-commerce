import path from "path"
import * as grpc from "@grpc/grpc-js"
import * as protoloader from "@grpc/proto-loader"

const PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/product.proto"
)

let client: any;

export const startPrductsGrpcClient = async () => {
    const packageDef = protoloader.loadSync(PROTO_PATH, {longs: String,keepCase: true})

    const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

    const adminProductPackage = grpcObject.productsPackage
    const host = process.env.PRODUCT_CLIENT
    client = new adminProductPackage.AdminProduct(
        `${host}:40098`,
        grpc.credentials.createInsecure()
    )

    return client
}

export const shutdownGRPCProductClient = async (client: any) => {
  if (client) {
    client.close();
  }
}
