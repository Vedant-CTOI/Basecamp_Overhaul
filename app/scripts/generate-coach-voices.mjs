// ============================================================
// Generate coach voices with ElevenLabs (one-time, pre-rendered)
// ============================================================
// The showcase coach replies are fixed text, so we render each coach's
// voice ONCE to a static mp3. Real ElevenLabs quality, zero runtime cost,
// zero latency, works offline. The takeover plays these files if present
// and falls back to text-only if not.
//
// USAGE:
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-coach-voices.mjs
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-coach-voices.mjs --list
//
// --list prints the voices available on your account so you can swap the
// VOICES map below to your preferred casting.
// ============================================================

import { writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Set ELEVENLABS_API_KEY. See the header of this file for usage.");
  process.exit(1);
}

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dir, "..", "public", "audio", "coaches");

// Casting — ElevenLabs' classic premade voice IDs, matched to each persona.
// If your account uses different voices, run with --list and swap these.
const VOICES = {
  provocateur:    { id: "ErXwobaYiN019PkySvjV", note: "Antoni — energetic, pushes" },
  sharpener:      { id: "VR6AewLTigWG4xSOukaG", note: "Arnold — crisp, precise" },
  // NOTE: Rachel (21m00...) and Sam (yoZ06...) are LIBRARY voices — the
  // API rejects them on a free plan (402 paid_plan_required). These two
  // are legacy premade voices, which render on the free tier like Antoni
  // and Arnold above. On a paid plan, cast whatever you like via --list.
  fan_lens:       { id: "EXAVITQu4vr4xnSDxMaL", note: "Sarah — warm, human (The Listener)" },
  rights_advisor: { id: "pNInz6obpgDQGcFmaJgB", note: "Adam — current, quick (The Tastemaker)" },
};

// The lines the coaches actually SPEAK. Kept in sync with
// SHOWCASE_COACH_REPLIES in lib/showcase-data.ts, minus the parenthetical
// UI note (that's a caption, not something the coach says aloud).
const LINES = {
  provocateur:
    "Take the version you're holding and ask what it looks like with ten times the nerve. Right now this idea behaves politely — it asks the agency's permission. Rewrite the first line so it makes a claim the smugness in the building has to answer, then keep every tooth when the edits come.",
  sharpener:
    "Hold it against the brief. The strongest overlap is the part you wrote last — move it to the front, cut the throat-clearing, and let the framework fields carry the strategy so the description can carry the idea. Then name one number this changes; today's briefs don't accept vibes.",
  fan_lens:
    "The room you're writing for can smell a hedge from the hallway. This lands the moment it costs them nothing to care — find the ten-second version a skeptical creative director would retell badly at the bar and still get right. That retelling is the idea; the rest is production.",
  rights_advisor:
    "Right now this idea sits next to the quiet-competence thing moving through culture — brands proving they can actually do the work, not just talk about it. That's live, not late. Where it wobbles: overnight borrows from hustle culture, which is tipping into cringe. Reframe the speed as craft, not grind, and you're riding the wave instead of chasing it. This should feel fresh the day it ships.",
};

async function listVoices() {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": KEY },
  });
  if (!res.ok) { console.error("List failed:", res.status, await res.text()); process.exit(1); }
  const { voices } = await res.json();
  console.log("\nAvailable voices on your account:\n");
  for (const v of voices) console.log(`  ${v.voice_id}  ${v.name}  (${v.category})`);
  console.log("\nEdit the VOICES map in this script to recast, then run without --list.\n");
}

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });
  // Already-rendered coaches are skipped so a re-run only fills the gaps
  // (a failed voice, a re-cast) instead of respending characters on the
  // ones that worked. `--force` re-renders everything.
  const force = process.argv.includes("--force");
  for (const [coach, { id, note }] of Object.entries(VOICES)) {
    const target = path.join(OUT_DIR, `${coach}.mp3`);
    if (!force) {
      try {
        await access(target);
        console.log(`${coach} — already rendered, skipping (--force to redo)`);
        continue;
      } catch {}
    }
    process.stdout.write(`${coach} (${note})… `);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: LINES[coach],
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!res.ok) { console.error("FAILED:", res.status, await res.text()); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(OUT_DIR, `${coach}.mp3`);
    await writeFile(file, buf);
    console.log(`✓ ${(buf.length / 1024).toFixed(0)}kb → public/audio/coaches/${coach}.mp3`);
  }
  console.log("\nDone. Refresh the takeover — coaches now speak.\n");
}

if (process.argv.includes("--list")) await listVoices();
else await generate();
