import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";

// Mutations here run on the SERVER client (service role when
// configured): policies.sql narrows anon's ticker_messages insert to
// style 'standard' (the entry page's arrival line) and denies update
// and delete outright — retiring or forging wire copy is an admin move.

// GET /api/ticker — list all ticker messages (active first, newest first)
export async function GET() {
  const { data, error } = await supabase
    .from("ticker_messages")
    .select("id, message, style, reporter, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "Failed to fetch ticker messages", detail: error.message }, { status: 500 });
  return Response.json({ data });
}

// POST /api/ticker — ADMIN SESSION REQUIRED (U5)
// The wire runs across every room surface, so an open POST here writes
// arbitrary copy onto the projected wall.
// Body: { message: string, style?: "standard" | "breaking", reporter?: string, is_active?: boolean }
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { message, style, reporter, is_active } = body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const validStyles = ["standard", "breaking"];
  if (style && !validStyles.includes(style)) {
    return Response.json({ error: `style must be one of: ${validStyles.join(", ")}` }, { status: 400 });
  }

  const r = await write("ticker_messages.insert:api", getServerSupabase()
    .from("ticker_messages")
    .insert({
      message: message.trim(),
      style: style || "standard",
      reporter: reporter || null,
      is_active: is_active !== false, // default true
    })
    .select("id, message, style, reporter, is_active, created_at")
    .single());

  if (!r.ok) return Response.json({ error: "Failed to create ticker message", detail: r.message }, { status: 500 });
  return Response.json({ data: r.data }, { status: 201 });
}

// PATCH /api/ticker — ADMIN SESSION REQUIRED (service-role rewire)
// Body: { id: string, is_active: boolean }. The console's wire toggle,
// previously a direct browser write policies.sql now denies.
export async function PATCH(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { id, is_active } = body;

  if (!id || typeof id !== "string") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  if (typeof is_active !== "boolean") {
    return Response.json({ error: "is_active must be a boolean" }, { status: 400 });
  }

  const r = await write("ticker_messages.update:api", getServerSupabase()
    .from("ticker_messages")
    .update({ is_active })
    .eq("id", id));

  if (!r.ok) return Response.json({ error: "Failed to update ticker message", detail: r.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE /api/ticker?id=uuid — ADMIN SESSION REQUIRED (U5)
export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id query parameter is required" }, { status: 400 });
  }

  const r = await write("ticker_messages.delete:api", getServerSupabase()
    .from("ticker_messages")
    .delete()
    .eq("id", id));

  if (!r.ok) return Response.json({ error: "Failed to delete ticker message", detail: r.message }, { status: 500 });
  return Response.json({ success: true });
}
