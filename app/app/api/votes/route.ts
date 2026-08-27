import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";

// POST /api/votes — cast a vote (uses the atomic cast_vote RPC)
// Body: { idea_id: string, category: string, voter_id: string }
export async function POST(req: Request) {
  const body = await req.json();
  const { idea_id, category, voter_id } = body;

  if (!idea_id || !category || !voter_id) {
    return Response.json({ error: "idea_id, category, and voter_id are required" }, { status: 400 });
  }

  const cast = await write<boolean>("rpc:cast_vote", supabase.rpc("cast_vote", {
    p_idea_id: idea_id,
    p_category: category,
    p_voter_id: voter_id,
  }));

  if (!cast.ok) return Response.json({ error: "Failed to cast vote", detail: cast.message }, { status: 500 });
  if (!cast.data) return Response.json({ error: "Vote limit reached for this pillar" }, { status: 409 });
  return Response.json({ success: true }, { status: 201 });
}

// DELETE /api/votes?idea_id=uuid&voter_id=string — remove a vote
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const ideaId = searchParams.get("idea_id");
  const voterId = searchParams.get("voter_id");

  if (!ideaId || !voterId) {
    return Response.json({ error: "idea_id and voter_id query parameters are required" }, { status: 400 });
  }

  const r = await write("votes.delete:api", supabase
    .from("votes")
    .delete()
    .eq("idea_id", ideaId)
    .eq("voter_id", voterId));

  if (!r.ok) return Response.json({ error: "Failed to remove vote", detail: r.message }, { status: 500 });
  return Response.json({ success: true });
}
