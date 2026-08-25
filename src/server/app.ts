import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import path from "node:path";

import { appActionSchema, ScenarioStore } from "./state.js";

export interface ServerOptions {
  serveWeb?: boolean;
  webRoot?: string;
}

export async function createServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });
  const store = new ScenarioStore();

  server.get("/api/health", () => ({ status: "ok", synthetic: true }));
  server.get("/api/scenarios", () =>
    store.list().map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      flow: scenario.flow,
      failureKind: scenario.failure.kind,
      riskTier: scenario.riskTier,
      taskIntent: scenario.task.intent
    }))
  );
  server.post<{ Params: { id: string } }>("/api/sessions/:id/reset", async (request, reply) => {
    try {
      return store.reset(request.params.id);
    } catch (error) {
      return reply
        .code(404)
        .send({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  server.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    try {
      return store.get(request.params.id);
    } catch (error) {
      return reply
        .code(404)
        .send({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  server.post<{ Params: { id: string } }>("/api/sessions/:id/actions", async (request, reply) => {
    try {
      return store.act(request.params.id, appActionSchema.parse(request.body));
    } catch (error) {
      return reply
        .code(409)
        .send({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  if (options.serveWeb) {
    await server.register(fastifyStatic, {
      root: options.webRoot ?? path.resolve("web-dist"),
      wildcard: false
    });
    server.get("/*", async (_request, reply) => reply.sendFile("index.html"));
  }
  return server;
}
