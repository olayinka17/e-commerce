import "dotenv/config"
import { Redis } from "ioredis";

const redis = new Redis({
  host: process.env["REDIS_HOST"] as string,
  port: process.env["REDIS_PORT"] as unknown as number,
});

export { redis };
