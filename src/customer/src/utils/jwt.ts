import fs from 'fs'
import path from 'path'
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import "dotenv/config";

function getSecret(secretName: string) {
  try {
    // Docker mounts secrets to /run/secrets/ by default
    const secretPath = path.join('/run/secrets', secretName);
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    // Fallback to environment variables for local development flexibility
    return process.env[secretName]; 
  }
}

const jwt_secret = getSecret("JWT_SECRET") as string


const signToken = (id: string) => {
  return jwt.sign({ id }, jwt_secret || "jwt_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN as unknown as number || "3h" as unknown as number,
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
