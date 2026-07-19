import express, { type NextFunction, type Request, type Response } from "express"
import Router from "./route/customer.js"
import globalErrorHandler from "./controller/error.js"
import CustomError from "./utils/customError.js"


const app = express()
app.use(express.json())

app.use("/api/v1/users", Router)

app.get("/api/v1/", (req: Request, res: Response) => {
    res.send("welcome to the home API")
})

app.use((req: Request, res: Response, next: NextFunction) => {
    next (new CustomError(`cant find ${req.originalUrl} n this server`, 404))
})

app.use(globalErrorHandler)

export default app