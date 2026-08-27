# Public Assets — the drop-in slots

What the current app actually references, slot by slot. Every path below
is either read from `lib/config.ts` or degrades gracefully when the file
is missing — so a reskin is files plus config edits, not code changes.
(Rewritten 2026-08-05 against the shipped tree; the old version of this
file described the sports-era app.) These slots are Layer 2 of the full
customization map in `docs/customization-layers.md`.

## /fonts — the licensed faces
`OgilvySerifWeb-*` and `OgilvySansWeb-*` woff2s, loaded by the four
`localFont` blocks in `app/layout.tsx` (Courier Prime comes from Google
Fonts). To reskin: replace the woff2s and those blocks; every surface
follows via `--font-ogilvy-serif` / `--font-ogilvy-sans`. Licensed —
leave behind in any non-Ogilvy fork.

## /logos
`ogilvy-logo-white.svg`, `ogilvy-logo-ink.svg` (+ `ogilvy-logo.svg`).
The entry hero reads `ENTRY_CONFIG.clientLogo` from config; the other
headers currently reference the white/ink SVGs by literal path (the
audited D-2 gap — a `BRAND.logo` slot is the planned fix). Until then a
reskin drops same-named files or edits the ~10 header call sites.

## /coaches — per `COACH_DEFS` in lib/config.ts
- Avatars: `provocateur.png`, `sharpener.png`, `listener.png`,
  `tastemaker.png` (square, ~512px) — paths on each coach's `avatar`.
- Full-bleed picker portraits: `full/<same names>.png` — paths on each
  coach's `portrait`. A missing portrait falls back to the monogram
  SVGs (`provocateur.svg` etc.) that ship beside the avatars.

## /audio/coaches — coach voices
One mp3 per coach TYPE (`provocateur.mp3`, `sharpener.mp3`,
`fan_lens.mp3`, `rights_advisor.mp3`). Missing file → text-only, no
error. Regenerate per cast with `scripts/generate-coach-voices.mjs`.

## /backdrop — the entry's full-bleed photo
`entry.jpg` (1920w) — the photographic backdrop beneath the entry's
orbital core, wired by `ENTRY_CONFIG.backdrop` in `lib/config.ts`. The
engagement's own place (Coke opened on the LA skyline; this edition
opens on the Touffou grounds). Grade it dark and quiet — the frame
should read as environment, not content; the component adds a deepened
scrim on top and disables the shader field so the orbit type, core, and
coupon hold projector contrast over any photo. Missing or broken file →
the generative AmbientField renders exactly as before; set the config
slot to `null` to ship without the photo deliberately.

## /video
- `teams/<group-slug>.mp4` + `<group-slug>.jpg` — team-select medallion
  loops and posters, wired in `TEAM_SELECT_CONFIG.media`. Missing files
  fall back to the zero-asset generative field at runtime.
- `unlock-quote.mp4` — optional unlock-ritual clip (HEAD-checked by the
  entry; absent file leaves the typographic ritual unchanged). Its
  caption/credit constants live beside the slot in `app/page.tsx`.

## /prints and /activation-images
`prints/print-0*.png` — eight abstract 16:9 duotones from
`scripts/generate-prints.py`, the showcase's stand-in contact-sheet
frames. `activation-images/` holds the showcase's real key visuals.
Regenerate per engagement palette; the real-model plug-in point and its
art-direction prompt live in `lib/darkroom.ts`.

## /textures
`tartan.svg` — Ogilvy heritage band (`.tartan-band`). Swap or delete
per engagement; an absent file simply doesn't paint.

## /reporters
Empty and optional — headshots for the breaking-news device only.
Engagements without the device drop it entirely.

## /backgrounds, /explorations
Empty / working files. Nothing in the app references them.

---

Handoff rule: ship the slots empty (with this file) except what the
engagement licensed. The colors these assets sit on all route through
`BRAND.colors` in `lib/config.ts` — one edit re-voices the platform.
