"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { supabase, isShowcaseMode } from "@/lib/supabase";
import { write, type WriteResult } from "@/lib/db";
import { Team } from "@/lib/types";
import { COACHES } from "@/lib/coaches";
import { GROUPS, BRAND, PAGE_NAMES, FRAMEWORK_FIELDS, darkMark, withAlpha } from "@/lib/config";
import { PILLAR_LIST, PILLARS, type PillarSlug } from "@/lib/config";
import { UNIVERSAL_ENGAGEMENT_CONTEXT, PILLAR_ENGAGEMENT_CONTEXT, findPlaceholderTokens } from "@/lib/engagement-context";
import { parseWorkshopState, serializeWorkshopState, isActiveState, getStateLabel, type WorkshopState } from "@/lib/workshop-phase";

// ── THE THEATER-DARK REGISTER ─────────────────────────────────
// USER RULING 2026-08-05, verbatim: "whether this is light or dark
// doesn't matter too much to me. maybe dark like the team select
// screen?" So the console sits in the theater dark, and it takes its
// ground, its seam and its type ramp FROM the team-select surface
// (app/page.tsx) rather than from a palette invented here — #0A0A0C
// ground, rgba(255,255,255,0.14) seams, #A8A5A6 secondary. This
// replaces the sweep's light-workbench judgement call
// (docs/ogilvy-showcase-direction.md, Round 21). What has not changed
// is what the surface IS: pre-session configuration, dense and quiet at
// laptop distance, never projected and never read across a room.
//
// RED DISCIPLINE holds, and the dark ground TIGHTENS it. Red is never
// running text on dark, so every red the light console SPOKE in — the
// unmet pre-flight detail, the NOT SAVED line, a failed export — is now
// white type behind a red edge. Red keeps exactly three jobs: the READY
// slab (the one filled red, and it exists only when nothing is unmet),
// the mark against an unmet pre-flight line, and the LIVE chip when
// voting is open.
//
// The primary inverts with the register. The light console's one
// primary was the INK slab — a console has a dozen save buttons and a
// dozen red buttons is wallpaper — and its dark converse is the PAPER
// slab: white ground, ink type. Same argument, ground swapped.
const PAPER = BRAND.colors.paper;      // the slab's ground; the QR tile
const INK = BRAND.colors.ink;          // type ON the slab
const RED = BRAND.colors.primary;
const STAGE = BRAND.colors.surface0;   // page ground — the team-select dark
const PANEL = BRAND.colors.surface1;   // card on stage
const TYPE = "#FFFFFF";                // primary type
const QUIET = "#A8A5A6";               // the team-select secondary
const FAINT = "rgba(255,255,255,0.55)";// labels, meta, inactive nav
const HAIRLINE = "rgba(255,255,255,0.14)"; // the team-select seam
const WELL = "rgba(255,255,255,0.04)"; // a recessed row INSIDE a card

// A field is not a tint on dark. The light WELL was a 2.5%-ink inset,
// which reads as an input on paper; its literal inversion reads as
// nothing at all. So an input is CUT INTO the card — the page ground
// back again, one step below the panel holding it — behind an edge that
// is meant to be seen. The fill alone cannot carry it: #0A0A0C inside
// #1B1A1D is 1.14:1, so the EDGE is the affordance, and it is sized to
// the 3:1 WCAG asks of a component boundary — 0.38 measures 3.06:1
// against the panel outside it and 3.45:1 against the fill inside it,
// which is why it reads from both sides. The focus ring lives in
// globals.css (`.console-field`): `focus:outline-none` with nothing
// behind it was already the light console's weakest affordance, and on
// this ground it is invisible.
const FIELD_EDGE = "rgba(255,255,255,0.38)";

const CARD: React.CSSProperties = { border: `1px solid ${HAIRLINE}`, background: PANEL };
const CARD_HEAD: React.CSSProperties = { borderBottom: `1px solid ${HAIRLINE}` };
const FIELD: React.CSSProperties = { background: STAGE, border: `1px solid ${FIELD_EDGE}`, color: TYPE };
const SLAB: React.CSSProperties = { background: PAPER, color: INK, border: "none" };

/** The alarm: white type behind a red edge and a red spine. Red is the
    mark, never the words — which is also what keeps a refused save from
    reading as the same object as the READY slab. */
const ALARM: React.CSSProperties = {
  color: TYPE,
  border: `1px solid ${RED}`,
  borderLeft: `3px solid ${RED}`,
  background: withAlpha(RED, 0.14),
};

/** The stamp: a state badge, bordered, tracked caps. Quiet when the
    thing is configured, a red edge around white type when it is not. */
function stamp(ok: boolean): React.CSSProperties {
  return ok
    ? { border: `1px solid ${HAIRLINE}`, color: QUIET, background: "transparent" }
    : { border: `1px solid ${RED}`, color: TYPE, background: withAlpha(RED, 0.16) };
}

const TEAM_COLORS: Record<string, string> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, g.color])
);

// ── THE CONSOLE'S WRITE PATH (service-role rewire) ────────────
// policies.sql restricts writes on workshop_settings, category_briefs,
// coach_prompt_overrides and teams — and the wire's toggle/delete — to
// the service role, and NO policy can admit this browser while refusing
// the room's phones: both present the same anon JWT. So on a LIVE
// deployment every mutation on this page travels through the
// session-gated API routes, which hold the service role via
// lib/supabase-server; the middleware already admitted this page, so
// the same httpOnly cookie rides along on every fetch. In SHOWCASE
// mode there is no Postgres, no RLS and no server-held store — the
// store IS this tab's in-memory shim — so the console writes it
// directly, exactly as every other showcase surface does. Both
// branches settle to the same WriteResult, so `took()` and the
// NOT SAVED line treat them identically.

/** A gated API call, reported in lib/db's own shape so no caller can
    tell the transport changed. */
async function apiWrite<T = unknown>(op: string, path: string, init: RequestInit = {}): Promise<WriteResult<T>> {
  try {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (body && typeof body.error === "string" && body.error) || `HTTP ${res.status}`;
      console.error(`[db] ${op} failed · ${res.status} — ${message}`);
      return { ok: false, code: String(res.status), message };
    }
    return { ok: true, data: (body && typeof body === "object" && "data" in body ? body.data : body) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db] ${op} threw — ${message}`);
    return { ok: false, code: null, message };
  }
}

/** One workshop_settings key. Showcase: this tab's store. Live: the
    gated PUT /api/settings, on the service role. */
function saveSetting(op: string, key: string, value: string): Promise<WriteResult> {
  if (isShowcaseMode) {
    return write(op, supabase.from("workshop_settings").upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    ));
  }
  return apiWrite(op, "/api/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
}

/** One category_briefs row (brief_context or fan_context). */
function saveBrief(op: string, category: string, fields: { brief_context?: string; fan_context?: string }): Promise<WriteResult> {
  if (isShowcaseMode) {
    return write(op, supabase.from("category_briefs").upsert(
      { category, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "category" }
    ));
  }
  return apiWrite(op, "/api/settings/briefs", { method: "PUT", body: JSON.stringify({ category, ...fields }) });
}

/** One team's editable fields, by slug (unique in schema.sql). */
function saveTeam(op: string, slug: string, fields: Record<string, unknown>): Promise<WriteResult> {
  if (isShowcaseMode) {
    return write(op, supabase.from("teams").update(fields).eq("slug", slug));
  }
  return apiWrite(op, `/api/teams/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(fields) });
}

// The guardrails settings key is `partnership_guardrails` (D-11); reads
// fall back to the Sprite-era `nba_rights` key so a pre-rename DB keeps
// its content. Saves write the canonical key only.
type Section = "setup" | "platforms" | "briefs" | "fan_data" | "playbook" | "insights" | "guardrails" | "coaches" | "ticker" | "qrcodes" | "report";

