# Progress

## Last Session: 2026-08-07 — the develop-in removed; the Stage flag reads

Two user rulings, both shipped and pushed.

**The grayscale→colour develop-in is gone** (`bf3efdc`). Pictures now arrive as printed fact: one that lands mid-session simply appears, like one that mounted with its surface always did. Reason on record, verbatim: *"it doesn't feel necessary and would just be another thing that needs to configure for other clients/themes."* Removed with it: the `animateIn`/`delay` props, the mount-time refs that computed them (`printUrlAtMount`, `sheetAtMount`, `hadPrintAtMount`), `ContactSheet`'s `animateIn`, and the sheet's develop stagger. `PrintReveal` is now a plain `<img>` holding only the object-fit and drag contract — the sole reason it stays a component rather than being inlined at 25 call sites. **Deliberately kept: the gray STATES** (a superseded frame ghosting under a re-picture, an unchosen sheet sitting washed). Those encode facts — *being replaced*, *nothing chosen yet* — and are not decoration. Ruling: `docs/ogilvy-showcase-direction.md` Round 8 item 3, struck through and amended.

**The Board card's `★ STAGE` flag was too dim** (`288cfc1`, recorded as Round 22). It sat at `rgba(35,31,32,0.55)` = 3.72:1 on the card's white at 10px, under the 4.5:1 floor; now `0.78` = 7.97:1. The general rule matters more than the value: **decisions read, process whispers.** A decision the team made (this idea goes to the Stage) reads; a process fact the system reports (darkroom working, sheet ready, stalled) whispers at 0.55 and is allowed to. Not red — see Round 22 for why the Kruger is wrong here.

## Current State

- **Repo:** standalone `bidnam/basecamp-showcase`, branch `main` (the old `ogilvy-generic` branch name in earlier notes is historical). Private. Deployed on Vercel, auto-deploys from `main`; Vercel root directory is `app`.
- **The site is public with `noindex`.** Noindex is not access control — treat the deployed URL as shareable-but-quiet. The admin console is behind `ADMIN_PASSWORD` (env var; ask Bidnam for the value, it is deliberately not in the repo).
- **Showcase mode is the default and needs no backend.** With no Supabase env vars, `lib/supabase.ts` serves an in-memory shim and realtime runs over BroadcastChannel — which is **same-browser only**. Two people on two laptops will not see each other. That is expected for the showcase, and is the single most common source of "the realtime is broken" reports.
- **Full harness green:** 1110 checks / 0 failures across all 13 suites. `node scripts/visual-qa-board-stage-newsroom.mjs all` (Playwright is not installed here — run it from the sibling `sprite-workshop` checkout, or set `PLAYWRIGHT_MODULE`; see the header of that script).
- `tsc --noEmit` clean; production `next build` exits 0.
- The four customization layers are documented in `docs/customization-layers.md` (this closes the "layers doc" that earlier notes listed as planned). Design rulings live in `docs/ogilvy-showcase-direction.md`, by round.
- Pre-existing eslint debt is untouched and unrelated to recent passes.

## Next Up

- **The QA harness tops out at 1600px.** Every check ever run has been at laptop widths, which is exactly how the big-screen failure reached two live client workshops unnoticed. Add 2560 and 3840 to the room-facing suites.
- **The darkroom's live success path is UNVERIFIED.** With `GOOGLE_GENERATIVE_AI_API_KEY` set, `app/app/api/darkroom/route.ts` renders three frames at 16:9; without it the route answers 503 and the pre-rendered stand-ins take over. Only the 503 path has been exercised end to end.
- **Before any real room:** the darkroom needs storage instead of data URLs, a server-side reaper, and a spend bound. All three are listed at the top of `app/lib/darkroom.ts`.
- No Supabase project is provisioned. The SQL is written but has been applied nowhere.
- `scripts/verify-deployment.mjs` was specced and never written.
- One pass on a real iPhone (the phone surfaces have only been checked at emulated 390×844).
- D-list remainders deferred by ruling or never scoped: D-4 three-teams geometry (deferred until an engagement wants it; ~1–2 days including motion QA), D-2 logo config slot, D-3 layout metadata, D-12 guide slides to config, D-8 base-register report, D-9's real JSONB framework refactor.

## Open Questions

- Every production build prints `Ecmascript file had an error` from `lib/supabase.ts`'s BroadcastChannel shim (`'__basecamp' in data`). Pre-existing and non-fatal — the build exits 0 — but it is noise on every deploy and would mask a real error. Worth diagnosing.
- The Scout route still falls back to canned showcase pitches on ANY failure (a deliberate U5 posture). A placeholder misconfiguration is caught by the route's 503 and the admin pre-flight row, not on the Board surface itself.
- The transient process flags (darkroom / sheet ready / stalled) share the old `0.55` ink and so sit at the same 3.72:1 the Stage flag was corrected from. Left there on purpose under Round 22 — process facts are allowed to whisper — but if a room ever needs them read, they move together, one line.
