import { describe, expect, it } from "vitest";

import { assertAllowedUrl } from "../src/agent/browser-driver.js";

describe("browser origin guard", () => {
  it("allows local simulator paths", () => {
    expect(assertAllowedUrl("/api/health", "http://127.0.0.1:4318").href).toBe(
      "http://127.0.0.1:4318/api/health"
    );
  });

  it("blocks external hosts and unapproved local ports", () => {
    expect(() => assertAllowedUrl("https://example.com", "http://127.0.0.1:4318")).toThrow(
      "outside the local simulator"
    );
    expect(() => assertAllowedUrl("http://127.0.0.1:9999", "http://127.0.0.1:4318")).toThrow(
      "unapproved simulator port"
    );
  });
});
