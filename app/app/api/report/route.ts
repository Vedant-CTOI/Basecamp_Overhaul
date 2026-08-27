import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { PILLAR_LIST } from "@/lib/config";
import { ANTI_TIC_RULES } from "@/lib/coaches";
import { requireAdmin } from "@/lib/admin-session";

export const maxDuration = 120;

// POST — ADMIN SESSION REQUIRED (U5). The most expensive request in the
// product: a 120-second model call over the whole workshop. Open, it was
// a public URL anyone could hold down. GET stays open — the Edition is
// read by the room.
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 503 });
  }

  const { facilitatorNotes } = await req.json();

  const [
    { data: allIdeas },
    { data: teams },
    { data: playbookRow },
    { data: insightsRow },
  ] = await Promise.all([
    supabase
      .from("ideas")
      .select("id, name, description, category, status, wave, bbei_connection, key_partners, source, team_id, created_at")
      .order("created_at"),
    supabase.from("teams").select("id, name, slug, display_name, creative_platform_name").order("name"),
    supabase.from("workshop_settings").select("value").eq("key", "strategic_playbook").single(),
    supabase.from("workshop_settings").select("value").eq("key", "insights").single(),
  ]);

  if (!teams || !allIdeas) {
    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  const pillars = PILLAR_LIST.map((p) => p.slug);
  const pillarLabelMap: Record<string, string> = {};
  for (const p of PILLAR_LIST) {
    pillarLabelMap[p.slug] = p.label;
  }

  const teamStats = teams.map((team) => {
    const teamIdeas = allIdeas.filter((i) => i.team_id === team.id);
    const coached = teamIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup");
    const lineup = teamIdeas.filter((i) => i.status === "starting_lineup");

    return {
      team: team.display_name || team.name,
      slug: team.slug,
      platform: team.creative_platform_name || null,
      total: teamIdeas.length,
      coached: coached.length,
      startingLineup: lineup.length,
    };
  });

  const pillarDist = pillars.map((cat) => ({
    pillar: cat,
    total: allIdeas.filter((i) => i.category === cat).length,
    startingLineup: allIdeas.filter((i) => i.category === cat && i.status === "starting_lineup").length,
  }));

  const totalIdeas = allIdeas.length;
  const totalCoached = allIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length;
  const totalLineup = allIdeas.filter((i) => i.status === "starting_lineup").length;

  const workshopDataXml = `<workshop_data>
${teams.map((team) => {
    const lineupIdeas = allIdeas.filter((i) => i.team_id === team.id && i.status === "starting_lineup");
    const coachedNonLineup = allIdeas.filter((i) => i.team_id === team.id && i.status === "coached");
    const platformAttr = team.creative_platform_name ? ` creative_platform="${team.creative_platform_name}"` : "";

    return `  <team name="${team.display_name || team.name}" slug="${team.slug}"${platformAttr}>
    <starting_lineup count="${lineupIdeas.length}">
${lineupIdeas.map((idea) => `      <idea category="${idea.category}" category_label="${pillarLabelMap[idea.category] || idea.category}" wave="${idea.wave || "unassigned"}">
        <name>${idea.name || "Unnamed"}</name>
        <description>${idea.description || ""}</description>
        <bbei_connection>${idea.bbei_connection || ""}</bbei_connection>
        <key_partners>${idea.key_partners || ""}</key_partners>
      </idea>`).join("\n")}
    </starting_lineup>
${coachedNonLineup.length > 0 ? `    <coached_non_lineup count="${coachedNonLineup.length}">
${coachedNonLineup.map((idea) => `      <idea category="${idea.category}" category_label="${pillarLabelMap[idea.category] || idea.category}">
        <name>${idea.name || "Unnamed"}</name>
        <description>${idea.description || ""}</description>
      </idea>`).join("\n")}
    </coached_non_lineup>` : ""}
  </team>`;
  }).join("\n")}
${playbookRow?.value ? `  <strategic_playbook>${playbookRow.value.slice(0, 2000)}</strategic_playbook>` : ""}
${insightsRow?.value ? `  <workshop_insights>${insightsRow.value.slice(0, 1200)}</workshop_insights>` : ""}
</workshop_data>

<workshop_statistics>
  <overall total_ideas="${totalIdeas}" total_coached="${totalCoached}" total_starting_lineup="${totalLineup}" />
  <funnel_by_team>
${teamStats.map((s) => `    <team name="${s.team}" slug="${s.slug}" platform="${s.platform || "none"}" total="${s.total}" coached="${s.coached}" starting_lineup="${s.startingLineup}" />`).join("\n")}
  </funnel_by_team>
  <pillar_distribution>
${pillarDist.map((c) => `    <pillar name="${c.pillar}" total_ideas="${c.total}" starting_lineup="${c.startingLineup}" />`).join("\n")}
  </pillar_distribution>
</workshop_statistics>

${facilitatorNotes ? `<facilitator_notes>${facilitatorNotes}</facilitator_notes>` : ""}`;

  // Build team name list for the prompt
  const teamNamesList = teams.map((t) => {
    const name = t.display_name || t.name;
    const platform = t.creative_platform_name ? ` (platform: "${t.creative_platform_name}")` : "";
    return `- ${name}${platform}`;
  }).join("\n");

  const systemPrompt = `You are a workshop synthesis analyst for a co-creation workshop. Your job is to faithfully represent what teams submitted — not to improve, evaluate, or embellish their ideas.

GROUNDING RULES:
- Every claim must reference a specific team and idea by name.
- Use exact numbers from the pre-computed statistics.
- Do not rank or compare the quality of ideas.
- Write in direct, clear prose. No filler.

FORMAT: Use markdown with ## for sections, ### for sub-sections, **bold labels** on bullets, and > blockquotes for key insights.
${ANTI_TIC_RULES}`;

  const userPrompt = `${workshopDataXml}

The teams in this workshop are:
${teamNamesList}

Generate an overnight synthesis report covering:

## Workshop Overview
2-3 sentences on the overall shape of ideation. Reference exact numbers. Key patterns as bold-labeled bullets. One blockquote with the most important stat.

## Team Summaries
For each team, summarize their creative output organized by category. For each team:
1. State their creative platform name (if they have one).
2. Summarize their shortlisted ideas grouped by category — what themes emerged, how they connect to the team's creative platform.
3. Reference specific ideas by name.

IMPORTANT: For each team, start the section with a one-sentence "Draft Platform Vision" in a blockquote. This captures the overarching ambition of that team's creative platform — what their shortlisted ideas collectively achieve. Format it EXACTLY like this for each team:

### [Team Name]
> DRAFT PLATFORM VISION: [one bold sentence capturing the team's overarching creative ambition]

**[Category Name]:** [summary of their ideas in that category]

**[Category Name]:** [summary of their ideas in that category]

[repeat for each category the team has ideas in]

## Cross-Team Connections
Connections between ideas from different teams. Each as a ### sub-section with the two ideas and team names.

## Shared Dependencies
What resources, partnerships, or capabilities multiple ideas share. Group by type.

## Wave Analysis
If the engagement uses waves, what's in each wave and any gaps or imbalances. Skip this section if waves aren't in use.

## Best of the Rest
2-3 most interesting coached ideas per team that didn't make the Shortlist. What makes each worth keeping.`;

  try {
    const { text } = await generateText({
      model: google("gemini-3.1-pro-preview"),
      system: systemPrompt,
      prompt: userPrompt,
    });

    const now = new Date().toISOString();

    // Extract draft platform visions per team from the generated text and save to workshop_settings
    // Format: > DRAFT PLATFORM VISION: [text]
    // We match ### [Team Name]\n> DRAFT PLATFORM VISION: [text]
    const teamVisionUpserts: PromiseLike<unknown>[] = [];
    for (const team of teams) {
      const teamName = team.display_name || team.name;
      // Escape special regex chars in team name
      const escapedName = teamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const teamVisionRegex = new RegExp(
        `###\\s+${escapedName}\\s*\\n>\\s*DRAFT PLATFORM VISION:\\s*(.+)`,
        "i"
      );
      const teamMatch = teamVisionRegex.exec(text);
      if (teamMatch) {
        const visionText = teamMatch[1].trim();
        if (visionText) {
          teamVisionUpserts.push(
            write("workshop_settings.upsert:team-vision", getServerSupabase().from("workshop_settings").upsert(
              { key: `team_vision_${team.slug}`, value: visionText, updated_at: now },
              { onConflict: "key" }
            ).select())
          );
        }
      }
    }

    // The Edition itself is the one write here that cannot be allowed
    // to vanish: the model has already run, and a discarded error means
    // the room is told the Overnight was generated when nothing was
    // stored. The team visions are reported but do not fail the run.
    // The storage writes run on the server client — policies.sql denies
    // anon every write on workshop_settings, and the Edition must land.
    const stored = await write("workshop_settings.upsert:report", getServerSupabase().from("workshop_settings").upsert(
      { key: "overnight_report", value: text, updated_at: now },
      { onConflict: "key" }
    ));
    if (!stored.ok) {
      return Response.json({ error: "The Edition was written but could not be saved", detail: stored.message }, { status: 500 });
    }
    await Promise.all([
      write("workshop_settings.upsert:report-at", getServerSupabase().from("workshop_settings").upsert(
        { key: "overnight_report_generated_at", value: now, updated_at: now },
        { onConflict: "key" }
      )),
      ...teamVisionUpserts,
    ]);

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Report generation error:", message);
    return Response.json({ error: "Generation failed", detail: message }, { status: 500 });
  }
}

export async function GET() {
  const [{ data: reportRow }, { data: timestampRow }] = await Promise.all([
    supabase.from("workshop_settings").select("value").eq("key", "overnight_report").single(),
    supabase.from("workshop_settings").select("value").eq("key", "overnight_report_generated_at").single(),
  ]);

  return Response.json({
    report: reportRow?.value || null,
    generatedAt: timestampRow?.value || null,
  });
}
