import express from "express"
import { ProductController } from "../controller/product.js"
import { CatchAsync } from "../utils/CatchAsync.js"
import { productCache } from "../middleware/cacheMiddleware.js"
export const controller = new ProductController()

const Router = express.Router()

Router.get("/category/:type", CatchAsync<{type: string}, any, {}, {}>(controller.getProductsByCategory))
Router.get("/:id", CatchAsync<{id: string}, any, {}, {}>(controller.getProductById))
Router.post("/ids", CatchAsync<{}, any, {ids: string[]}, {}>(controller.getSelectedProducts))
Router.get("/", productCache,CatchAsync<{}, any, {}, Record<string, string | undefined>>(controller.getProducts))
Router.get("/categories", CatchAsync<{}, any, {}, {}>(controller.getCategories))

export default Router