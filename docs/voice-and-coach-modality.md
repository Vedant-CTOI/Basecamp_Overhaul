# Coach voice: what's built, and the open question

## What ships today (showcase)
Four coaches speak from PRE-RENDERED mp3s in `public/audio/coaches/`,
generated once by `scripts/generate-coach-voices.mjs` (ElevenLabs).
This works only because showcase replies are fixed text. Casting:
Provocateur=Antoni, Sharpener=Arnold, Listener=Sarah, Tastemaker=Adam
(legacy premade voices — ElevenLabs "library" voices 402 on free plans).
Re-run with `--force` if the scripted copy in `lib/showcase-data.ts`
changes, or voice and text drift apart.

## Live deployments: streaming TTS (NOT built — deliberate)
Genuine AI replies need runtime TTS. Assessment: ~1–2 days for a
competent front-end dev. Not research, but not free.

- **Shape:** pipe LLM tokens into ElevenLabs' streaming-input WebSocket;
  audio chunks return continuously, so the coach starts speaking ~1s in
  instead of after the full reply. Simpler variant: buffer the streaming
  text to sentence boundaries, POST each sentence, queue the clips.
- **The real work** is browser-side: queueing audio chunks smoothly
  (Web Audio / MediaSource) and making playback INTERRUPTIBLE — this
  room lets you Esc to fast-forward or switch coaches mid-reply.
- **Key stays server-side** behind a route handler (same pattern as the
  existing coach API). The browser never holds it.
- **Cost is per-character at runtime.** A full day of live coaching is
  real money — model it before committing.
- **Room audio:** one device is the speaker; browser autoplay needs a
  user gesture to unlock (facilitator presses once at session start).

## Recommendation
Keep pre-rendered audio for scripted moments; make streaming TTS a
PER-ENGAGEMENT TOGGLE, not baseline. Most of a workshop's value is the
text — voice is a craft moment, and a deployment should be able to ship
without it.

## Open question (2026-07-31, user)
If voice is a logistical uphill battle, what OTHER modalities make the
coach's contribution feel dynamic and part of the room, rather than a
chat bubble streaming a line of text?

ANSWERED: see `docs/research-coach-modalities.md` — six families of
prior art, twelve patterns with adopt/adapt/reject verdicts, and five
ranked recommendations. Headline: the problem is not that the bubble is
silent, it's that it's ADDRESSED. Cheapest real wins are killing the
typewriter (the reply lands composed, developed like a print), the
china-marker drawn on the team's OWN words, and one graded non-speech
bell on the wire-service code — all together under a day, versus the
1–2 days plus per-character runtime that streaming TTS costs.
