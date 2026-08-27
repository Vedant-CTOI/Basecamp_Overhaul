import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";

// GET /api/training-notes?idea_id=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ideaId = searchParams.get("idea_id");

  let query = supabase.from("training_notes").select("*").order("created_at");
  if (ideaId) query = query.eq("idea_id", ideaId);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ notes: data });
}

// POST /api/training-notes
// Body: { idea_id, coach_type, user_prompt?, ai_response, is_saved? }
export async function POST(req: Request) {
  const body = await req.json();
  const { idea_id, coach_type, team_slug, user_prompt, ai_response, is_saved, auto_promote } = body;

  if (!idea_id || !coach_type || !ai_response) {
    return Response.json({ error: "idea_id, coach_type, and ai_response are required" }, { status: 400 });
  }

  // Auto-set idea status to 'coached' on first training note (if currently 'draft')
  // Opt out with auto_promote: false (default: true for backwards compat)
  // The RECORD first, then the stamp. This route used to mark the idea
  // coached before the note existed and discard the result of both — so
  // a rejected note left a COACHED idea the Newsroom's coaching count
  // could not see.
  const note = await write("training_notes.insert:api", supabase
    .from("training_notes")
    .insert({
      idea_id,
      coach_type,
      team_slug: team_slug || null,
      user_prompt: user_prompt || null,
      ai_response,
      is_saved: is_saved ?? false,
    })
    .select()
    .single());

  if (!note.ok) return Response.json({ error: note.message }, { status: 500 });

  if (auto_promote !== false) {
    const { data: idea } = await supabase.from("ideas").select("status").eq("id", idea_id).single();
    if (idea?.status === "draft") {
      const marked = await write("ideas.update:coached-api", supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", idea_id));
      if (!marked.ok) {
        // The exchange is kept; only the stamp is not. Say so rather
        // than reporting a clean 201 for a half-done thing.
        return Response.json({ note: note.data, warning: "The exchange was saved; the idea could not be marked coached." }, { status: 200 });
      }
    }
  }
  const data = note.data;
  return Response.json({ note: data }, { status: 201 });
}
