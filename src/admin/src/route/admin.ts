import express from "express";
import { AdminController } from "../controller/admin.js";
import { CatchAsync } from "../utils/CatchAsync.js";
import { protect, restrictTo } from "../middleware/auth.js";

const controller = new AdminController();

const Router = express.Router();

Router.use(protect);
Router.use(restrictTo("admin"));
Router.post(
  "/products",
  CatchAsync<
    {},
    any,
    { name: string; category_id: string; price: number; sku: string },
    {}
  >(controller.createProducts),
);
Router.get(
  "/revenue",
  CatchAsync<{}, any, {}, { now: string; to: string }>(
    controller.total_revenue,
  ),
);
Router.get(
  "/orders",
  CatchAsync<
    {},
    any,
    {},
    { limit?: string; beforeTimestamp?: string; status?: string }
  >(controller.Orders),
);
Router.get(
  "/transactions",
  CatchAsync<
    {},
    any,
    {},
    { limit?: string; beforeTimestamp?: string; status?: string }
  >(controller.Transactions),
);
Router.post(
  "/inventory/adjustments",
  CatchAsync<
    {},
    any,
    {
      product_id: string;
      qty: number;
      reference_type: string;
      reference_id: string;
      type: string;
    },
    {}
  >(controller.addMoreStock),
);

Router.delete(
  "/products/:id",
  CatchAsync<{ id: string }, any, {}, {}>(controller.archiveProduct),
);
Router.patch(
  "/products/:id",
  CatchAsync<{ id: string }, any, {}, {}>(controller.unarchiveProduct),
);

Router.patch("/products/info/:id", CatchAsync<{id: string}, any, {name?: string, category_id?: string, price?: number, sku?: string}, {}>(controller.updateProductInfo))

Router.post(
  "/categories",
  CatchAsync<{}, any, { name: string; description: string }, {}>(
    controller.createCategory,
  ),
);
export default Router;
