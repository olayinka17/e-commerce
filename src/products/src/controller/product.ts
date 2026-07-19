import type { Request, Response, NextFunction } from "express";
import { ProductService } from "../service/products.js";
import { redis } from "../utils/redis.js";
import { acquireLock, release_lock } from "../utils/lock.js";

export class ProductController {
  public productService = new ProductService();

  constructor() {}

  //    createProduct = async(req: Request, res: Response) => {
  //     const { name, category_id, description, price, sku} = req.body

  //     const product = await this.productService.CreateProduct({ name, category_id, description, price, sku})
  //     res.status(201).json({
  //         status: "success",
  //         data: {
  //             product
  //         }
  //     })
  //    }

  getProducts = async (req: Request, res: Response) => {
    const query = req.query as unknown as Record<string, string | undefined>;
    const redisKey: string = `products:${req.originalUrl}`;
    const lockkey: string = `getproducts`;
    const token = "iuh";
    const lock = await acquireLock(lockkey, token, 20);

    if (lock) {
        try {
            const data = await this.productService.GetProducts(query);
            await redis.set(redisKey, JSON.stringify(data));

            return res.status(200).json({
                status: "success",
                data,
            })
        } finally {
            await release_lock(lockkey, token);
            
        }
    }

    for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const cachedResponse = await redis.get(redisKey);
        if (cachedResponse) {
            return res.send(200).json({
                status: "success",
                data: JSON.parse(cachedResponse),
            });
        }
    }
    const data = await this.productService.GetProducts(query);
    res.status(200).json({
      status: "success",
      data,
    });
  };

  getProductById = async (req: Request, res: Response) => {
    const productId = req.params.id as string;

    const product = await this.productService.GetProductById(productId);

    res.status(200).json({
      status: "success",
      data: {
        product,
      },
    });
  };

  getProductsByCategory = async (req: Request, res: Response) => {
    const category = req.params.type as string;
    const query = req.query as unknown as Record<string, string | undefined>

    const products = await this.productService.GetProductByCategory(category, query);

    res.status(200).json({
      status: "success",
      data: {
        products,
      },
    });
  };

  getSelectedProducts = async (req: Request, res: Response) => {
    const { ids } = req.body;

    const products = await this.productService.GetSelectedProducts(ids);

    res.status(200).json({
      status: "success",
      data: {
        products,
      },
    });
  };

  getCategories = async (req: Request, res: Response) => {
    const categories = await this.productService.getCategory()

    res.status(200).json({
      status: "success",
      data: {
        categories
      }
    })
  }
}
