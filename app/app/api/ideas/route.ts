import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { isPillarSlug, isIdeaSource, PILLAR_SLUGS, IDEA_SOURCES } from "@/lib/config";

// GET /api/ideas
// Query params: team_slug, team_id, category, status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamSlug = searchParams.get("team_slug");
  const teamId = searchParams.get("team_id");
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  let resolvedTeamId = teamId;

  if (teamSlug && !resolvedTeamId) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", teamSlug)
      .single();
    if (!team) return Response.json({ error: "Team not found" }, { status: 404 });
    resolvedTeamId = team.id;
  }

  let query = supabase.from("ideas").select("*").order("created_at");

  if (resolvedTeamId) query = query.eq("team_id", resolvedTeamId);
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ideas: data });
}

// POST /api/ideas — OPEN, DELIBERATELY (U5)
// The room captures ideas. This route and `/api/votes` are the two
// mutating paths a participant's device may need, so neither is gated;
// `/api/ideas/[id]` PATCH and DELETE are, because destroying and
// re-categorising are operator acts.
// Body: { team_id, category, name?, description?, status?, source?, wave?, bbei_connection?, key_partners? }
export async function POST(req: Request) {
  const body = await req.json();
  const { team_id, category, name, description, source, wave, bbei_connection, key_partners } = body;

  // Validate required fields
  const isTissue = source === "tissue";
  if (!isTissue && !team_id) {
    return Response.json({ error: "team_id is required for non-tissue ideas" }, { status: 400 });
  }
  if (!category) {
    return Response.json({ error: "category is required" }, { status: 400 });
  }
  if (!isPillarSlug(category)) {
    return Response.json({ error: `Invalid category: ${category}. Valid: ${PILLAR_SLUGS.join(", ")}` }, { status: 400 });
  }
  if (source && !isIdeaSource(source)) {
    return Response.json({ error: `Invalid source: ${source}. Valid: ${IDEA_SOURCES.join(", ")}` }, { status: 400 });
  }
  const r = await write("ideas.insert:api", supabase
    .from("ideas")
    .insert({
      team_id: isTissue ? null : team_id,
      category,
      name: name || "",
      description: description || null,
      status: "draft",
      source: source || "team",
      wave: wave || null,
      bbei_connection: bbei_connection || null,
      key_partners: key_partners || null,
    })
    .select()
    .single());

  if (!r.ok) return Response.json({ error: r.message }, { status: 500 });
  return Response.json({ idea: r.data }, { status: 201 });
}
