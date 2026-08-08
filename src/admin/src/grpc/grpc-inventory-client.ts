import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";

const PROTO_PATH = path.join(process.cwd(), "src/grpc/inventory.proto");

let client: any;
export const startInventoryGrpcClient = async () => {
  const packageDef = protoloader.loadSync(PROTO_PATH, {
    longs: String,
    keepCase: true,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

  const inventoryPackage = grpcObject.inventoryPackage;
  const host = process.env.NODE_ENV === 'test' ? 'localhost' : process.env.SHOPPING_CLIENT 
  client = new inventoryPackage.Inventory(
    `${host}:40100`,
    grpc.credentials.createInsecure(),
  );

  return client;
};

export const shutdownGRPCInventoryClient = async (client: any) => {
  if (client) {
    client.close();
  }
}
