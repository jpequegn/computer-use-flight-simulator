import { afterEach, describe, expect, it } from "vitest";

import { createServer } from "../src/server/app.js";
import type { SessionSnapshot } from "../src/server/state.js";

const servers: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => Promise.all(servers.splice(0).map(async (server) => server.close())));

describe("synthetic application API", () => {
  it("lists the bounded corpus and health boundary", async () => {
    const server = await createServer();
    servers.push(server);
    const health = await server.inject({ method: "GET", url: "/api/health" });
    expect(health.json()).toEqual({ status: "ok", synthetic: true });
    const scenarios = await server.inject({ method: "GET", url: "/api/scenarios" });
    expect(scenarios.json()).toHaveLength(12);
  });

  it("executes and resets one reversible action", async () => {
    const server = await createServer();
    servers.push(server);
    await server.inject({ method: "POST", url: "/api/sessions/invoice-clean/reset" });
    const action = await server.inject({
      method: "POST",
      url: "/api/sessions/invoice-clean/actions",
      payload: { action: "submit_dispute", expectedVersion: 1, payload: {} }
    });
    expect(action.statusCode).toBe(200);
    expect(action.json<SessionSnapshot>().record.disputeSubmitted).toBe(true);
    const reset = await server.inject({ method: "POST", url: "/api/sessions/invoice-clean/reset" });
    expect(reset.json<SessionSnapshot>().record.disputeSubmitted).toBe(false);
  });

  it("cannot address arbitrary scenarios", async () => {
    const server = await createServer();
    servers.push(server);
    const response = await server.inject({ method: "GET", url: "/api/sessions/../../etc/passwd" });
    expect(response.statusCode).toBe(404);
  });
});
