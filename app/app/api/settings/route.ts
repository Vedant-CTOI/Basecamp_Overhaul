import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";

// GET /api/settings?key=strategic_playbook
// GET /api/settings (returns all settings)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key) {
    const { data, error } = await supabase
      .from("workshop_settings")
      .select("key, value, updated_at")
      .eq("key", key)
      .single();

    if (error) return Response.json({ error: "Setting not found", detail: error.message }, { status: 404 });
    return Response.json({ data });
  }

  // Return all settings
  const { data, error } = await supabase
    .from("workshop_settings")
    .select("key, value, updated_at")
    .order("key");

  if (error) return Response.json({ error: "Failed to fetch settings", detail: error.message }, { status: 500 });
  return Response.json({ data });
}

// PUT /api/settings — ADMIN SESSION REQUIRED (U5)
// Body: { key: string, value: string }
//
// This is the hijack-the-room's-screen route. `workshop_state` lives in
// this table, so an open PUT here re-drives the projected wall from any
// public URL; `/api/settings/coach-prompts` next door rewrites the
// coaches' system prompts the same way. Reads stay open — every room
// surface needs them.
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { key, value } = body;

  if (!key || typeof key !== "string") {
    return Response.json({ error: "key is required and must be a string" }, { status: 400 });
  }
  if (value === undefined || value === null) {
    return Response.json({ error: "value is required" }, { status: 400 });
  }

  // Service role, not the shared client: policies.sql denies anon every
  // write on workshop_settings (the headline lock on the room's screen).
  const r = await write("workshop_settings.upsert:api", getServerSupabase()
    .from("workshop_settings")
    .upsert(
      { key, value: String(value), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
    .select("key, value, updated_at")
    .single());

  if (!r.ok) return Response.json({ error: "Failed to save setting", detail: r.message }, { status: 500 });
  return Response.json({ data: r.data });
}
