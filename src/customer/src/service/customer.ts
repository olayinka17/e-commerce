import crypto from "crypto";
import "dotenv/config";
import CustomError from "../utils/customError.js";
import { prisma } from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/otp.js";
import { redis } from "../utils/redis.js";

import { verifyJWT } from "../utils/jwt.js";
import { sendResetEmail, sendUserEmail } from "../utils/email.js";

interface SignUpI {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}
interface UserI {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
}

interface VerifyI {
  email: string;
  code: number;
}

interface LoginI {
  email: string;
  password: string;
}

export const signUpService = async ({
  first_name,
  last_name,
  email,
  password,
}: SignUpI): Promise<object> => {
  // try and remove this and handle duplicate error
  // const existingUser = await prisma.user.findUnique({ where: { email } });

  // if (existingUser) {
  //   throw new CustomError("An account with this email already exists", 400);
  // }

  const hashpassword: string = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: {
      first_name,
      last_name,
      password: hashpassword,
      email,
    },
  });

  // Generate OTP
  const otp = generateOTP();

  const redisKey: string = `customer-service:OTP:${email}`;

  await redis.set(redisKey, bcrypt.hashSync(otp.toString()), "EX", 300);
  // await redis.hset(redisKey, {
  //   OTP: otp.code,
  //   expires_at: otp.expiry,
  // });
  // await redis.expire(redisKey, 60 * 11);

  // email service
  await sendUserEmail(email, otp);
  console.log(`OTP for ${email}: ${otp}`); // For testing purposes only, remove in production

  return { message: "OTP sent successfully" };
};

export const verifyOTPService = async ({
  email,
  code,
}: VerifyI): Promise<UserI> => {
  const redisKey: string = `customer-service:OTP:${email}`;
  const Otpcode: string = String(await redis.get(redisKey));

  if (!Otpcode) {
    console.log("kjsjsj")
    throw new CustomError("Invalid or expired OTP", 400);
  }

  const isValid = bcrypt.compareSync(code.toString(), Otpcode);

  if (!isValid) throw new CustomError("Invalid or Expired OTP", 400);
  await redis.del(redisKey);
  console.log("jdjdjd")

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email },
      data: { is_verified: true },
    });

    await tx.emailOutbox.create({
      data: {
        aggregateid: user.id,
        aggregatetype: "email",
        eventtype: "NEW_USER",
        payload: {
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
        },
      },
    });
    const { password: _, ...safeUser } = user;
    return safeUser;
  });
  // const user = await prisma.user.update({
  //   where: { email },
  //   data: { is_verified: true },
  // });

  console.log(user)
  return user;
};

export const resendOtpService = async (
  email: string,
  is_reset = false,
): Promise<object> => {
  const redisKey: string = `customer-service:OTP:${email}`;
  const rateKey: string = `otp:rate:${email}`;
  const count = await redis.incr(rateKey);

  if (count === 1) {
    await redis.expire(rateKey, 60);
  }

  if (count > 3) {
    throw new CustomError("Too many OTP requests", 429);
  }

  const cooldownKey = `otp:cooldown:${email}`;

  const exists = await redis.get(cooldownKey);
  const coolttl = await redis.ttl(cooldownKey)

  if (exists) {
    throw new CustomError(`Please wait before requesting another OTP. retry after ${coolttl}`, 429);
  }

  await redis.set(cooldownKey, "1", "EX", 30);

  const existingOtp = await redis.get(redisKey);
  const ttl = await redis.ttl(redisKey);

  let otpTosend: string;

  if (!existingOtp) {
    await redis.del(rateKey)
    await redis.del(cooldownKey)
    throw new CustomError(
      "Invalid request state. please request a new OTP",
      400,
    );
  }

  if (existingOtp && ttl > 60) {
    otpTosend = existingOtp;
  } else {
    const otp = generateOTP();

    otpTosend = otp.toString();

    await redis.set(redisKey, bcrypt.hashSync(otpTosend), "EX", 300);
  }

  //email service
  if (is_reset) {
    await sendResetEmail(email, Number(otpTosend));
  } else {
    await sendUserEmail(email, Number(otpTosend));
  }

  console;
  return { message: "OTP sent successfully" };
};

