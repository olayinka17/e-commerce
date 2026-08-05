import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";

const PROTO_PATH = path.join(process.cwd(), "src/grpc/products.proto");
let client: any;
export const startGrpcclient = async () => {
  const packageDef = protoloader.loadSync(PROTO_PATH, {});

  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

  const productsPackage = grpcObject.productsPackage;

  const host = process.env.PRODUCT_CLIENT
  client = new productsPackage.Products(
    `${host}:40098`,
    grpc.credentials.createInsecure(),
  );
  return client;
};

export async function shutdownGRPCClient(client: any) {
  if (client) {
    client.close()
  }
}
