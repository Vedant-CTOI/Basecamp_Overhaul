# V2 Interaction Direction

*Origin: brainstormed March 2026 after the Coke LA28 deployment. Was held in `memory/workshop-platform-v2-ideas.md`; moved here 2026-05-26 as part of the cross-project memory migration. Cited from `CLAUDE.md`.*

## Core Shift: Coaches on the Field, Not in the Gym

V1 (Coke) had a separate "training room" — you leave the grid to coach an idea. V2 should embed coaching where ideas already live. The coach walks over to you on the field, you don't leave to go train.

**Why:** The training room creates a screen change that breaks room context. The facilitator's screen was projected — the room could see coaching happen, which is good. But navigating away from the grid to a separate view loses orientation.

## Interaction Model: Structured Options, Not Chat

- **Grid level** — Ask a coach "what do you see?" across all the team's ideas. Coach reads full picture and surfaces patterns, connections, or gaps. Analytical lens — forest, not trees.
- **Card level** — Instead of chat, the coach returns:
  1. A rationale (what's strong, what's missing)
  2. 2-3 concrete directions to build on the idea
  3. Each direction is a clickable option
  4. Room discusses which direction, facilitator clicks one
  5. Content populates directly into framework fields

## Why this beats chat

- AI's output is **structured and actionable** (options you click) rather than conversational (paragraphs you copy)
- Room makes a **collective decision** about direction (not a solo activity)
- Framework completion happens **naturally** — AI fills fields as part of coaching, not as separate chore
- Solves the **88% default prompt problem** observed in the Coke deployment — AI leads with a specific read, not a blank prompt

## Don't make phones a distraction

Phone quick-add worked in v1 because it was minimal — type, submit, put phone down. Adding features to the phone risks turning it into a distraction device. Keep it minimal unless a specific workshop moment genuinely needs it.

One exception worth exploring: **participants vote on which AI-generated direction to take** (uses existing voting infrastructure, gives phones a purpose during coaching).

## Both modes may survive

- **Quick coaching on the field** for initial reads and option generation (majority of interactions)
- **Deep training room** for iterative multi-round sessions (like the refugee team idea with 4 rounds in the Coke workshop)
- Default entry point shifts from "go to the gym" to "the coach is right here"

## Research backing

- `Projects/_research/ai-architecture/group-ai-interaction-research.md` — academic backing for the chat-window-is-the-problem framing. Key insights:
  - Chat window is the problem, not the AI (IBM IUI 2025)
  - AI as canvas contributor > AI as conversationalist
  - 70% human conversation / 30% tech interaction (SessionLab 2025)
  - Pre-computed drops beat live streaming chat
  - Governor/approval pattern — AI suggests provisionally, humans accept

## Design reference

- **aiverse.design** — curated library of 200+ AI UX interactions, 37+ patterns. Good reference for implementation patterns. Requires account for full access.

## Contrary cases — what would invalidate this

- If facilitator workflow in real deployments shows that the training-room separation is actually a feature (preserves focus on one idea at a time, reduces room distraction during deep work), the "coaches on the field" shift might be wrong for some workshop shapes — see `workshop-types-taxonomy.md`.
- If chat coaches in v1 are heavily used in moments where the room *doesn't* need to be in the loop (1:1 facilitator-AI thinking), the structured-options-only approach removes a useful mode.
- If the 88% default-prompt problem turns out to be specific to coke's coach personas (not a general pattern), the framing here over-generalizes from one engagement.
