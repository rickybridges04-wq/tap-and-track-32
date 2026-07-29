# AGENTS.md

## Purpose
This file is always read by the Lovable agent at the start of every session, regardless of session length. Keep this file itself short — it's a router. Full governance detail lives in /docs and should only be opened when the current task actually needs it.

## Start here
- Trigger clause (when/how agents should invoke governance): docs/AGENTS_trigger_clause.md
- Master index of all BAEOS documents: docs/MASTER_INDEX.md
- BAEOS overview: docs/README.md
- Change history: docs/CHANGELOG.md
- Roadmap: docs/ROADMAP.md
- New app standard (checklist for any new app in the portfolio): docs/NEW_APP_STANDARD.md
- Trial/pilot policy: docs/TRIAL_POLICY.md

## BAEOS Volumes (Enterprise Edition v2.0)
- Vol 01 — Enterprise Foundation: docs/BAEOS_Volume_01_Enterprise_Foundation_v1.0.md
- Vol 02 — AI Operating System: docs/BAEOS_Volume_02_AI_Operating_System_v2.1.md
- Vol 03 — Execution Engine: docs/BAEOS_Volume_03_Execution_Engine_v1.0.md
- Vol 04 — Backend Platform: docs/BAEOS_Volume_04_Backend_Platform_v1.0.md
- Vol 05 — Synapse OS: docs/BAEOS_Volume_05_Synapse_OS_v1.0.md
- Vol 06 — AI Clone Studio: docs/BAEOS_Volume_06_AI_Clone_Studio_v1.0.md
- Vol 07 — Vault: docs/BAEOS_Volume_07_Vault_v1.0.md
- Vol 08 — Portfolio Framework: docs/BAEOS_Volume_08_Portfolio_Framework_v1.0.md
- Vol 09 — Distribution & Growth OS: docs/BAEOS_Volume_09_Distribution_Growth_OS_v1.0.md
- Vol 10 — Enterprise Prompt Library: docs/BAEOS_Volume_10_Enterprise_Prompt_Library_v1.0.md
- Vol 11 — Enterprise Knowledge Base: docs/BAEOS_Volume_11_Enterprise_Knowledge_Base_v1.0.md
- Vol 12 — Platform Capability Modules: docs/BAEOS_Volume_12_Platform_Capability_Modules_v1.0.md

## Universal Engineering Constitution (UEC)
- Constitution Part 1: docs/UEC-000-Universal-Engineering-Constitution-Part-1.md
- Constitution Part 2: docs/UEC-000-Universal-Engineering-Constitution-Part-2.md
- Constitution Part 3: docs/UEC-000-Universal-Engineering-Constitution-Part-3.md
- Philosophy: docs/UEC-001-Universal-Engineering-Philosophy.md
- Principles: docs/UEC-002-Universal-Engineering-Principles.md
- AI Constitution: docs/UEC-003-Universal-AI-Constitution.md
- Governance: docs/UEC-004-Engineering-Governance-Part-1.md

## Other reference docs
- UX psychology principles: docs/UX_PSYCHOLOGY_PRINCIPLES-1.md

## Core rules (always enforced, no exceptions)
- Truth Standard: never report a task as complete without evidence. A fabricated success is worse than an honest failure.
- Read-before-write: check existing file/data state before modifying anything.
- Decision-Rights Tiers apply (see UEC-002 / BAEOS Vol 02) — Tier 4 items require founder approval before execution.
- North Star tie-break order for conflicting priorities: Profit → Growth → Impact → Freedom.

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

## When starting a task
1. Check the reference lists above for anything relevant to the current task.
2. Open only the specific docs/ file(s) needed — don't load the entire framework into context for a small task.
3. If a task touches Decision-Rights Tier 3 or 4, stop and flag for founder review rather than proceeding.
