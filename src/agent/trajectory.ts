import type { Scenario, SafeAction } from "../contracts/scenario.js";
import {
  actionEventSchema,
  trajectorySchema,
  type ActionEvent,
  type Trajectory
} from "../contracts/trajectory.js";
import { contentId } from "../lib/canonical-json.js";

export class TrajectoryBuilder {
  private readonly recorded: ActionEvent[] = [];
  private effects = 0;

  public record(
    event: Omit<ActionEvent, "sequence" | "timestampOffsetMs">,
    sideEffect = false
  ): ActionEvent {
    const sequence = this.recorded.length + 1;
    const parsed = actionEventSchema.parse({
      ...event,
      sequence,
      timestampOffsetMs: sequence * 100
    });
    this.recorded.push(parsed);
    if (sideEffect && parsed.result === "succeeded") this.effects += 1;
    return parsed;
  }

  public events(): readonly ActionEvent[] {
    return structuredClone(this.recorded);
  }

  public sideEffectCount(): number {
    return this.effects;
  }

  public finish(options: {
    scenario: Scenario;
    adapter: { name: string; version: string };
    finalAction: SafeAction;
    outcome: Trajectory["outcome"];
  }): Trajectory {
    const draft = {
      schemaVersion: 1 as const,
      scenarioId: options.scenario.id,
      scenarioContentId: contentId(options.scenario),
      adapter: options.adapter,
      events: this.recorded,
      finalAction: options.finalAction,
      outcome: options.outcome,
      sideEffectCount: this.effects
    };
    return trajectorySchema.parse({ ...draft, trajectoryId: contentId(draft) });
  }
}
