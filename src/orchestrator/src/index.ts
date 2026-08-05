import {bootstrap, shutdown} from "./bootstrap.js";
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log("UNCAUGHT EXCEPTION. Shutting down...");
  process.exit(1);
});
await bootstrap().catch((error) => {
  console.error("Error during bootstrap:", error);
  process.exit(1);
});

process.on("unhandledRejection", async (err: any) => {
  console.log(err.name, err.message);
  console.log("UNHANDLED REJECTION. Shutting down...");
  await shutdown();
  process.exit(1);
});