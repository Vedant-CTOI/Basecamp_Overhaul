# Basecamp — Co-Creation Workshop Platform

A productized fork of the workshop platform that powered the Coca-Cola (March 2026) and Sprite × NBA (April 2026) ideation workshops. Built for partnered build teams to extend, re-skin, and deploy per engagement.

This is the **engineering surface**. For the platform's product philosophy, the building blocks, and how to scope an engagement, see the Basecamp playbook (shared separately).

---

## Stack

- **Next.js 16** (App Router, Turbopack, edge runtime for AI routes)
- **Supabase** (Postgres + Auth + Realtime)
- **Google Gemini** (3 Pro Preview for coaching, 3 Flash Preview for scout/merge)
- **Tailwind CSS v4** (utility-first, no preprocessor)
- **Framer Motion** (page transitions, card animations)
- **Vercel** (recommended deploy target — uses edge functions + analytics)

## Quick Start

```bash
cd app
npm install
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          GOOGLE_GENERATIVE_AI_API_KEY, ADMIN_PASSWORD
npm run dev
```

Visit `http://localhost:3000`. The first page asks for a room code — set one in admin (`/admin-login`, password from your `.env.local`) to unlock participant entry.

## First-Time Setup

1. **Provision a Supabase project**, then apply the schema:
   ```bash
   # In the Supabase SQL editor, paste and run:
   app/supabase/schema.sql
   ```

2. **Provision a Google AI Studio API key** at <https://aistudio.google.com/apikey>. Gemini 3 Pro is required for the coach; Flash variants are used elsewhere.

3. **Seed demo data** (optional, useful for smoke-testing):
   ```bash
   cd app
   npm run seed
   ```
   This populates 3 teams, 36 ideas across 3 categories, placeholder briefs, and 4 example coaching notes. **Replace per engagement** — see `extending-basecamp.md`.

4. **Drop in brand assets**. The platform references paths like `/logos/engagement-logo.png` and `/coaches/provocateur.png`. See `app/public/ASSETS.md` for the full list.

5. **Run it**:
   ```bash
   npm run dev          # local development on :3000
   npm run build        # production build
   npm start            # production server
   ```

## Project Structure

```
app/
  app/
    page.tsx                 Landing + room-code unlock + team select
    [team]/                  Team board (idea grid, AI scout)
      page.tsx               The board itself
      training-room/         Coaching room (4 coaches, conversational)
      quick-add/             Phone-first quick capture
    center-court/            Facilitator projection surface (present, vote, lineup)
    big-board/               Live cross-team activity dashboard
    vote/                    Phone voting flow
    report/                  Workshop synthesis report
    admin/                   Operator console (rooms, briefs, prompts, exports)
    admin-login/             Admin password gate
    api/
      coach/                 Streaming AI coach (Provocateur/Sharpener/Audience Lens/Guidelines Advisor)
      scout/                 AI Scout — generates 3 surprising ideas per category
      merge/                 AI-assisted idea merging
      report/                Overnight synthesis report generator
      breaking-news/         Insider-tweet-style ticker device
      ideas/, votes/, ...    REST endpoints for participants and agents
  components/
    ExpandedCard, IdeaCard, AddIdeaModal, LiveTicker, CategoryTabs, ...
  lib/
    config.ts                Single source of truth — categories, teams, coaches, brand
    coaches.ts               Coach system prompts + ANTI_TIC_RULES
    engagement-context.ts    Audience/strategic context defaults
    types.ts                 Shared TypeScript types
    supabase.ts              Supabase client
    workshop-phase.ts        Workshop state machine
  scripts/
    seed-demo-data.ts        Populate fresh DB with demo content
    clear-workshop-data.ts   Wipe proprietary data after engagement delivery
    export-data.js           Backup all tables to JSON + CSV
    realtime-soak-test.mjs   Stress-test realtime subscriptions
  supabase/
    schema.sql               Full DB schema, RPCs, RLS policies, seed data
  public/                    Static assets (logos, backgrounds, coach avatars)
  middleware.ts              Admin auth guard

docs/
  extending-basecamp.md      How to swap branding, change categories, re-tune coaches
  BACKEND-TESTING.md         Load tests, soak tests, resilience monitoring
  troubleshooting-playbook.md  Facilitator runbook for live-workshop incidents
  plans/                     Build plans and decision records
```

## Where to Start Reading

If you're getting oriented:

1. **`app/lib/config.ts`** — every category, team, coach, page name, brand color is defined here. Read this first; you'll touch it on every engagement.
2. **`app/lib/coaches.ts`** — the four coach personas as system prompts. The platform's voice lives here.
3. **`app/app/api/coach/route.ts`** — how runtime context (strategic playbook, category briefs, audience data, partnership guardrails) gets layered into each coaching call.
4. **`app/supabase/schema.sql`** — full data model. The relaxed `category` constraint means you can use any category slugs you want.
5. **`docs/extending-basecamp.md`** — tactical guide for the most common changes per engagement.

## Documentation Index

- **`docs/extending-basecamp.md`** — how to extend, re-skin, and re-tune for a new engagement
- **`docs/BACKEND-TESTING.md`** — load tests, soak tests, resilience monitoring, recovery from realtime outages
- **`docs/troubleshooting-playbook.md`** — facilitator-facing runbook for incidents during live workshops
- **`docs/plans/phase-4-smoke-test-report.md`** — what was verified on the productized fork before handoff
- **`app/public/ASSETS.md`** — what brand assets to drop in per engagement
- **`app/.env.local.example`** — required environment variables

The Basecamp **playbook** (separate document) covers the platform's product philosophy, the building blocks across engagements, and how to scope new engagements. Read that before this README if you're new to the project.

## Engagement Model

Every Basecamp deployment is **bespoke per engagement**. The codebase has three layers:

| Layer | What it is | Where it lives |
|---|---|---|
| **Platform** | Universal mechanics: idea capture → coaching → presentation → voting → synthesis | `app/app/`, `app/components/`, `app/lib/`, `app/supabase/schema.sql` |
| **Primitives** | Configurable parts: categories, teams, coaches, brand, framework fields, page names | `app/lib/config.ts` |
| **Bespoke** | Engagement-specific content: strategic playbook, category briefs, audience data, partnership guardrails, coach prompt overrides, brand assets | `workshop_settings` and `category_briefs` tables (DB) + `app/public/` (assets) |

Re-skinning for a new engagement is **mostly a config + content exercise**, not a code rewrite. See `extending-basecamp.md` for the standard ops.

## Conventions

- **TypeScript everywhere** — `tsc --noEmit` should be clean before any merge.
- **No CSS-in-JS** — Tailwind utility classes inline. Custom CSS only in `globals.css`.
- **Server Components by default** — opt into `"use client"` only when you need state, refs, or browser APIs.
- **Edge runtime for AI routes** — see `export const runtime = "edge"` in `api/coach/route.ts`.
- **No mocks in tests** — integration tests should hit a real Supabase test project.
- **DB column names are stable** — UI labels can change freely, but renaming DB columns cascades through 8+ files. The legacy `nba_rights` key in `workshop_settings` is intentionally kept; it surfaces as "Partnership Guardrails" in the UI.

## License & Provenance

Built by Ogilvy Consulting Labs (OC Labs). Forked from the Sprite × NBA workshop deployment (April 2026) and genericized for partnered build teams.

The platform's design and product philosophy are documented in the Basecamp playbook. The codebase is an artifact of that philosophy — not the source of it.
