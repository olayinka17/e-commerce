import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Router from "./route/admin.js"
import {globalErrorHandler} from "./controller/error.js"
import CustomError from "./utils/CustomError.js";

const app = express();

app.use(express.json())
app.use("/api/v1/admin", Router)

app.get("/api/v1", (req: Request, res: Response) => {
  res.send("welcome to the home API")
})

app.use((req: Request, Response, next: NextFunction) => {
  next(new CustomError(`can't find ${req.originalUrl} on this server`, 404))
})

app.use(globalErrorHandler)

export default app;
