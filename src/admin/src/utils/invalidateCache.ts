import { redis } from "./redis.js";

export async function invalidateCacheByPattern(pattern: string) {
  const stream = redis.scanStream({ match: pattern });

  for await (const resultkeys of stream) {
    for (const key of resultkeys) await redis.del(key);
  }
}