import path from "path"
import * as grpc from "@grpc/grpc-js"
import * as protoloader from "@grpc/proto-loader"

const PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/inventory.proto"
)

export const startInventoryGrpcClient = async () => {
    const packageDef = protoloader.loadSync(PROTO_PATH,{longs: String, keepCase: true})

    const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

    const inventoryPackage = grpcObject.inventoryPackage

    const client = new inventoryPackage.Inventory(
        "localhost:40100",
        grpc.credentials.createInsecure()
    )

    return client
}