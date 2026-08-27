# Workshop Platform — Product Philosophy

Six principles that underpin every design and architecture decision in the platform. They emerged from two live deployments (Coke LA28, March 2026 and Sprite × NBA, April 2026) — both idea-generation workshops.

Each principle has two layers:

- **Universal core** — the part of the principle that should hold across any workshop shape the platform might eventually support (idea-generation, positioning, strategy, retro, customer co-creation, etc).
- **Idea-generation manifestation** — how that universal core gets implemented for the current shape. Other shapes would need different manifestations.

The platform is the artifact this worldview produced. The codebase is downstream of the philosophy, not the other way around.

---

## North star

**Make the non-obvious inevitable, and make it usable.**

Two outcomes the platform is optimized for:
1. Engineer the conditions that push a room past its own creative ceiling.
2. Capture every output as structured material the client can act on.

Both halves are equally load-bearing. Most ideation tools treat one as primary and the other as cleanup; this platform treats them as the same job.

The north star is current-shape-flavored ("creative ceiling" leans into idea-gen). For positioning or strategy work, the framing would shift — but the dual structure (engineer the conditions + capture in usable form) holds.

---

## The six principles

### 1. The room is the creative source. AI is force multiplication, not substitute.

**Universal core.** AI is force multiplication for human creative work, not substitute. The humans in the room are the source; the platform's job is to amplify what's there, never to take the creative seat.

**Idea-generation manifestation.** Provocation over evaluation. AI as opt-in lever for sharpening, expanding, or re-routing — never always-on, never ambient. Coaches provoke or expand; they never evaluate, score, or rank ideas (research-backed: AI evaluation during ideation increases fixation). Multi-persona pattern with three core coaches plus a rights/guidelines advisor on a separate code path.

For other shapes: in a strategy workshop, evaluation might legitimately be the role (helping converge on a decision). In customer co-creation, AI's job might be listening and extracting rather than provoking. The universal "force multiplication, not substitute" frame holds; the specific anti-patterns shift.

### 2. Conditions > components.

**Universal core.** The shape of a workshop (JTBD plus driving conditions plus rhythm) matters more than the components inside it. Workshop design starts with the conditions — what's the room like, who's in it, what's the rhythm, what's the deliverable — not with picking features off a shelf.

**Idea-generation manifestation.** Group-sized room (~30–70 people across multiple teams), time-pressured ideation, senior stakeholder presence, AI as creative provocateur, synthesis as deliverable. The rhythm: divergence → expansion → convergence → reveal. Two structural patterns within this shape (multi-team distinct briefs at Coke; multi-team shared brief with per-team creative platforms at Sprite).

For other shapes: positioning workshops have different driving conditions (smaller rooms, iterative crafting, output is a positioning statement). Strategy workshops, different again. The universal principle holds; the specific conditions are shape-dependent.

### 3. Designed for the live moment, not the steady state.

**Universal core.** Live workshops ship once. Architecture and operations optimize for the one-shot live case where everything must work simultaneously in front of an audience. The bar is "how does this feel when the room is watching" — not "how does this perform in steady state."

**Idea-generation manifestation.** Pre-flight load battery (k6, Playwright, Realtime soak, chaos tests). Real-time support as a primitive. Live-tunable prompts (admin panel, no redeploy). Hidden vote counts + reveal as a designed moment. "Theatrics at the seams, efficiency at the surfaces" motion philosophy — two motion budgets for two different jobs.

For other shapes: most live workshops share this principle, but the specific designed moments shift. A retro might have its own peak moments (tension surfacing, alignment); a positioning workshop, others (statement reveal). The principle of *designing for the live moment* holds; the specific moments differ.

### 4. Capture is as important as creation.

**Universal core.** Workshop outputs that don't land in usable form get lost. Structured capture is part of the product, not post-hoc cleanup. Every primitive should be designed with the deliverable in mind. Every data decision compounds into what the synthesis can produce.

