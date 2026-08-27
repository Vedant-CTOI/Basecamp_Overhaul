// Hardcoded baseline engagement context — fallback if DB is empty.
// Admin can override via the Strategic Context section in the admin panel.
// Pattern: DB wins if present, hardcoded is the safety net.
//
// This file is the Layer 1 + Layer 2 strategic context fallback for the
// AI coaching architecture. See docs/extending-basecamp.md for the full
// context engineering pattern.
//
// Per-engagement: replace these placeholder strings with the actual
// strategic context for the engagement (brand strategy, partnership
// context, evaluation framework, audience research, cultural framing,
// etc.). Aim for ~2,000 words on UNIVERSAL_ENGAGEMENT_CONTEXT and
// ~500–1,000 words per category.

// ── Placeholder safety (D-6) ─────────────────────────────────
// The bracket tokens this file's fallbacks (and any admin-pasted
// prompt) may carry. They are TRIPWIRES, kept deliberately: api/coach
// and api/scout REFUSE to send a prompt still carrying one, and the
// Operator Console pre-flight lists them before the room opens — a
// coach can never say "[CLIENT_BRAND]" to a live room. Extend the
// union when a new token joins the fallbacks.

export const PLACEHOLDER_TOKEN_RE =
  /\[(?:CLIENT_BRAND|ENGAGEMENT_DOMAIN|ENGAGEMENT_TITLE|ENGAGEMENT_STRATEGIC_CONTEXT|CATEGORY_\d+_BRIEF)\]/g;

/** Distinct placeholder tokens present in a string — [] when clean. */
export function findPlaceholderTokens(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_TOKEN_RE) ?? [])];
}

// Universal engagement context (Layer 1 — loaded into every coach/scout call)
export const UNIVERSAL_ENGAGEMENT_CONTEXT = `DOVE — REAL INTELLIGENCE ENGAGEMENT CONTEXT

THE CLIENT. Dove (Unilever), the global personal-care brand built on the Real Beauty platform since 2004. Dove's standing commitments: no AI-generated faces and no digitally distorted bodies in its advertising, the No Digital Distortion alliance, the Dove Self-Esteem Project (school-based body-confidence education, one of the largest of its kind), and product truth grounded in real care science (microbiome-friendly formulation, dermatologist-tested ranges). Dove's tone is warm, plain-spoken, and evidence-backed: it affirms rather than instructs, and it treats skepticism of beauty-industry distortion as a shared value with its audience, not a marketing angle.

THE WORKSHOP. Dove Real Intelligence: championing authentic self-expression in a synthetic world. The room protects and extends the brand's self-esteem work into the age of generative media. The premise: authenticity stops being a value statement and becomes a system — labelling what is synthetic, teaching people to see distortion, and building care products that serve every real skin. The room is hostile to purpose-washing; ideas must ship with mechanisms, not manifestos.

THE THREE BRIEFS (pillars):
1. The Transparency Standard — industry-wide labelling of AI-altered and synthetic imagery while Dove holds its own 100% natural, un-retouched line. Good looks like standards, marks, dashboards, commitments with enforcement. Bad looks like manifestos and disclaimers.
2. Digital Self-Esteem Toolkits — interactive modules and in-app tools building critical literacy around algorithmic beauty filters, for teenagers, parents, and creators. Good lives inside the daily routine (the camera, the feed, the classroom); bad is a lesson plan nobody opens twice.
3. Inclusive Biomimetic Care Innovation — gentle, microbiome-friendly formulation for every skin texture, melanin level, and dermatological need, without restrictive cosmetic tropes. Good widens who care is for and publishes its evidence; bad narrows the definition of healthy skin.

THE AUDIENCE. Dove marketers, agency creatives, and youth-culture experts. Secondary audiences the ideas must ultimately serve: teens navigating appearance-based algorithms, parents who want plain language, creators who want credibility without cosmetic tropes, and dermatological communities (eczema, vitiligo, acne, scars) routinely erased by filtered media.

EVALUATION LENSES (apply to every idea):
- Mechanism: does the idea DO something checkable, or only say something?
- Proof: can its claims be audited by someone outside the room?
- Respect: does it treat real people — especially young ones — as capable, not fragile?
- Dove line: does it strengthen the no-digital-distortion commitment rather than decorate it?
- Scale: could it run in more than one market without losing its teeth?

GUARDRAILS. Nothing that contradicts Dove's commitments: no generated faces or retouched bodies in concepts we would ship. No mocking of skin conditions or bodies. Competitors are challenged on practice, never attacked personally. No fabricated statistics presented as real research — the Dove Self-Esteem Project's work may be referenced qualitatively, never invented numerically.

WORKSHOP AMBITION. By the end of the day: one shortlisted, sequenced program per pillar, specific enough to brief a partner on Monday morning — tools that exist, standards with enforcement, science with a public face.`;