export default function AdminPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeSection, setActiveSection] = useState<Section>("setup");

  // Total participants setting
  const [totalParticipants, setTotalParticipants] = useState("20");

  // Coach prompts state
  const [coachPrompts, setCoachPrompts] = useState<Record<string, string>>({});
  const [coachSaving, setCoachSaving] = useState<Record<string, boolean>>({});
  const [coachSaved, setCoachSaved] = useState<Record<string, boolean>>({});

  // Ticker state
  const [tickerMessage, setTickerMessage] = useState("");
  const [tickerMessages, setTickerMessages] = useState<
    { id: string; message: string; is_active: boolean; created_at: string }[]
  >([]);
  const [tickerSending, setTickerSending] = useState(false);

  // Breaking news auto-fire state
  const [breakingAuto, setBreakingAuto] = useState(false);
  const [breakingSending, setBreakingSending] = useState(false);
  const [breakingLastSent, setBreakingLastSent] = useState<string | null>(null);
  const breakingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strategic playbook state
  const [strategicPlaybook, setStrategicPlaybook] = useState("");
  const [playbookSaving, setPlaybookSaving] = useState(false);
  const [playbookSaved, setPlaybookSaved] = useState(false);

  // Workshop insights state
  const [workshopInsights, setWorkshopInsights] = useState("");
  const [insightsSaving, setInsightsSaving] = useState(false);
  const [insightsSaved, setInsightsSaved] = useState(false);

  // Partnership guardrails state (key: partnership_guardrails)
  const [guardrails, setGuardrails] = useState("");
  const [guardrailsSaving, setGuardrailsSaving] = useState(false);
  const [guardrailsSaved, setGuardrailsSaved] = useState(false);

  // Workshop phase state
  const [workshopPhase, setWorkshopPhase] = useState<WorkshopState | null>(null);

  // Category briefs state (from category_briefs table)
  const [pillarBriefs, setPillarBriefs] = useState<Record<string, string>>({});
  const [pillarBriefSaving, setPillarBriefSaving] = useState<Record<string, boolean>>({});
  const [pillarBriefSaved, setPillarBriefSaved] = useState<Record<string, boolean>>({});

  // Audience data state (universal + per-category)
  const [fanContext, setFanContext] = useState("");
  const [fanContextSaving, setFanContextSaving] = useState(false);
  const [fanContextSaved, setFanContextSaved] = useState(false);
  const [pillarFanContext, setPillarFanContext] = useState<Record<string, string>>({});
  const [pillarFanSaving, setPillarFanSaving] = useState<Record<string, boolean>>({});
  const [pillarFanSaved, setPillarFanSaved] = useState<Record<string, boolean>>({});

  // Report state
  const [facilitatorNotes, setFacilitatorNotes] = useState("");
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null);
  const [reportError, setReportError] = useState(false);

  // PPTX export state
  const [pptxExporting, setPptxExporting] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);
  const [exportIdeaCount, setExportIdeaCount] = useState<number | null>(null);
  const [pptxSelectedTeams, setPptxSelectedTeams] = useState<Set<string>>(new Set());

  // Room code state
  const [roomCodeSetting, setRoomCodeSetting] = useState("");
  const [roomCodeSaving, setRoomCodeSaving] = useState(false);
  const [roomCodeSaved, setRoomCodeSaved] = useState(false);

  // Max votes per category
  const [maxVotesPerPillar, setMaxVotesPerPillar] = useState("3");

  // Enabled idea fields
  const [enabledIdeaFields, setEnabledIdeaFields] = useState<string[]>(
    FRAMEWORK_FIELDS.map((f) => f.key)
  );

  // Creative platform state (per-team)
  const [platformNames, setPlatformNames] = useState<Record<string, string>>({});
  const [platformBriefs, setPlatformBriefs] = useState<Record<string, string>>({});
  const [platformSaving, setPlatformSaving] = useState<Record<string, boolean>>({});
  const [platformSaved, setPlatformSaved] = useState<Record<string, boolean>>({});

  // ── U3: the console never claims a save it did not get ─────
  // This screen's register is the per-field SAVED stamp. A stamp that
  // fires on a write the store refused is the exact lie the write
  // layer exists to end — and on this surface it is the most expensive
  // one, because the facilitator walks away believing the room is
  // configured. So the stamp now only fires on success, and the
  // failure names the setting once, at the head of the console, where
  // whoever pressed Save is already looking.
  const [saveFailed, setSaveFailed] = useState<string | null>(null);
  const took = (r: WriteResult, what: string): boolean => {
    if (!r.ok) {
      setSaveFailed(what);
      return false;
    }
    setSaveFailed(null);
    return true;
  };

  // Voting toggle
  const [votingEnabled, setVotingEnabled] = useState(false);

  // QR code state
  const [baseUrl, setBaseUrl] = useState("");

  // Readiness check state
  const [readinessData, setReadinessData] = useState<{
    strategicPlaybook: string;
    ideaCount: number;
    aiHealthy: boolean | null;
  } | null>(null);

  useEffect(() => {
    // Set base URL from window
    setBaseUrl(window.location.origin);

    async function fetchTeams() {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .order("slug");
      if (data) {
        setTeams(data as Team[]);
        const names: Record<string, string> = {};
        const briefs: Record<string, string> = {};
        (data as Team[]).forEach((t) => {
          names[t.id] = t.creative_platform_name || "";
          briefs[t.id] = t.creative_platform_brief || "";
        });
        setPlatformNames(names);
        setPlatformBriefs(briefs);
      }
    }

    async function fetchPillarBriefs() {
      const { data } = await supabase.from("category_briefs").select("*");
      if (data) {
        const briefMap: Record<string, string> = {};
        const fanMap: Record<string, string> = {};
        data.forEach((b: { category: string; brief_context: string | null; fan_context: string | null }) => {
          briefMap[b.category] = b.brief_context || "";
          fanMap[b.category] = b.fan_context || "";
        });
        setPillarBriefs(briefMap);
        setPillarFanContext(fanMap);
      }
    }

    async function fetchFanContext() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "fan_context").single();
      if (data?.value) setFanContext(data.value);
    }

    async function fetchWorkshopPhase() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "workshop_state").single();
      if (data) setWorkshopPhase(parseWorkshopState(data.value));
    }

    async function fetchGuardrails() {
      // Canonical key first; alias read for pre-rename DBs (D-11).
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "partnership_guardrails").single();
      if (data?.value) { setGuardrails(data.value); return; }
      const { data: legacy } = await supabase
        .from("workshop_settings").select("value").eq("key", "nba_rights").single();
      if (legacy) setGuardrails(legacy.value || "");
    }

    async function fetchCoachOverrides() {
      const { data } = await supabase
        .from("coach_prompt_overrides")
        .select("*");
      if (data) {
        const overrides: Record<string, string> = {};
        data.forEach((r: { coach_type: string; system_prompt: string }) => {
          overrides[r.coach_type] = r.system_prompt;
        });
        // Merge: use override if exists, otherwise default from code
        const prompts: Record<string, string> = {};
        COACHES.forEach((c) => {
          prompts[c.type] = overrides[c.type] || c.systemPrompt;
        });
        setCoachPrompts(prompts);
      } else {
        // No overrides table yet — just use defaults
        const prompts: Record<string, string> = {};
        COACHES.forEach((c) => {
          prompts[c.type] = c.systemPrompt;
        });
        setCoachPrompts(prompts);
      }
    }

    async function fetchTickerMessages() {
      const { data } = await supabase
        .from("ticker_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setTickerMessages(data);
    }

    async function fetchStrategicPlaybook() {
      const { data } = await supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "strategic_playbook")
        .single();
      if (data?.value) setStrategicPlaybook(data.value);
    }

    async function fetchWorkshopInsights() {
      const { data } = await supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "insights")
        .single();
      if (data?.value) {
        setWorkshopInsights(data.value);
      }
    }

    async function fetchRoomCode() {
      const { data } = await supabase
        .from("workshop_settings")
        .select("value")
        .eq("key", "room_code")
        .single();
      if (data?.value) setRoomCodeSetting(data.value);
    }

    async function fetchReportMeta() {
      const res = await fetch("/api/report");
      const data = await res.json();
      if (data.generatedAt) setReportGeneratedAt(data.generatedAt);
    }

    async function fetchTotalParticipants() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "total_participants").single();
      if (data?.value) setTotalParticipants(data.value);
    }

    async function fetchMaxVotes() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "max_votes_per_pillar").single();
      if (data?.value) setMaxVotesPerPillar(data.value);
    }

    async function fetchEnabledIdeaFields() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "enabled_idea_fields").single();
      if (data?.value) {
        try { setEnabledIdeaFields(JSON.parse(data.value)); } catch {}
      }
    }

    async function fetchVotingEnabled() {
      const { data } = await supabase
        .from("workshop_settings").select("value").eq("key", "voting_enabled").single();
      if (data?.value) setVotingEnabled(data.value === "true");
    }

    async function fetchReadinessData() {
      const [playbookRes, ideasRes] = await Promise.all([
        supabase.from("workshop_settings").select("value").eq("key", "strategic_playbook").single(),
        supabase.from("ideas").select("id", { count: "exact", head: true }),
      ]);
      setReadinessData({
        strategicPlaybook: playbookRes.data?.value || "",
        ideaCount: ideasRes.count || 0,
        aiHealthy: null, // resolved below
      });

      // In showcase mode there is no model attached and the coaches return
      // scripted replies by design — firing a health check only produces a
      // guaranteed 503 in the console and a permanent red line on a
      // pre-flight list that is otherwise green.
      if (isShowcaseMode) {
        setReadinessData((prev) => (prev ? { ...prev, aiHealthy: true } : prev));
        return;
      }

      try {
        const aiRes = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coachType: "provocateur",
            ideaName: "Health Check",
            ideaDescription: "test",
            ideaCategory: PILLAR_LIST[0].slug,
            prompt: "Say OK",
          }),
        });
        setReadinessData((prev) => prev ? { ...prev, aiHealthy: aiRes.ok } : prev);
      } catch {
        setReadinessData((prev) => prev ? { ...prev, aiHealthy: false } : prev);
      }
    }

    fetchTeams();
    fetchPillarBriefs();
    fetchFanContext();
    fetchStrategicPlaybook();
    fetchCoachOverrides();
    fetchTickerMessages();
    fetchWorkshopInsights();
    fetchGuardrails();
    fetchWorkshopPhase();
    fetchRoomCode();
    fetchReportMeta();
    fetchTotalParticipants();
    fetchMaxVotes();
    fetchEnabledIdeaFields();
    fetchVotingEnabled();
    fetchReadinessData();
  }, []);

  // --- Strategic Playbook ---
  const handleSavePlaybook = async () => {
    setPlaybookSaving(true);
    setPlaybookSaved(false);

    const r = await saveSetting("workshop_settings.upsert:playbook", "strategic_playbook", strategicPlaybook);

    setPlaybookSaving(false);
    if (!took(r, "the strategic playbook")) return;
    setPlaybookSaved(true);
    setTimeout(() => setPlaybookSaved(false), 2000);
  };

  // --- Workshop Insights ---
  const handleSaveInsights = async () => {
    setInsightsSaving(true);
    setInsightsSaved(false);

    const r = await saveSetting("workshop_settings.upsert:insights", "insights", workshopInsights);

    setInsightsSaving(false);
    if (!took(r, "the workshop insights")) return;
    setInsightsSaved(true);
    setTimeout(() => setInsightsSaved(false), 2000);
  };

  // --- Coach Prompts ---
  const handleSaveCoachPrompt = async (coachType: string) => {
    setCoachSaving((s) => ({ ...s, [coachType]: true }));
    setCoachSaved((s) => ({ ...s, [coachType]: false }));

    const r = isShowcaseMode
      ? await write("coach_prompt_overrides.upsert:prompt", supabase.from("coach_prompt_overrides").upsert(
          {
            coach_type: coachType,
            system_prompt: coachPrompts[coachType],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "coach_type" }
        ))
      : await apiWrite("coach_prompt_overrides.upsert:prompt", "/api/settings/coach-prompts", {
          method: "PUT",
          body: JSON.stringify({ coach_type: coachType, system_prompt: coachPrompts[coachType] }),
        });

    setCoachSaving((s) => ({ ...s, [coachType]: false }));
    if (!took(r, `the ${coachType} coach prompt`)) return;
    setCoachSaved((s) => ({ ...s, [coachType]: true }));
    setTimeout(
      () => setCoachSaved((s) => ({ ...s, [coachType]: false })),
      2000
    );
  };

  const handleResetCoachPrompt = (coachType: string) => {
    const coach = COACHES.find((c) => c.type === coachType);
    if (coach) {
      setCoachPrompts((p) => ({ ...p, [coachType]: coach.systemPrompt }));
    }
  };

  // --- Ticker Messages ---
  const handleSendTickerMessage = async () => {
    if (!tickerMessage.trim()) return;
    setTickerSending(true);

    const r = isShowcaseMode
      ? await write("ticker_messages.insert:admin", supabase
          .from("ticker_messages")
          .insert({ message: tickerMessage.trim(), is_active: true })
          .select()
          .single())
      : await apiWrite("ticker_messages.insert:admin", "/api/ticker", {
          method: "POST",
          body: JSON.stringify({ message: tickerMessage.trim() }),
        });

    setTickerSending(false);
    // The wire did not take it — keep the message in the field so it
    // can be sent again rather than retyped.
    if (!took(r, "the wire message")) return;
    if (r.ok && r.data) {
      setTickerMessages((prev) => [r.data as typeof prev[number], ...prev]);
    }
    setTickerMessage("");
  };

  const handleToggleTickerMessage = async (id: string, isActive: boolean) => {
    const r = isShowcaseMode
      ? await write("ticker_messages.update:toggle", supabase
          .from("ticker_messages")
          .update({ is_active: !isActive })
          .eq("id", id))
      : await apiWrite("ticker_messages.update:toggle", "/api/ticker", {
          method: "PATCH",
          body: JSON.stringify({ id, is_active: !isActive }),
        });
    if (!took(r, "the wire message")) return;
    setTickerMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_active: !isActive } : m))
    );
  };

  const handleDeleteTickerMessage = async (id: string) => {
    const r = isShowcaseMode
      ? await write("ticker_messages.delete:admin", supabase.from("ticker_messages").delete().eq("id", id))
      : await apiWrite("ticker_messages.delete:admin", `/api/ticker?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!took(r, "the wire message")) return;
    setTickerMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Breaking news — send one now
  const sendBreakingNews = useCallback(async (force = false) => {
    setBreakingSending(true);
    try {
      const res = await fetch("/api/breaking-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.skipped) {
          setBreakingLastSent(data.message);
          const { data: msgs } = await supabase
            .from("ticker_messages")
            .select("*")
            .order("created_at", { ascending: false });
          if (msgs) setTickerMessages(msgs);
        }
      }
    } catch (err) {
      console.error("Breaking news failed:", err);
    }
    setBreakingSending(false);
  }, []);

  // Breaking news auto-timer — 15-20 min randomized
  useEffect(() => {
    if (!breakingAuto) {
      if (breakingTimer.current) clearTimeout(breakingTimer.current);
      breakingTimer.current = null;
      return;
    }
    const scheduleNext = () => {
      const delay = (15 + Math.random() * 5) * 60 * 1000;
      breakingTimer.current = setTimeout(async () => {
        await sendBreakingNews(false);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      if (breakingTimer.current) clearTimeout(breakingTimer.current);
    };
  }, [breakingAuto, sendBreakingNews]);

  const handleGenerateReport = async () => {
    setReportGenerating(true);
    setReportError(false);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilitatorNotes }),
      });
      if (!res.ok) throw new Error("Failed");
      const now = new Date().toISOString();
      setReportGeneratedAt(now);
    } catch {
      setReportError(true);
    }
    setReportGenerating(false);
  };

  // Count the ideas the deck will carry + initialize team selection
  useEffect(() => {
    if (activeSection !== "report") return;
    supabase
      .from("ideas")
      .select("id, status", { count: "exact" })
      .neq("status", "bench")
      .then(({ count }) => {
        setExportIdeaCount(count || 0);
      });
    // Initialize pptxSelectedTeams with all team IDs if empty
    if (teams.length > 0 && pptxSelectedTeams.size === 0) {
      setPptxSelectedTeams(new Set(teams.map((t) => t.id)));
    }
  }, [activeSection, teams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportPptx = async () => {
    setPptxExporting(true);
    setPptxError(null);
    try {
      // EVERY idea, set-aside included. The export filters the set-aside
      // ideas out itself, but it derives each idea's stable № first, and
      // `ideaNumbers` requires the whole bucket — a number taken from a
      // filtered slice is a position again (lib/idea-number).
      const [ideasRes, teamsRes, visionsRes] = await Promise.all([
        supabase.from("ideas").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("workshop_settings").select("key, value").like("key", "team_vision_%"),
      ]);
      if (ideasRes.error) throw ideasRes.error;
      if (teamsRes.error) throw teamsRes.error;

      // Build team visions map: { "team_vision_group-1": "vision text", ... }
      const teamVisions: Record<string, string> = {};
      if (visionsRes.data) {
        for (const row of visionsRes.data) {
          if (row.value) teamVisions[row.key] = row.value;
        }
      }

      const selectedIds = Array.from(pptxSelectedTeams);
      const { exportStartingLineup } = await import("@/lib/export-pptx");
      await exportStartingLineup(
        ideasRes.data || [],
        teamsRes.data || [],
        undefined,
        { selectedTeamIds: selectedIds.length > 0 ? selectedIds : undefined, teamVisions }
      );
    } catch (err) {
      console.error("PPTX export failed:", err);
      setPptxError(err instanceof Error ? err.message : "Export failed");
    }
    setPptxExporting(false);
  };

  const handleSaveRoomCode = async () => {
    setRoomCodeSaving(true);
    setRoomCodeSaved(false);
    const r = await saveSetting("workshop_settings.upsert:room-code", "room_code", roomCodeSetting.trim().toUpperCase());
    setRoomCodeSaving(false);
    if (!took(r, "the room code")) return;
    setRoomCodeSetting((c) => c.trim().toUpperCase());
    setRoomCodeSaved(true);
    setTimeout(() => setRoomCodeSaved(false), 2000);
  };

  // Phase control — uses the workshop_state key
  const setPhase = async (pillar: PillarSlug | null, view: string | null) => {
    const newState: WorkshopState = {
      pillar: pillar as PillarSlug | null,
      team: null,
      view: (view as WorkshopState["view"]) || null,
      voting_open: false,
      show_counts: false,
    };
    const serialized = serializeWorkshopState(newState);
    // Live: POST /api/phase — the route validates the state shape and
    // holds the service role. Showcase: the tab's own store, directly.
    const r = isShowcaseMode
      ? await write("workshop_settings.upsert:phase", supabase.from("workshop_settings").upsert(
          { key: "workshop_state", value: serialized },
          { onConflict: "key" }
        ))
      : await apiWrite("workshop_state.post:phase", "/api/phase", { method: "POST", body: serialized });
    if (!took(r, "the workshop phase — the room's screen did not move")) return;
    setWorkshopPhase(parseWorkshopState(serialized));
  };

  // Save category brief
  const savePillarBrief = async (category: string) => {
    setPillarBriefSaving((s) => ({ ...s, [category]: true }));
    const r = await saveBrief("category_briefs.upsert:brief", category, { brief_context: pillarBriefs[category] || "" });
    setPillarBriefSaving((s) => ({ ...s, [category]: false }));
    if (!took(r, `the ${category} brief`)) return;
    setPillarBriefSaved((s) => ({ ...s, [category]: true }));
    setTimeout(() => setPillarBriefSaved((s) => ({ ...s, [category]: false })), 2000);
  };

  // Save universal audience context
  const saveFanContext = async () => {
    setFanContextSaving(true);
    const r = await saveSetting("workshop_settings.upsert:fan-context", "fan_context", fanContext);
    setFanContextSaving(false);
    if (!took(r, "the audience context")) return;
    setFanContextSaved(true);
    setTimeout(() => setFanContextSaved(false), 2000);
  };

  // Save per-category audience context
  const savePillarFanContext = async (category: string) => {
    setPillarFanSaving((s) => ({ ...s, [category]: true }));
    const r = await saveBrief("category_briefs.upsert:fan-context", category, { fan_context: pillarFanContext[category] || "" });
    setPillarFanSaving((s) => ({ ...s, [category]: false }));
    if (!took(r, `the ${category} audience context`)) return;
    setPillarFanSaved((s) => ({ ...s, [category]: true }));
    setTimeout(() => setPillarFanSaved((s) => ({ ...s, [category]: false })), 2000);
  };

  // Save partnership guardrails
  const saveGuardrails = async () => {
    setGuardrailsSaving(true);
    const r = await saveSetting("workshop_settings.upsert:guardrails", "partnership_guardrails", guardrails);
    setGuardrailsSaving(false);
    if (!took(r, "the partnership guardrails")) return;
    setGuardrailsSaved(true);
    setTimeout(() => setGuardrailsSaved(false), 2000);
  };

  const NAV_ITEMS: { key: Section; label: string }[] = [
    { key: "setup", label: "SETUP" },
    { key: "platforms", label: "PLATFORMS" },
    { key: "briefs", label: "CATEGORY BRIEFS" },
    { key: "fan_data", label: "AUDIENCE DATA" },
    { key: "playbook", label: "PLAYBOOK" },
    { key: "insights", label: "INSIGHTS" },
    { key: "guardrails", label: "PARTNERSHIP GUARDRAILS" },
    { key: "coaches", label: "COACHES" },
    { key: "ticker", label: "TICKER" },
    { key: "qrcodes", label: "QR CODES" },
    { key: "report", label: "EXPORTS" },
  ];

  /** The one primary on any card: the ink slab. */
  const SlabButton = ({
    onClick, disabled, children, className = "",
  }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-bold text-[12px] tracking-[1.5px] uppercase px-6 py-2.5 cursor-pointer transition-opacity disabled:opacity-50 ${className}`}
      style={SLAB}
    >
      {children}
    </button>
  );

  /** A saved flash, in the stamp register. */
  const SavedStamp = () => (
    <span
      className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-0.5"
      style={{ border: `1px solid ${HAIRLINE}`, color: QUIET }}
    >
      Saved
    </span>
  );

  return (
    // colorScheme: the native controls on this page — checkboxes, the
    // number inputs' spinners, the scrollbars — are drawn by the browser,
    // and left on `light` they arrive as white chrome on a dark ground.
    <div className="min-h-screen p-8 pb-16" style={{ background: STAGE, color: TYPE, colorScheme: "dark" }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
          {/* The wordmark is the way home — the same object the Board uses,
              so the console reads as the same product. White on the dark
              register, exactly as the team-select header carries it. */}
          <img src="/logos/dove-logo-white.svg" alt={BRAND.subtitle} className="h-[22px]" />
          <span className="font-bold text-[11px] tracking-[2px] uppercase transition-opacity opacity-60 group-hover:opacity-100" style={{ color: TYPE }}>
            &larr; Home
          </span>
        </Link>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-[34px] tracking-[0.5px] mb-2" style={{ color: TYPE }}>
              {PAGE_NAMES.admin}
            </h1>
            <p className="text-[14px]" style={{ color: QUIET, textWrap: "balance" } as React.CSSProperties}>
              Pre-session setup. Live workshop control happens on {PAGE_NAMES.centerCourt}.
            </p>
          </div>
          <div className="text-right shrink-0 ml-8 px-5 py-4" style={{ border: `1px solid ${HAIRLINE}` }}>
            <div className="font-bold text-[10px] tracking-[2.5px] uppercase mb-1" style={{ color: FAINT }}>Full Screen</div>
            <div className="font-display text-[20px] tracking-[1px]" style={{ color: QUIET }}>Shift + ⌘ + F</div>
          </div>
        </div>

        {/* The console's one failure line. Not a banner and not a
            modal — the same slug register the SAVED stamps use, sitting
            where the console's own standing belongs. It says what did
            not save and it does not move. On dark the words are white
            and the RED is the edge: red running text is the one thing
            this register forbids, and a red-on-red block would also
            read as a second READY slab. */}
        {saveFailed && (
          <p
            data-qa="admin-save-failed"
            className="font-mono text-[11px] tracking-[1px] mb-6 px-4 py-3"
            style={ALARM}
          >
            NOT SAVED — {saveFailed}. Nothing was written; try again.
          </p>
        )}

        {/* Section nav — active is white type over a white underline, the
            dark register's own selection chrome (Round 7 item 1);
            never red (Round 6 item 3). */}
        <div className="flex gap-1 mb-10 flex-wrap" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className="font-bold text-[11px] tracking-[1.5px] uppercase px-5 py-3 cursor-pointer transition-colors"
              style={{
                color: activeSection === item.key ? TYPE : FAINT,
                borderBottom:
                  activeSection === item.key
                    ? `2px solid ${TYPE}`
                    : "2px solid transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ===== SETUP ===== */}
        {activeSection === "setup" && (
          <div className="space-y-8">
            {/* Pre-flight readiness check */}
            {readinessData && (() => {
              // D-6 — placeholder tokens reachable by a live model call.
              // Mirrors the prompt assembly in api/coach + api/scout: DB
              // content wins, and the bracketed teaching fallbacks from
              // lib/engagement-context stand in wherever it is missing —
              // so an empty slot here means a token in a live prompt.
              // The routes refuse such a prompt outright; this row names
              // the offending source before the room ever opens.
              const placeholderSources: [string, string][] = [
                ["playbook", readinessData.strategicPlaybook],
                ["insights", workshopInsights],
                ["guardrails", guardrails],
                ["audience data", fanContext || UNIVERSAL_ENGAGEMENT_CONTEXT],
                ...PILLAR_LIST.map((p): [string, string] => [
                  `${p.abbr} audience`,
                  pillarFanContext[p.slug] || PILLAR_ENGAGEMENT_CONTEXT[p.slug] || "",
                ]),
                ...PILLAR_LIST.map((p): [string, string] => [`${p.abbr} brief`, pillarBriefs[p.slug] || ""]),
                ...COACHES.map((c): [string, string] => [c.name, coachPrompts[c.type] || c.systemPrompt]),
              ];
              const tokenSources = placeholderSources
                .filter(([, text]) => findPlaceholderTokens(text).length > 0)
                .map(([label]) => label);
              const checks = [
                { label: "Room code", ok: !!roomCodeSetting.trim(), detail: roomCodeSetting.trim() || "Not set" },
                { label: "Teams", ok: teams.length > 0, detail: `${teams.length} teams` },
                { label: "Strategic playbook", ok: !!readinessData.strategicPlaybook, detail: readinessData.strategicPlaybook ? `${readinessData.strategicPlaybook.length} chars` : "Not loaded" },
                { label: "Category briefs", ok: Object.values(pillarBriefs).some((b) => b.length > 0), detail: `${Object.values(pillarBriefs).filter((b) => b.length > 0).length}/${PILLAR_LIST.length} categories` },
                { label: "Audience data", ok: !!fanContext, detail: fanContext ? `${fanContext.length} chars` : "Not loaded" },
                { label: "Partnership guardrails", ok: !!guardrails, detail: guardrails ? `${guardrails.length} chars` : "Not loaded" },
                {
                  label: "Prompt placeholders",
                  ok: isShowcaseMode || tokenSources.length === 0,
                  detail: isShowcaseMode
                    ? "Showcase — scripted replies"
                    : tokenSources.length === 0
                    ? "None reachable"
                    : `Tokens in: ${tokenSources.join(", ")}`,
                },
                { label: "Ideas seeded", ok: readinessData.ideaCount > 0, detail: `${readinessData.ideaCount} ideas` },
                {
                  label: "Coaching AI",
                  ok: readinessData.aiHealthy === true,
                  detail: isShowcaseMode
                    ? "Showcase — scripted replies"
                    : readinessData.aiHealthy === null ? "Checking…" : readinessData.aiHealthy ? "Responding" : "Not responding",
                },
              ];
              const passCount = checks.filter((c) => c.ok).length;
              const allGood = passCount === checks.length;
              return (
                <div className="p-5" style={CARD}>
                  <div className="flex items-center justify-between mb-4">
                    {/* The console's single Kruger: one red slab, and only
                        when the room is actually ready to open. */}
                    {allGood ? (
                      <span className="font-bold text-[12px] tracking-[3px] uppercase px-3 py-1.5" style={{ background: RED, color: PAPER }}>
                        Ready
                      </span>
                    ) : (
                      <span className="font-bold text-[12px] tracking-[3px] uppercase" style={{ color: TYPE }}>
                        Pre-flight check
                      </span>
                    )}
                    <span className="font-mono text-[11px]" style={{ color: QUIET }}>
                      {passCount}/{checks.length} configured
                    </span>
                  </div>
                  {/* An unmet line is louder than a met one, and on dark
                      the loudness is LUMINANCE, not hue: the red ▪ is the
                      mark, and both the label and its detail step up to
                      full white rather than being set in red. A met line
                      recedes to the quiet ramp. */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {checks.map((check) => (
                      <div key={check.label} className="flex items-center gap-3 py-1">
                        <span style={{ color: check.ok ? QUIET : RED, fontSize: 13, lineHeight: 1 }}>
                          {check.ok ? "✓" : "▪"}
                        </span>
                        <span className="text-[13px]" style={{ color: check.ok ? QUIET : TYPE }}>
                          {check.label}
                        </span>
                        <span className="text-[11px] font-mono ml-auto" style={{ color: check.ok ? FAINT : TYPE }}>
                          {check.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Room Code */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Room code</span>
                <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!roomCodeSetting.trim())}>
                  {roomCodeSetting.trim() ? "Set" : "Not set"}
                </span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>Participants enter this code on the home screen to join.</p>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={roomCodeSetting}
                    onChange={(e) => setRoomCodeSetting(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveRoomCode()}
                    placeholder="e.g. WORKSHOP"
                    className="w-[240px] px-4 py-3 font-bold text-[18px] tracking-[6px] uppercase focus:outline-none console-field"
                    style={FIELD}
                  />
                  <SlabButton onClick={handleSaveRoomCode} disabled={roomCodeSaving}>
                    {roomCodeSaving ? "Saving…" : "Save"}
                  </SlabButton>
                  {roomCodeSaved && <SavedStamp />}
                </div>
              </div>
            </div>

            {/* Total Participants */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Total participants</span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>Used for the &ldquo;X of Y have voted&rdquo; counter on {PAGE_NAMES.centerCourt}.</p>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={totalParticipants}
                    onChange={(e) => setTotalParticipants(e.target.value)}
                    className="w-[120px] px-4 py-3 font-bold text-[18px] tracking-[1px] focus:outline-none console-field text-center"
                    style={FIELD}
                  />
                  <SlabButton
                    onClick={async () => {
                      took(await saveSetting("workshop_settings.upsert:participants", "total_participants", totalParticipants), "the participant count");
                    }}
                  >
                    Save
                  </SlabButton>
                </div>
              </div>
            </div>

            {/* Max Votes Per Category */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Votes per category</span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>Max votes each person can cast per category. Also enforced in the database.</p>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxVotesPerPillar}
                    onChange={(e) => setMaxVotesPerPillar(e.target.value)}
                    className="w-[120px] px-4 py-3 font-bold text-[18px] tracking-[1px] focus:outline-none console-field text-center"
                    style={FIELD}
                  />
                  <SlabButton
                    onClick={async () => {
                      took(await saveSetting("workshop_settings.upsert:max-votes", "max_votes_per_pillar", maxVotesPerPillar), "the vote limit");
                    }}
                  >
                    Save
                  </SlabButton>
                </div>
              </div>
            </div>

            {/* Idea Framework Fields — driven by FRAMEWORK_FIELDS so the
                labels can never drift from the ones the idea form shows. */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Idea fields</span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>Toggle optional fields on the idea form. Name and description are always required.</p>
                <div className="flex flex-col gap-2">
                  {FRAMEWORK_FIELDS.map((field) => (
                    <label key={field.key} className="flex items-baseline gap-3 px-4 py-3 cursor-pointer" style={{ background: WELL }}>
                      <input
                        type="checkbox"
                        checked={enabledIdeaFields.includes(field.key)}
                        onChange={() => {
                          setEnabledIdeaFields((prev) => {
                            const next = prev.includes(field.key)
                              ? prev.filter((f) => f !== field.key)
                              : [...prev, field.key];
                            // The write is issued from inside a state
                            // updater, so it cannot be awaited here —
                            // it reports on the console's own line.
                            void saveSetting("workshop_settings.upsert:idea-fields", "enabled_idea_fields", JSON.stringify(next))
                              .then((r) => took(r, "the idea fields"));
                            return next;
                          });
                        }}
                        className="w-4 h-4 shrink-0 self-center"
                        style={{ accentColor: TYPE }}
                      />
                      <span className="text-[14px] shrink-0" style={{ color: TYPE }}>{field.label}</span>
                      <span className="text-[12px] truncate" style={{ color: FAINT }}>{field.prompt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Voting Toggle */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Idea-level voting</span>
                <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(votingEnabled)}>
                  {votingEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>
                  When disabled, {PAGE_NAMES.vote} and the control that opens it are hidden. Voting data is preserved.
                </p>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: WELL }}>
                  <input
                    type="checkbox"
                    checked={votingEnabled}
                    onChange={async () => {
                      const next = !votingEnabled;
                      setVotingEnabled(next);
                      const r = await saveSetting("workshop_settings.upsert:voting-enabled", "voting_enabled", String(next));
                      // The toggle goes back if the setting did not
                      // take — a console that shows voting enabled
                      // while the phones cannot see it is the worst
                      // thing this screen can say.
                      if (!took(r, "the voting toggle")) setVotingEnabled(!next);
                    }}
                    className="w-4 h-4"
                    style={{ accentColor: TYPE }}
                  />
                  <span className="text-[14px]" style={{ color: TYPE }}>Enable voting — the ballot on phones and the returns on {PAGE_NAMES.centerCourt}</span>
                </label>
              </div>
            </div>

            {/* Workshop Status (read-only + emergency reset) */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Workshop status</span>
                <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(true)}>
                  {workshopPhase ? getStateLabel(workshopPhase) : "Ready"}
                </span>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-4" style={{ color: QUIET }}>
                  Workshop phase is controlled from {PAGE_NAMES.centerCourt}. Use the reset below only in emergencies.
                </p>
                {workshopPhase && isActiveState(workshopPhase) && (
                  <div className="mb-4 px-4 py-3" style={{ background: WELL, border: `1px solid ${HAIRLINE}` }}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[13px] tracking-[1px] uppercase" style={{ color: workshopPhase.pillar ? TYPE : QUIET }}>
                        {workshopPhase.pillar ? PILLARS[workshopPhase.pillar].label : "—"}
                      </span>
                      <span className="text-[11px]" style={{ color: FAINT }}>·</span>
                      <span className="text-[11px] tracking-[1px] uppercase" style={{ color: QUIET }}>
                        {getStateLabel(workshopPhase)}
                      </span>
                      {workshopPhase.voting_open && (
                        <span className="font-bold text-[10px] tracking-[2px] uppercase px-2 py-0.5" style={{ background: RED, color: PAPER }}>
                          Voting open
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => setPhase(null, null)}
                  className="px-6 py-2 font-bold text-[11px] tracking-[1.5px] uppercase cursor-pointer transition-colors"
                  style={{ background: "transparent", color: QUIET, border: `1px solid ${HAIRLINE}` }}
                >
                  Reset to idle
                </button>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex gap-3">
              {[
                { href: "/center-court", label: PAGE_NAMES.centerCourt },
                { href: "/big-board", label: PAGE_NAMES.bigBoard },
                { href: "/report", label: PAGE_NAMES.report },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  className="px-4 py-2 font-bold text-[11px] tracking-[1.5px] uppercase transition-colors"
                  style={{ color: TYPE, border: `1px solid ${HAIRLINE}` }}
                >
                  {`${link.label} →`}
                </a>
              ))}
            </div>

            {/* Teams (folded into Setup) */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Teams</span>
              </div>
              <div className="p-6 space-y-3">
                {teams.map((team) => {
                  // The dot is a MARK and keeps the raw hue; anything that
                  // has to be READ takes the paper-safe shade of it.
                  const hue = TEAM_COLORS[team.slug] || team.color;
                  return (
                    <div key={team.id} className="flex items-center gap-4 px-4 py-3" style={{ background: WELL }}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: hue }} />
                      <input
                        type="text"
                        value={team.display_name || ""}
                        onChange={(e) => {
                          setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, display_name: e.target.value } : t));
                        }}
                        onBlur={async (e) => {
                          took(await saveTeam("teams.update:display-name", team.slug, { display_name: e.target.value || null }), `${team.name}'s name`);
                        }}
                        placeholder={team.name}
                        className="w-[180px] px-2 py-1 text-[14px] focus:outline-none console-field"
                        style={FIELD}
                      />
                      <div className="flex gap-2 ml-auto">
                        {PILLAR_LIST.map((pillar) => {
                          const isAssigned = (team.assigned_pillars || []).includes(pillar.slug);
                          return (
                            <button
                              key={pillar.slug}
                              onClick={async () => {
                                const current = team.assigned_pillars || [];
                                let next: string[];
                                if (isAssigned) {
                                  if (current.length <= 1) return;
                                  next = current.filter((p: string) => p !== pillar.slug);
                                } else {
                                  next = [...current, pillar.slug];
                                }
                                const r = await saveTeam("teams.update:pillars", team.slug, { assigned_pillars: next });
                                if (!took(r, `${team.name}'s categories`)) return;
                                setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, assigned_pillars: next as PillarSlug[] } : t));
                              }}
                              className="px-3 py-1 font-bold text-[10px] tracking-[1.5px] uppercase transition-all"
                              style={{
                                background: isAssigned ? "rgba(255,255,255,0.10)" : "transparent",
                                color: isAssigned ? TYPE : FAINT,
                                border: `1px solid ${isAssigned ? "rgba(255,255,255,0.5)" : HAIRLINE}`,
                              }}
                            >
                              {pillar.abbr}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== CREATIVE PLATFORMS ===== */}
        {activeSection === "platforms" && (
          <div>
            <div className="flex flex-col gap-6">
              <p className="text-[13px]" style={{ color: QUIET }}>
                Enter the creative platform name and brief for each team. These are injected into all AI coaching, scouting, and merging. Participants see the platform name on team select and on {PAGE_NAMES.teamBoard}.
              </p>
              {teams.map((team) => {
                const hue = TEAM_COLORS[team.slug] || BRAND.colors.ink;
                return (
                  <div key={team.id} style={CARD}>
                    <div className="flex items-center gap-3 px-6 py-4" style={CARD_HEAD}>
                      <div className="w-3 h-3 rounded-full" style={{ background: hue }} />
                      <span className="font-bold text-[14px] tracking-[1.5px] uppercase" style={{ color: TYPE }}>
                        {team.display_name || team.name}
                      </span>
                      {platformSaved[team.id] && <SavedStamp />}
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                      <div>
                        <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>Platform name</label>
                        <input
                          type="text"
                          value={platformNames[team.id] || ""}
                          onChange={(e) => setPlatformNames((prev) => ({ ...prev, [team.id]: e.target.value }))}
                          placeholder="e.g. Sell or Else"
                          className="w-full px-4 py-3 text-[16px] focus:outline-none console-field"
                          style={FIELD}
                        />
                      </div>
                      <div>
                        <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>Platform brief</label>
                        <textarea
                          value={platformBriefs[team.id] || ""}
                          onChange={(e) => setPlatformBriefs((prev) => ({ ...prev, [team.id]: e.target.value }))}
                          placeholder="Describe the creative territory this team will explore…"
                          rows={4}
                          className="w-full px-4 py-3 text-[14px] leading-[1.7] focus:outline-none console-field resize-y"
                          style={FIELD}
                        />
                      </div>
                      <div className="self-end">
                        <SlabButton
                          onClick={async () => {
                            setPlatformSaving((prev) => ({ ...prev, [team.id]: true }));
                            setPlatformSaved((prev) => ({ ...prev, [team.id]: false }));
                            const name = platformNames[team.id]?.trim() || null;
                            const brief = platformBriefs[team.id]?.trim() || null;
                            const r = await saveTeam("teams.update:platform", team.slug, {
                              creative_platform_name: name,
                              creative_platform_brief: brief,
                            });
                            setPlatformSaving((prev) => ({ ...prev, [team.id]: false }));
                            if (!took(r, `${team.name}'s creative platform`)) return;
                            setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, creative_platform_name: name, creative_platform_brief: brief } : t));
                            setPlatformSaved((prev) => ({ ...prev, [team.id]: true }));
                            setTimeout(() => setPlatformSaved((prev) => ({ ...prev, [team.id]: false })), 2000);
                          }}
                          disabled={platformSaving[team.id]}
                        >
                          {platformSaving[team.id] ? "Saving…" : "Save platform"}
                        </SlabButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== PARTNERSHIP GUARDRAILS (key: partnership_guardrails; reads alias legacy nba_rights) ===== */}
        {activeSection === "guardrails" && (
          <div>
            <h2 className="font-display text-[24px] mb-2">Partnership guardrails</h2>
            <p className="text-[13px] mb-6" style={{ color: QUIET }}>Injected into all AI coach system prompts as context. Do not include verbatim financial terms or contact emails.</p>
            <textarea
              value={guardrails}
              onChange={(e) => setGuardrails(e.target.value)}
              rows={20}
              className="w-full p-4 text-[14px] leading-relaxed focus:outline-none console-field resize-y"
              style={FIELD}
              placeholder="What the room may and may not commit to — approvals needed, IP and rights available, use of the identity, anything Legal has to see first…"
            />
            <div className="mt-4 flex items-center gap-4">
              <SlabButton onClick={saveGuardrails} disabled={guardrailsSaving}>
                {guardrailsSaving ? "Saving…" : "Save"}
              </SlabButton>
              {guardrailsSaved && <SavedStamp />}
              <span className="font-mono text-[11px] ml-auto" style={{ color: FAINT }}>{guardrails.length} characters</span>
            </div>
          </div>
        )}

        {/* ===== CATEGORY BRIEFS ===== */}
        {activeSection === "briefs" && (
          <div>
            <h2 className="font-display text-[24px] mb-2">Category strategic briefs</h2>
            <p className="text-[13px] mb-6" style={{ color: QUIET }}>Each category gets its own strategic brief, loaded by AI coaches based on the idea&apos;s category.</p>
            <div className="space-y-6">
              {PILLAR_LIST.map((pillar) => (
                <div key={pillar.slug} style={CARD}>
                  <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: pillar.color }} />
                      <span className="font-display text-[20px]" style={{ color: TYPE }}>
                        {pillar.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {pillarBriefSaved[pillar.slug] && <SavedStamp />}
                      <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!pillarBriefs[pillar.slug]?.trim())}>
                        {pillarBriefs[pillar.slug]?.trim() ? `${pillarBriefs[pillar.slug].length} chars` : "Empty"}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={pillarBriefs[pillar.slug] || ""}
                      onChange={(e) => setPillarBriefs((b) => ({ ...b, [pillar.slug]: e.target.value }))}
                      placeholder={`Strategic brief for ${pillar.label}…\n\n- What the category is really asking for\n- The audience behaviour behind it\n- Evidence the room should be working from\n- How it connects to each team's creative platform`}
                      rows={10}
                      className="w-full px-4 py-3 text-[14px] leading-[1.7] focus:outline-none console-field resize-y"
                      style={FIELD}
                    />
                    <div className="flex justify-end mt-3">
                      <SlabButton onClick={() => savePillarBrief(pillar.slug)} disabled={pillarBriefSaving[pillar.slug]}>
                        {pillarBriefSaving[pillar.slug] ? "Saving…" : "Save brief"}
                      </SlabButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== AUDIENCE DATA ===== */}
        {activeSection === "fan_data" && (
          <div>
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              Audience insights from social listening, research, and anything the room should be working from. Universal context loads into every AI call; category-specific data routes based on the idea&apos;s category.
            </p>

            {/* Universal audience context */}
            <div className="mb-6" style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Universal audience context</span>
                <div className="flex items-center gap-3">
                  {fanContextSaved && <SavedStamp />}
                  <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!fanContext.trim())}>
                    {fanContext.trim() ? `${fanContext.length} chars` : "Empty"}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <p className="text-[12px] mb-3" style={{ color: QUIET }}>Loaded into every coach and Scout call. Broad audience insights, cultural context, behavioural data.</p>
                <textarea
                  value={fanContext}
                  onChange={(e) => setFanContext(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 text-[14px] leading-relaxed resize-y focus:outline-none console-field"
                  style={FIELD}
                  placeholder="Paste universal audience insights here — social listening, research findings, cultural context…"
                />
                <div className="mt-3">
                  <SlabButton onClick={saveFanContext} disabled={fanContextSaving}>
                    {fanContextSaving ? "Saving…" : "Save"}
                  </SlabButton>
                </div>
              </div>
            </div>

            {/* Per-category audience context */}
            <div className="flex flex-col gap-4">
              {PILLAR_LIST.map((pillar) => (
                <div key={pillar.slug} style={CARD}>
                  <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: pillar.color }} />
                      <span className="font-bold text-[13px] tracking-[1.5px] uppercase" style={{ color: TYPE }}>{pillar.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {pillarFanSaved[pillar.slug] && <SavedStamp />}
                      <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!pillarFanContext[pillar.slug]?.trim())}>
                        {pillarFanContext[pillar.slug]?.trim() ? `${pillarFanContext[pillar.slug].length} chars` : "Empty"}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={pillarFanContext[pillar.slug] || ""}
                      onChange={(e) => setPillarFanContext((f) => ({ ...f, [pillar.slug]: e.target.value }))}
                      rows={6}
                      className="w-full px-4 py-3 text-[14px] leading-relaxed resize-y focus:outline-none console-field"
                      style={FIELD}
                      placeholder={`Audience insights specific to ${pillar.label}…`}
                    />
                    <div className="mt-3">
                      <SlabButton onClick={() => savePillarFanContext(pillar.slug)} disabled={pillarFanSaving[pillar.slug]}>
                        {pillarFanSaving[pillar.slug] ? "Saving…" : "Save"}
                      </SlabButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== STRATEGIC PLAYBOOK ===== */}
        {activeSection === "playbook" && (
          <div>
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              The strategic playbook is used by all coaches, the Scout, and the
              merge AI. Paste the campaign strategy, brand guardrails,
              partnership objectives, and any strategic context here.
            </p>

            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Strategic playbook</span>
                <div className="flex items-center gap-3">
                  {playbookSaved && <SavedStamp />}
                  <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!strategicPlaybook.trim())}>
                    {strategicPlaybook.trim()
                      ? `${strategicPlaybook.trim().split("\n").length} lines`
                      : "Empty"}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>
                  Campaign strategy &amp; brand guardrails
                </label>
                <p className="text-[12px] mb-3 leading-[1.6]" style={{ color: QUIET }}>
                  Paste the strategic brief, brand positioning, campaign objectives,
                  partnership goals, and any guardrails. Coaches reference this
                  to keep ideas strategically grounded.
                </p>
                <textarea
                  value={strategicPlaybook}
                  onChange={(e) => setStrategicPlaybook(e.target.value)}
                  placeholder={`Paste strategic context here. For example:\n\n## Campaign objective\n[The audience and outcome the engagement is driving toward]\n\n## Brand guardrails\n- [Brand voice and what to lead with]\n- [What to avoid]\n- [Tone preferences]\n\n## Partnership goals\n- [What the partnership unlocks]\n- [Ownable moments to create]\n\n## Key tensions to solve\n- [The strategic tension the work has to resolve]\n- [Balancing constraints]`}
                  rows={24}
                  className="w-full px-4 py-3 text-[13px] leading-[1.7] focus:outline-none console-field resize-y font-mono"
                  style={FIELD}
                />
                <div className="flex justify-end mt-3">
                  <SlabButton onClick={handleSavePlaybook} disabled={playbookSaving}>
                    {playbookSaving ? "Saving…" : "Save playbook"}
                  </SlabButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== WORKSHOP INSIGHTS ===== */}
        {activeSection === "insights" && (
          <div>
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              Paste workshop insights, stimuli, data, and provocations here. Coaches
              reference relevant insights when coaching teams on their ideas.
              Any format works — the coaches pull in what&apos;s relevant.
            </p>

            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Workshop insights</span>
                <div className="flex items-center gap-3">
                  {insightsSaved && <SavedStamp />}
                  <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={stamp(!!workshopInsights.trim())}>
                    {workshopInsights.trim()
                      ? `${workshopInsights.trim().split("\n").length} lines`
                      : "Empty"}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>
                  Workshop insights &amp; stimuli
                </label>
                <p className="text-[12px] mb-3 leading-[1.6]" style={{ color: QUIET }}>
                  Paste extracted text from the insights deck, cultural data,
                  consumer research, category trends — anything from earlier
                  sessions that coaches should be able to reference. Multiple
                  categories and unstructured content is fine.
                </p>
                <textarea
                  value={workshopInsights}
                  onChange={(e) => setWorkshopInsights(e.target.value)}
                  placeholder={`Paste insights here. For example:\n\n## Consumer trends\n- [Behavioural data point with source]\n- [Cultural shift relevant to the brief]\n\n## Cultural tensions\n- [The tension to lean into]\n- [Where the audience already is]\n\n## Category data\n- [Category-specific stat]\n- [Channel insight]\n\n## Partnership-specific\n- [Context the room needs about the partnership]`}
                  rows={24}
                  className="w-full px-4 py-3 text-[13px] leading-[1.7] focus:outline-none console-field resize-y font-mono"
                  style={FIELD}
                />
                <div className="flex justify-end mt-3">
                  <SlabButton onClick={handleSaveInsights} disabled={insightsSaving}>
                    {insightsSaving ? "Saving…" : "Save insights"}
                  </SlabButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== COACH PROMPTS ===== */}
        {activeSection === "coaches" && (
          <div className="space-y-8">
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              Edit coach system prompts to adjust their lens and voice.
              Overrides are stored in the database and take effect on the
              next conversation.
            </p>

            {COACHES.map((coach) => {
              const isModified = coachPrompts[coach.type] !== coach.systemPrompt;
              return (
                <div key={coach.type} style={CARD}>
                  <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                    <div className="flex items-center gap-3">
                      {/* The coach's hue is a SPINE here — a mark, not type.
                          darkMark because the Sharpener's hue IS ink, and ink
                          is not a hue on this ground: its spine measured
                          1.06:1 and simply was not on the screen. */}
                      <div className="w-[3px] h-[26px] shrink-0" style={{ background: darkMark(coach.color) }} />
                      <Image src={coach.avatar} alt={coach.name} width={28} height={28} className="w-[28px] h-[28px] rounded-full object-cover" />
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-[20px]" style={{ color: TYPE }}>
                          {coach.name}
                        </span>
                        <span className="text-[12px]" style={{ color: QUIET }}>
                          {coach.title}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {coachSaved[coach.type] && <SavedStamp />}
                      {isModified && (
                        <span className="font-mono text-[10px] tracking-[1px] uppercase px-2 py-1" style={{ border: `1px solid ${HAIRLINE}`, color: TYPE }}>
                          Modified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>
                      System prompt
                    </label>
                    <textarea
                      value={coachPrompts[coach.type] || ""}
                      onChange={(e) =>
                        setCoachPrompts((p) => ({
                          ...p,
                          [coach.type]: e.target.value,
                        }))
                      }
                      rows={16}
                      className="w-full px-4 py-3 text-[13px] leading-[1.7] focus:outline-none console-field resize-y font-mono"
                      style={FIELD}
                    />
                    <div className="flex items-center justify-between mt-3">
                      {isModified ? (
                        <button
                          onClick={() => handleResetCoachPrompt(coach.type)}
                          className="text-[12px] cursor-pointer underline underline-offset-4 transition-colors"
                          style={{ color: QUIET }}
                        >
                          Reset to default
                        </button>
                      ) : (
                        <span className="text-[12px]" style={{ color: FAINT }}>
                          Using default prompt
                        </span>
                      )}
                      <SlabButton onClick={() => handleSaveCoachPrompt(coach.type)} disabled={coachSaving[coach.type]}>
                        {coachSaving[coach.type] ? "Saving…" : "Save prompt"}
                      </SlabButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== TICKER MESSAGES ===== */}
        {activeSection === "ticker" && (
          <div>
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              Send custom messages to the wire — the ticker that runs under
              every surface. Active messages rotate alongside real-time
              workshop activity.
            </p>

            {/* Send new message */}
            <div className="p-6 mb-8" style={CARD}>
              <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-3" style={{ color: FAINT }}>
                New wire message
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={tickerMessage}
                  onChange={(e) => setTickerMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendTickerMessage();
                    }
                  }}
                  placeholder="e.g. “Fifteen minutes until presentations” or “Touffou just put three ideas on the Stage”"
                  className="flex-1 px-4 py-3 text-[14px] focus:outline-none console-field"
                  style={FIELD}
                />
                <SlabButton onClick={handleSendTickerMessage} disabled={!tickerMessage.trim() || tickerSending} className="shrink-0">
                  {tickerSending ? "Sending…" : "Send"}
                </SlabButton>
              </div>
            </div>

            {/* Breaking news */}
            <div className="p-6 mb-8" style={CARD}>
              <div className="flex items-center justify-between mb-4">
                <label className="font-bold text-[10px] tracking-[2px] uppercase" style={{ color: FAINT }}>
                  Breaking news on the wire
                </label>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px]" style={{ color: FAINT }}>
                    Auto every 15–20 min
                  </span>
                  <button
                    onClick={() => setBreakingAuto((v) => !v)}
                    className="font-bold text-[10px] tracking-[1.5px] uppercase px-4 py-1.5 cursor-pointer transition-all"
                    style={
                      breakingAuto
                        ? { background: PAPER, border: `1px solid ${PAPER}`, color: INK }
                        : { background: "transparent", border: `1px solid ${HAIRLINE}`, color: QUIET }
                    }
                  >
                    {breakingAuto ? "On" : "Off"}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <SlabButton onClick={() => sendBreakingNews(true)} disabled={breakingSending}>
                  {breakingSending ? "Generating…" : "Send now"}
                </SlabButton>
                {breakingLastSent && (
                  <span className="font-mono text-[11px] truncate flex-1" style={{ color: QUIET }}>
                    Last: &quot;{breakingLastSent}&quot;
                  </span>
                )}
              </div>
            </div>

            {/* Existing messages */}
            <div className="space-y-2">
              <span className="font-bold text-[10px] tracking-[2px] uppercase block mb-3" style={{ color: FAINT }}>
                Active messages ({tickerMessages.filter((m) => m.is_active).length})
              </span>
              {tickerMessages.length === 0 && (
                <p className="text-[13px] py-8 text-center" style={{ color: FAINT }}>
                  No custom wire messages yet. Send one above.
                </p>
              )}
              {tickerMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center gap-4 px-5 py-3"
                  style={{ border: `1px solid ${HAIRLINE}` }}
                >
                  {/* White, not red: the row already says paused three
                      ways — a hollow dot, the message on the quiet ramp,
                      and a button that reads Resume — so a column of red
                      dots repeats a signal the list is making anyway, and
                      red here is spoken for by the pre-flight marks, the
                      READY slab and the LIVE chip. */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={msg.is_active ? { background: TYPE } : { border: `1px solid ${HAIRLINE}` }}
                  />
                  <span className="flex-1 text-[13px]" style={{ color: msg.is_active ? TYPE : QUIET }}>
                    {msg.message}
                  </span>
                  <span className="font-mono text-[10px] shrink-0" style={{ color: FAINT }}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => handleToggleTickerMessage(msg.id, msg.is_active)}
                    className="font-bold text-[10px] tracking-[1px] uppercase px-2 py-1 cursor-pointer transition-colors"
                    style={{ border: `1px solid ${HAIRLINE}`, color: QUIET, background: "transparent" }}
                  >
                    {msg.is_active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDeleteTickerMessage(msg.id)}
                    className="text-[14px] leading-none cursor-pointer transition-colors"
                    style={{ color: QUIET }}
                    title="Delete this message"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== EXPORTS ===== */}
        {activeSection === "report" && (
          <div className="space-y-8">
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET, textWrap: "balance" } as React.CSSProperties}>
              Workshop deliverables. Generate the overnight synthesis, or download everything the room made as an editable PowerPoint deck for client handoff and planning.
            </p>

            {/* ===== WORKSHOP PPTX EXPORT ===== */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">Workshop &rarr; PowerPoint</span>
                {exportIdeaCount !== null && (
                  <span className="font-mono text-[11px]" style={{ color: QUIET }}>
                    {exportIdeaCount} {exportIdeaCount === 1 ? "idea" : "ideas"} (not set aside)
                  </span>
                )}
              </div>

              <div className="p-6">
                <p className="text-[12px] mb-4 leading-[1.6]" style={{ color: QUIET, textWrap: "balance" } as React.CSSProperties}>
                  A team-based deck: cover, workshop snapshot, then a section per team — the team&apos;s hue and creative platform, category overview tables, and one card per idea carrying its number, stamps, and framework fields. Tables are fully editable in PowerPoint.
                </p>

                {/* Team selection checkboxes */}
                <div className="mb-4">
                  <div className="font-bold text-[10px] tracking-[2px] uppercase mb-2" style={{ color: FAINT }}>
                    Teams to include
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {teams.map((team) => {
                      const isChecked = pptxSelectedTeams.has(team.id);
                      const hue = TEAM_COLORS[team.slug] || team.color;
                      return (
                        <label
                          key={team.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                          style={{
                            background: isChecked ? withAlpha(hue, 0.22) : "transparent",
                            border: `1px solid ${isChecked ? "rgba(255,255,255,0.45)" : HAIRLINE}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setPptxSelectedTeams((prev) => {
                                const next = new Set(prev);
                                if (next.has(team.id)) {
                                  next.delete(team.id);
                                } else {
                                  next.add(team.id);
                                }
                                return next;
                              });
                            }}
                            style={{ accentColor: TYPE }}
                          />
                          <span
                            className="font-bold text-[11px] tracking-[1px] uppercase"
                            style={{ color: isChecked ? TYPE : FAINT }}
                          >
                            {team.display_name || team.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-[12px] leading-[1.5]" style={{ color: QUIET }}>
                    Format: PPTX (16:9) · Editable tables · Print-ready idea cards
                  </div>
                  <div className="shrink-0 ml-6">
                    <SlabButton
                      onClick={handleExportPptx}
                      disabled={pptxExporting || exportIdeaCount === 0 || pptxSelectedTeams.size === 0}
                    >
                      {pptxExporting ? "Generating…" : "Download PPTX"}
                    </SlabButton>
                  </div>
                </div>

                {pptxExporting && (
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
                      style={{ borderColor: TYPE, borderTopColor: "transparent" }}
                    />
                    <span className="font-mono text-[12px]" style={{ color: QUIET }}>
                      Building the deck — a few seconds.
                    </span>
                  </div>
                )}

                {pptxError && (
                  <p className="mt-3 font-mono text-[12px] px-3 py-2" style={ALARM}>
                    Export failed: {pptxError}
                  </p>
                )}

                {exportIdeaCount === 0 && (
                  <p className="mt-3 font-mono text-[12px]" style={{ color: QUIET }}>
                    No ideas to export yet. Add and coach ideas first.
                  </p>
                )}
              </div>
            </div>

            {/* ===== OVERNIGHT SYNTHESIS ===== */}
            <div style={CARD}>
              <div className="flex items-center justify-between px-6 py-4" style={CARD_HEAD}>
                <span className="font-display text-[20px]">{PAGE_NAMES.report}</span>
                <div className="flex items-center gap-3">
                  {reportGeneratedAt && (
                    <span className="font-mono text-[11px]" style={{ color: QUIET }}>
                      Last generated {new Date(reportGeneratedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {reportGeneratedAt && (
                    <a
                      href="/report"
                      target="_blank"
                      className="font-bold text-[10px] tracking-[1px] uppercase px-2 py-1 transition-colors"
                      style={{ border: `1px solid ${HAIRLINE}`, color: TYPE }}
                    >
                      View ↗
                    </a>
                  )}
                </div>
              </div>

              <div className="p-6">
                <label className="font-bold text-[10px] tracking-[2px] uppercase block mb-2" style={{ color: FAINT }}>
                  Facilitator notes (optional)
                </label>
                <p className="text-[12px] mb-3 leading-[1.6]" style={{ color: QUIET }}>
                  Add your read of the room — what had the most energy, where teams struggled, any patterns you noticed. This gets injected into the synthesis so the AI has your perspective, not just the data.
                </p>
                <textarea
                  value={facilitatorNotes}
                  onChange={(e) => setFacilitatorNotes(e.target.value)}
                  placeholder="e.g. Hathaway's Overnight Agency generated the most energy in the room. Two teams independently landed on ritualised critique — worth surfacing. The Creative Culture ideas felt thinner across the board…"
                  rows={6}
                  className="w-full px-4 py-3 text-[14px] leading-[1.7] focus:outline-none console-field resize-y"
                  style={FIELD}
                />

                <div className="flex items-center justify-between mt-4">
                  <div className="text-[12px] leading-[1.5]" style={{ color: QUIET }}>
                    Sections: Workshop overview · Team summaries · Cross-team connections · Shared dependencies · Wave analysis · Best of the rest
                  </div>
                  <div className="shrink-0 ml-6">
                    <SlabButton onClick={handleGenerateReport} disabled={reportGenerating}>
                      {reportGenerating ? "Generating…" : reportGeneratedAt ? "Regenerate" : "Generate report"}
                    </SlabButton>
                  </div>
                </div>

                {reportGenerating && (
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
                      style={{ borderColor: TYPE, borderTopColor: "transparent" }}
                    />
                    <span className="font-mono text-[12px]" style={{ color: QUIET }}>
                      Pulling all workshop data and running synthesis — 30 to 60 seconds.
                    </span>
                  </div>
                )}

                {reportError && (
                  <p className="mt-3 font-mono text-[12px] px-3 py-2" style={ALARM}>
                    Generation failed — check the console and try again.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== QR CODES ===== */}
        {activeSection === "qrcodes" && (
          <div>
            <p className="text-[13px] -mt-4 mb-6" style={{ color: QUIET }}>
              Print or project these codes so participants can add ideas from
              their phones. Each code links to that team&apos;s quick-add page.
            </p>

            {/* Base URL editor */}
            <div className="mb-8 flex items-center gap-3">
              <label className="font-bold text-[10px] tracking-[2px] uppercase shrink-0" style={{ color: FAINT }}>
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="flex-1 px-4 py-2 text-[13px] focus:outline-none console-field font-mono"
                style={FIELD}
                placeholder="https://your-app.vercel.app"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {teams.map((team) => {
                const hue = TEAM_COLORS[team.slug] || team.color;
                const url = `${baseUrl}/${team.slug}/quick-add`;
                return (
                  <div key={team.id} className="flex flex-col items-center p-8" style={CARD}>
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-3 h-3 rounded-full" style={{ background: hue }} />
                      <span className="font-bold text-[14px] tracking-[1.5px] uppercase" style={{ color: TYPE }}>
                        {team.display_name || team.name}
                      </span>
                    </div>

                    <div className="p-4 mb-4" style={{ background: PAPER }}>
                      <QRCodeSVG
                        value={url}
                        size={180}
                        level="M"
                        fgColor={INK}
                        bgColor={PAPER}
                      />
                    </div>

                    <span className="font-mono text-[11px] text-center break-all" style={{ color: QUIET }}>
                      {url}
                    </span>
                  </div>
                );
              })}
            </div>

            {teams.length === 0 && (
              <div className="text-center py-20" style={{ color: QUIET }}>
                <p className="text-[16px]">
                  No teams found. Codes appear once teams are added.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
