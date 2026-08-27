import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase-server";
import { PILLARS, isPillarSlug, type PillarSlug } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-session";
import { write } from "@/lib/db";

export const maxDuration = 15;

// SERVICE-ROLE REWIRE: the hand-built client (which threw with no env —
// audit #12's second landmine) is replaced by lib/supabase-server: the
// service role when configured, the showcase shim when not. merge_ideas
// itself runs as invoker within verbs policies.sql opens to anon, but
// this route holds the session gate and the server client like every
// other facilitator move.

const MergeResultSchema = z.object({
  name: z.string().describe("A clear, concise name for the combined idea. 3-8 words. Use the strongest existing name or synthesize a new one that captures the core concept."),
  description: z.string().describe("2-3 sentences that synthesize the best elements of all input ideas into one coherent description."),
});

// POST /api/merge — ADMIN SESSION REQUIRED (U5)
// A facilitator-only action (Combine, on the Stage) that both spends a
// model call and benches the originals on the wall.
// Body: { idea_ids: string[], category: string, team_id: string }
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { idea_ids, category, team_id } = body;

  if (!idea_ids || !Array.isArray(idea_ids) || idea_ids.length < 2) {
    return Response.json({ error: "Need at least 2 idea IDs" }, { status: 400 });
  }
  if (!category || !isPillarSlug(category)) {
    return Response.json({ error: `Invalid category: ${category}` }, { status: 400 });
  }
  if (!team_id) {
    return Response.json({ error: "team_id is required" }, { status: 400 });
  }

  const supabaseAdmin = getServerSupabase();

  // Fetch the ideas to combine + workshop context + team platform in parallel
  const [ideasResult, playbookResult, briefResult, teamResult] = await Promise.all([
    supabaseAdmin.from("ideas").select("id, name, description").in("id", idea_ids),
    supabaseAdmin.from("workshop_settings").select("value").eq("key", "strategic_playbook").single(),
    supabaseAdmin.from("category_briefs").select("brief_context").eq("category", category).single(),
    supabaseAdmin.from("teams").select("creative_platform_name, creative_platform_brief").eq("id", team_id).single(),
  ]);

  const ideas = ideasResult.data;
  if (ideasResult.error || !ideas || ideas.length < 2) {
    return Response.json({ error: "Could not fetch ideas" }, { status: 400 });
  }

  const pillarLabel = PILLARS[category as PillarSlug]?.label || category;
  const strategicPlaybook = playbookResult.data?.value || "";
  const pillarBrief = (briefResult.data as { brief_context: string } | null)?.brief_context || "";
  const platformName = teamResult.data?.creative_platform_name || "the creative platform";
  const platformBrief = teamResult.data?.creative_platform_brief || "";

  const ideaDescriptions = ideas
    .map((i: { name: string; description: string | null }) => `"${i.name}": ${i.description || "No description"}`)
    .join("\n\n");

  try {
    const { object } = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: MergeResultSchema,
      temperature: 0,
      prompt: `You are a workshop facilitator synthesizing related ideas into one combined version. The team's creative platform is "${platformName}".

CONTEXT:
- Category: ${pillarLabel}
- Creative platform: "${platformName}"${platformBrief ? ` — ${platformBrief}` : ""}
${strategicPlaybook ? `- Strategic direction: ${strategicPlaybook.slice(0, 500)}` : ""}
${pillarBrief ? `- Category brief: ${pillarBrief.slice(0, 500)}` : ""}

RULES:
1. Synthesize the core concepts from all inputs into one clear, coherent idea that serves the engagement.
2. The merged name should be the strongest existing name, a combination of name fragments, or a short new name that captures the essence. Keep it 3-8 words.
3. The merged description should capture what makes each input idea distinctive, woven together into 2-3 clear sentences. Prioritize elements that connect to the ${platformName} creative platform.
4. If inputs have complementary angles, combine them. If they conflict, preserve the most compelling version.
5. Do not add strategic commentary or evaluation — just describe the combined idea itself.

IDEAS TO MERGE:

${ideaDescriptions}`,
    });

    // Use the merge_ideas RPC for atomic operation
    const merged = await write<string>("rpc:merge_ideas", supabaseAdmin
      .rpc("merge_ideas", {
        p_original_ids: idea_ids,
        p_new_name: object.name,
        p_new_description: object.description,
        p_category: category,
        p_team_id: team_id,
      }));

    if (!merged.ok) {
      return Response.json({ error: merged.message }, { status: 500 });
    }
    const newId = merged.data;

    return Response.json({ ok: true, id: newId, name: object.name, description: object.description });
  } catch (err) {
    console.error("Merge error:", err);
    return Response.json({ error: "AI merge failed" }, { status: 500 });
  }
}