export const PILLAR_ENGAGEMENT_CONTEXT: Record<string, string> = {
  category_1: `THE TRANSPARENCY STANDARD — brief context.

The strategic role: turn Dove's no-digital-distortion commitment from a brand promise into industry infrastructure. The room's ideas should make honesty verifiable — scannable labels, public dashboards, provenance standards, certification marks, model cards — while Dove's own output stays 100% natural and un-retouched.

What good looks like: a mechanism someone else can check. A mark with an audit behind it. A dashboard a journalist can use. A standard a competitor can adopt (Dove wins either way — if it works, and if rivals sign on, the feed gets honest at scale).

Constraints: nothing defamatory toward named competitors; nothing that implies surveillance of individuals; labelling must inform, not alarm. The audience for these systems includes platforms, advertisers, regulators, and the people scrolling.

Precedents worth studying: ingredient transparency in food labelling, fair-trade certification, nutrition labels, open-source provenance standards (C2PA), and Dove's own Reverse Selfie and No Digital Distortion campaigns.`,

  category_2: `DIGITAL SELF-ESTEEM TOOLKITS — brief context.

The strategic role: extend the Dove Self-Esteem Project into the algorithmic feed. The room builds tools and modules that give teenagers, parents, and creators critical literacy around beauty filters and synthetic media — education that feels like culture, never like a lecture.

What good looks like: it lives inside the daily routine (the front-facing camera, the scroll, the group chat, the classroom). It demonstrates rather than preaches — showing what the algorithm changed beats telling someone they are beautiful. It respects young people as capable of seeing, not as fragile. Parents get their own plain-language track. Creators get credibility tools, not compliance burdens.

Constraints: no shaming of individuals who use filters — the algorithm is the subject, not the girl. No engagement-bait mechanics. Accessibility across devices and bandwidths matters; a toolkit that only works on a new phone fails its own brief.

Precedents: Detox Your Feed, Reverse Selfie, media-literacy curricula, de-influencing culture, "reveal the edit" content formats.`,

  category_3: `INCLUSIVE BIOMIMETIC CARE INNOVATION — brief context.

The strategic role: make Dove's care science prove what its advertising claims — products that serve every skin texture, melanin level, and dermatological need, without restrictive cosmetic tropes.

What good looks like: formulation and product innovation with published evidence — tested across documented skin profiles, results and failures included. Retail and merchandising that does not sort people into narrow shade hierarchies. Clinical photography that refuses the before/after correction trope. A public face for the science: dermatologists, real skin conditions shown unedited, answered honestly.

Constraints: claims must be supportable — nothing the legal team would strike. "Inclusive" is the mechanism, not the marketing adjective: if the idea does not widen who care is for, it is not innovation. No borrowed credibility: partners must be real institutions, not invented ones.

Precedents: microbiome-friendly formulation science, dermatological partnerships, shade-range expansions done properly, clinical photography standards.`,
};
