## Goal

After "Pull all fixes" opens the bubble, add an "Analyze root causes" action that groups the raw fixes into a small set of root-cause clusters using the LLM, so implementing them is a handful of edits instead of dozens of one-offs.

## What changes

### 1. New server function: `analyzeFixRootCauses`
File: `src/lib/ai.functions.ts` (append)

- Input: `{ findings: Array<{ id, severity, title, suggestion, page_url }> }`
- Uses the same Lovable AI gateway path already in the file (`google/gemini-3-flash-preview`) with `generateText` + `Output.object` and a Zod schema:
  ```
  {
    clusters: [{
      title: string,             // short root cause name
      rootCause: string,         // 1-2 sentences: the underlying issue
      severity: "critical"|"high"|"medium"|"low",
      unifiedFix: string,        // one concrete implementation step that resolves all findings in the cluster
      findingIds: string[],      // ids from input this cluster covers
      affectedPages: string[]    // distinct page_urls
    }],
    summary: string              // 1-2 sentence overview
  }
  ```
- System prompt tells it: dedupe symptoms, prefer 3–8 clusters, every input finding must belong to exactly one cluster, order clusters by severity + findings count.

### 2. UI: `FixesBubble` in `src/routes/qa.runs.$runId.tsx`

Add a second "Root causes" section inside the existing bubble (no new modal — same bubble the user already opened):

- New header button `Analyze root causes` (Sparkles icon) next to `Copy all`.
- On click → call `useServerFn(analyzeFixRootCauses)({ findings: sorted })`, show inline spinner.
- Result renders above the raw fix list:
  - Summary sentence
  - Ordered list of clusters. Each cluster card shows: title, severity pill, root cause, unified fix, "Covers N findings across M pages", collapsible list of the underlying finding titles (linked to their entries below), and a `Copy fix` button that copies the unified fix + affected pages.
- New `Copy root-cause plan` button appears once analysis is done — copies the full clustered plan as markdown.
- Errors → toast; keep raw fixes visible either way.
- Cache the result in component state so re-toggling the bubble doesn't re-run it (per run session).

### 3. No other changes
- No DB writes, no new tables, no route changes.
- Free-run gating already covers QA runs; analysis piggybacks on an existing paid feature surface, so no new paywall hook.

## Files touched
- `src/lib/ai.functions.ts` — append `analyzeFixRootCauses` server function
- `src/routes/qa.runs.$runId.tsx` — extend `FixesBubble` with the analyze button, state, and cluster rendering
