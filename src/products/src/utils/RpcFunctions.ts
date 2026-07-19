import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { ProductService } from "../service/products.js";
import type { CategoriesI, CategoryResI, ProductI, ProductsI, ProductUI } from "../service/products.js";
import type { CurrentProducts, Products } from "../generated/prisma/client.js";

export interface ProductRequest {
  id: string;
}

export interface ProductsRequest {
  ids: string[];
}

export interface achiveResponseI {
  success: boolean;
}


export class Observer {
  constructor(private service: ProductService) {
    this.service = service;
  }

  getProduct = async (call: ServerUnaryCall<ProductRequest, Partial<CurrentProducts>>): Promise<Partial<CurrentProducts> | null> => {
    const result = this.service.GetProductByIdGrpc(call)
    return result
  }


  getProducts = async (call: ServerUnaryCall<ProductsRequest, {items: Partial<CurrentProducts>[]}>): Promise<{items: Partial<CurrentProducts>[]}> => {
    const result = await this.service.GetSelectedProducts(call)
    return result
  }




  createProducts = async (call: ServerUnaryCall<ProductI, ProductsI>): Promise<ProductsI> => {
    console.log("createProducts called with request:", call.request);
    const result = await this.service.CreateProduct(call)
    
    return {...result, price: Number(result.price)}
  }

  createCategories = async (call: ServerUnaryCall<CategoriesI, CategoryResI>): Promise<CategoryResI> => {
    
    const result = await this.service.createCategory(call)
    return result
  }


  updateProduct = async (call: ServerUnaryCall<ProductUI, ProductsI>): Promise<ProductsI> => {
    return await this.service.update_product(call)
  }



  archiveProduct = async (call: ServerUnaryCall<ProductRequest, achiveResponseI>): Promise<achiveResponseI> => {
    return await this.service.archive_product(call)
  }


  unarchiveProduct = async (call: ServerUnaryCall<ProductRequest, achiveResponseI>): Promise<achiveResponseI> => {
    return await this.service.unachive_product(call)
  }

}
