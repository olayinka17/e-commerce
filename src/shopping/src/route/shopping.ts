import express from "express";
import { shoppingController } from "../shopping-controller.js";
import { CatchAsync } from "../utils/CatchAsync.js";
import { protect } from "../middleware/auth.js";
import { orderCached } from "../middleware/cacheMiddleware.js";


const Router = express.Router();

Router.post(
  "/webhook",
  CatchAsync<{}, any, {}, {}>(shoppingController.webhook),
);
Router.use(protect);
// cart
Router.post(
  "/carts",
  CatchAsync<{}, any, { product_id: string; qty: number }, {}>(
    shoppingController.addCartItem,
  ),
);
Router.delete(
  "/carts/:product_id",
  CatchAsync<{ id: string }, any, {}, {}>(shoppingController.removeCartItem),
);
Router.get(
  "/carts",
  CatchAsync<{}, any, {}, {}>(shoppingController.getCartById),
);

//wishlist
Router.post(
  "/wishlists",
  CatchAsync<{}, any, { product_id: string }, {}>(
    shoppingController.addToWishlist,
  ),
);
Router.delete(
  "/wishlists/:product_id",
  CatchAsync<{ id: string }, any, {}, {}>(
    shoppingController.removeFromWishlist,
  ),
);
Router.get(
  "/wishlists",
  CatchAsync<{}, any, {}, {}>(shoppingController.getWishlist),
);

//order
Router.post(
  "/orders",
  CatchAsync<{}, any, {}, {}>(shoppingController.createOrder),
);
Router.get(
  "/orders/:id",
  CatchAsync<{ id: string }, any, {}, {}>(shoppingController.getOrderById),
);
Router.get(
  "/orders",
  orderCached,
  CatchAsync<{}, any, {}, Record<string, string | undefined>>(
    shoppingController.getOrders,
  ),
);

Router.get(
  "/status/:id",
  CatchAsync<{ id: string }, any, {}, {}>(shoppingController.getOrderStatus),
);

export default Router;
