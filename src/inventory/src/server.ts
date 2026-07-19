import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { KafkaService } from "@enterprise/kafka-common";
import { InventoryService } from "./service/inventory.js";
import { subscribeEvent } from "./util/eventHandler.js";
import { grpcHandler } from "./util/grpc-handler-wrapper.js";
import { Observer } from "./util/RpcFunctions.js";

const PROTO_PATH = path.join(process.cwd(), "src/inventory.proto");

let server: grpc.Server;
let kafkaService: KafkaService;

export async function startServer(startJobs = true) {
  if (startJobs) {
    await import("./util/background-job.js");
  }
  kafkaService = new KafkaService({
    clientId: "inventory-service",
    brokers: [process.env.KAFKA_BROKERS as string],
  });
  const inventoryService = new InventoryService();

  await kafkaService.connect();
  await subscribeEvent(inventoryService, kafkaService);

  const observer = new Observer(inventoryService);

  const packageDef = protoloader.loadSync(PROTO_PATH, {
    longs: String,
    keepCase: true,
  });

  const grpcObject = grpc.loadPackageDefinition(packageDef) as any;
  const inventoryPackage = grpcObject.inventoryPackage;

  server = new grpc.Server();

  server.addService(inventoryPackage.Inventory.service, {
    addMoreStock: grpcHandler(observer.addMoreStock),
  });

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      "localhost:40100",
      grpc.ServerCredentials.createInsecure(),
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export async function stopServer() {
  if (server) {
    await new Promise<void>((resolve) => {
      server.tryShutdown(() => resolve());
    });
  }

  if (kafkaService) {
    await kafkaService.disconnect();
    await kafkaService.disconnectConsumer()
  }
}
