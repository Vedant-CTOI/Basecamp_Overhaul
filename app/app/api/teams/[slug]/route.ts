import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin-session";
import { write, type WriteResult } from "@/lib/db";

// GET /api/teams/[slug]
// Returns a single team with all its ideas
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("slug", slug)
    .single();

  if (teamError || !team) return Response.json({ error: "Team not found" }, { status: 404 });

  const { data: ideas, error: ideasError } = await supabase
    .from("ideas")
    .select("*")
    .eq("team_id", team.id)
    .order("created_at");

  if (ideasError) return Response.json({ error: ideasError.message }, { status: 500 });

  const allIdeas = ideas || [];
  return Response.json({
    team: {
      ...team,
      ideas: allIdeas,
      stats: {
        total: allIdeas.length,
        coached: allIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length,
        startingLineup: allIdeas.filter((i) => i.status === "starting_lineup").length,
      },
    },
  });
}

// PATCH /api/teams/[slug] — ADMIN SESSION REQUIRED (service-role rewire)
// The console's team edits: display name, category assignment, creative
// platform. policies.sql gives anon NO write on `teams` (a phone must
// not rename a team or reassign its categories), so this runs on the
// server client. Allow-list only — `slug`, `id` and `color` are the
// team's identity, set at seed time; no console control edits them and
// this route will not either.
const PATCHABLE = [
  "display_name",
  "assigned_pillars",
  "creative_platform_name",
  "creative_platform_brief",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [{ slug }, body] = await Promise.all([params, req.json()]);
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of PATCHABLE) {
    if (key in body) updates[key] = (body as Record<string, unknown>)[key];
  }
  if (!Object.keys(updates).length) {
    return Response.json(
      { error: `No editable field in body. Editable: ${PATCHABLE.join(", ")}` },
      { status: 400 }
    );
  }
  if ("assigned_pillars" in updates &&
      (!Array.isArray(updates.assigned_pillars) ||
        (updates.assigned_pillars as unknown[]).some((p) => typeof p !== "string"))) {
    return Response.json({ error: "assigned_pillars must be an array of category slugs" }, { status: 400 });
  }

  const r: WriteResult = await write("teams.update:api", getServerSupabase()
    .from("teams")
    .update(updates)
    .eq("slug", slug)
    .select("id, slug")
    .single());

  if (!r.ok) {
    // A slug that matches nothing is a 404, not a server fault.
    if (r.code === "PGRST116") return Response.json({ error: "Team not found" }, { status: 404 });
    return Response.json({ error: "Failed to update team", detail: r.message }, { status: 500 });
  }
  return Response.json({ data: r.data });
}
