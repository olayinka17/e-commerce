import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import "dotenv/config";

const signToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "jwt_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN as unknown as number,
  });
};

export const sendCreatedToken = (
  user: any,
  statusCode: number,
  res: Response,
) => {
  const token = signToken(user.id);
  user.password = undefined;
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

export function verifyJWT<T extends object = JwtPayload>(
  token: string,
  secret: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decode) => {
      if (err || !decode) {
        return reject(err);
      }
      resolve(decode as T);
    });
  });
}
