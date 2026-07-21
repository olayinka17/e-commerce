import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Router from "./route/shopping.js";
import globalErrorHandler from "./controller/error.js";
import CustomError from "./utils/CustomError.js";

const app = express();

app.use(express.json());

app.use("/api/v1/shopping", Router);

app.get("api/v1/", (req: Request, res: Response, next: NextFunction) => {
  next(new CustomError(`can't find ${req.originalUrl}, on this server`, 404));
});
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new CustomError(`can't find ${req.originalUrl} on this server`, 404));
});
app.use(globalErrorHandler);

export default app;
