import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { COACHES, ANTI_TIC_RULES } from "@/lib/coaches";
import { ENGAGEMENT } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { UNIVERSAL_ENGAGEMENT_CONTEXT, PILLAR_ENGAGEMENT_CONTEXT, findPlaceholderTokens } from "@/lib/engagement-context";

// ── Placeholder safety (D-6) ────────────────────────────────
// A prompt still carrying a bracket token ([CLIENT_BRAND], a fallback
// brief, an unedited admin override) must FAIL LOUDLY here, not render
// into a live reply. 503 with the house "Not sent ·" vocabulary; the
// training room surfaces the message instead of a scripted fallback,
// and the Operator Console pre-flight runs the same scan before the
// room ever opens.
function refuseIfPlaceholders(prompt: string): Response | null {
  const tokens = findPlaceholderTokens(prompt);
  if (tokens.length === 0) return null;
  return Response.json(
    {
      error: `Not sent · the coach prompt still carries placeholder tokens (${tokens.join(", ")}) — load the engagement context in the Operator Console before going live.`,
      code: "placeholder_tokens",
    },
    { status: 503 },
  );
}

// The Guidelines Advisor (rights_advisor) is the only coach that doesn't need
// the audience/strategic context — it's checking partnership guardrails, not
// creative feedback. The other coaches (Provocateur, Sharpener, Audience Lens)
// all receive the layered engagement context.

export const runtime = "edge";

