import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { ANTI_TIC_RULES } from "@/lib/coaches";
import { requireAdmin } from "@/lib/admin-session";

export const maxDuration = 15;

// Bespoke layer: the "breaking news" device leans into a sports-media voice
// (Sprite-era reference: NBA trade-deadline insider tweets). Re-theme per
// engagement — generic name kept here, but voice/style/reporter handles
// should be re-tuned in the prompt below.
const BreakingNewsSchema = z.object({
  message: z.string().describe("A single punchy sentence in insider breaking-news style. Max 120 characters. No hashtags."),
  reporter: z.enum(["reporter_a", "reporter_b"]).describe("Which reporter is 'breaking' this news"),
});

// POST /api/breaking-news — ADMIN SESSION REQUIRED (U5)
// Generates a breaking-news toast from recent workshop activity and puts
// it on the wire, which every room surface carries.
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const force = body.force === true; // bypass cooldown for demo triggers

  // Check cooldown — don't fire more than once every 10 minutes unless forced
  if (!force) {
    const { data: recent } = await supabase
      .from("ticker_messages")
      .select("created_at")
      .eq("style", "breaking")
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      const lastAt = new Date(recent[0].created_at).getTime();
      if (Date.now() - lastAt < 10 * 60 * 1000) {
        return Response.json({ skipped: true, reason: "cooldown" }, { status: 200 });
      }
    }
  }

  // Gather recent workshop activity for context
  const [{ data: recentIdeas }, { data: teams }, { data: settings }] = await Promise.all([
    supabase
      .from("ideas")
      .select("name, category, status, team_id, source, created_at")
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase.from("teams").select("id, name, slug"),
    supabase.from("workshop_settings").select("key, value").eq("key", "workshop_state"),
  ]);

  if (!recentIdeas || recentIdeas.length === 0) {
    return Response.json({ skipped: true, reason: "no activity" }, { status: 200 });
  }

  const teamLookup = Object.fromEntries((teams || []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const activitySummary = recentIdeas
    .slice(0, 10)
    .map((i: { name: string; category: string; status: string; team_id: string | null; source: string }) => {
      const team = i.team_id ? teamLookup[i.team_id] || "Unknown" : "Tissue";
      return `"${i.name}" (${i.category}, ${i.status}) by ${team}${i.source === "ai_scouted" ? " [AI Scouted]" : ""}`;
    })
    .join("\n");

  try {
    const { object } = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: BreakingNewsSchema,
      temperature: 0.9,
      prompt: `You are generating a fake "breaking news" alert for a co-creation workshop. The alert should feel like a real industry-insider tweet — dramatic, specific, referencing actual team names and idea names from the workshop.

RECENT WORKSHOP ACTIVITY:
${activitySummary}

RULES:
- Reference a SPECIFIC team name and idea name from the activity above
- Write in a breathless insider-reporting voice
- One sentence only, under 120 characters
- Examples of good style: "Sources: Team A moving aggressively on '[Idea Name]' — could be the breakout concept", "Team B has locked in '[Idea Name]' as their cornerstone, per sources"
- Do NOT use "breaking:" prefix — the UI adds that
- Alternate between reporter_a and reporter_b
${ANTI_TIC_RULES}`,
    });

    // Insert the breaking news — on the server client: policies.sql
    // narrows anon's ticker insert to style 'standard' precisely so a
    // phone cannot forge a BREAKING takeover; this route is the one
    // legitimate writer of 'breaking' rows.
    const r = await write("ticker_messages.insert:breaking", getServerSupabase().from("ticker_messages").insert({
      message: object.message,
      style: "breaking",
      reporter: object.reporter,
      is_active: true,
    }));

    if (!r.ok) {
      const error = { message: r.message };
      console.error("Breaking news insert error:", error);
      return Response.json({ error: "Insert failed" }, { status: 500 });
    }

    return Response.json({ message: object.message, reporter: object.reporter });
  } catch (err) {
    console.error("Breaking news generation failed:", err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
