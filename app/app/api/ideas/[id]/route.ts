import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { isIdeaStatus, isPillarSlug, IDEA_STATUSES, PILLAR_SLUGS } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-session";

// GET /api/ideas/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabase.from("ideas").select("*").eq("id", id).single();
  if (error || !data) return Response.json({ error: "Idea not found" }, { status: 404 });
  return Response.json({ idea: data });
}

// PATCH /api/ideas/[id] — ADMIN SESSION REQUIRED (U5)
// GET above stays open. The room's own edits do not come through here —
// the app writes ideas directly with the client key — so gating the REST
// surface takes nothing away from a participant.
//
// NOTE the gate does NOT close the anon-key hole: a client can still
// update any `ideas` row directly. Only RLS closes that, and it ships as
// an unapplied artifact in U1. Do not read this route's 401 as "the
// ideas table is protected".
// Body: any subset of idea fields
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [{ id }, body] = await Promise.all([params, req.json()]);

  // Check idea exists
  const { data: existing, error: fetchError } = await supabase.from("ideas").select("source").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Idea not found" }, { status: 404 });

  const isTissue = existing.source === "tissue";

  // Validate enum fields before hitting DB
  if (body.status && !isIdeaStatus(body.status)) {
    return Response.json({ error: `Invalid status: ${body.status}. Valid: ${IDEA_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (body.category && !isPillarSlug(body.category)) {
    return Response.json({ error: `Invalid category: ${body.category}. Valid: ${PILLAR_SLUGS.join(", ")}` }, { status: 400 });
  }

  const allowed = ["name", "description", "status", "category", "wave", "bbei_connection", "key_partners"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (isTissue && (key === "name" || key === "description")) continue;
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const r = await write("ideas.update:api", supabase.from("ideas").update(updates).eq("id", id).select().single());
  if (!r.ok) return Response.json({ error: r.message }, { status: 500 });
  return Response.json({ idea: r.data });
}

// DELETE /api/ideas/[id] — ADMIN SESSION REQUIRED (U5)
// Cascades: deletes training_notes and votes for the idea first
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;

  // Check idea exists
  const { data: existing } = await supabase.from("ideas").select("id").eq("id", id).single();
  if (!existing) return Response.json({ error: "Idea not found" }, { status: 404 });

  // Delete dependent records first (FK constraints). Neither of these
  // used to be checked, so a refused child delete carried on to a
  // parent delete that could only fail — leaving an idea with its votes
  // gone and a 500 that named the wrong statement.
  const notes = await write("training_notes.delete:api", supabase.from("training_notes").delete().eq("idea_id", id));
  if (!notes.ok) return Response.json({ error: notes.message }, { status: 500 });
  const votes = await write("votes.delete:api-cascade", supabase.from("votes").delete().eq("idea_id", id));
  if (!votes.ok) return Response.json({ error: votes.message }, { status: 500 });

  const r = await write("ideas.delete:api", supabase.from("ideas").delete().eq("id", id));
  if (!r.ok) return Response.json({ error: r.message }, { status: 500 });
  return Response.json({ success: true });
}
