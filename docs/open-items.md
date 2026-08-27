# Open items (as of 2026-08-05)

Rewritten against the code after the hardening plan
(`docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md`, U1–U11) executed
on 2026-08-04 and the bespoke-layer cleanup plus the live Darkroom landed on
2026-08-05. Every item below was re-verified against a file, not against a plan —
a unit that says it shipped is not proof that it did, and two of them did not.
What was closed is listed at the bottom so nobody re-reports it.

**The one thing to take from this document.** Most of section A is no longer
missing work. It is finished work with nowhere to run. Four SQL files, a strict
shim generated from them and a verification runbook all exist and are reviewed;
there is no database, no Supabase project and no keys, so none of it has ever
executed. Written is not applied, and this document keeps the two words apart
everywhere it can.

Full backend detail, with DDL and the complete 19-item ranking:
`docs/backend-audit.md`. The apply order and the 11-step verification procedure:
`app/supabase/README.md`.

---

## A. Blocks a real deployment (the showcase is fine; a live room is not)

**The standing fact underneath all of these.** `app/.env.local` carries
`ADMIN_PASSWORD` and `ELEVENLABS_API_KEY` and nothing else. No
`NEXT_PUBLIC_SUPABASE_URL`, no anon key, no `SUPABASE_SERVICE_ROLE_KEY`, no
`GOOGLE_GENERATIVE_AI_API_KEY`. Every run of this checkout is the in-memory shim
(`lib/supabase.ts:21`). No SQL in this repository has been executed anywhere.

