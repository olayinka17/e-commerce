import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";

const PROTO_PATH = path.join(process.cwd(), "src/grpc/products.proto");

export const startGrpcclient = async () => {
  const packageDef = protoloader.loadSync(PROTO_PATH, {});

  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

  const productsPackage = grpcObject.productsPackage;
  console.log("jjdjdj");
  const client = new productsPackage.Products(
    "localhost:40098",
    grpc.credentials.createInsecure(),
  );
  return client;
};
