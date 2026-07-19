import {
  type ProductsFindManyArgs,
  type Decimal,
  type ProductsWhereInput,
  type CurrentProductsFindManyArgs,
  type CurrentProductsWhereInput,
} from "../generated/prisma/internal/prismaNamespace.js";
import { prisma } from "../utils/prisma.js";
import { APIFeatures } from "../utils/ApiFeatures.js";
import type { ServerUnaryCall } from "@grpc/grpc-js";
import type {
  achiveResponseI,
  ProductRequest,
  ProductsRequest,
} from "../utils/RpcFunctions.js";
import type { CurrentProducts, Products } from "../generated/prisma/client.js";

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
export class ProductService {
  private prisma;

  constructor() {
    this.prisma = prisma;
  }

  async GetProducts(query: Record<string, string | undefined>) {
    const features = new APIFeatures<
      CurrentProductsFindManyArgs,
      CurrentProductsWhereInput
    >(query)
      .filter()
      .search(["name", "category", "description"])
      .sort()
      .paginate()
      .select()
      .build();

    const productsResult = await this.prisma.currentProducts.findMany({
      ...features,
      orderBy: features.orderBy!,
    });

    // let categories = {}

    const grouped = productsResult.reduce(
      (acc, product) => {
        const categoryName: string = product.category;

        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }

        acc[categoryName].push({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          sku: product.sku,
        });

        return acc;
      },
      {} as Record<string, any[]>,
    );

    const categories = [
      ...new Map(
        productsResult.map((product) => [
          product.category_id,
          product.category,
        ]),
      ).values(),
    ];
    return { grouped, categories };
  }

  async GetProductByIdGrpc(
    call: ServerUnaryCall<ProductRequest, ProductI>,
  ): Promise<Partial<CurrentProducts> | null> {
    const product = await this.prisma.currentProducts.findFirst({
      where: { id: call.request.id },
      select: {
        id: true,
        name: true,
        category_id: true,
        description: true,
        price: true,
        sku: true,
        created_at: false,
        updated_at: false,
      },
    });

    return product;
  }

  async GetProductById(product_id: string) {
    const product = await this.prisma.currentProducts.findFirst({
      where: { id: product_id },
      select: {
        id: true,
        name: true,
        category_id: true,
        price: true,
        category: true,
        sku: true,
      },
    });
    return product;
  }

  async GetProductByCategory(
    category: string,
    query: Record<string, string | undefined>,
  ) {
    const features = new APIFeatures<
      CurrentProductsFindManyArgs,
      CurrentProductsWhereInput
    >(query)
      .filter(category)
      .paginate()
      .sort()
      .build();
    const products = await this.prisma.currentProducts.findMany({
      ...features,
      orderBy: features.orderBy!,
    });
    return products;
  }

  async GetSelectedProducts(
    call: ServerUnaryCall<ProductsRequest, {items: Partial<CurrentProducts>[]}>,
  ): Promise<{items: Partial<CurrentProducts>[]}> {
    const ids = call.request.ids.map((item: any) => item.id)

    console.log(ids)
    const products = await this.prisma.currentProducts.findMany({
      where: { id: { in:  ids} },
      select: {
        id: true,
        name: true,
        category_id: true,
        description: true,
        price: true,
        sku: true,
        created_at: false,
        updated_at: false,
      },
    });
    return {items: products};
  }

  async CreateProduct(
    call: ServerUnaryCall<ProductI, ProductsI>,
  ): Promise<ProductsI> {
    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.products.create({
        data: {
          name: call.request.name,
          description: call.request.description,
          price: call.request.price as unknown as Decimal,
          sku: call.request.sku,
          category: {
            connect: { id: call.request.category_id },
          },
        },
      });

      await tx.inventoryOutbox.create({
        data: {
          aggregatetype: "products",
          aggregateid: product.id,
          eventtype: "PRODUCT_CREATE",
          payload: {
            product_id: product.id,
          },
        },
      });
      return product;
    });

    return {
      ...product,
      price: Number(product.price),
      created_at: product.created_at.toDateString(),
      updated_at: product.updated_at.toDateString(),
    };
  }

  async createCategory(
    call: ServerUnaryCall<CategoriesI, CategoryResI>,
  ): Promise<CategoryResI> {
    return await this.prisma.categories.create({
      data: {
        name: call.request.name,
        description: call.request.description,
      },
    });
  }

  async getCategory() {
    const categories = await this.prisma.categories.findMany({});
    return categories;
  }

  async update_product(
    call: ServerUnaryCall<ProductUI, ProductsI>,
  ): Promise<ProductsI> {
    console.log("update_product called with request:", call.request);
    const product = await this.prisma.products.update({
      where: { id: call.request.product_id },
      data: {
        ...(call.request.name && { name: call.request.name }),
        ...(call.request.category_id && {
          category: {
            connect: {
              id: call.request.category_id,
            },
          },
        }),
        ...(call.request.description && {
          description: call.request.description,
        }),
        ...(call.request.price && {
          price: call.request.price as unknown as Decimal,
        }),
        ...(call.request.sku && { sku: call.request.sku }),
      },
    });

    return {...product, price: Number(product.price), created_at: String(new Date(product.created_at)), updated_at: String(new Date(product.updated_at))};
  }

  async archive_product(
    call: ServerUnaryCall<ProductRequest, achiveResponseI>,
  ): Promise<achiveResponseI> {
    await this.prisma.$transaction(async (tx) => {
      const product = await tx.products.update({
        where: {
          id: call.request.id,
        },
        data: {
          active: false,
        },
      });

      const inventory = await tx.inventoryOutbox.create({
        data: {
          aggregatetype: "products",
          aggregateid: product.id,
          eventtype: "PRODUCT_ARCHIVE",
          payload: {
            product_id: product.id,
          },
        },
      });
      console.log(inventory)
    });

    return {
      success: true,
    };
  }

  async unachive_product(
    call: ServerUnaryCall<ProductRequest, achiveResponseI>,
  ): Promise<achiveResponseI> {
    const product = await this.prisma.$transaction(async (tx) => {
      const product = await tx.products.update({
        where: {
          id: call.request.id,
        },
        data: {
          active: true,
        },
      });

      await tx.inventoryOutbox.create({
        data: {
          aggregatetype: "products",
          aggregateid: product.id,
          eventtype: "PRODUCT_UNARCHIVE",
          payload: {
            product_id: product.id,
          },
        },
      });
      return product;
    });

    return {
      success: true,
    };
  }
}
