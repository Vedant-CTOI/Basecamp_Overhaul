import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { ANTI_TIC_RULES } from "@/lib/coaches";
import { ENGAGEMENT } from "@/lib/config";
import { PILLAR_ENGAGEMENT_CONTEXT, findPlaceholderTokens } from "@/lib/engagement-context";

export const maxDuration = 60;

const ScoutResultSchema = z.object({
  ideas: z.array(
    z.object({
      name: z.string().describe("Bold, memorable idea name — 3-6 words"),
      insight: z.string().describe("One sentence: the surprising fan behavior or cultural observation this idea is built on"),
      description: z
        .string()
        .describe("2-3 short, plain sentences explaining the idea like you're telling a friend. First sentence = the core concept. Second sentence = how it works. No jargon, no run-on sentences, no semicolons."),
      bbeiConnection: z
        .string()
        .describe("One sentence: which strategic platform lens this hits and why"),
    })
  ).min(3).max(3),
});

// POST /api/scout — DELIBERATELY OPEN (U5 ruling, revised)
//
// The Scout is pitched from the team BOARD — a surface the ROOM works
// on, not the facilitator's console. Gating it behind the admin session
// meant a team laptop got a 401 and the Board silently fell back to the
// three canned showcase pitches, with nothing on the surface saying
// why: a participant feature quietly degraded by an admin control.
//
// So this route carries the same posture as `/api/coach` — an
// unauthenticated model call on a public URL, accepted knowingly. Both
// are participant-facing AI the room reaches for directly; gating them
// breaks the product to protect a spend line. If cost abuse ever
// matters more than the room's experience, rate-limit by team and IP
// rather than re-gating: the fix must not cost a team its Scout.
//
// Body: { teamId, pillar, existingIdeas: [{ name, description }] }
export async function POST(req: Request) {

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { teamId, pillar, existingIdeas } = body;

  if (!pillar) {
    return Response.json({ error: "pillar is required" }, { status: 400 });
  }

  // Load pillar brief + pillar-specific fan context (skip universal — too large for scout)
  const { data: briefData } = await supabase
    .from("category_briefs")
    .select("brief_context, fan_context")
    .eq("category", pillar)
    .single();

  // Load strategic playbook + workshop insights + team platform (no universal fan context)
  const [{ data: playbookData }, { data: insightsData }, { data: teamRecord }] = await Promise.all([
    supabase.from("workshop_settings").select("value").eq("key", "strategic_playbook").single(),
    supabase.from("workshop_settings").select("value").eq("key", "insights").single(),
    teamId
      ? supabase.from("teams").select("creative_platform_name, creative_platform_brief").eq("id", teamId).single()
      : Promise.resolve({ data: null }),
  ]);

  const pillarBrief = briefData?.brief_context || "";
  const pillarFanContext = briefData?.fan_context || PILLAR_ENGAGEMENT_CONTEXT[pillar] || "";
  const strategicPlaybook = playbookData?.value || "";
  const insights = insightsData?.value || "";
  const platformName = teamRecord?.creative_platform_name || "the creative platform";
  const platformBrief = teamRecord?.creative_platform_brief || "";

  const existingList = (existingIdeas || [])
    .map((i: { name: string; description: string | null }) => `- "${i.name}": ${i.description || "No description"}`)
    .join("\n");

  // Bespoke layer: this scout system prompt is engagement-specific. Re-tune
  // per engagement to match the room composition, dead-on-arrival patterns,
  // and adjacent-domain references that resonate for that audience. The
  // client brand and cultural domain interpolate from ENGAGEMENT in
  // lib/config.ts (D-6: no bracket tokens in a live model call).
  const systemPrompt = `You are scouting ideas for the room. The participants have seen every predictable pitch in their careers. They are bored by safe ideas. They lean forward when an idea makes them think "I've never seen that before" or "why hasn't anyone done this?"

Your job: find the 3 ideas this room will wish they'd thought of first. You are scouting the "${pillar}" category for ${ENGAGEMENT.clientBrand}. This team's creative platform is "${platformName}"${platformBrief ? ` — ${platformBrief}` : ""}.

PHASE 1 — DIVERGE (do this internally before generating output):
Brainstorm 20 raw provocations, observations, or "what if" collisions related to the "${pillar}" space. Rules:
- Ignore feasibility, ignore the brief, ignore strategic alignment during this phase
- Pull from unexpected domains: gaming economies, music production, creator economics, street culture, group chat behavior, weather/seasons, public transit
- Think about real audience behaviors that brands haven't touched yet
- What's happening in ${ENGAGEMENT.domain} RIGHT NOW that most brands are too slow to notice?
- At least 5 provocations should make you think "this brand would never do this" — those are the interesting ones

PHASE 2 — CONVERGE (this is what you output):
From your 20 provocations, select the 3 most surprising and shape them into specific, executable concepts. For each, name the insight it's built on, describe the specific mechanic, and note which strategic platform lens it connects to.

For at least 1 of the 3 ideas, force a collision between ${ENGAGEMENT.domain} and a domain that doesn't obviously belong. The connection should feel surprising but inevitable once explained.

DEAD ON ARRIVAL — these generic patterns will get instantly dismissed:
- "Limited edition packaging" without a never-before-done mechanic
- "Social media challenge" with no novel structural twist
- "Pop-up experience" that's just a branded photo booth with a step-and-repeat
- "QR code on a product" leading to generic content or a sweepstakes
- "Partner with [popular creator]" as the entire idea
- Ideas that are not structurally tied to the brand or partnership — if you can swap the brand and nothing changes, the idea is too generic
- "AR experience" or "interactive activation" without naming the specific, novel mechanic
- Anything described as "immersive," "innovative," or "engaging" without saying what actually happens

WRITING STYLE — this is critical:
Write each idea description like you're explaining it to a colleague over coffee. Short sentences. Plain language. No semicolons, no compound-complex sentences, no cramming three mechanics into one breath. The person reading this is seeing it for the first time on a screen at the front of the room — they need to get it in one read. Lead with the simplest version of what happens, then add the detail.

${strategicPlaybook ? `STRATEGIC CONTEXT:\n${strategicPlaybook}\n` : ""}
${pillarBrief ? `CATEGORY BRIEF:\n${pillarBrief}\n` : ""}
${pillarFanContext ? `AUDIENCE / STRATEGIC CONTEXT — real behaviors and data points to ground your ideas in (use as evidence that your idea connects to reality, do NOT simply repackage these as idea themes):\n${pillarFanContext}\n` : ""}
${insights ? `WORKSHOP INSIGHTS:\n${insights}\n` : ""}
${ANTI_TIC_RULES}`;

  // D-6: refuse to scout on a prompt still carrying placeholder tokens
  // (an unloaded category brief falls back to lib/engagement-context's
  // bracket-token teaching text). The Board treats any scout failure as
  // "use the showcase pitches"; the Operator Console pre-flight is where
  // this misconfiguration is flagged by name before the room opens.
  const tokens = findPlaceholderTokens(systemPrompt);
  if (tokens.length) {
    return Response.json(
      {
        error: `Not sent · the scout prompt still carries placeholder tokens (${tokens.join(", ")}) — load the engagement context in the Operator Console before going live.`,
        code: "placeholder_tokens",
      },
      { status: 503 },
    );
  }

  try {
    const { object } = await generateObject({
      model: google("gemini-3.1-pro-preview"),
      schema: ScoutResultSchema,
      system: systemPrompt,
      prompt: `COVERED TERRITORY — the team has already explored these. Go somewhere they haven't been:\n\n${existingList || "No ideas yet — this is wide open."}\n\nFind the 3 ideas this room doesn't know it wants yet.`,
    });

    return Response.json(object);
  } catch (err) {
    console.error("Scout generation failed:", err);
    return Response.json({ error: "Failed to generate ideas", detail: String(err) }, { status: 500 });
  }
}
