import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";

const PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/shopping.proto"
)

export const startGrpcclient = async () => {
  const packageDef = protoloader.loadSync(PROTO_PATH, {keepCase: true});

  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;

  const adminPackage = grpcObject.AdminPackage;

  

  const client = new adminPackage.Admin(
    "localhost:40099",
    grpc.credentials.createInsecure(),
  );
  return client;
};
