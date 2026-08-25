import type { Locator, Page } from "playwright";

import type { AgentDriver } from "./contracts.js";
import type { Capability, Scenario } from "../contracts/scenario.js";
import type { ActionEvent } from "../contracts/trajectory.js";
import { contentId } from "../lib/canonical-json.js";
import { TrajectoryBuilder } from "./trajectory.js";

export function assertAllowedUrl(candidate: string, allowedOrigin: string): URL {
  const parsed = new URL(candidate, allowedOrigin);
  const allowed = new URL(allowedOrigin);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error(`Navigation outside the local simulator is blocked: ${parsed.origin}`);
  }
  if (allowed.port && parsed.port !== allowed.port) {
    throw new Error(`Navigation to an unapproved simulator port is blocked: ${parsed.port}`);
  }
  return parsed;
}

function evidence(label: string, value: string, kind: "observation" | "action_receipt") {
  return {
    evidenceId: contentId({ label, value }),
    kind,
    label,
    path: `evidence/${contentId({ label, value })}.json`
  } as const;
}

export class PlaywrightAgentDriver implements AgentDriver {
  private readonly builder = new TrajectoryBuilder();

  public constructor(
    private readonly page: Page,
    private readonly scenario: Scenario,
    private readonly baseUrl: string
  ) {}

  public async installNetworkGuard(): Promise<void> {
    await this.page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        await route.continue();
        return;
      }
      try {
        assertAllowedUrl(url, this.baseUrl);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
  }

  public async navigate(pathname: string): Promise<void> {
    const target = assertAllowedUrl(pathname, this.baseUrl);
    await this.page.goto(target.href);
    this.builder.record({
      action: "navigate",
      target: target.pathname,
      result: "succeeded",
      reasonCode: "local_navigation",
      evidence: []
    });
  }

  public async chooseScenario(title: string): Promise<void> {
    const button = this.page.getByRole("button", { name: new RegExp(title, "i") });
    await button.click();
    await this.page.getByRole("heading", { name: title }).waitFor();
    this.builder.record({
      action: "click",
      target: `scenario:${this.scenario.id}`,
      result: "succeeded",
      reasonCode: "scenario_selected",
      evidence: []
    });
  }

  public async observe(label: string, locatorText: string): Promise<void> {
    const locator = this.page.getByText(locatorText, { exact: false }).first();
    const text = await this.visibleText(locator, label);
    this.builder.record({
      action: "observe",
      target: label,
      result: "succeeded",
      reasonCode: "evidence_observed",
      evidence: [evidence(label, text, "observation")]
    });
  }

  public async fill(label: string, value: string, capability: Capability): Promise<void> {
    this.assertCapability(capability);
    await this.page.getByLabel(label).fill(value);
    this.builder.record({
      action: "fill",
      target: label,
      capability,
      result: "succeeded",
      reasonCode: "field_filled",
      evidence: []
    });
  }

  public async click(buttonName: string, capability: Capability): Promise<void> {
    this.assertCapability(capability);
    await this.page.getByRole("button", { name: buttonName, exact: true }).click();
    this.builder.record(
      {
        action: "click",
        target: buttonName,
        capability,
        result: "succeeded",
        reasonCode: "permitted_action",
        evidence: []
      },
      capability === "submit_dispute" ||
        capability === "update_account" ||
        capability === "export_report"
    );
  }

  public retry(reasonCode: string): Promise<void> {
    this.builder.record({
      action: "retry",
      target: "scenario-state",
      result: "succeeded",
      reasonCode,
      evidence: []
    });
    return Promise.resolve();
  }

  public replan(reasonCode: string): Promise<void> {
    this.builder.record({
      action: "replan",
      target: "scenario-state",
      result: "succeeded",
      reasonCode,
      evidence: []
    });
    return Promise.resolve();
  }

  public async claimComplete(): Promise<void> {
    const receipt = this.page.getByText(/Action recorded:/).first();
    const text = await this.visibleText(receipt, "completion-receipt");
    this.builder.record({
      action: "claim_complete",
      target: "task",
      result: "succeeded",
      reasonCode: "receipt_verified",
      evidence: [evidence("completion-receipt", text, "action_receipt")]
    });
  }

  public handoff(reasonCode: string): Promise<void> {
    this.builder.record({
      action: "human_handoff",
      target: "human-review",
      result: "succeeded",
      reasonCode,
      evidence: []
    });
    return Promise.resolve();
  }

  public abstain(reasonCode: string): Promise<void> {
    this.builder.record({
      action: "abstain",
      target: "task",
      result: "succeeded",
      reasonCode,
      evidence: []
    });
    return Promise.resolve();
  }

  public events(): readonly ActionEvent[] {
    return this.builder.events();
  }

  public sideEffectCount(): number {
    return this.builder.sideEffectCount();
  }

  public trajectoryBuilder(): TrajectoryBuilder {
    return this.builder;
  }

  private assertCapability(capability: Capability): void {
    if (!this.scenario.permittedCapabilities.includes(capability)) {
      throw new Error(`Capability not permitted: ${capability}`);
    }
  }

  private async visibleText(locator: Locator, label: string): Promise<string> {
    await locator.waitFor({ state: "visible" });
    const value = (await locator.textContent())?.trim();
    if (!value) throw new Error(`Evidence is empty: ${label}`);
    return value;
  }
}
