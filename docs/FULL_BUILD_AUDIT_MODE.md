## Full Build Audit Mode (Trigger: "AGENTS.md — go to work")

When the founder invokes this exact phrase, override the lean-loading default below and instead load full context for a comprehensive quality + parity sweep.

**Load order:**
1. docs/MASTER_INDEX.md
2. All UEC docs (Parts 1-3, Philosophy, Principles, AI Constitution, Governance)
3. docs/BAEOS_Volume_10_Enterprise_Prompt_Library_v1.0.md (Master Category Prompts)
4. Any BAEOS volume relevant to the current app's stack (e.g., Vol 04 Backend Platform, Vol 05 Synapse OS, Vol 07 Vault)
5. docs/NEW_APP_STANDARD.md and docs/TRIAL_POLICY.md if the app is new or pre-launch

**Run against the current build, in this order:**
1. Coding — Senior Engineer Review (bugs, vulnerabilities, edge cases, performance)
2. Design — Art Director Pass (UX critique, hierarchy, accessibility)
3. Reasoning — Rigor Stack (root cause any known issues, second-order effects)
4. Productivity — System Optimizer (friction points, workflow collapse)
5. AI Power User — Meta Layer (self-critique the findings before reporting; confidence score per finding)

**Output:** one consolidated report — bugs/vulnerabilities, UX/design gaps, performance issues, an overall quality score, and a prioritized fix list.

**Guardrail:** this mode changes what gets *read and reported*, not what gets *executed*. Core Rules still apply — Tier 3/4 findings are flagged for founder approval, not auto-fixed. Truth Standard still applies — every finding needs evidence, not a fabricated pass/fail.

**Output & logging (auto-commit, no approval needed for the report itself):**
1. Write the full report to `docs/audits/YYYY-MM-DD-full-build-audit.md` (one new file per run — never overwritten).
2. Append one line to `docs/AUDIT_LOG.md`:
   `YYYY-MM-DD | Score: XX/100 | N Tier-3/4 flags | → docs/audits/YYYY-MM-DD-full-build-audit.md`
3. Commit both directly to `main` as the final step of the run — do not ask for confirmation before committing the report/log (this is documentation, not a change to the app itself).
4. Tier 3/4 findings inside the report still require founder sign-off before any fix is executed — auto-committing the report does not authorize acting on it.
