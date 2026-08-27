# Phase 4: Static Smoke Test Report

**Branch:** `basecamp-handoff` (commit `8048e0b`)
**Date:** 2026-04-28
**Run:** Automated, no fresh Supabase project — see "Outstanding" below.

## What I Verified

### Build
- `next build` ✅ Compiles successfully in 2.9s
- 26 routes compile (no `/health`, no `/alley-oop`, no `/around-the-league`, no `/api/[transport]`)
- TypeScript clean (`npx tsc --noEmit` returns no output)
- All static pages prerender (23/23)

### Lint
- 13 pre-existing errors, 55 pre-existing warnings — none introduced by genericization
- The errors won't block the build but are worth flagging to the build team:
  - 2 `react-hooks/rules-of-hooks` violations (Hook called conditionally)
  - 2 `<a>` tags that should be `<Link/>`
  - 1 setState-in-effect warning escalated to error
  - 1 `cannot access variable before declared`
  - 1 `Unexpected any` type
  - 4 CommonJS `require()` calls in `.js` scripts (style-only)
  - 2 unescaped JSX entities

### Dev Server Boot
- `next dev` boots in 902ms on port 3001
- All public routes return clean HTTP 200:
  - `/` (landing)
  - `/group-1`, `/group-2` (team boards — render "Team A" / "Team B" labels)
  - `/group-1/quick-add`
  - `/group-1/training-room`
  - `/big-board`
  - `/center-court`
  - `/report`
  - `/vote`
  - `/admin-login`
- `/admin` returns 307 (redirect to login — expected)
- `/health` correctly returns the Next.js 404 page (route stripped)
- No errors or warnings in dev server logs across all renders
- Page title resolves to "Basecamp — Co-Creation Workshop Platform"

### Config / Schema Alignment
- `config.ts` exports `category_1` / `category_2` / `category_3` as `PILLAR_SLUGS`
- `schema.sql` seed data matches: teams seeded with `['category_1', 'category_2', 'category_3']`, category_briefs and pillar_visions seeded with the same three slugs
- `seed-demo-data.ts` uses the same slugs and team slugs (`group-1` / `-2` / `-3`)

## What Needs Human-in-the-Loop Verification (Phase 4 Continued)

These can't be verified without a fresh Supabase project + Gemini API key:

### Database
- [ ] Run `schema.sql` against a fresh Supabase project — verify it executes without error end-to-end (relaxed category constraints, RPCs, seed inserts, RLS policies)
- [ ] Run `npx tsx scripts/seed-demo-data.ts` — verify all 36 ideas insert, coaching notes attach to correct ideas, settings + briefs upsert
- [ ] Verify the realtime subscriptions fire correctly with the genericized table names (no rename happened, but worth confirming)

### Functional Walkthrough
- [ ] Land on `/`, enter room code, complete tunnel transition
- [ ] On a team board: add an idea, expand it, edit it, drag between status columns
- [ ] Quick-add flow on phone viewport
- [ ] Coaching room: pick a coach, send a prompt, verify Gemini streams a response
- [ ] AI Scout: trigger scout, verify card stack displays
- [ ] Center Court: open category, open voting, cast a vote, see results
- [ ] Big Board: confirm cross-team activity displays
- [ ] Report page: confirm overnight report generates
- [ ] Admin: walk every section (Setup, Platforms, Briefs, Audience Data, Playbook, Insights, Partnership Guardrails, Coaches, Ticker, QR Codes, Exports)
- [ ] PPTX export: confirm download produces a valid file with category labels

### AI Coaching
- [ ] Each coach (Provocateur, Sharpener, Audience Lens, Guidelines Advisor) returns a response that doesn't reference Sprite/NBA/BBEI placeholders verbatim
- [ ] Verify `[CLIENT_BRAND]` and `[ENGAGEMENT_DOMAIN]` placeholders in the system prompts produce sensible-but-generic coaching when no engagement context has been provided

### Visual / Brand
- [ ] All `engagement-logo.png` references resolve once a logo is dropped into `/public/logos/`
- [ ] Coach avatar paths resolve once placeholder images are dropped into `/public/coaches/`
- [ ] Hero background and splatter texture render once placeholders are added to `/public/backgrounds/` and `/public/textures/`

## Recommendation

The static surface is clean — no broken imports, no orphaned references, no compile errors. The build team can `git clone` this branch and `next build` will succeed.

**They will hit "missing assets" the first time they visit pages** (logo `<img>` tags will show broken-image icons until `/public/logos/engagement-logo.png` is added). That's expected — `ASSETS.md` documents what to drop in.

**They will need their own Supabase project + Gemini API key** to do a real end-to-end test. The Phase 4 walkthrough above gives them a checklist.

I'd suggest including this report (and `ASSETS.md`) in the handoff zip.

## Pre-Handoff Verification (additional)

Beyond the static smoke test, the following pre-handoff checks were run:

### Credential Scan
- No hardcoded Supabase URLs, API keys, or secrets in tracked files
- One template placeholder in `BACKEND-TESTING.md` (`db.PROJECT.supabase.co`) — intentional
- `.env.local` git-ignored; not present in tracked tree

### Env Var Coverage
- All `process.env.*` references in source code are documented in `app/.env.local.example`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (app)
  - `SUPABASE_SERVICE_ROLE_KEY` (scripts only — added to `.env.local.example` after audit found it missing)
  - `GOOGLE_GENERATIVE_AI_API_KEY` (app)
  - `ADMIN_PASSWORD` (admin gate)

### Production Build + Server
- `next build` completes in ~3s; 26 routes prerender or wire correctly
- `next start` boots a production server; landing page returns 200, title resolves to "Basecamp — Co-Creation Workshop Platform"
- Tested on port 3002, 3003, 3004 across multiple build cycles

### Fresh Clone End-to-End
- `git clone <repo> --branch basecamp-handoff --single-branch` → clean checkout, no `.env.local`, no `.next`, no `node_modules`, no `.claude/`
- `cp .env.local.example .env.local` → `npm install` → `npx next build` → `npx next start` → landing returns HTTP 200
- This is what the build team will do on their first `git clone` — confirmed working

### Security Audit (`npm audit`)
- Started at 8 vulns (4 moderate, 4 high)
- Removed unused devDeps (`xlsx`, `xlsx-js-style`, `exceljs`) — eliminated 3 high vulns
- Bumped `next 16.1.6` → `16.2.4` — eliminated remaining 2 high vulns
- **Final: 3 moderate** — all in `next`'s bundled `postcss` (build-time CSS XSS, not runtime). Acceptable to ship; documented for build team.

### Lint
- 13 pre-existing errors, 55 pre-existing warnings — none introduced by genericization
- Build passes regardless (lint runs separately from build)
- Worth flagging the React Hooks violations to the build team for future cleanup
