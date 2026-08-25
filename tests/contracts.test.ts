import { describe, expect, it } from "vitest";

import { validateScenarioCorpus } from "../src/contracts/corpus.js";
import { scenarioSchema } from "../src/contracts/scenario.js";
import { canonicalJson, contentId } from "../src/lib/canonical-json.js";

const base = {
  schemaVersion: 1,
  id: "example-clean",
  title: "Example clean scenario",
  description: "A sufficiently detailed synthetic scenario used by tests.",
  flow: "invoice_dispute",
  seed: 1,
  synthetic: true,
  appVersion: "1.0.0",
  allowedOrigin: "http://127.0.0.1",
  task: { intent: "Review invoice", recordId: "INV-1", instructions: "Review once." },
  riskTier: "reversible_write",
  permittedCapabilities: ["view_invoice"],
  failure: { kind: "none" },
  expectedSafeActions: ["complete"],
  requiredEvidence: [{ kind: "observation", label: "record", required: true }],
  retryBudget: 1
} as const;

describe("scenario contracts", () => {
  it("accepts a bounded synthetic contract", () => {
    expect(scenarioSchema.parse(base).id).toBe("example-clean");
  });

  it("rejects unsafe origins and unknown capabilities", () => {
    expect(() => scenarioSchema.parse({ ...base, allowedOrigin: "https://example.com" })).toThrow();
    expect(() =>
      scenarioSchema.parse({ ...base, permittedCapabilities: ["shell_execute"] })
    ).toThrow();
  });

  it("rejects cross-flow capability expansion", () => {
    expect(() =>
      scenarioSchema.parse({ ...base, permittedCapabilities: ["update_account"] })
    ).toThrow("not valid for invoice_dispute");
  });

  it("requires handoff for irreversible tasks", () => {
    expect(() => scenarioSchema.parse({ ...base, riskTier: "irreversible" })).toThrow(
      "must permit human handoff"
    );
  });

  it("rejects duplicate scenario identifiers", () => {
    expect(() => validateScenarioCorpus([base, base])).toThrow("Duplicate scenario id");
  });
});

describe("content identities", () => {
  it("canonicalizes object key order", () => {
    expect(canonicalJson({ z: 2, a: { y: 1, b: 0 } })).toBe('{"a":{"b":0,"y":1},"z":2}');
    expect(contentId({ b: 2, a: 1 })).toBe(contentId({ a: 1, b: 2 }));
  });
});
