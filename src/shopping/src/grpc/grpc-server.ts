import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { Observer } from "../utils/RpcServerfunctions.js";
import { shoppingController } from "../route/shopping.js";
import { grpcHandler } from "../utils/grpc-handler-wrapper.js";
import type {
  PaginateI,
  OrderI,
  TransactionsI,
  revenueI,
  now_toI,
  TransactionI,
} from "../utils/RpcServerfunctions.js";

const PROTO_PATH = path.join(process.cwd(), "src/grpc/shopping.proto");

export const startGrpcServer = async () => {
  const observer = new Observer(shoppingController.shoppingService);
  const packageDef = protoloader.loadSync(PROTO_PATH, { keepCase: true });
  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
  const AdminPackage = grpcObject.AdminPackage;

  const server = new grpc.Server();
  server.addService(AdminPackage.Admin.service, {
    totalOrders: grpcHandler<
      PaginateI,
      { orders: OrderI[]; nextCursor: string | null }
    >(observer.totalOrders),
    totalRevenue: grpcHandler<now_toI, revenueI>(observer.totalRevenue),
    recentTransactions: grpcHandler<
      PaginateI,
      { transactions: TransactionI[]; nextCursor: string | null }
    >(observer.recentTransactions),
  });
  return new Promise<number>((resolve, reject) => {
    server.bindAsync(
      "localhost:40099",
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          return reject(err);
        }
        console.log(`grpc server is running on ${port}`);
        resolve(port);
      },
    );
  });
};
