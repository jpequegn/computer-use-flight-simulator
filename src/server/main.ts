import { pathToFileURL } from "node:url";

import { createServer } from "./app.js";

export async function startServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 4317);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = await createServer({ serveWeb: process.env.NODE_ENV === "production" });
  await server.listen({ port, host });
  process.stdout.write(`Simulator API listening on http://${host}:${String(port)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startServer();
