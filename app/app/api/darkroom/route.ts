import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { buildRenderPrompt } from "@/lib/render-prompt";
import { IMAGE_MODEL } from "@/lib/config";
import { findPlaceholderTokens } from "@/lib/engagement-context";

// ============================================================
// THE DARKROOM — the live develop
// ============================================================
// One commission in, a contact sheet of frames out. The choreography
// around this route (the IN THE DARKROOM stamp, the wait, the sheet,
// the two-step select, stale detection, recovery) is entirely in
// lib/darkroom.ts and does not change when this route is present —
// this only replaces the showcase's staged setTimeout with real work.
//
// THREE RENDERS, ONE BRIEF, IN PARALLEL. A sheet is three readings of
// one commission, so all three get the identical prompt and run
// concurrently — the sheet costs the wall-clock of a single frame, not
// three. The team then chooses on taste, which is the point: the
// choice is the room's, not the model's.
//
// THE WAIT IS NOT PADDED. Whatever this takes IS the develop beat
// (user ruling: the beat is the work — never add time to natural
// latency). The 20–30s staged beat in lib/darkroom.ts applies ONLY to
// showcase mode, where there is nothing real to wait for.
//
// PORTABILITY. Nothing here is Vercel-specific. `@ai-sdk/google` is a
// plain npm library, the handler is a standard Next.js route, and the
// frames come back as data URLs rather than going to any host's blob
// store — so this runs unchanged on Cloud Run, a container, or any
// Node host. `maxDuration` below is Next.js route config that Vercel
// honours and other hosts ignore.
//
// WHY DATA URLS. With no backend attached there is no storage bucket
// to write to, and the in-memory shim holds the frames perfectly well
// for a session — which is what makes a keys-only demo deploy possible
// at all. WITH a real Postgres backend this must change: three 2K data
// URLs on every row would bloat `ideas` badly. The swap is to upload
// each frame to storage here and return the public URLs instead; every
// surface already treats print_options as opaque strings, so nothing
// downstream moves.
// ============================================================

/** Image generation is slow by nature and three renders run at once.
    Vercel honours this (Pro allows up to 300s; Hobby caps at 60s and
    will cut a long develop short); other hosts ignore it and use their
    own timeout. */
export const maxDuration = 300;

/** The FORMAT LAW, pinned here rather than in config: every mount in
    the product is a true 16:9 box and no surface ever crops a print,
    so a render at any other ratio would arrive already broken. */
const ASPECT_RATIO = "16:9" as const;

const FRAMES_PER_SHEET = 3;

type Body = {
  name?: unknown;
  description?: unknown;
  note?: unknown;
};

/** One frame. Returns a data URL, or null if the model answered
    without an image (a refusal, a safety block, an empty response) —
    a null is one lost frame, not a lost sheet. */
async function renderFrame(prompt: string): Promise<string | null> {
  const result = await generateText({
    model: google(IMAGE_MODEL.id),
    prompt,
    providerOptions: {
      google: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: ASPECT_RATIO, imageSize: IMAGE_MODEL.size },
      },
    },
  });

  const image = result.files?.find((f) => f.mediaType?.startsWith("image/"));
  if (!image) return null;

  // `base64` is documented as raw base64, but tolerate a provider that
  // hands back a full data URL rather than double-prefixing it.
  const data = image.base64;
  return data.startsWith("data:")
    ? data
    : `data:${image.mediaType ?? "image/png"};base64,${data}`;
}

export async function POST(req: Request) {
  // NOT CONFIGURED IS NOT AN ERROR. Without a key this deployment is
  // in showcase mode, and 503 is the agreed signal for that: the
  // client falls back to the pre-rendered stand-ins and the staged
  // beat, remembers the answer, and stops asking. Any OTHER failure
  // below is a real failure and must never be dressed as a sheet.
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      { error: "Darkroom not configured — showcase prints in use." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Not sent · unreadable commission." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json(
      { error: "Not sent · an idea needs a name before it can be pictured." },
      { status: 400 }
    );
  }
  const description = typeof body.description === "string" ? body.description : "";
  const note = typeof body.note === "string" ? body.note : null;

  const prompt = buildRenderPrompt({ name, description }, note);

  // D-6, the same tripwire the coach routes carry: a prompt still
  // holding a bracket token means the engagement's art direction was
  // never written for this client. Fail loudly rather than render a
  // placeholder into a picture the room will see.
  const tokens = findPlaceholderTokens(prompt);
  if (tokens.length > 0) {
    return Response.json(
      {
        error: `Not sent · the art direction still carries placeholder tokens (${tokens.join(", ")}) — write IMAGE_ART_DIRECTION for this engagement before commissioning.`,
      },
      { status: 503 }
    );
  }

  // allSettled, not all: one refused frame must not cost the room the
  // other two. A sheet of two is a sheet; a sheet of none is a failure.
  const settled = await Promise.allSettled(
    Array.from({ length: FRAMES_PER_SHEET }, () => renderFrame(prompt))
  );

  const frames: string[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value) frames.push(outcome.value);
    else if (outcome.status === "rejected") console.error("Darkroom render failed:", outcome.reason);
  }

  if (frames.length === 0) {
    return Response.json(
      { error: "The darkroom could not develop this one — try it again." },
      { status: 502 }
    );
  }

  return Response.json({ frames });
}
