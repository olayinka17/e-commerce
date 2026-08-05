import { startGrpcclient, shutdownGRPCClient } from "../grpc/grpc-client.js";

export let client: Awaited<ReturnType<typeof startGrpcclient>>;

export async function bootstrap() {
  client = await startGrpcclient();
}

export async function shutdown() {
  await shutdownGRPCClient(client);
}
