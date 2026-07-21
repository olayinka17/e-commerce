import type { Request, Response, NextFunction } from "express";

import { ShoppingService } from "../service/shopping.js";
import { redis } from "../utils/redis.js";

import { subscribeEvent } from "../utils/eventHandler.js";

export class ShoppingController {
  public shoppingService = new ShoppingService();

  constructor() {
    (async () => {
      await subscribeEvent(this.shoppingService);
    })();
  }

  // orders
  createOrder = async (req: Request, res: Response) => {
    const { id, email } = req.user;

    const { order, response } = await this.shoppingService.CreateNewOrder(
      id,
      email,
    );

    res.status(201).json({
      status: "success",
      data: {
        order,
        response,
      },
    });
  };

  getOrders = async (req: Request, res: Response) => {
    const { id } = req.user;

    const query = req.query as unknown as Record<string, string | undefined>;
    const redisKey: string = `orders:user${id}:${req.originalUrl}`;

    const orders = await this.shoppingService.GetOrders(id, query);

    await redis.setex(redisKey, 60, JSON.stringify(orders));

    res.status(200).json({
      status: "success",
      data: {
        orders,
      },
    });
  };

  getOrderById = async (req: Request, res: Response) => {
    const order_id = req.params.id as string;

    const order = await this.shoppingService.GetOrderbyId(order_id);

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  };

  getOrderStatus = async (req: Request, res: Response) => {
    const order_id = req.params.id as string;

    const order = await this.shoppingService.getOrderStatus(order_id);

    res.status(200).json({
      status: "success",
      data: {
        order,
      },
    });
  };

  // wishlist
  addToWishlist = async (req: Request, res: Response) => {
    const { id } = req.user;
    const { product_id } = req.body;

    const wishlist = await this.shoppingService.addToWishlist(id, product_id);

    res.status(201).json({
      status: "success",
      data: {
        wishlist,
      },
    });
  };

  removeFromWishlist = async (req: Request, res: Response) => {
    const { id } = req.user;
    const product_id = req.params.product_id as string;

    const wishlist = await this.shoppingService.ManageWishlist(
      id,
      { id: product_id },
      true,
    );

    res.status(200).json({
      status: "success",
      data: {
        wishlist,
      },
    });
  };

  getWishlist = async (req: Request, res: Response) => {
    const { id } = req.user;

    const wishlist = await this.shoppingService.GetWishlistByCustomerId(id);

    res.status(200).json({
      status: "success",
      data: {
        wishlist,
      },
    });
  };

  // cart

  addCartItem = async (req: Request, res: Response) => {
    const { id } = req.user;

    const { product_id, qty } = req.body;

    const cart = await this.shoppingService.addToCart(id, product_id, qty);

    res.status(201).json({
      status: "success",
      data: {
        cart,
      },
    });
  };

  removeCartItem = async (req: Request, res: Response) => {
    const { id } = req.user;

    const product_id = req.params.product_id as string;

    const cart = await this.shoppingService.ManageCart(
      id,
      { id: product_id },
      0,
      true,
    );

    res.status(200).json({
      status: "success",
      data: {
        cart,
      },
    });
  };

  getCartById = async (req: Request, res: Response) => {
    const { id } = req.user;

    const cart = await this.shoppingService.GetCartByCustomerId(id);

    res.status(200).json({
      status: "success",
      data: {
        cart,
      },
    });
  };

  webhook = async (req: Request, res: Response) => {
    const body = req.body;
    const signature = req.headers["x-paystack-signature"] as string;

    await this.shoppingService.webhook(body, signature);

    res.status(200);
  };
}
