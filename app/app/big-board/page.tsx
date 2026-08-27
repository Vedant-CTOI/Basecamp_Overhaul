"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Idea, Team } from "@/lib/types";
import { GROUPS, GROUP_LIST, PILLAR_LIST, BRAND, PAGE_NAMES } from "@/lib/config";
import DoveMark from "@/components/DoveMark";
import { EASE, DUR, STAGGER, BEAT } from "@/lib/motion";

const HAIRLINE = "1px solid rgba(255,255,255,0.18)";
const HAIRLINE_DIM = "1px solid rgba(255,255,255,0.10)";

// White or ink on a team-color ground, by luminance (cobalt/olive → white, rose → ink)
function chipText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 128 ? BRAND.colors.ink : "#fff";
}

// ── Pace calculation ──
type PaceStatus = "surging" | "rising" | "steady";

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

interface ActivityEvent {
  teamSlug: string;
  teamColor: string;
  teamLabel: string;
  text: string;
  ideaName: string;
  action: string;
  time: string;
  timestamp: number;
}

export default function BigBoardPage() {
  const router = useRouter();
  const [dataReady, setDataReady] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [coachingSessions, setCoachingSessions] = useState(0);
  const [showFloorMenu, setShowFloorMenu] = useState(false);
  const floorBtnRef = useRef<HTMLButtonElement>(null);
  const knownIdeaIds = useRef<Set<string>>(new Set());
  const knownStatuses = useRef<Record<string, string>>({});
  const initialized = useRef(false);

  // Fetch teams once on mount (they never change during a workshop)
  const teamsRef = useRef<Team[]>([]);
  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
    if (data) {
      teamsRef.current = data;
      setTeams(data);
    }
  }, []);

  // Coaching sessions — the exact number of coach exchanges on record.
  // A head count, so no note text crosses the wire. (This replaces an
  // estimated word total that multiplied the same count by 150 and added
  // a full ideas-text fetch to guess at the rest.)
  const fetchCoachingSessions = useCallback(async () => {
    const { count } = await supabase
      .from("training_notes")
      .select("id", { count: "exact", head: true });
    setCoachingSessions(count || 0);
  }, []);

  // Fetch ideas and detect activity changes
  const fetchIdeas = useCallback(async () => {
    const { data: ideasData } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
    if (!ideasData) return;

    setIdeas(ideasData);

    if (!initialized.current) {
      // Register ALL ideas as known so the realtime handler doesn't re-process them as "new"
      ideasData.forEach((idea: Idea) => {
        knownIdeaIds.current.add(idea.id);
        knownStatuses.current[idea.id] = idea.status;
      });

      // Build activity feed from the most recent 12
      const seedActivities: ActivityEvent[] = [];
      ideasData.slice(0, 12).forEach((idea: Idea) => {
        const team = teamsRef.current.find((t: Team) => t.id === idea.team_id);
        const group = team ? Object.values(GROUPS).find((g) => g.slug === team.slug) : null;

        const event: ActivityEvent = {
          teamSlug: team?.slug || "",
          teamColor: group?.color || "#555",
          teamLabel: group ? group.shortLabel : "??",
          text: "",
          ideaName: idea.name,
          action: "",
          time: getRelativeTime(idea.updated_at || idea.created_at),
          timestamp: new Date(idea.updated_at || idea.created_at).getTime(),
        };

        if (idea.source === "ai_scouted") {
          event.text = "Scouted an idea";
          event.action = "SCOUTED";
        } else if (idea.status === "coached" || idea.status === "starting_lineup") {
          event.text = "Coached";
          event.action = "COACHED";
        } else {
          event.text = "Submitted";
          event.action = "NEW IDEA";
        }
        seedActivities.push(event);
      });
      setActivities(seedActivities);
      initialized.current = true;
      return;
    }

    // Detect new ideas and status changes
    const newActivities: ActivityEvent[] = [];
    ideasData.forEach((idea: Idea) => {
      const team = teamsRef.current.find((t: Team) => t.id === idea.team_id);
      const group = team ? Object.values(GROUPS).find((g) => g.slug === team.slug) : null;

      if (!knownIdeaIds.current.has(idea.id)) {
        knownIdeaIds.current.add(idea.id);
        knownStatuses.current[idea.id] = idea.status;
        newActivities.push({
          teamSlug: team?.slug || "",
          teamColor: group?.color || "#555",
          teamLabel: group ? group.shortLabel : "??",
          text: idea.source === "ai_scouted" ? "Scouted an idea" : "Submitted",
          ideaName: idea.name,
          action: idea.source === "ai_scouted" ? "SCOUTED" : "NEW IDEA",
          time: "now",
          timestamp: Date.now(),
        });
      } else if (knownStatuses.current[idea.id] !== idea.status) {
        const oldStatus = knownStatuses.current[idea.id];
        knownStatuses.current[idea.id] = idea.status;

        if (idea.status === "coached" && oldStatus === "draft") {
          newActivities.push({
            teamSlug: team?.slug || "",
            teamColor: group?.color || "#555",
            teamLabel: group ? group.shortLabel : "??",
            text: "Coached",
            ideaName: idea.name,
            action: "COACHED",
            time: "now",
            timestamp: Date.now(),
          });
        }
      }
    });

    if (newActivities.length > 0) {
      setActivities((prev) => [...newActivities, ...prev].slice(0, 12));
    }
  }, []);

  // Initial load: teams + ideas + coaching sessions
  useEffect(() => {
    fetchTeams().then(() => fetchIdeas()).then(() => {
      fetchCoachingSessions();
      setDataReady(true);
    });
  }, [fetchTeams, fetchIdeas, fetchCoachingSessions]);

  // Refresh the coaching count every 30 seconds (not on every realtime event)
  useEffect(() => {
    const interval = setInterval(fetchCoachingSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchCoachingSessions]);

  // Debounced version for realtime events (1s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchIdeas = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return () => { clearTimeout(timer); timer = setTimeout(() => fetchIdeas(), 1000); };
  }, [fetchIdeas]);

  // Realtime subscription — only refetch ideas, not teams or training_notes
  useEffect(() => {
    const channel = supabase
      .channel("big-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => debouncedFetchIdeas())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [debouncedFetchIdeas]);

  // ── Computed stats ──
  const totalIdeas = ideas.length;
  const coachedIdeas = ideas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length;
  const scoutKeptIdeas = ideas.filter((i) => i.source === "ai_scouted").length;

  // ── Per-team stats ──
  function getTeamStats(teamId: string) {
    const teamIdeas = ideas.filter((i) => i.team_id === teamId);
    return {
      total: teamIdeas.length,
      coached: teamIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length,
      kept: teamIdeas.filter((i) => i.source === "ai_scouted").length,
    };
  }

  // ── Pace per team (based on recent ideas in last 10 min) ──
  function getTeamPace(): Record<string, PaceStatus> {
    const now = Date.now();
    const tenMinAgo = now - 10 * 60 * 1000;
    const recentByTeam: Record<string, number> = {};

    ideas.forEach((idea) => {
      const ts = new Date(idea.updated_at || idea.created_at).getTime();
      if (ts > tenMinAgo && idea.team_id) {
        const team = teams.find((t) => t.id === idea.team_id);
        if (team) {
          recentByTeam[team.slug] = (recentByTeam[team.slug] || 0) + 1;
        }
      }
    });

    const result: Record<string, PaceStatus> = {};
    Object.values(GROUPS).forEach((g) => {
      const count = recentByTeam[g.slug] || 0;
      if (count >= 3) result[g.slug] = "surging";
      else if (count >= 2) result[g.slug] = "rising";
      else result[g.slug] = "steady";
    });

    return result;
  }

  const paceMap = getTeamPace();

  // ── The teams, in configured order ──
  // The Newsroom tracks the room; it does not score teams against one
  // another. Rows stay in GROUP_LIST order whatever the totals do, so a
  // number that moves never moves a team, and a missing team record still
  // holds its own place.
  const teamRows = GROUP_LIST.map((group) => {
    const team = teams.find((t) => t.slug === group.slug);
    const stats = team ? getTeamStats(team.id) : { total: 0, coached: 0, kept: 0 };
    return { group, team, stats };
  });

  // ── Category breakdown ──
  function getPillarStats() {
    return PILLAR_LIST.map((pillar) => {
      const pillarIdeas = ideas.filter((i) => i.category === pillar.slug);
      const byTeam: { teamSlug: string; color: string; count: number }[] = [];

      Object.values(GROUPS).forEach((group) => {
        const team = teams.find((t) => t.slug === group.slug);
        if (!team) return;
        const count = pillarIdeas.filter((i) => i.team_id === team.id).length;
        if (count > 0) {
          byTeam.push({ teamSlug: group.slug, color: group.color, count });
        }
      });

      return {
        slug: pillar.slug,
        label: pillar.label,
        color: pillar.color,
        total: pillarIdeas.length,
        byTeam,
      };
    });
  }

  const pillarStats = getPillarStats();

  if (!dataReady) {
    return <div className="relative min-h-screen" style={{ background: BRAND.colors.surface0 }} />;
  }

  return (
    <div className="overhaul-page room-scale min-h-screen relative" style={{ background: BRAND.colors.surface0, color: "#2C2419" }}>
      {/* ── Sticky Header — beat 1: the structure arrives ── */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DUR.beat, delay: BEAT.structure, ease: EASE }}
        className="flex items-center justify-between px-12 py-4 sticky top-0 z-[100]"
        style={{ background: BRAND.colors.surface0, borderBottom: HAIRLINE }}
      >
        <div className="flex items-center gap-4">
          <img src="/logos/dove-logo-ink.svg" alt={BRAND.subtitle} className="h-[22px] cursor-pointer" onClick={() => router.push("/")} />
          <div className="w-px h-6" style={{ background: "rgba(107,93,74,0.25)" }} />
          <span
            className="font-display text-[28px] text-[#2C2419] cursor-pointer transition-opacity hover:opacity-70"
            onClick={() => router.push("/")}
          >
            {PAGE_NAMES.bigBoard}
          </span>
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: BRAND.colors.surface2 }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: BRAND.colors.primary }} />
            <span className="text-[11px] font-bold tracking-[2px] text-[#2C2419]">LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/")}
            className="dove-nav dove-nav-dark"
          >
            Home
          </button>
          <button
            ref={floorBtnRef}
            onClick={() => setShowFloorMenu((v) => !v)}
            className="dove-nav dove-nav-dark"
            style={{ color: showFloorMenu ? "#fff" : "#6B5D4A" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { if (!showFloorMenu) e.currentTarget.style.color = "#6B5D4A"; }}
          >
            {PAGE_NAMES.teamBoard} ▾
          </button>
          <button
            onClick={() => router.push("/center-court")}
            className="dove-nav dove-nav-dark"
          >
            {PAGE_NAMES.centerCourt}
          </button>
        </div>
      </motion.header>

      <div className="horizon-glow max-w-[1300px] mx-auto px-10 pt-8 pb-24">

        {/* ── Broadsheet numerals — beat 2: the marquee lands ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.beat, delay: BEAT.hero, ease: EASE }}
          className="flex mb-10"
          style={{ borderTop: HAIRLINE, borderBottom: HAIRLINE }}
        >
          {[
            { value: totalIdeas, label: "Ideas on the board" },
            { value: coachedIdeas, label: "Ideas coached" },
            { value: scoutKeptIdeas, label: "Scouted" },
            { value: coachingSessions, label: "Coaching sessions" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              data-qa="marquee-stat"
              data-label={stat.label}
              data-value={stat.value}
              className="flex-1 px-8 py-7"
              style={{ borderLeft: i > 0 ? HAIRLINE : "none", minWidth: 0 }}
            >
              <div className="font-display tabular text-[84px] leading-none text-[#2C2419]">
                {stat.value}
              </div>
              <div className="text-[13px] font-bold tracking-[3px] uppercase mt-3 whitespace-nowrap" style={{ color: "#6B5D4A" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── The teams — beat 3: the working surface settles ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.beat, delay: BEAT.content, ease: EASE }}
          className="mb-10"
        >
          {/* Header */}
          <div className="flex items-center pb-3">
            <div className="w-[6px] shrink-0" />
            <div className="w-[336px] shrink-0 text-[13px] font-bold tracking-[3px] uppercase px-7" style={{ color: "#6B5D4A" }}>
              Team
            </div>
            <div className="flex-1 text-center text-[13px] font-bold tracking-[3px] uppercase" style={{ color: "#6B5D4A" }}>
              Ideas
            </div>
            <div className="flex-1 text-center text-[13px] font-bold tracking-[3px] uppercase" style={{ color: "#6B5D4A" }}>
              Coached
            </div>
            <div className="flex-1 text-center text-[13px] font-bold tracking-[3px] uppercase" style={{ color: "#6B5D4A" }}>
              Scouted
            </div>
            <div className="w-[160px] text-center text-[13px] font-bold tracking-[3px] uppercase" style={{ color: "#6B5D4A" }}>
              Pace
            </div>
          </div>

          {/* Team rows — configured order, no rank, no leader treatment */}
          <div style={{ borderTop: HAIRLINE }}>
            {teamRows.map(({ group, team, stats }, index) => {
              const pace = paceMap[group.slug] || "steady";

              return (
                <motion.div
                  key={group.slug}
                  data-qa="team-row"
                  data-team={group.slug}
                  data-total={stats.total}
                  data-coached={stats.coached}
                  data-scouted={stats.kept}
                  data-pace={pace}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.15 + index * 0.05, ease: "easeOut" }}
                  onClick={() => router.push(`/${group.slug}`)}
                  className="flex items-stretch h-[96px] cursor-pointer"
                  style={{ borderBottom: HAIRLINE }}
                >
                  {/* Identity spine — hue, not rank */}
                  <div className="w-[6px] shrink-0" style={{ background: group.color }} />

                  {/* Team name + platform — the row's anchor */}
                  <div className="w-[336px] shrink-0 flex flex-col justify-center px-7">
                    <span className="text-[32px] font-bold text-[#2C2419] leading-tight whitespace-nowrap">
                      {team?.display_name || group.name}
                    </span>
                    {team?.creative_platform_name && (
                      <span className="text-[16px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {team.creative_platform_name}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-display tabular text-[52px] leading-none">{stats.total}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-display tabular text-[52px] leading-none">{stats.coached}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-display tabular text-[52px] leading-none">{stats.kept}</span>
                  </div>

                  {/* Pace */}
                  <div className="w-[160px] shrink-0 flex items-center justify-center">
                    {pace === "surging" && (
                      <span className="stamp" style={{ color: BRAND.colors.primary, fontSize: 13 }}>
                        Surging
                      </span>
                    )}
                    {pace === "rising" && (
                      <span className="stamp" style={{ color: "#2C2419", fontSize: 13 }}>
                        Rising
                      </span>
                    )}
                    {pace === "steady" && (
                      <span className="stamp" style={{ color: "#6B5D4A", fontSize: 13 }}>
                        Steady
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── By category — detail beat ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.beat, delay: BEAT.detail, ease: EASE }}
          className="mt-8"
        >
          <h3 className="text-[13px] font-bold tracking-[3px] uppercase mb-4" style={{ color: "#6B5D4A" }}>
            By category
          </h3>
          <div className="flex flex-col gap-3">
            {pillarStats.map((pillar) => (
              <div key={pillar.slug} className="flex items-center gap-4 h-7">
                <div className="w-[200px] shrink-0 flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold truncate" style={{ color: pillar.color }}>
                    {pillar.label}
                  </span>
                  <span className="font-display tabular text-[36px] leading-none text-[#2C2419]">
                    {pillar.total}
                  </span>
                </div>
                <div className="flex-1 h-full flex items-stretch">
                  <div
                    className="flex-1 flex overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {pillar.byTeam.map((seg) => (
                      <div
                        key={seg.teamSlug}
                        className="flex items-center justify-center tabular text-[16px] font-bold min-w-[28px]"
                        style={{
                          flex: seg.count,
                          background: seg.color,
                          color: chipText(seg.color),
                        }}
                      >
                        {seg.count}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── The wire — detail beat, one stagger behind ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.beat, delay: BEAT.detail + STAGGER, ease: EASE }}
          className="mt-10"
        >
          <h3 className="text-[13px] font-bold tracking-[3px] uppercase mb-3" style={{ color: "#6B5D4A" }}>
            The wire
          </h3>
          <div style={{ borderTop: HAIRLINE }}>
            {activities.map((activity, i) => (
              <div
                key={`${activity.timestamp}-${i}`}
                data-qa="wire-row"
                className="flex items-center gap-4 px-2 py-3"
                style={{ borderBottom: HAIRLINE_DIM }}
              >
                <span className="slug shrink-0 w-[64px]" style={{ color: "#6e6a6c" }}>
                  {activity.time}
                </span>
                <span
                  className="text-[11px] font-bold tracking-[1px] px-2 py-[3px] rounded-[2px] shrink-0 inline-flex items-center justify-center leading-none"
                  style={{ background: activity.teamColor, color: chipText(activity.teamColor) }}
                >
                  {activity.teamLabel}
                </span>
                <span className="text-[16px]" style={{ color: "rgba(44,36,25,0.75)" }}>
                  {activity.text} <strong style={{ color: "rgba(44,36,25,0.9)" }}>&ldquo;{activity.ideaName}&rdquo;</strong>
                </span>
                <span className="text-[11px] font-bold tracking-[2px] ml-auto shrink-0" style={{ color: "#6B5D4A" }}>
                  {activity.action}
                </span>
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{ borderBottom: HAIRLINE_DIM }}>
                <div className="flex flex-col items-center gap-3 py-10">
                  <DoveMark size={52} />
                  <div className="text-center">
                    <div className="font-display italic text-[20px] text-[#2C2419]/90">Quiet on the wire.</div>
                    <div className="mt-1 text-[13px]" style={{ color: "#6B5D4A" }}>
                      The moment a team files an idea, it crosses here — real thoughts only.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Floor dropdown ── */}
      <AnimatePresence>
        {showFloorMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100]"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setShowFloorMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-[101] overflow-hidden"
              style={{
                top: floorBtnRef.current ? floorBtnRef.current.getBoundingClientRect().bottom + 10 : 52,
                right: floorBtnRef.current ? window.innerWidth - floorBtnRef.current.getBoundingClientRect().right : 140,
                transformOrigin: "top right",
                background: BRAND.colors.surface2,
                border: HAIRLINE,
                borderRadius: 2,
                width: 260,
              }}
            >
              {Object.values(GROUPS).map((group, i) => {
                const team = teams.find((t) => t.slug === group.slug);
                return (
                  <motion.button
                    key={group.slug}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => { router.push(`/${group.slug}`); setShowFloorMenu(false); }}
                    className="w-full flex items-center gap-3 px-5 py-[16px] text-left cursor-pointer bg-transparent border-none relative overflow-hidden transition-colors duration-200 group"
                    style={{ borderBottom: i < Object.values(GROUPS).length - 1 ? HAIRLINE_DIM : "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,38,99,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ background: group.color }}
                    />
                    <span className="text-[13px] font-bold tracking-[1px] uppercase text-[#2C2419] opacity-90 group-hover:opacity-100 transition-opacity duration-200">
                      {team?.display_name || group.name}
                    </span>
                    <span className="ml-auto text-[11px] opacity-0 group-hover:opacity-40 transition-opacity duration-200 text-[#2C2419]">
                      →
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
