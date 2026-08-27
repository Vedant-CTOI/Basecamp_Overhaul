import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { isCoachType } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-session";

// GET /api/settings/coach-prompts?coach_type=provocateur
// GET /api/settings/coach-prompts (returns all overrides)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const coachType = searchParams.get("coach_type");

  if (coachType) {
    if (!isCoachType(coachType)) {
      return Response.json({ error: `Invalid coach_type: ${coachType}` }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("coach_prompt_overrides")
      .select("coach_type, system_prompt, updated_at")
      .eq("coach_type", coachType)
      .single();

    if (error) return Response.json({ error: "No override found for this coach", detail: error.message }, { status: 404 });
    return Response.json({ data });
  }

  const { data, error } = await supabase
    .from("coach_prompt_overrides")
    .select("coach_type, system_prompt, updated_at")
    .order("coach_type");

  if (error) return Response.json({ error: "Failed to fetch overrides", detail: error.message }, { status: 500 });
  return Response.json({ data });
}

// PUT /api/settings/coach-prompts — ADMIN SESSION REQUIRED (U5)
// Body: { coach_type: string, system_prompt: string }
//
// An override written here becomes the coach's system prompt for every
// participant in the room. It is the one setting whose abuse would be
// read as the product's own voice.
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { coach_type, system_prompt } = body;

  if (!coach_type || !isCoachType(coach_type)) {
    return Response.json({ error: "Valid coach_type is required" }, { status: 400 });
  }
  if (typeof system_prompt !== "string") {
    return Response.json({ error: "system_prompt must be a string" }, { status: 400 });
  }

  // Service role: policies.sql restricts coach_prompt_overrides writes to it.
  const r = await write("coach_prompt_overrides.upsert:api", getServerSupabase()
    .from("coach_prompt_overrides")
    .upsert(
      { coach_type, system_prompt, updated_at: new Date().toISOString() },
      { onConflict: "coach_type" }
    )
    .select("coach_type, system_prompt, updated_at")
    .single());

  if (!r.ok) return Response.json({ error: "Failed to save override", detail: r.message }, { status: 500 });
  return Response.json({ data: r.data });
}
