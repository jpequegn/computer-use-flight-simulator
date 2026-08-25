// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "../web/src/components/StatusBadge.js";

describe("StatusBadge", () => {
  it("normalizes contract labels for operators", () => {
    render(<StatusBadge tone="warning">slow_load</StatusBadge>);
    expect(screen.getByText("slow load")).toHaveClass("status-warning");
  });
});
