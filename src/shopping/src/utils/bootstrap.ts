import { startGrpcclient } from "../grpc/grpc-client.js";

export let client: Awaited<ReturnType<typeof startGrpcclient>>;

export async function bootstrap() {
  client = await startGrpcclient();
}
