import { startGrpcclient, shutdownGRPCClient } from "../grpc/grpc-client.js";
import { startPrductsGrpcClient, shutdownGRPCProductClient } from "../grpc/grpc-products-client.js";
import { startInventoryGrpcClient, shutdownGRPCInventoryClient } from "../grpc/grpc-inventory-client.js";

export let client: Awaited<ReturnType<typeof startGrpcclient>>;
export let ProductClient: Awaited<ReturnType<typeof startPrductsGrpcClient>>;
export let InventoryClient: Awaited<
  ReturnType<typeof startInventoryGrpcClient>
>;
export async function bootstrap() {
  client = await startGrpcclient();
  ProductClient = await startPrductsGrpcClient();
  InventoryClient = await startInventoryGrpcClient();
}

export async function shutdown() {
  await shutdownGRPCClient(client);
  await shutdownGRPCInventoryClient(InventoryClient);
  await shutdownGRPCProductClient(ProductClient);
}
