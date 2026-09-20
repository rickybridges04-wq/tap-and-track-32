// Shared, browser-safe Step schema for automated test cases.
// Validated everywhere a step is saved or served to the worker.
import { z } from "zod";

export const STEP_ACTIONS = [
  "goto",
  "fill",
  "click",
  "select",
  "press",
  "check",
  "wait_for",
  "expect_text",
  "expect_not_text",
  "expect_url",
  "expect_visible",
  "expect_hidden",
  "expect_count",
  "expect_status",
] as const;

export type StepAction = (typeof STEP_ACTIONS)[number];

export const StepSchema = z.object({
  action: z.enum(STEP_ACTIONS),
  selector: z.string().max(500).optional(),
  value: z.string().max(2000).optional(),
  timeout_ms: z.number().int().min(100).max(60000).optional(),
});

export type Step = z.infer<typeof StepSchema>;

export const StepsSchema = z.array(StepSchema).max(200);

export const DEFAULT_TIMEOUT_MS = 10000;

/** Human label for the steps editor dropdown. */
export const STEP_LABELS: Record<StepAction, string> = {
  goto: "Go to path",
  fill: "Type into field",
  click: "Click",
  select: "Select option",
  press: "Press key",
  check: "Check box",
  wait_for: "Wait for element",
  expect_text: "Expect text present",
  expect_not_text: "Expect text absent",
  expect_url: "Expect URL contains",
  expect_visible: "Expect visible",
  expect_hidden: "Expect hidden",
  expect_count: "Expect element count",
  expect_status: "Expect HTTP status",
};

/** Whether the action uses the selector / value field, for editor hints. */
export const STEP_FIELDS: Record<StepAction, { selector: boolean; value: boolean }> = {
  goto: { selector: false, value: true },
  fill: { selector: true, value: true },
  click: { selector: true, value: false },
  select: { selector: true, value: true },
  press: { selector: true, value: true },
  check: { selector: true, value: false },
  wait_for: { selector: true, value: false },
  expect_text: { selector: false, value: true },
  expect_not_text: { selector: false, value: true },
  expect_url: { selector: false, value: true },
  expect_visible: { selector: true, value: false },
  expect_hidden: { selector: true, value: false },
  expect_count: { selector: true, value: true },
  expect_status: { selector: false, value: true },
};
