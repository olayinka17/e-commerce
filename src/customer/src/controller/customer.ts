import type { NextFunction, Request, Response } from "express";
import { CatchAsync } from "../utils/CatchAsync.js";
import { sendCreatedToken } from "../utils/jwt.js";
import {
  forgotPasswordService,
  loginService,
  reactivate_accountService,
  reactivate_requestService,
  resendOtpService,
  resetPasswordService,
  signUpService,
  validate_user,
  verifyOTPService,
} from "../service/customer.js";
import CustomError from "../utils/customError.js";

export const signup = CatchAsync<
  {},
  any,
  {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { first_name, last_name, email, password } = req.body;

  const message = await signUpService({
    first_name,
    last_name,
    email,
    password,
  });

  res.status(201).json({
    status: "success",
    data: message,
  });
});

export const verifyOTP = CatchAsync<
  {},
  any,
  {
    email: string;
    code: number;
  },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { email, code } = req.body;

  const newUser = await verifyOTPService({ email, code });
  console.log("sksk")
  sendCreatedToken(newUser, 200, res);
});

export const login = CatchAsync<
  {},
  any,
  {
    email: string;
    pasword: string;
  },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  const user = await loginService({ email, password });

  console.log("iisi")
  sendCreatedToken(user, 200, res);
});

export const forgotPassword = CatchAsync<
  {},
  any,
  {
    email: string;
  },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const email: string = req.body.email;

  const message = await forgotPasswordService(email);

  res.status(200).json({
    status: "success",
    data: message,
  });
});

export const resetPassword = CatchAsync<
  {},
  any,
  {
    password: string;
    email: string;
    code: string;
  },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { password, email, code } = req.body;

  const user = await resetPasswordService(password, code, email);

  sendCreatedToken(user, 200, res);
});

export const resendOtp = CatchAsync<
  {},
  any,
  { email: string; is_reset?: boolean },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { email, is_reset } = req.body;

  const message = await resendOtpService(email, is_reset);
  res.status(200).json({
    status: "success",
    data: message,
  });
});

export const request_reactivation = CatchAsync<{}, any, { email: string }, {}>(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    const message = await reactivate_requestService(email);

    res.status(200).json({
      status: "success",
      data: message,
    });
  },
);

export const reactivate_account = CatchAsync<
  {},
  any,
  { token: string; email: string },
  {}
>(async (req: Request, res: Response, next: NextFunction) => {
  const { token, email } = req.body;
  const user = await reactivate_accountService(token, email);

  sendCreatedToken(user, 200, res);
});

export const validateUser = CatchAsync<{}, {}, {}, {}>(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | null = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1] as string;
    }

    if (!token) {
      return next(new CustomError("please login", 401));
    }
    console.log("token", token);

    const decoded = await validate_user(token);

    res.set("x_user", JSON.stringify(decoded));
    // res.set("x-user-role") // set the user role
    res.status(200).end();
  },
);
