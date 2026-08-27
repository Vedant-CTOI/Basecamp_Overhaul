import { supabase } from "@/lib/supabase";
import { PILLAR_SLUGS } from "@/lib/config";

// GET /api/teams
// Returns all teams with idea stats
export async function GET() {
  const [{ data: teams, error: teamsError }, { data: ideas, error: ideasError }] = await Promise.all([
    supabase.from("teams").select("*").order("slug"),
    supabase.from("ideas").select("id, team_id, category, status"),
  ]);

  if (teamsError || ideasError) {
    return Response.json({ error: teamsError?.message || ideasError?.message }, { status: 500 });
  }

  const teamsWithStats = (teams || []).map((team) => {
    const teamIdeas = (ideas || []).filter((i) => i.team_id === team.id);
    const byPillar: Record<string, number> = {};
    for (const slug of PILLAR_SLUGS) {
      byPillar[slug] = teamIdeas.filter((i) => i.category === slug).length;
    }
    return {
      ...team,
      stats: {
        total: teamIdeas.length,
        coached: teamIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length,
        startingLineup: teamIdeas.filter((i) => i.status === "starting_lineup").length,
        byPillar,
      },
    };
  });

  return Response.json({ teams: teamsWithStats });
}