export const loginService = async ({
  email,
  password,
}: LoginI): Promise<UserI> => {
  const user = await prisma.current_users.findFirst({
    where: { email },
  });

  if (!user) {
    throw new CustomError("Invalid Credentials", 400);
  }
  if (!user.is_verified) {
    throw new CustomError("please verify your account", 400);
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new CustomError("Invalid Credentials", 400);
  }

  return user;
};

export const forgotPasswordService = async (email: string): Promise<object> => {
  const user = await prisma.current_users.findUnique({
    where: { email, is_verified: true },
  });

  if (!user) throw new CustomError("Invalid Credentials", 400);

  // const resetToken = crypto.randomBytes(32).toString("hex");

  // const resetTokenHash = crypto
  //   .createHash("sha256")
  //   .update(resetToken)
  //   .digest("hex");

  // const expiry = Date.now() + 10 * 60 * 1000;
  // await prisma.token.create({
  //   data: {
  //     email,
  //     token: resetTokenHash,
  //     expires_at: expiry,
  //   },
  // });

  const otp = generateOTP();

  const redisKey: string = `customer-service:OTP:${email}`;

  await redis.set(redisKey, bcrypt.hashSync(otp.toString()), "EX", 300);

  await sendResetEmail(email, otp);
  console.log(`OTP for ${email}: ${otp}`); // For testing purposes only, remove in production
  return { message: "OTP sent successfully" };

  // email service
};

export const resetPasswordService = async (
  password: string,
  code: string,
  email: string,
): Promise<UserI> => {
  // const hashToken = crypto.createHash("sha256").update(token).digest("hex");

  // const record = await prisma.token.findFirst({
  //   where: {
  //     token: hashToken,
  //   },
  // });
  const redisKey: string = `customer-service:OTP:${email}`;
  const Otpcode: string = String(await redis.get(redisKey));

  if (!Otpcode) {
    throw new CustomError("Invalid or expired OTP", 400);
  }

  const isValid = bcrypt.compareSync(code.toString(), Otpcode);

  if (!isValid) throw new CustomError("Invalid or Expired OTP", 400);

  await redis.del(redisKey);

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword, password_change_at: new Date() },
  });

  return user;
};

// TODO: verify the owner if acct is making the request
export const deleteUser = async (email: string) => {
  const user = await prisma.user.update({
    where: {
      email,
    },
    data: {
      active: false,
    },
  });

  return user;
};

export const reactivate_requestService = async (email: string) => {
  const user = await prisma.current_users.findUnique({
    where: {
      email,
    },
  });

  if (user) {
    throw new CustomError("BAD Request", 400);
  }

  const token = crypto.randomBytes(32).toString("hex");

  const redisKey: string = `customer-service:OTP:${email}`;

  await redis.set(redisKey, bcrypt.hashSync(token.toString()), "EX", 300);
  const reesetUrl = `http://localhost:${process.env.PORT}/api/v1/reactivate/${token}`;
  //email service

  return {
    message:
      "reactivation link has been sent to your email, kindly check your email",
  };
};

export const reactivate_accountService = async (
  token: string,
  email: string,
) => {
  const user = await prisma.current_users.findUnique({
    where: {
      email,
    },
  });

  if (user) throw new CustomError("Invalid request", 400);

  const redisKey: string = `customer-service:token:${email}`;

  const original_token: string = String(await redis.get(redisKey));

  if (!original_token) throw new CustomError("Invalid or expired token", 400);

  const is_valid = await bcrypt.compareSync(token, original_token);

  if (!is_valid) throw new CustomError("Invalid or expired token", 400);

  const update = await prisma.user.update({
    where: {
      email,
    },
    data: {
      active: true,
    },
  });

  return update;
};

export const validate_user = async (token: string) => {
  const decoded = await verifyJWT(token, process.env.JWT_SECRET!);

  const currentUser = await prisma.current_users.findFirst({
    where: {
      id: decoded.id,
    },
  });

  if (!currentUser) {
    throw new CustomError("Invalid Request", 400);
  }

  //const time = currentUser?.password_change_at?.getTime() / 1000
  if (
    currentUser.password_change_at &&
    currentUser?.password_change_at?.getTime() / 1000 > decoded.iat!
  ) {
    throw new CustomError("Invalid Request", 400);
  }

  return {
    id: currentUser.id,
    email: currentUser.email,
    role: currentUser.role,
  };
  //const {password: _, ...user} = currentUser!

  // return user
};
