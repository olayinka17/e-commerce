import { startGrpcclient } from "../grpc/grpc-client.js";
import { startPrductsGrpcClient } from "../grpc/grpc-products-client.js";
import { startInventoryGrpcClient } from "../grpc/grpc-inventory-client.js";

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
