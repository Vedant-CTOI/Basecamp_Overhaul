// ============================================================
// THE RENDER PROMPT — what the image model is actually asked for
// ============================================================
// Deliberately its own module, importing nothing but config: both the
// CLIENT (lib/darkroom.ts, which carries React hooks and the supabase
// shim) and the SERVER route (app/api/darkroom) need this function, and
// a route handler must not drag a client module into the server bundle
// to get it. Pure, synchronous, no I/O — so the harness and any prompt
// review can print exactly what would be sent without a key or a call.
// ============================================================

import { IMAGE_ART_DIRECTION } from "./config";

type PromptSubject = { name: string; description?: string | null };

/** Compose the commission: the engagement's standing art direction
 *  (`IMAGE_ART_DIRECTION` in config — swap that constant and every
 *  print re-art-directs), the idea's own words, the format law, and
 *  the team's optional note.
 *
 *  THE NOTE'S STANDING. It goes LAST, which is where an image model
 *  weights hardest, and it is told explicitly that it outranks the
 *  standing direction — the note is the team's own art direction and
 *  the whole point of the darkroom being a commission rather than a
 *  button. But it is NOT allowed to break format or palette: those two
 *  carry the engagement's identity and the 16:9 mounts every surface is
 *  built from, so "make it square" or "make it purple" must lose. Every
 *  other disagreement, the room wins.
 *
 *  ONE COMMISSION, ONE BRIEF. The same string goes to all three
 *  parallel renders — a sheet is three readings of one direction, not
 *  three different briefs — so the team chooses between takes rather
 *  than between instructions. */
export function buildRenderPrompt(
  idea: PromptSubject,
  note?: string | null
): string {
  const words = (idea.description ?? "").trim();
  const subject = words ? `${idea.name} — ${words}` : idea.name;
  const direction = (note ?? "").trim();

  return [
    IMAGE_ART_DIRECTION,
    ``,
    `Subject: ${subject}`,
    `Format: cinematic 16:9 campaign key visual.`,
    ...(direction
      ? [
          ``,
          `Art direction from the team, which takes precedence over the standing direction above wherever the two disagree — except on format and palette, which it may not override: ${direction}`,
        ]
      : []),
  ].join("\n");
}
