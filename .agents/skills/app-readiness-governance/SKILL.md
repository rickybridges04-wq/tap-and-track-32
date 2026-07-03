---
name: app-readiness-governance
description: Governance rules, skills, and knowledge for AI build agents working on any app in the portfolio. Use this skill whenever an agent is building, testing, fixing, or reporting on app functionality, backend connections, security, or store-submission readiness. Enforces the Truth Standard (no fabricated completion claims), the No Shell UI Rule (no disconnected buttons/forms), and the four-phase Analyze-Fix-Verify protocol before any feature can be marked complete. Trigger this whenever a task involves marking something "done," "fixed," "deployed," or "ready to ship," or whenever preparing an app for Apple/Google store submission.
---

# App Readiness Governance — Agent Rules, Skills & Knowledge

**Purpose:** This document defines the rules, skills, and knowledge that any AI agent (Lovable, Claude Code, or autonomous build agent) must follow when building, testing, or reporting on app readiness. It exists to prevent shell UI, fabricated completion claims, and App Store rejections (Guideline 4.2).

**Applies to:** All apps in the portfolio unless a project-specific AGENTS.md overrides a section.

---

## 1. RULES (Non-Negotiable — Tier 1-4 Decision Rights Apply)

### 1.1 Truth Standard
1. An agent may NEVER report a feature, fix, or flow as "complete," "working," or "deployed" without direct evidence (see Section 4: Verification Protocol).
2. Fabrication of test results, metrics, or completion status is a worse outcome than honest failure. An agent that says "I could not verify this" is behaving correctly.
3. If an agent is uncertain whether something works, it must say so explicitly — not imply success through silence or vague language ("should be working now").

### 1.2 No Shell UI Rule
4. No button, link, or form may exist in the UI without a real, connected backend action. A visible-but-non-functional element is treated as a bug, not a placeholder.
5. Mock data must be visually/textually flagged as mock (e.g., "Demo Mode") if it must temporarily exist — it may never be presented as live.
6. Any screen that only displays static content where dynamic content is expected is logged as a Guideline 4.2 risk.

### 1.3 Security Rules
7. API keys (Anthropic, Stripe, etc.) are called server-side only — Edge Functions or equivalent. Client-side exposure is a Tier 1 blocking violation.
8. All user input must be validated on both client and server. Client-only validation is not acceptable for any form that writes to the database.
9. Row-Level Security (or equivalent) must be enabled and tested on every table containing user data before that table is considered production-ready.

### 1.4 Escalation Rule
10. If an agent hits a decision beyond its tier (see Decision-Rights Tiers), it stops and escalates to founder rather than guessing or defaulting to "safe-sounding" output.

---

## 2. SKILLS (What the Agent Must Be Able to Do)

### 2.1 Functional Verification Skill
- Trace a feature request to its actual code path (frontend action → API call → backend handler → database write/read → response render).
- Identify whether each link in that chain exists, or whether it terminates in a no-op, console.log, or hardcoded return.

### 2.2 Flow Testing Skill
- Walk every primary user flow (signup → onboarding → core action → payment → confirmation) as a sequence, not as isolated components.
- Test edge cases within each flow: empty input, no network, expired session, double-submit, back-button navigation.

### 2.3 Security Audit Skill
- Search codebase for any instance of API keys, secrets, or tokens referenced in client-side files (React components, public folders).
- Confirm RLS policies exist and match intended access rules (not just "enabled").

### 2.4 Store Compliance Skill
- Cross-check the current build against Apple Guideline 4.2 (minimum functionality) and Google Play's equivalent policy before any submission is recommended.
- Flag any screen, agent persona, or automation that performs actions cosmetically without real execution.

### 2.5 Reporting Skill
- Produce status reports in a fixed format: Feature → Claimed Status → Evidence → Confidence Level → Open Risk.
- Never merge "built" and "verified" into a single status — they are always reported separately.

---

## 3. KNOWLEDGE (What the Agent Must Know Before Acting)

### 3.1 Stack Knowledge
- Frontend: React/Vite via Lovable
- Backend: Supabase (Postgres, Edge Functions, RLS)
- Payments: Stripe
- Email: Resend (transactional)
- AI: Anthropic API, called exclusively from server-side Edge Functions — never from client code

### 3.2 Known Failure Patterns (from documented incidents)
- Agents have previously posted hardcoded metrics to Slack and reported them as verified live data.
- Automations have fired "success" notifications before deploy and metric-check steps actually completed.
- UI shells with no backend connection are the single most common blocker found across the app portfolio to date.
- These are not hypothetical risks — they are the specific failure modes this document exists to prevent.

### 3.3 Priority Framework
- When trade-offs arise, resolve in this order: Profit → Growth → Impact → Freedom (North Star tie-break).
- When in doubt about scope, a smaller verified feature outranks a larger unverified one.

---

## 4. VERIFICATION PROTOCOL (Required Extra Step: Analyze & Fix)

Before any feature, screen, or flow can be marked complete, the agent must run this four-phase protocol. No phase may be skipped or assumed.

### Phase 1 — Inventory
1. List every screen, button, form, and automation in the current build.
2. For each, classify as: Fully Connected / Partially Connected / Not Connected / Unknown.

### Phase 2 — Analyze
3. For every item not marked "Fully Connected," trace the actual code path and identify exactly where it breaks (missing API call, missing handler, missing DB write, missing error handling, etc.).
4. Cross-reference against Section 1 (Rules) and Section 3.2 (Known Failure Patterns) to check whether this is a recurring issue type.
5. Assign a severity: Blocking (store rejection risk / security risk) / Degraded (works but unreliable) / Cosmetic (non-functional but non-blocking).

### Phase 3 — Fix
6. Fix Blocking items first, in order of user-journey position (auth → core flow → payment → confirmation → secondary features).
7. Each fix must include: what was changed, why, and how it was tested — not just "fixed."
8. No fix is marked complete until it passes Phase 4.

### Phase 4 — Verify
9. Re-test the exact flow that failed, using the same steps that surfaced the issue originally.
10. Capture evidence (screenshot, log output, network tab confirmation, or test result) — evidence is required, not optional, for anything touching auth, payments, or data writes.
11. Update the Inventory (Phase 1) status only after evidence is captured.
12. Log the incident and fix in a running Verification Log so the same failure pattern can be checked for elsewhere in the codebase.

---

## 5. STATUS REPORT TEMPLATE (Use for Every Readiness Check)

```
Feature: [name]
Claimed Status: [Built / Partially Built / Not Started]
Verified Status: [Verified / Unverified / Failed Verification]
Evidence: [screenshot / log / network trace / "none — flagging as unverified"]
Severity if Broken: [Blocking / Degraded / Cosmetic]
Next Action: [fix / re-test / escalate to founder]
```

---

## 6. FOUNDER OVERRIDE

Ricky (founder) has final authority (Tier 4) on:
- Whether an app is store-ready
- Whether a "Degraded" item can ship with a known limitation
- Any exception to the No Shell UI Rule for demo/investor purposes (must be explicitly flagged as demo in-app if approved)

No agent may self-approve an exception to Sections 1 or 4.
