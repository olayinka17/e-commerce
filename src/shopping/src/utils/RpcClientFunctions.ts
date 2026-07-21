import type { ServiceError } from "@grpc/grpc-js";
import { client } from "../utils/bootstrap.js";
interface ProductI {
  id: string;
  name: string;
  category_id: string;
  description: string;
  price: number;
  sku: string;
}
export function getProducts(ids: string[]): Promise<{ items: ProductI[] }> {
  return new Promise((resolve, reject) => {
    client.getProducts(
      { ids: ids.map((id) => ({ id })) },
      (err: ServiceError | null, response: { items: ProductI[] }) => {
        if (err) {
          return reject(err);
        }

        resolve(response);
      },
    );
  });
}

export function getProduct(id: string): Promise<ProductI | null> {
  return new Promise((resolve, reject) => {
    client.getProduct(
      { id },
      (err: ServiceError | null, response: ProductI | null) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      },
    );
  });
}