**Idea-generation manifestation.** Overnight synthesis report (~11k characters at Coke). PPTX export structured by team. Structured idea metadata (status, source, category, team, timestamps). Idea lifecycle states (draft → coached → starting_lineup / bench) feeding what shows up in the deliverable. Pattern Surfacing for cross-idea synthesis. Layer 1 strategic context + Layer 2 category/team briefs feeding AI-generated outputs.

For other shapes: a positioning workshop captures the iteration history and final statement; a strategy workshop captures the decision and dissent log; a retro captures actions and ownership. The universal principle holds; what's being captured changes.

### 5. Architecture is opinionated.

**Universal core.** The platform makes deliberate architectural choices and stands behind them. These aren't defaults; they're decisions with rationale. Opinionated architecture is what keeps the platform coherent across engagements without becoming generic.

**Idea-generation manifestation.** Three deliberate choices in the AI architecture: prompt engineering (the persona), context engineering (the layered grounding), designed guardrails (the output constraints). Per-engagement deploy, not multi-tenant. Build configurable, not always-on (Wave 1/2 lesson). Layered context architecture (strategic / category-and-team / retrieval). Designed style guardrails ported across engagements, not picked up from defaults.

For other shapes: the *fact* of having opinions about AI architecture, deploy model, and configurability holds. The *specific* opinions might differ — a strategy workshop might want different AI architecture choices. The principle is to hold opinions and stand behind them; the specific opinions are shape-dependent.

### 6. Repeatability without standardization.

**Universal core.** The platform is engineered to be repeated AND tailored. Three layers: Platform (stable across engagements), Primitives (configured per engagement), Bespoke (rebuilt every time). Not a SaaS (too cookie-cutter), not a one-off (too unrepeatable), but a deliberate third thing that holds shape while the recipe changes per client.

**Idea-generation manifestation.** Same engine, different recipe across Coke and Sprite. Two structural patterns within the shape (distinct briefs vs shared brief with creative platforms). Bespoke layer holds the design judgment per engagement (theming, prompts, evaluation framework, craft moments, brand assets). Platform and Primitives stable.

For other shapes: the three-layer model is the universal product DNA. What's in each layer shifts per shape — a positioning-workshop platform would have different primitives, a different bespoke layer, possibly the same Platform.

---

## Meta-principles

### The codebase is downstream of the philosophy, not the other way around.

When in doubt:

- A new feature should serve a principle, not invent one
- A scoping decision should ladder back to "which principle is this in service of?"
- An architecture trade-off should be evaluated against the principles, not against generic engineering norms
- A handover risk: principles can't be transferred through code; they have to be transferred through people or living documents
- An evolution risk: as the platform expands to new workshop shapes, the universal cores stay; the manifestations need re-derivation

The platform is what this worldview built. Future engagements stay coherent if the principles do — and the platform stays alive as it extends to new shapes if the *manifestations* get rewritten honestly for each new shape, rather than copy-pasted from idea-gen.

### Design decisions only become legible at run-of-show resolution.

"We'll ideate, then vote on finalists" doesn't surface the real questions: which surface, when, how it transitions, what the room sees, what state changes. Build the run-of-show before you build anything else. Block-by-block, not minute-by-minute — the show flexes, but the sequence and transitions are precise.

The corollary: "configurable per engagement" has real limits. Some choices are config (an admin toggle, a theme variable, copy text). Some are content (briefs, prompts, brand assets). Some are **build** — a different UX surface or mechanic entirely. The intake conversation has to surface which category each design choice falls into. Don't promise "configurable" when the honest answer is "buildable." The run-of-show is what makes the difference legible.

This connects directly to *conditions > components* — the conditions only become real at the run-of-show layer. And to *designed for the live moment* — every transition in the show is a designed moment, not just the peaks.

---

## Related artifacts

- `visuals/basecamp-playbook.html` — the build-team-facing playbook where each principle is enacted in features, architecture, and operating model
- `building-blocks.md` — the proven primitive menu these principles produced
- `craft-moments.md` — the craft-moments taxonomy that flows from "designed for the live moment"
- `productization-framework.md` — how repeatability-without-standardization gets operationalized
- `intake-form-template.md` — how the conditions-over-components principle shapes scoping
- `handoff-notes.md` — internal notes on what travels and what stays during handover
