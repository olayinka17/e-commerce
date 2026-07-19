import { redis } from "./redis.js";

// redis.defineCommand("releaseLock", {
//   numberOfKeys: 1,
//   lua: `
//         if redis.call("get", KEYS[1]) == ARGV[1] then
//             return redis.call("del", KEYS[1])
//         else
//             return 0
//         end
//     `,
// });

const LUA_SCRIPT = `
    local key = KEYS[1]
    local value = ARGV[1]

    if redis.call('get', key) == value then 
        return redis.call('del', key)
    else
        return 0
    end
`;

export async function acquireLock(
  lockKey: string,
  token: string,
  acquire_timeout: number,
  lock_timeout: number,
) {
  const end = Date.now() + acquire_timeout * 1000;

  while (Date.now() < end) {
    const result = await redis.set(lockKey, token, "EX", lock_timeout, "NX");
    if (result) {
      return token;
    }
  }

  return false;
}

export async function release_lock(lockKey: string, token: string) {
  const result = await redis.eval(
    LUA_SCRIPT,
    1,
    lockKey.toString(),
    token.toString(),
  );
  return result === 1
}
