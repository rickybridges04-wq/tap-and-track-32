Add 15 new beta tester personas to `src/lib/qa/personas.ts`, bringing the total from 5 → 20. Each gets a unique id, name, emoji, one-line description, and a distinct system prompt that biases the AI inspector toward that persona's lens. All 20 stay selectable on `/qa/new`.

## New personas (15)

1. Mobile-only user 📱 — small screens, thumb reach, tap targets
2. Slow-network user 🐢 — perceived perf, loading states, skeletons
3. Non-English speaker 🌐 — copy clarity, translation gaps, locale assumptions
4. Senior user 👵 — font size, jargon, dense UI, multi-step confusion
5. Skeptical buyer 🧐 — trust signals, pricing transparency, social proof
6. Privacy-conscious user 🔒 — data collection prompts, cookie banners, tracking
7. Keyboard-only user ⌨️ — focus order, visible focus rings, tab traps
8. Screen-reader user 🦻 — landmarks, alt text, ARIA, reading order
9. Color-blind user 🎨 — color-only signaling, contrast pairs
10. Returning user 🔁 — state persistence, recognition vs recall
11. Distracted multitasker 🤹 — interruption recovery, autosave, confirmation clarity
12. Security tester 🛡️ — exposed inputs, error leakage, unsafe links
13. SEO/marketer 📈 — titles, meta, headings, semantic HTML
14. Edge-case input tester 🧪 — long strings, emoji, paste, special chars
15. Developer/integrator 🧑‍💻 — API hints, docs links, error messages, console noise

## Implementation

- Append the 15 entries to the existing `personas` array, matching the current `Persona` type shape.
- Keep ids kebab-case and unique.
- Keep system prompts tight (~2–3 sentences) and focused on what that persona notices/reports.
- No UI changes needed — `/qa/new` already renders the full list and `runner.ts` iterates whichever are selected.

## Out of scope

- No scoring weight changes.
- No new categories beyond functional/visual/accessibility/performance already supported.

&nbsp;

Test deployable pathways

Add trash buttons to all tabs 

Add beta test history