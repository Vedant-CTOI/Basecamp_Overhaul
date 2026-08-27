import { supabase } from "@/lib/supabase";
import { getServerSupabase } from "@/lib/supabase-server";
import { write } from "@/lib/db";
import { isPillarSlug } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-session";

// GET /api/settings/briefs?category=commercial
// GET /api/settings/briefs (returns all pillar briefs)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  if (category) {
    if (!isPillarSlug(category)) {
      return Response.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("category_briefs")
      .select("category, brief_context, fan_context, updated_at")
      .eq("category", category)
      .single();

    if (error) return Response.json({ error: "Brief not found", detail: error.message }, { status: 404 });
    return Response.json({ data });
  }

  const { data, error } = await supabase
    .from("category_briefs")
    .select("category, brief_context, fan_context, updated_at")
    .order("category");

  if (error) return Response.json({ error: "Failed to fetch briefs", detail: error.message }, { status: 500 });
  return Response.json({ data });
}

// PUT /api/settings/briefs — ADMIN SESSION REQUIRED (U5)
// Body: { category: string, brief_context?: string, fan_context?: string }
export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { category, brief_context, fan_context } = body;

  if (!category || !isPillarSlug(category)) {
    return Response.json({ error: "Valid category (pillar slug) is required" }, { status: 400 });
  }

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (brief_context !== undefined) updates.brief_context = brief_context;
  if (fan_context !== undefined) updates.fan_context = fan_context;

  // Service role: policies.sql restricts category_briefs writes to it.
  const r = await write("category_briefs.upsert:api", getServerSupabase()
    .from("category_briefs")
    .upsert(
      { category, ...updates },
      { onConflict: "category" }
    )
    .select("category, brief_context, fan_context, updated_at")
    .single());

  if (!r.ok) return Response.json({ error: "Failed to save brief", detail: r.message }, { status: 500 });
  return Response.json({ data: r.data });
}