1. **The deployment SQL is written, reviewed, and applied to nothing.** Four
   files, each carrying its own "THIS FILE HAS NEVER BEEN EXECUTED AGAINST A
   DATABASE" header. This is one item because it has one blocker — a Postgres to
   run it against — and four failures if it is skipped:
   - **The six `ideas` columns.** `presenting`, `print_status`, `print_options`,
     `print_url`, `print_source`, `print_note` — written at
     `app/supabase/migrations/2026-08-04-001_present_gate_and_darkroom.sql:44-80`,
     with the Sprite-era category-CHECK drops at `:109-112`. Unapplied, every
     Present toggle and every commission still 400s. Two of the three knock-ons
     are now closed in code and one is not: a failed commission no longer
     discards the participant's text (the write is split in two, `lib/darkroom.ts:346`
     then `:365`), and the ballot no longer widens silently (`lib/present-gate.ts:85-98`
     returns `unreadable` and the ballot refuses). What is left is the plain
     failure — with the columns absent, **the vote cannot open at all.** That is
     the designed refusal, not a regression.
   - **RLS and policies.** `app/supabase/policies.sql` — 281 lines, nine tables,
     an explicit per-verb ruling for `anon` on every one, the `ideas` column
     grant withholding `id` / `created_at` / `source` / `gifted_from_team_id`,
     and four accepted exposures written on the record at `:45-71`. The app-side
     half **has** landed (commit `c91cebe`): admin mutations now reach Postgres
     as the service role through the gated API routes. The file itself has never
     run.
   - **`cast_vote` under concurrency.** `pg_advisory_xact_lock` as the function's
     first statement, `app/supabase/migrations/2026-08-04-002_cast_vote_and_realtime.sql:99`,
     plus the hardened max-votes parse at `:102` (audit #16 — one non-numeric
     character in the admin's field used to break every vote in the room).
     README step 7 is the only real test of the lock and it cannot be run here.
   - **Realtime DELETE.** `alter table ideas replica identity full` at
     `2026-08-04-002:153`. Until it runs, a killed idea stays on the team wall
     until an unrelated event or a reload.
2. **`scripts/verify-deployment.mjs` does not exist.** U11 shipped its half — the
   runbook (`app/supabase/README.md`, 11 numbered steps, each naming the claim it
   proves and what failure means for the room) — but not the script that runs it.
   The README says so honestly ("until it exists, the steps are runnable by hand
   as written"). Everything in item 1 is therefore verified by a person reading
   prose at 8am on workshop day.
3. **A half-set `NEXT_PUBLIC_` pair silently ships a showcase browser.**
   `isShowcaseMode = !ENV_URL || !ENV_KEY` (`lib/supabase.ts:21`) is evaluated at
   build time and says nothing. A deploy with the URL but no anon key serves a
   live server behind a demo browser and the room's work vanishes into per-tab
   memory with no error. `prebuild` runs `check:writes` and `schema:check` and
   neither looks at this. README step 1 catches it; nothing in the build does.
   (Audit #9 — the audit calls it the worst failure on its list.)
4. **The Darkroom has no reaper.** U6 shipped the participant's way out —
   `isPrintStalled` / `useStalledDevelop` / `recoverStalledPrint`
   (`lib/darkroom.ts:156`, `:168`, `:515`), and a stranded develop is now one
   click from a fresh sheet. The server half was never in scope: nothing sweeps
   rows left `developing` past the ceiling back to null, and with a real model
   attached a render can die mid-flight on the server too. Owed, and named in
   `lib/darkroom.ts:64-70` and in the README's handoff section.
   **Note the ceiling moved:** `DEVELOP_CEILING_MS` is now 180s
   (`lib/darkroom.ts:141`), sized for three parallel 2K renders rather than the
   showcase's staged 30s beat. Any reaper must read that constant, not a number.
5. **Nothing bounds Darkroom spend.** `POST /api/darkroom` is ungated by design —
   it is a room surface, same posture as `/api/scout` and `/api/coach` — and
   every click fires **three parallel Gemini 3 Pro Image renders at 2K**
   (`lib/config.ts:732-737`, `app/api/darkroom/route.ts:55`, `:137`). There is no
   rate limit, no per-idea cap, no per-room budget, and no auth. Fine behind a
   protected demo URL; not fine on an open one, and a live room of 69 phones is
   the case where it matters. Named in `lib/darkroom.ts:71-73`.
6. **The Darkroom returns data URLs.** Three base64 2K images land in
   `ideas.print_options` on every developed sheet
   (`app/api/darkroom/route.ts:84-86`). Against the in-memory shim this is what
   makes a keys-only demo deploy possible with no bucket at all; against real
   Postgres it bloats the room's hottest table badly. The swap is contained —
   upload in the route, return public URLs, every surface already treats
   `print_options` as opaque strings — but it is owed before a real backend, not
   after. Named in `app/api/darkroom/route.ts:34-41` and `lib/darkroom.ts:57-63`.
7. **The live Darkroom's successful path has never run.** There is no
   `GOOGLE_GENERATIVE_AI_API_KEY` in this checkout, so every path through
   `app/api/darkroom/route.ts` that has actually executed is the 503 at `:95` —
   the showcase branch. `renderFrame`'s provider options, the `files` extraction,
   the data-URL prefix tolerance, the `allSettled` partial-sheet behaviour and
   the 16:9 pin are all unexercised code. The failure path is likewise theory.
   The visual harness has no coverage of it (no state hits `/api/darkroom`).
   **First run with a key is a test, and it should not be in front of a room.**
8. **The `updated_at` precondition has never round-tripped against PostgREST.**
   U7's conflict detection adds `.eq("updated_at", seenAt)` to the open card's
   save (`components/ExpandedCard.tsx:652`). It depends on the store comparing a
   `timestamptz` to the exact ISO string the app itself wrote; the shim compares
   JS strings, so this checkout cannot tell. A precision or timezone mismatch
   makes **every** save in the room look like a conflict. It ships behind a
   one-line kill switch (`USE_UPDATED_AT_PRECONDITION`, `:94`, currently `true`)
   and is README step 9. Someone has to run that step and rule.

Nine more, ranked with fixes, in the audit — #8 (both ballots still subscribe
`event: "UPDATE"` only on `workshop_settings`, so a phone opened before voting is
enabled never sees the ballot without a reload: `app/vote/page.tsx:322`,
`app/[team]/quick-add/page.tsx:194`), #11, #12, #13, #14, #15 (the `/api/ideas`
PATCH allow-list still omits all six new fields: `app/api/ideas/[id]/route.ts:44`),
#17, #18, #19.

---

## B. Fix before a real workshop (design/UX, not infrastructure)

- **The iOS keyboard fix has never met an iPhone.** U9 shipped it structurally —
  `useKeyboardInset` reading `visualViewport` (`app/[team]/quick-add/page.tsx:84`),
  the primary action as a sticky bar bound to that inset (`:645`),
  `interactive-widget=resizes-content` in the viewport meta (`app/layout.tsx:73`),
  and both `window.scrollTo(0, 0)` blur compensations removed (`:558`). The
  harness proves it at a simulated 390×844. Simulated keyboard insets and Safari's
  real ones are not the same fact, and this is the one item on the list whose
  failure mode is a participant who cannot file an idea. **Stays open until one
  pass on real hardware.**
- **Killing an idea still reclaims its №, and the escape hatch was never built.**
  This is worse than the 2026-08-03 entry said. U10 planned two artifacts — a
  reader change so `ideaNumbers()` prefers a stored `idea_no`, and an authored,
  deliberately-unapplied `2026-08-04-003_idea_no_optional.sql`. **Neither
  exists.** `lib/idea-number.ts:29-46` derives unconditionally with no stored-value
  branch, `idea_no` appears nowhere in `lib/types.ts`, and
  `app/supabase/migrations/` holds exactly two files. Three documents already
  describe the migration as shipped —
  `migrations/2026-08-04-001:122-125` ("ships as a separate ... migration
  (2026-08-04-003, authored by U10)"), `app/supabase/README.md:15`, and the plan
  itself. The ruling stands (Round 16: the № is derived, and the DELETE cost is
  on the record); what is missing is the artifact that makes reversing it a
  migration instead of a refactor. **Either build it or correct the three
  documents that claim it exists.**
- **`app/supabase/README.md:96` points at a block that no longer exists.** It
  tells the deployment team to build the Darkroom server job "to the spec in
  `app/lib/darkroom.ts`'s **REAL IMPLEMENTATION PLUG-IN** block (it is accurate —
  follow it, do not rewrite it)". That block was replaced on 2026-08-05 when the
  live route landed; `lib/darkroom.ts` now carries a STILL OWED list instead
  (`:56-73`). A dev team following the README looks for a section that is not
  there. One-paragraph fix, but it sits in the handoff document, which is the
  worst place for a dangling pointer.

---

## C. Decisions waiting on you

Checked against the ledger on 2026-08-05, then **all six were ruled on the same
day** and have moved to Closed below: the Stage spine dim, the mobile copy, the
PROOF SHEET edge slug, the deck's fonts, the seam bridge, and admin's register.

**Nothing on this list is waiting on you.** The next decision that lands here
should come from work not yet done, not from the backlog above.

---

## D. Parked deliberately

- **The shared activity clock** — mocked at `/card-lab#clock-round`. Note: R3 of
  the hierarchy plan removed the idea count it was designed to pair with, so its
  band composition must be RE-JUDGED, not resumed.
- **Streaming TTS for live coach replies** — assessed at ~1–2 days;
  recommendation is a per-engagement toggle, not baseline.
  See `docs/voice-and-coach-modality.md`.
- **Capture from the room** (post-it photos + discussion recording → drafted
  cards). Design thinking settled, nothing built. See
  `../workshop-platform/capture-from-the-room.md`.
- **Director's Cut** and **room intelligence / Convergence Field** — deferred by
  the hierarchy plan to post-voting review.
- **Coach modality experiments** — the ranked five in
  `docs/research-coach-modalities.md`; only the plate arrival shipped.
- **Print history** (`print_runs`: idea, source snapshot, url, commissioned_at).
  The showcase keeps only the latest `print_source`, so the Edition can never
  show a first-draft print beside the final one. Named as a real-implementation
  nicety in `lib/darkroom.ts:218-223`; nobody has asked for it.
- **The reskin D-list remainders**, from `docs/bespoke-layer-audit.md`. The
  approved pass shipped D-1, D-5, D-6, D-7, D-10, D-11 and D-13 (commits
  `e0a37c1`…`a8fa98d`). Left, by ruling or by scope: **D-2** logo config slot
  (~10 headers still bake `/logos/ogilvy-*.svg`), **D-3** layout metadata,
  **D-4** three-teams geometry (deferred until an engagement needs it — the
  medallion drum bakes 120°), **D-8** the base-register report layout, **D-9**
  the real JSONB framework-fields refactor (`bbei_connection` is still an
  engagement-branded column name in the schema), **D-12** guide slides to config.
  These are reskin cost, not deployment or workshop risk — which is why they are
  here and not in A or B.
- **The arrival moment stays bespoke** (Round 20, settled 2026-08-05). This is
  parked as a *ruling*, not as a backlog item: do NOT generalize Sprite's
  activating video and the D.O. clip into one video slot. The platform owes the
  moment a mounting point — stable arrival choreography, a composition that holds
  whatever is dropped in the centre, a defined hand-off into the room — and
  nothing more.

---

## Closed since 2026-08-03

Verified closed in the code, not just in a plan. Do not re-report these.

| Was | Closed by | Evidence |
|---|---|---|
| A3 — no auth on any mutating or AI route | U5 + the service-role rewire (`3730872`, `c91cebe`) | One enumerated `GATED_ROUTES` list read by both the matcher and the handlers, `lib/admin-session.ts:294-318`; `middleware.ts:106-121`. `PUT /api/settings` is 401 without a session |
| A5 — `ADMIN_PASSWORD` unset fails OPEN, and the cookie is the password | U5 (`3730872`) | `middleware.ts:55-66` denies when unconfigured; the cookie is an HMAC-signed expiry-only token in an httpOnly cookie (`lib/admin-session.ts:155-193`), and the legacy plaintext cookie is cleared on login |
| B — open cards don't merge remote edits | U7 (`ce38459`) | Field-level writes (only changed columns, `ExpandedCard.tsx:650`) plus the `updated_at` precondition and a fourth `conflict` save state (`:102`, `:652`, `:667-677`). **The precondition's live behaviour is A8 above** |
| B — an abandoned coach exchange is lost but the idea counts as coached | U8 (`02fa5f3`) | The record then the stamp: a `training_notes` insert per completed exchange at `CoachTakeover.tsx:490`, `onCoached` moved off the edit path and fired only after the insert lands (`:504`) |
| B — Board scrolls horizontally at 390px | U9 (`7fb35bd`) | Header chrome collapses at `max-[599px]` (`app/[team]/page.tsx:690`, `:967`); harness state `board-phone-390x844` asserts `docOverflow === false` (`scripts/visual-qa-board-stage-newsroom.mjs:376`, `:286`) |
| B — the vote receipt is session state | U9 (`7fb35bd`) | The receipt book moved to `localStorage`, keyed per category and read on mount (`app/vote/page.tsx:69`, `:114`, `:185`) |
| Audit #1's silent-failure half — ~70 mutating call sites never inspected `error` | U3 (`ce38459`) | `lib/db.ts`'s `write()` returns a discriminated result the caller cannot ignore, and `scripts/check-write-errors.mjs` fails the build on any bypass without an `// write-unchecked:` reason. Wired into `prebuild` |
| Audit #1's ballot-widening half — an unreadable `presenting` opened the gate wide | U4 (`2a51248`) | A third state: `lib/present-gate.ts:85-98` returns `unreadable`, and the ballot refuses rather than widening |
| The shim tolerated what PostgREST rejects | U2 (`d852be9`) | `lib/schema-manifest.generated.ts`, generated from the deployment SQL in the README's apply order; `npm run schema:check` fails the build when the manifest and the SQL diverge |
| A7's participant half — a refresh strands `developing` forever | U6 (`a4f31ab`) | `isPrintStalled` / `useStalledDevelop` / `recoverStalledPrint` (`lib/darkroom.ts:156`, `:168`, `:515`), judged from `updated_at` with no new column. **The server reaper is A4 above** |
| `/api/scout` degraded to canned pitches without an admin session | `bb14717` | Deliberately absent from `GATED_ROUTES` — a room surface must not need a laptop's login. Same standing posture as `/api/coach`, and now `/api/darkroom` |
| C — the 55% Stage spine dim | Ruled 2026-08-05; fixed as PARITY, not removal | The dim had two reasons and only one died. Touffou's brand-adjacent red is gone, but "six to twelve at full strength turned the wall into wallpaper" is hue-independent and stands. What was actually wrong was fairness: at a flat 0.55 on `#1B1A1D`, cobalt measured 1.43:1, oxblood 1.40:1, stone 3.17:1. `heldBackTint()` (`lib/config.ts`) now solves each hue to the same contrast — 1.48 / 1.47 / 1.49 — and keeps solving it when an engagement swaps a colour |
| C — mobile copy added by the sweep | Ruled 2026-08-05 ("keep this lean") | "Filing under **New Craft**." trimmed to the label alone (`app/[team]/quick-add/page.tsx:528`); the chip wears the abbreviation, so the spelled-out category stays. The flash's "It's on Touffou's Board." KEPT — the stamp says it happened, that line says where to look. `FILED` → `ADDED` kept. The two lines a sweep-reader might mistake for helpers are the `addFailed` / `ballotFailed` messages, which are U3 failure surfacing and must not be trimmed |
| C — the seam bridge (card-lab Round 3) | Ruled 2026-08-05: hard seam ships, the dissolve is dead | Recorded as foundation in ledger Round 9 item 3 — no engagement has a reason to want it different, so it is ruled once. Rejected because the bridge is a soft crop of the print's bottom 40px (against the full-frame law), because its cost swings unpredictably on GENERATED pictures with no dial that fixes both cases, and because the crisp edge is the print idiom. The mock is kept at `/card-lab#seam-bridge` labelled RULED; it also carried the proof of the wider rule — it baked `#0A0A0C` while the real panel is `rgba(10,10,12,0.92)`, so it would have banded. **A primitive compositing against a token must read it, never bake it** |
| C — the PROOF SHEET edge slug | Ruled 2026-08-05: dropped | Never built, so nothing to remove. It named the metaphor rather than telling the room anything, which the system's own law forbids |
| C — the exported deck's Georgia/Arial | Ruled 2026-08-05: keep | `lib/export-pptx.ts:69-70` stays. Embedding a licensed face in a file handed to a client is a different permission from using it on screen; the fallbacks are honest and legible |
| C — Admin's register | Ruled 2026-08-05: **theater-dark, "like the team select screen"** — shipped (`1ae74c7`, `23a62c6`) | The design doc had assigned admin to no register at all, which is why the sweep had to guess; the register list in `docs/ogilvy-showcase-direction.md` now names the console and its login door, and Round 21 records the ruling. The console takes `surface0` / `surface1` / `rgba(255,255,255,0.14)` / `#A8A5A6` from `app/page.tsx` rather than from a palette invented for it. Three light rulings inverted rather than survived — the ink slab became the paper slab, red stopped being words and became edges (three jobs: READY, the unmet mark, the LIVE chip), and the `WELL` inset became a 3:1 field EDGE because `#0A0A0C` inside `#1B1A1D` is 1.14:1. `paperType()` left the file (Round 7 item 5), `darkMark()` entered `lib/config.ts` for the one coach hue that IS ink, and the login moved so entering the console is not a white flash. Every type pair on all eleven tabs ≥4.5:1 bar the Kruger (3.94:1, unchanged product canon) and the red ▪ (4.39:1, held to the 3:1 non-text floor) |
| Audit #16 — one non-numeric character in max-votes broke every vote | U1 (`8ec54cf`) | Rewritten parse at `2026-08-04-002:102`. **Written, not applied** — it rides item A1 |

---

## Not an issue (checked)

- Coach voice mp3s ARE committed (`app/public/audio/coaches/`).
- Touffou activation images and the rewritten descriptions are committed.
- The entry backdrop photo is committed and small (`app/public/backdrop/entry.jpg`,
  59KB), with the generative field as the runtime fallback.
- The showcase's same-browser BroadcastChannel realtime is a showcase-mode
  constraint, not a defect — real Supabase realtime replaces it.
- `/api/scout`, `/api/coach` and `/api/darkroom` are ungated **on purpose** —
  all three are room surfaces, and a login in front of a table of participants
  is a worse failure than the exposure. Recorded in `lib/admin-session.ts:280-288`
  and in the runbook's accepted-exposures list. The Darkroom's missing spend
  bound (A5) is a separate, real gap and is not covered by this ruling.