// ── UNAUTHENTICATED, DELIBERATELY (U5) ──────────────────────
// Every other model-calling route in this app now requires the admin
// session. This one does not, and the exposure is stated rather than
// implied: `POST /api/coach` REMAINS AN UNAUTHENTICATED MODEL CALL ON A
// PUBLIC URL.
//
// Why: the coach is a participant tool. The Coaching Room is worked in
// by the room, at the team tables, on devices that never see a
// password. Gating it would put a login in front of participants, and
// "the room never authenticates" is the harder rule.
//
// Its only protection is the prompt's own input caps below — 2000 chars
// on the idea name, 5000 on the description, the last 10 turns of
// history — and the provider's own quota. A rate limit is the real
// answer and is a separate posture decision tied to the hosting
// platform; it is on the deferred list in the plan, not forgotten here.
export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 503 });
  }

  const {
    coachType,
    ideaName,
    ideaDescription,
    ideaCategory,
    ideaFramework,
    teamName,
    teamSlug,
    prompt,
    conversationHistory,
  } = await req.json();

  // Cap input lengths
  const cappedPrompt = (prompt || "").slice(0, 2000);
  const cappedDescription = (ideaDescription || "").slice(0, 5000);

  const coach = COACHES.find((c) => c.type === coachType);
  if (!coach) {
    return new Response("Unknown coach type", { status: 400 });
  }

  // Fetch workshop settings + coach override in parallel
  const isRightsAdvisor = coachType === "rights_advisor";

  const [{ data: override }, { data: playbookRow }, { data: insightsRow }, { data: guardrailsRow }, { data: legacyGuardrailsRow }, { data: fanContextRow }, pillarBriefResult, { data: teamPlatformRow }] =
    await Promise.all([
      supabase
        .from("coach_prompt_overrides")
        .select("system_prompt")
        .eq("coach_type", coachType)
        .single(),
      supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "strategic_playbook")
        .single(),
      supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "insights")
        .single(),
      supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "partnership_guardrails")
        .single(),
      // Alias read (D-11): pre-rename DBs stored the guardrails under
      // the Sprite-era `nba_rights` key. Canonical key wins when both exist.
      supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "nba_rights")
        .single(),
      // Rights Advisor skips fan context — he's checking guardrails, not creative feedback
      isRightsAdvisor
        ? Promise.resolve({ data: null })
        : supabase
            .from("workshop_settings")
            .select("value")
            .eq("key", "fan_context")
            .single(),
      // Rights Advisor skips pillar brief
      isRightsAdvisor
        ? Promise.resolve({ data: null })
        : supabase
            .from("category_briefs")
            .select("brief_context, fan_context")
            .eq("category", ideaCategory)
            .single(),
      // Fetch team's creative platform
      teamSlug
        ? supabase
            .from("teams")
            .select("creative_platform_name, creative_platform_brief")
            .eq("slug", teamSlug)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const basePrompt = override?.system_prompt || coach.systemPrompt;
  const strategicPlaybook = playbookRow?.value || "";
  const workshopInsights = insightsRow?.value || "";
  const partnershipGuardrails = guardrailsRow?.value || legacyGuardrailsRow?.value || "";
  // Audience/strategic context is only fetched for creative coaches, not Guidelines Advisor
  const engagementContext = isRightsAdvisor ? "" : (fanContextRow?.value || UNIVERSAL_ENGAGEMENT_CONTEXT);
  const pillarData = pillarBriefResult as { data: { brief_context: string; fan_context: string } | null };
  const pillarBrief = pillarData?.data?.brief_context || "";
  const pillarEngagementContext = pillarData?.data?.fan_context || PILLAR_ENGAGEMENT_CONTEXT[ideaCategory] || "";
  const platformName = teamPlatformRow?.creative_platform_name || "the creative platform";
  const platformBrief = teamPlatformRow?.creative_platform_brief || "";

  // Build framework context from idea fields
  const frameworkContext = ideaFramework
    ? Object.entries(ideaFramework)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n")
    : "";

  // ── Guidelines Advisor — separate, simpler prompt ──
  if (isRightsAdvisor) {
    const rightsPrompt = `${basePrompt}

---

IDEA TO CHECK:
- Team: ${teamName || "Unknown"}
- Idea: "${ideaName || "Untitled"}"
- Category: ${ideaCategory || "Unknown"}
${cappedDescription ? `- Description: ${cappedDescription}` : ""}
${frameworkContext ? `\nIdea details:\n${frameworkContext}` : ""}

${strategicPlaybook ? `STRATEGIC PLAYBOOK (${platformName.toUpperCase()}):\n${strategicPlaybook}` : ""}
${partnershipGuardrails ? `\nPARTNERSHIP GUARDRAILS:\n${partnershipGuardrails}` : ""}
${workshopInsights ? `\nWORKSHOP CONTEXT:\n${workshopInsights}` : ""}`;

    const refusal = refuseIfPlaceholders(rightsPrompt);
    if (refusal) return refusal;

    try {
      const result = streamText({
        model: google("gemini-3.1-pro-preview"),
        system: rightsPrompt,
        messages: [
          ...(conversationHistory || []).slice(-10),
          { role: "user" as const, content: cappedPrompt },
        ],
      });

      return result.toTextStreamResponse();
    } catch (error) {
      console.error("Coach (rights advisor) streaming error:", error);
      return new Response(JSON.stringify({ error: "Taking a moment — try again in a few seconds." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── Standard coaches (Provocateur, Sharpener, Audience Lens) ──
  // Bespoke layer: this WORKSHOP CONTEXT block is the engagement-specific
  // framing that wraps every coach response. Rewrite per engagement to match
  // the brief, partnership context, and category structure. The placeholders
  // below describe the platform's structural shape generically.
  const systemPrompt = `${basePrompt}

---

WORKSHOP CONTEXT:
You are coaching a team in a live co-creation workshop for ${ENGAGEMENT.clientBrand}. The participants are the decision-makers in the room. Talk TO them, not AT them. The energy in the room is everything.

This team's creative platform is "${platformName}."${platformBrief ? ` ${platformBrief}` : ""}

HOW TO USE THE CREATIVE PLATFORM:
You know what ${platformName} is so you can speak fluently about it when it's relevant. But don't force-anchor every idea to it. If the team's idea doesn't obviously map to ${platformName}, don't critique the mismatch — instead:
- Suggest how the idea could flex to land inside the territory
- Or suggest where else it could live in the program
Build ideas up, don't gate-keep them.

CATEGORIES — each team creates ideas across the engagement's category set. The active category for this idea is below.

IDEA FRAMEWORK — what teams capture per idea:
1. Idea Name + Description — the concept
2. Connection to ${platformName} — how it ties to the creative territory
3. Key Players & Partners — talent, creators, collaborators needed
4. Optional engagement-specific fields (e.g., wave, phase) per the FRAMEWORK_FIELDS config

THIS TEAM'S IDEA:
- Team: ${teamName || "Unknown"}
- Idea: "${ideaName || "Untitled"}"
- Category: ${ideaCategory || "Unknown"}
${cappedDescription ? `- Description: ${cappedDescription}` : ""}
${frameworkContext ? `\nFRAMEWORK (what the team has written so far):\n${frameworkContext}` : ""}
${strategicPlaybook ? `\nSTRATEGIC PLAYBOOK (${platformName.toUpperCase()} — the overarching evaluation criteria and creative direction):\n${strategicPlaybook}` : ""}
${pillarBrief ? `\nCATEGORY STRATEGIC BRIEF (the creative direction for this channel):\n${pillarBrief}` : ""}
${engagementContext ? `\nAUDIENCE / STRATEGIC CONTEXT (evidence to draw from — cite specific data points when they strengthen your feedback):\n${engagementContext}` : ""}
${pillarEngagementContext ? `\nCATEGORY-SPECIFIC CONTEXT:\n${pillarEngagementContext}` : ""}
${partnershipGuardrails ? `\nPARTNERSHIP GUARDRAILS (reference when relevant, don't recite):\n${partnershipGuardrails}` : ""}
${workshopInsights ? `\nWORKSHOP INSIGHTS (reference specific insights when they connect to THIS idea):\n${workshopInsights}` : ""}

VOICE — HOW TO SOUND:
You are a senior creative coach, not a helpful AI assistant. Jump straight into substance. Never open with praise or restatement. Show enthusiasm through SPECIFICITY, not adjectives. Talk TO the team in short, punchy sentences. End when you're done — no summaries or closers.

RESPONSE FORMAT:
- 2-3 short paragraphs. Natural prose, not bullet lists.
- Use **bold** for the single most important provocation.
- Reference their actual framework fields — quote what they've written.
- Under 250 words.
${ANTI_TIC_RULES}`;

  const refusal = refuseIfPlaceholders(systemPrompt);
  if (refusal) return refusal;

  try {
    const result = streamText({
      model: google("gemini-3.1-pro-preview"),
      system: systemPrompt,
      messages: [
        ...(conversationHistory || []).slice(-10),
        { role: "user" as const, content: cappedPrompt },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Coach streaming error:", error);
    return new Response(JSON.stringify({ error: "Taking a moment — try again in a few seconds." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
