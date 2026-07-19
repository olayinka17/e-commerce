import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { Observer } from "../utils/RpcFunctions.js";
import { controller } from "../route/products.js";
import { grpcHandler } from "../utils/grpc-handler-wrapper.js";
import type { CurrentProducts, Products } from "../generated/prisma/client.js";
import type { ProductRequest, ProductsRequest, achiveResponseI, } from "../utils/RpcFunctions.js";
import type { CategoriesI, CategoryResI, ProductI, ProductsI, ProductUI } from "../service/products.js";

const PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/products.proto"
)
// const PROTO_PATH = path.join(__dirname, "./products.proto");

export const startGrpcServer = async () => {
  const observer = new Observer(controller.productService);
  const packageDef = protoloader.loadSync(PROTO_PATH, {longs: String, keepCase: true});
  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
  const productsPackage = grpcObject.productsPackage;

  const server = new grpc.Server();
  server.addService(productsPackage.Products.service, {
    getProduct: grpcHandler<ProductRequest, Partial<CurrentProducts> | null>(observer.getProduct),
    getProducts: grpcHandler<ProductsRequest, {items: Partial<CurrentProducts>[]}>(observer.getProducts),
  });
  server.addService(productsPackage.AdminProduct.service, {
    createProducts: grpcHandler<ProductI, ProductsI>(observer.createProducts),
    updateProduct: grpcHandler<ProductUI, ProductsI>(observer.updateProduct),
    archiveProduct: grpcHandler<ProductRequest, achiveResponseI>(observer.archiveProduct),
    unarchiveProduct: grpcHandler<ProductRequest, achiveResponseI>(observer.unarchiveProduct),
    createCategory: grpcHandler<CategoriesI, CategoryResI>(observer.createCategories)
  }

  )
  return new Promise<number>((resolve, reject) => {
    server.bindAsync(
      "localhost:40098",
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

// function GetProduct(call, callback) {

// }

// function GetProducts(call, callback) {

// }


