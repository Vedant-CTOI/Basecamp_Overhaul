# UX Rules — Hard-Won, From Live Deployments

Rules learned running this platform in real rooms (Coca-Cola March 2026, Sprite × NBA
April 2026). These are not preferences — each one traces to something that failed or
worked under live-workshop conditions. They bind every surface in this repo.

## Projector readability (the room is 15–20 feet from the screen)

- Minimum 16px for anything the room needs to read. 24px+ for idea names.
  48px+ for section headers on stage surfaces.
- No gray-on-dark for room-facing content — invisible at distance. `#999` minimum,
  `#ccc` for important labels. Projector gamma crushes shadows: never stack
  near-black grays on black; separate surfaces with hairlines, not lighter fills.
- Red carries far less luminance projected than on a monitor, and cheap projectors
  bloom saturated red. Red is a field or bar with white type on it — never running
  text at room scale.
- `text-wrap: balance` on anything that might orphan a word (headlines, pillar names).
- Facilitator-only hints can be small and dim — they read the laptop, not the wall.
- If the facilitator has to scroll the projected view, the layout has failed.
  Stage states are discrete broadcast frames.

## Interaction

- **Click-to-expand, not hover.** Dropdowns open on click, close on click-outside.
  Hover menus feel flimsy and unreliable, especially on projected displays.
  Never hide an affordance behind hover-only.
- **Full opacity by default.** New UI elements ship clearly visible. Dim states are
  only for secondary info (metadata, counts). Dimmed UI gets lost on a projector.
- **Fixed card heights over variable.** Grids of cards keep consistent heights;
  controls pin absolutely inside the card rather than growing it.

## Mobile voting (phones in a live room)

- No submit button — instant-tap with optimistic UI. An "auto-saved" label preempts
  "where's submit?" confusion.
- Never say "submitted" or "locked in" — votes stay swappable until the facilitator
  closes the ballot. Those words imply finality that doesn't exist.
- Lock vote-control dimensions with explicit width/height so text changes never
  shift layout mid-vote.
- At max votes, dim unvoted options (~0.4) to show the budget without blocking.
- Tap targets ≥ 44px.

## Error copy (the room is watching)

- Conversational, never shouty: "Just a moment" not "Something went wrong."
  "Taking a moment — try again" not "Service unavailable."
- Never show "error," "failed," or "contact support" language on a projected
  surface. The message is for the facilitator, but everyone sees it.

## Ambient elements

- The ticker/wire is the ONE continuously moving element in the system. Fixed
  speed — never scale speed with content volume. Ambient, not information-passing.
- All other motion is an event: state changes cut fast (150–250ms), numbers tick,
  and the two choreographed peaks (results reveal, winner moment) get 1–2 seconds.
  Nothing fades up on scroll; nothing floats.

## AI conduct

- AI provokes and expands. It never scores, ranks, or judges an idea. (This is a
  product principle — see `philosophy.md` — but it binds copy and UI too: no
  score badges, no AI verdict language, no "rating" affordances on AI output.)
- AI-drafted content is always labeled as such (the SCOUTED stamp) and counts for
  nothing until a human keeps it.
