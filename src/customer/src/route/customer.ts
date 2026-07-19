import express from "express"
import { signup, login, forgotPassword, resetPassword, request_reactivation, reactivate_account, validateUser, resendOtp, verifyOTP } from "../controller/customer.js"

const Router = express.Router()

Router.post("/signup", signup)
Router.post("/login", login)
Router.post("/forgotpassword", forgotPassword)
Router.patch("/resetpassword", resetPassword)
Router.post("/verify-otp", verifyOTP)
Router.post("/resend", resendOtp)
Router.post("/reactivate", request_reactivation)
Router.patch("/activate", reactivate_account)
Router.get("/verify", validateUser)
export default Router