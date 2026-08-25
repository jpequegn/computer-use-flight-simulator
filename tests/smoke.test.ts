import { describe, expect, it } from "vitest";

import { PACKAGE_NAME, VERSION } from "../src/version.js";

describe("package foundation", () => {
  it("publishes a stable identity", () => {
    expect(PACKAGE_NAME).toBe("computer-use-flight-simulator");
    expect(VERSION).toBe("0.1.0");
  });
});
