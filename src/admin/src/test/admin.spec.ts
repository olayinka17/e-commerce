import path from "path";
import request from "supertest";
import app from "../app.js";
import * as grpc from "@grpc/grpc-js";
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { boostrap } from "../utils/bootstrap.js";

export interface PaginateI {
  limit: number;
  beforeTimestamp: string;
  status: string;
}

export interface OrderI {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_price: number;
  created_at: String;
}

export interface now_toI {
  now: Date;
  to: Date;
}

export interface revenueI {
  total_amount: number;
}

export interface TransactionI {
  id: string;
  created_at: string;
  amount: number;
  order_id: string;
  status: string;
  update_at: string;
}

export interface params {
  product_id: string;
  quantity: number;
  reference_type: string;
  reference_id: string;
  type: string;
}

export interface response {
  success: boolean;
}

export interface ProductI {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  price: Number;
  sku: string;
}

export interface ProductsI extends ProductI {
  created_at: string;
  updated_at: string;
}

export interface ProductUI extends ProductI {
  product_id: string;
}

export interface CategoriesI {
  name: string;
  description: string;
}

export interface CategoryResI {
  id: string;
  name: string;
  description: string;
}
export interface ProductRequest {
  id: string;
}

export interface ProductsRequest {
  ids: string[];
}

export interface achiveResponseI {
  success: boolean;
}

const Shopping_PROTO_PATH = path.join(process.cwd(), "src/grpc/shopping.proto");
const Inventory_PROTO_PATH = path.join(
  process.cwd(),
  "src/grpc/inventory.proto",
);
const Products_PROTO_PATH = path.join(process.cwd(), "src/grpc/product.proto");

const ShoppingPackageDef = protoloader.loadSync(Shopping_PROTO_PATH, {
  keepCase: true,
});
const ShoppingGrpcObject = grpc.loadPackageDefinition(
  ShoppingPackageDef,
) as any;
const AdminPackage = ShoppingGrpcObject.AdminPackage;

const InventoryPackageDef = protoloader.loadSync(Inventory_PROTO_PATH, {
  longs: String,
  keepCase: true,
});
const InventoryGrpcObject = grpc.loadPackageDefinition(
  InventoryPackageDef,
) as any;
const inventoryPackage = InventoryGrpcObject.inventoryPackage;

const ProductPackageDef = protoloader.loadSync(Products_PROTO_PATH, {
  longs: String,
  keepCase: true,
});
const ProductGrpcObject = grpc.loadPackageDefinition(ProductPackageDef) as any;
const productsPackage = ProductGrpcObject.productsPackage;

function bindServer(server: grpc.Server, address: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          reject(err);
          return;
        }

        server.start(); // Start serving requests
        resolve(port);
      },
    );
  });
}

