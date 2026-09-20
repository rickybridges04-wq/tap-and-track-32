// Regression diff between two automated runs of the same project.
export type CaseVerdict = "pass" | "fail" | "error";

export type DiffState =
  | "newly_failing"
  | "fixed"
  | "still_failing"
  | "still_passing"
  | "new_case";

export type DiffRow = {
  case_id: string;
  code: string;
  title: string;
  current: CaseVerdict | null;
  previous: CaseVerdict | null;
  state: DiffState;
  flaky: boolean;
};

export const DIFF_LABEL: Record<DiffState, string> = {
  newly_failing: "Newly failing",
  fixed: "Fixed",
  still_failing: "Still failing",
  still_passing: "Still passing",
  new_case: "New case",
};

export const DIFF_CLASS: Record<DiffState, string> = {
  newly_failing: "bg-rose-500/15 text-rose-600",
  fixed: "bg-emerald-500/15 text-emerald-600",
  still_failing: "bg-orange-500/15 text-orange-600",
  still_passing: "bg-muted text-muted-foreground",
  new_case: "bg-blue-500/15 text-blue-600",
};

function failed(v: CaseVerdict | null | undefined): boolean {
  return v === "fail" || v === "error";
}

export function diffState(
  current: CaseVerdict | null,
  previous: CaseVerdict | null,
): DiffState {
  if (previous == null) return "new_case";
  if (failed(current) && !failed(previous)) return "newly_failing";
  if (!failed(current) && failed(previous)) return "fixed";
  if (failed(current) && failed(previous)) return "still_failing";
  return "still_passing";
}

/** Flaky = the case flipped pass↔fail at least twice across the given history
 *  (ordered oldest → newest, at most the last 5 runs). */
export function isFlaky(history: CaseVerdict[]): boolean {
  let flips = 0;
  for (let i = 1; i < history.length; i++) {
    if (failed(history[i]) !== failed(history[i - 1])) flips++;
  }
  return flips >= 2;
}

export function buildDiff(input: {
  cases: Array<{ id: string; code: string; title: string }>;
  current: Record<string, CaseVerdict>;
  previous: Record<string, CaseVerdict> | null;
  history: Record<string, CaseVerdict[]>;
}): DiffRow[] {
  const { cases, current, previous, history } = input;
  return cases
    .map((c) => {
      const cur = current[c.id] ?? null;
      const prev = previous ? (previous[c.id] ?? null) : null;
      return {
        case_id: c.id,
        code: c.code,
        title: c.title,
        current: cur,
        previous: prev,
        state: previous ? diffState(cur, prev) : ("new_case" as DiffState),
        flaky: isFlaky(history[c.id] ?? []),
      };
    })
    .sort((a, b) => {
      const order: DiffState[] = [
        "newly_failing",
        "still_failing",
        "new_case",
        "fixed",
        "still_passing",
      ];
      const d = order.indexOf(a.state) - order.indexOf(b.state);
      return d !== 0 ? d : a.code.localeCompare(b.code);
    });
}

export function median(values: number[]): number | null {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}
