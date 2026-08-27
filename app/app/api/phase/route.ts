import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { isPillarSlug } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-session";
import { type WorkshopState, VIEWS, serializeWorkshopState, parseWorkshopState } from "@/lib/workshop-phase";
import { write } from "@/lib/db";

// ADMIN SESSION REQUIRED on both verbs (U5). POST drives the room's
// screen — pillar, view, whether the ballot is open, whether counts
// show — and GET reads the same operator state. No room-facing surface
// calls either: the Board, the ballot and the Stage read
// `workshop_state` through the store and its realtime channel, so
// gating this cannot reach a participant.
//
// SERVICE-ROLE REWIRE: this route used to build its own client from
// `process.env.NEXT_PUBLIC_SUPABASE_URL!`, which threw with no env and
// made GET 500 in showcase mode (audit #12). It now shares
// lib/supabase-server — the service role when configured (REQUIRED once
// policies.sql is applied; anon cannot write workshop_settings), the
// showcase shim when not — so the landmine went with the rewire.

const VIEW_SET = new Set<string>(VIEWS);

function validateState(body: unknown): WorkshopState | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;

  // Idle state
  if (obj.pillar === null && obj.view === null) {
    return { pillar: null, team: null, view: null, voting_open: false, show_counts: false };
  }

  // Active state — team is optional additive context
  if (
    typeof obj.pillar === "string" &&
    isPillarSlug(obj.pillar) &&
    typeof obj.view === "string" &&
    VIEW_SET.has(obj.view)
  ) {
    return {
      pillar: obj.pillar,
      team: typeof obj.team === "string" ? obj.team : null,
      view: obj.view as WorkshopState["view"],
      voting_open: obj.voting_open === true,
      show_counts: obj.show_counts === true,
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const state = validateState(body);

    if (!state) {
      return NextResponse.json({ error: "Invalid workshop state" }, { status: 400 });
    }

    // Can't have voting_open without being in pillar view
    if (state.voting_open && state.view !== "pillar") {
      return NextResponse.json({ error: "Voting can only be open in pillar view" }, { status: 400 });
    }

    // Can't show counts without being in pillar view
    if (state.show_counts && state.view !== "pillar") {
      return NextResponse.json({ error: "Counts can only be shown in pillar view" }, { status: 400 });
    }

    // Can't show counts while voting is open
    if (state.show_counts && state.voting_open) {
      return NextResponse.json({ error: "Cannot show counts while voting is open" }, { status: 400 });
    }

    const serialized = serializeWorkshopState(state);

    const r = await write("workshop_settings.upsert:phase-api", getServerSupabase()
      .from("workshop_settings")
      .upsert({ key: "workshop_state", value: serialized }, { onConflict: "key" }));

    if (!r.ok) {
      return NextResponse.json({ error: r.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, state });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { data, error } = await getServerSupabase()
    .from("workshop_settings")
    .select("value")
    .eq("key", "workshop_state")
    .single();

  if (error || !data) {
    return NextResponse.json({ pillar: null, team: null, view: null, voting_open: false, show_counts: false });
  }

  return NextResponse.json(parseWorkshopState(data.value));
}