describe("admin service", () => {
  let ProductsServer: grpc.Server;
  let shopping_server: grpc.Server;
  let inventoryServer: grpc.Server;
  beforeAll(async () => {
    shopping_server = new grpc.Server();
    shopping_server.addService(AdminPackage.Admin.service, {
      totalOrders: (
        call: ServerUnaryCall<
          PaginateI,
          { orders: OrderI[]; nextCursor: string | null }
        >,
        
        callback: sendUnaryData<{
          orders: OrderI[];
          nextCursor: string | null;
        }>,
      ) => {
        
        callback(null, {
          orders: [
            {
              id: "laoa",
              user_id: "1234",
              status: "pending",
              payment_status: "pending",
              total_price: 2345,
              created_at: "sat june",
            },
          ],
          nextCursor: "1234567",
        });
      },
      totalRevenue: (
        call: ServerUnaryCall<now_toI, revenueI>,
        callback: sendUnaryData<revenueI>,
      ) => {
        callback(null, { total_amount: 2345 });
      },
      recentTransactions: (
        call: ServerUnaryCall<
          PaginateI,
          { transactions: TransactionI[]; nextCursor: string | null }
        >,
        callback: sendUnaryData<{
          transactions: TransactionI[];
          nextCursor: string | null;
        }>,
      ) => {
        callback(null, {
          transactions: [
            {
              id: "123",
              created_at: "sat june",
              amount: 2345,
              order_id: "laoa",
              status: "pending",
              update_at: "sat june",
            },
          ],
          nextCursor: "1234567",
        });
      },
    });

    inventoryServer = new grpc.Server();
    inventoryServer.addService(inventoryPackage.Inventory.service, {
      addMoreStock: (
        call: ServerUnaryCall<params, response>,
        callback: sendUnaryData<response>,
      ) => {
        callback(null, { success: true });
      },
    });

    ProductsServer = new grpc.Server();
    ProductsServer.addService(productsPackage.AdminProduct.service, {
      createProducts: (
        call: ServerUnaryCall<ProductI, ProductsI>,
        callback: sendUnaryData<ProductsI>,
      ) => {
        callback(null, {
          id: "oooo",
          name: call.request.name,
          category_id: call.request.category_id,
          description: call.request.description,
          price: call.request.price,
          sku: call.request.sku,
          created_at: "sat june",
          updated_at: "sat june",
        });
      },
      updateProduct: (
        call: ServerUnaryCall<ProductUI, ProductsI>,
        callback: sendUnaryData<ProductsI>,
      ) => {
        callback(null, {
          id: call.request.product_id ?? "oooo",
          name: call.request.name ?? "ksks",
          category_id: call.request.category_id ?? "qwer",
          description: call.request.description ?? "skss",
          price: call.request.price ?? "sssss",
          sku: call.request.sku ?? "ksjss",
          created_at: "sat june",
          updated_at: "sat june",
        });
      },
      archiveProduct: (
        call: ServerUnaryCall<ProductRequest, achiveResponseI>,
        callback: sendUnaryData<achiveResponseI>,
      ) => {
        callback(null, { success: true });
      },
      unarchiveProduct: (
        call: ServerUnaryCall<ProductRequest, achiveResponseI>,
        callback: sendUnaryData<achiveResponseI>,
      ) => {
        callback(null, { success: true });
      },
      createCategory: (
        call: ServerUnaryCall<CategoriesI, CategoryResI>,
        callback: sendUnaryData<CategoryResI>,
      ) => {
        callback(null, {
          id: "oaos",
          name: call.request.name,
          description: call.request.description,
        });
      },
    });

    await Promise.all([
      bindServer(shopping_server, "localhost:40099"),
      bindServer(inventoryServer, "localhost:40100"),
      bindServer(ProductsServer, "localhost:40098"),
    ]);

    await boostrap();
  });
  afterAll(async () => {
    if (ProductsServer) ProductsServer.forceShutdown();
    if (shopping_server) shopping_server.forceShutdown();
    if (inventoryServer) inventoryServer.forceShutdown();
  });

  it("should return the total revenue", async () => {
    const response = await request(app)
      .get("/api/v1/admin/revenue")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      );
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("revenue");
  });
  it("should return orders", async () => {
    const response = await request(app)
      .get("/api/v1/admin/orders")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("orders");
  });
  it("should return transactions", async () => {
    const response = await request(app)
      .get("/api/v1/admin/transactions")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      );
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("transactions");
  });

  it("should create products", async () => {
    const response = await request(app)
      .post("/api/v1/admin/products")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      )
      .send({
        name: "biscuit",
        category_id: "12334",
        price: 1234,
        sku: "thhe",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("product");
    expect(response.body.data.product).toHaveProperty("name", "biscuit");
  });

  it("should add more stock", async () => {
    const response = await request(app)
      .post("/api/v1/admin/inventory/adjustments")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      )
      .send({
        product_id: "weeer",
        qty: 23,
        reference_type: "purchase",
        reference_id: "purchase-01",
        type: "prurchase",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("response");
    expect(response.body.data.response).toHaveProperty("success", true);
  });

  it("should arhive products", async () => {
    const response = await request(app)
      .delete("/api/v1/admin/products/23231")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("response");
    expect(response.body.data.response).toHaveProperty("success", true);
  });

  it("should unarchive products", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/products/23231")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("response");
    expect(response.body.data.response).toHaveProperty("success", true);
  });

  it("updates products info", async () => {
    const response = await request(app)
      .patch("/api/v1/admin/products/info/23231")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      )
      .send({
        name: "ola",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("products");
    expect(response.body.data.products).toHaveProperty("name", "ola");
    expect(response.body.data.products).toHaveProperty("id", "23231");
  });
  it("should create categories ", async () => {
    const response = await request(app)
      .post("/api/v1/admin/categories")
      .set(
        "x-user",
        `{"id": "152e703e-df22-4f95-9585-a2779e1354eb",  "email": "olayinkaolaniyi2000@gmailcom", "role": "admin"}`,
      )
      .send({
        name: "ola",
        description: "ollaa"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("status", "success");
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("category");
    expect(response.body.data.category).toHaveProperty("name", "ola");
    expect(response.body.data.category).toHaveProperty("description", "ollaa");
  });
});
