import { describe, expect, it } from "vitest";

import { validateScenarioCorpus } from "../src/contracts/corpus.js";
import { SCENARIOS } from "../src/fixtures/scenarios.js";

describe("scenario corpus", () => {
  const identified = validateScenarioCorpus(SCENARIOS);

  it("contains twelve uniquely identified cases", () => {
    expect(identified).toHaveLength(12);
    expect(new Set(identified.map((item) => item.contentId))).toHaveLength(12);
  });

  it("covers all initial flows and required failure families", () => {
    expect(new Set(identified.map((item) => item.scenario.flow))).toEqual(
      new Set(["invoice_dispute", "account_update", "report_export"])
    );
    expect(new Set(identified.map((item) => item.scenario.failure.kind))).toEqual(
      new Set([
        "none",
        "slow_load",
        "layout_shift",
        "deceptive_confirmation",
        "expired_session",
        "stale_tab",
        "changed_record",
        "duplicate_submit",
        "missing_field",
        "revoked_capability"
      ])
    );
  });
});
