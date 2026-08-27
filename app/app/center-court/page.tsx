"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase, isShowcaseMode } from "@/lib/supabase";
import { write } from "@/lib/db";
import AmbientField from "@/components/AmbientField";
import { PILLAR_LIST, PILLARS, BRAND, PAGE_NAMES, GROUP_LIST, GROUPS, type PillarSlug } from "@/lib/config";
import DoveMark from "@/components/DoveMark";
import { EASE, DUR, BEAT } from "@/lib/motion";
import { ideaNumbers } from "@/lib/idea-number";
import { teamStageIdeas } from "@/lib/present-gate";
import { Idea } from "@/lib/types";
import { useCenterCourtData } from "./hooks/useCenterCourtData";
import PillarView from "./components/PillarView";
import LineupView from "./components/LineupView";
import FullLineupView from "./components/FullLineupView";
import ControlStrip from "./components/ControlStrip";
import ExpandedCard from "@/components/ExpandedCard";

export default function CenterCourtPage() {
  const router = useRouter();
  const data = useCenterCourtData();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openedIdea, setOpenedIdea] = useState<Idea | null>(null);
  const [combining, setCombining] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [interstitial, setInterstitial] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  // Always start at presenting view on mount — clears on first facilitator action
  const [localViewOverride, setLocalViewOverride] = useState<"pillar" | null>("pillar");

  // Clear override once the facilitator pushes any new state
  const prevStateRef = useRef(data.workshopState);
  useEffect(() => {
    if (data.workshopState !== prevStateRef.current) {
      prevStateRef.current = data.workshopState;
      setLocalViewOverride(null);
    }
  }, [data.workshopState]);

  // The pillar is the top-level unit; the team is the presenting turn within it
  const activePillar = data.activePillar || data.workshopState.pillar || PILLAR_LIST[0].slug;
  const activeTeam = data.activeTeam || GROUP_LIST[0]?.slug;
  const currentView = localViewOverride || data.workshopState.view || "pillar";

  // Ideas for the active pillar (across all teams)
  const pillarIdeas = useMemo(
    () => data.ideas.filter((i) => i.category === activePillar),
    [data.ideas, activePillar]
  );

  // Get current presenting team's group config for colors/names
  const activeTeamGroup = Object.values(GROUPS).find((g) => g.slug === activeTeam);

  // The control strip mirrors the screen: on cold load the local override shows the
  // presenting wall, so the strip must offer the presenting actions — never a dead
  // "Ready" strip over a live view. Only applies while the pushed state is idle.
  const effectiveWorkshopState = useMemo(() => {
    if (localViewOverride && !data.workshopState.view) {
      return {
        pillar: activePillar,
        team: activeTeam,
        view: "pillar" as const,
        voting_open: false,
        show_counts: false,
      };
    }
    return data.workshopState;
  }, [localViewOverride, data.workshopState, activePillar, activeTeam]);

  // Ordered idea list for navigation — depends on the current view
  const orderedIdeas = useMemo(() => {
    if (currentView === "full_lineup") {
      // Full shortlist: by team → pillar → newest first (matches FullLineupView columns)
      const lineup = data.ideas.filter((i) => i.status === "starting_lineup");
      const ordered: Idea[] = [];
      for (const group of GROUP_LIST) {
        const team = data.teams.find((t) => t.slug === group.slug);
        if (!team) continue;
        for (const pillar of PILLAR_LIST) {
          const ideasOfPillar = lineup
            .filter((i) => i.team_id === team.id && i.category === pillar.slug)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          ordered.push(...ideasOfPillar);
        }
      }
      return ordered;
    }

    if (currentView === "lineup") {
      // Pillar shortlist: by team → newest first (matches LineupView render order)
      const lineup = pillarIdeas.filter((i) => i.status === "starting_lineup");
      const ordered: Idea[] = [];
      for (const group of GROUP_LIST) {
        const team = data.teams.find((t) => t.slug === group.slug);
        if (!team) continue;
        ordered.push(
          ...lineup
            .filter((i) => i.team_id === team.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        );
      }
      return ordered;
    }

    // Pillar presenting view: grouped by team (GROUPS order), newest
    // first within each — and passed through the SAME present gate the
    // Stage wall, the phone ballot and the returns apply (a team shows
    // what it brought to the Stage, falling back to its whole board when
    // it selected nothing). One implementation, lib/present-gate: U4's
    // previous/next walks exactly the collection the room was shown.
    const activeIdeas = pillarIdeas.filter((i) => i.status !== "bench");
    const ordered: Idea[] = [];
    const seatedTeamIds = new Set<string>();
    GROUP_LIST.forEach((g) => {
      const team = data.teams.find((t) => t.slug === g.slug);
      if (!team) return;
      seatedTeamIds.add(team.id);
      const teamIdeas = activeIdeas
        .filter((i) => i.team_id === team.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      ordered.push(...teamStageIdeas(teamIdeas).ideas);
    });
    // Any idea belonging to no configured team still has to be reachable
    activeIdeas
      .filter((i) => !i.team_id || !seatedTeamIds.has(i.team_id))
      .forEach((i) => ordered.push(i));
    return ordered;
  }, [currentView, pillarIdeas, data.ideas, data.teams]);

  // THE STABLE № — one derivation over every idea the Stage holds, so
  // the number the focus state reports is the number the card wore on
  // the wall, on the Board, and in the returns (lib/idea-number).
  const stableNo = useMemo(() => ideaNumbers(data.ideas), [data.ideas]);

  // Navigate between ideas while ExpandedCard is open
  const navigateIdea = useCallback((direction: "prev" | "next") => {
    if (!openedIdea || orderedIdeas.length === 0) return;
    const currentIndex = orderedIdeas.findIndex((i) => i.id === openedIdea.id);
    if (currentIndex === -1) return;
    const nextIndex = direction === "next"
      ? (currentIndex + 1) % orderedIdeas.length
      : (currentIndex - 1 + orderedIdeas.length) % orderedIdeas.length;
    setOpenedIdea(orderedIdeas[nextIndex]);
  }, [openedIdea, orderedIdeas]);

  // Arrow key navigation when ExpandedCard is open
  useEffect(() => {
    if (!openedIdea) return;
    const handler = (e: KeyboardEvent) => {
      // Keys pressed inside a field belong to the field: arrows move the
      // caret, and Esc releases focus (a second press closes the card) —
      // never a silent navigation that discards in-progress edits.
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        if (editable) { t.blur(); return; }
        setOpenedIdea(null);
        return;
      }
      if (editable) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateIdea("prev"); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigateIdea("next"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openedIdea, navigateIdea]);

  // Keep the OPEN card in sync with realtime — same contract as the team
  // board: a develop landing, a frame choice, or an edit made in another
  // tab reaches the card the room is looking at. Always a shallow clone —
  // the showcase shim mutates rows in place, so the held reference can
  // never detect the change on its own.
  useEffect(() => {
    setOpenedIdea((prev) => {
      if (!prev) return prev;
      const fresh = data.ideas.find((i) => i.id === prev.id);
      return fresh ? { ...fresh } : prev;
    });
  }, [data.ideas]);

  // Turn + pillar positions
  const currentTeamIndex = GROUP_LIST.findIndex((g) => g.slug === activeTeam);
  const currentPillarIndex = PILLAR_LIST.findIndex((p) => p.slug === activePillar);
  const isLastPillar = currentPillarIndex === PILLAR_LIST.length - 1;

  // ── Interstitial helper ──
  const showInterstitial = (message: string) => {
    setInterstitial(message);
    setTimeout(() => setInterstitial(null), 2000);
  };

  // ── Pillar switching (top-level tabs) ──
  const switchPillar = useCallback((pillarSlug: PillarSlug) => {
    data.setActivePillar(pillarSlug);
    data.setActiveTeam(GROUP_LIST[0].slug);
    setSelectedIds(new Set());
    data.setPhase({
      pillar: pillarSlug,
      team: GROUP_LIST[0].slug,
      view: "pillar",
      voting_open: false,
      show_counts: false,
    });
  }, [data]);

  // ── Turn rotation — spotlight the presenting team within the pillar ──
  const spotlightTeam = useCallback((teamSlug: string) => {
    data.setActiveTeam(teamSlug);
    data.setPhase({
      pillar: activePillar,
      team: teamSlug,
      view: "pillar",
      voting_open: false,
      show_counts: false,
    });
  }, [data, activePillar]);

  const nextTeam = useCallback(() => {
    const nextIndex = (currentTeamIndex + 1) % GROUP_LIST.length;
    spotlightTeam(GROUP_LIST[nextIndex].slug);
  }, [currentTeamIndex, spotlightTeam]);

  // ── Card selection ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Phase transitions ──
  const openVoting = useCallback(async () => {
    setSelectedIds(new Set());
    const pillarLabel = PILLARS[activePillar]?.label || "Category";
    showInterstitial(`The ballot is open — ${pillarLabel}`);
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "pillar",
      voting_open: true,
      show_counts: false,
    });
  }, [activePillar, activeTeam, data]);

  const closeVoting = useCallback(async () => {
    showInterstitial("The ballot is closed.");
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "pillar",
      voting_open: false,
      show_counts: false,
    });
  }, [activePillar, activeTeam, data]);

  const showCounts = useCallback(async () => {
    setSelectedIds(new Set());
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "pillar",
      voting_open: false,
      show_counts: true,
    });
  }, [activePillar, activeTeam, data]);

  const advanceToLineup = useCallback(async () => {
    setSelectedIds(new Set());
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "lineup",
      voting_open: false,
      show_counts: false,
    });
  }, [activePillar, activeTeam, data]);

  const backToPresenting = useCallback(async () => {
    setSelectedIds(new Set());
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "pillar",
      voting_open: false,
      show_counts: false,
    });
  }, [activePillar, activeTeam, data]);

  // ── Next category — the pillar-to-pillar advance ──
  const nextPillar = useCallback(async () => {
    const nextIndex = Math.min(currentPillarIndex + 1, PILLAR_LIST.length - 1);
    const next = PILLAR_LIST[nextIndex];
    showInterstitial(`Now presenting — ${next.label}`);
    data.setActivePillar(next.slug);
    data.setActiveTeam(GROUP_LIST[0].slug);
    setSelectedIds(new Set());
    await data.setPhase({
      pillar: next.slug,
      team: GROUP_LIST[0].slug,
      view: "pillar",
      voting_open: false,
      show_counts: false,
    });
  }, [currentPillarIndex, data]);

  const showFullLineup = useCallback(async () => {
    await data.setPhase({
      pillar: activePillar,
      team: activeTeam,
      view: "full_lineup",
      voting_open: false,
      show_counts: false,
    });
  }, [data, activePillar, activeTeam]);

  // ── Bench/Combine ──
  const benchSelected = useCallback(async () => {
    for (const id of selectedIds) {
      await data.benchIdea(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, data]);

  const combineSelected = useCallback(async () => {
    const selectedIdeas = pillarIdeas.filter((i) => selectedIds.has(i.id));
    if (selectedIdeas.length < 2) return;

    // All selected ideas must share the same category
    const categories = new Set(selectedIdeas.map((i) => i.category));
    if (categories.size > 1) {
      setToast("Select ideas from the same category to combine");
      setSelectedIds(new Set());
      return;
    }
    const category = selectedIdeas[0].category;

    setCombining(true);
    try {
      // The combined idea lives with the first selected idea's team
      const assignedTeamId = selectedIdeas[0].team_id
        || data.teams.find((t) => t.slug === activeTeam)?.id
        || null;

      if (isShowcaseMode) {
        // No AI backend — merge through the showcase engine with a plain synthesis
        const merged = await write<string>("rpc:merge_ideas", supabase.rpc("merge_ideas", {
          p_original_ids: Array.from(selectedIds),
          p_new_name: selectedIdeas.map((i) => i.name).join(" × "),
          p_new_description: selectedIdeas.map((i) => i.description).filter(Boolean).join(" "),
          p_category: category,
          p_team_id: assignedTeamId,
        }));
        if (!merged.ok) {
          // The selection stays selected — the operator can try the
          // same combine again rather than rebuilding it.
          setToast("Combine failed — nothing was merged");
          return;
        }
        const mergedId = merged.data;
        setSelectedIds(new Set());
        setNewlyCreatedId(mergedId || null);
        data.fetchIdeas();
        if (mergedId) setTimeout(() => setNewlyCreatedId(null), 5000);
        return;
      }

      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea_ids: Array.from(selectedIds),
          category,
          team_id: assignedTeamId,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setSelectedIds(new Set());
        setNewlyCreatedId(result.id || null);
        data.fetchIdeas();
        // Clear glow after 5 seconds
        if (result.id) setTimeout(() => setNewlyCreatedId(null), 5000);
      }
    } catch (err) {
      console.error("Combine failed:", err);
    } finally {
      setCombining(false);
    }
  }, [selectedIds, pillarIdeas, activeTeam, data]);

  const linkSelected = useCallback(async () => {
    if (selectedIds.size < 2) return;
    // If any selected idea already belongs to a link group, use that group
    // If multiple groups exist, merge everything into the first one found
    const selectedIdeas = data.ideas.filter((i) => selectedIds.has(i.id));
    const existingGroups = [...new Set(selectedIdeas.map((i) => i.link_group).filter(Boolean))] as string[];
    const linkGroup = existingGroups[0] || crypto.randomUUID();

    // Update all selected ideas to this group. A link that only half
    // happened is a group the wall would draw wrong, so the run stops
    // at the first refusal and says how far it got.
    let linked = 0;
    for (const id of selectedIds) {
      const r = await write("ideas.update:link", supabase.from("ideas").update({ link_group: linkGroup, updated_at: new Date().toISOString() }).eq("id", id));
      if (!r.ok) {
        data.fetchIdeas();
        setToast(`Link failed after ${linked} of ${selectedIds.size}`);
        return;
      }
      linked += 1;
    }
    // If merging multiple groups, update all ideas from the other groups too
    for (const oldGroup of existingGroups.slice(1)) {
      const r = await write("ideas.update:link-merge", supabase.from("ideas").update({ link_group: linkGroup, updated_at: new Date().toISOString() }).eq("link_group", oldGroup));
      if (!r.ok) {
        data.fetchIdeas();
        setToast("Link failed — some ideas kept their old group");
        return;
      }
    }
    setSelectedIds(new Set());
    data.fetchIdeas();
    setToast(`${selectedIds.size} ideas linked`);
  }, [selectedIds, data]);

  return (
    // The Stage's working states are working surfaces — they carry NO halftone
    // (Round 6 precedent: the Board's root lost its screen). The dim on
    // non-spotlit teams makes cards translucent, so ANY ground texture would
    // read through them; the texture lives only on the idle theater state.
    <div className="overhaul-page h-screen flex flex-col relative" style={{ background: BRAND.colors.surface0 }}>
      {/* ── Interstitial overlay — full-screen typographic moment ── */}
      <AnimatePresence>
        {interstitial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="horizon-glow fixed inset-0 z-[500] flex items-center justify-center"
            // horizon-glow's un-layered position: relative outranks Tailwind's .fixed — pin it inline
            style={{ background: "#F3EEE7", position: "fixed" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-center px-16"
            >
              <h1 className="font-display text-[88px] leading-[1.05] text-[#2C2419] text-balance">
                {interstitial}
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header — beat 1: the structure arrives (house grammar) ── */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DUR.beat, delay: BEAT.structure, ease: EASE }}
        className="flex items-center justify-between px-12 py-4 shrink-0"
        style={{
          background: "#F3EEE7",
          borderBottom: "1px solid rgba(107,93,74,0.22)",
        }}
      >
        <div className="flex items-center gap-4">
          <img src="/logos/dove-logo-ink.svg" alt="Dove" className="h-[34px] cursor-pointer" onClick={() => router.push("/")} />
          <div className="w-px h-6" style={{ background: "rgba(107,93,74,0.22)" }} />
          <span
            className="font-display text-[28px] text-[#2C2419] cursor-pointer transition-opacity hover:opacity-70"
            onClick={() => router.push("/")}
          >
            {PAGE_NAMES.centerCourt}
          </span>
          {/* The engagement's living signature, small and steady at the
              top of the room's main screen. */}
          <DoveMark size={34} glow={false} className="ml-2 opacity-80" />
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/")}
            className="dove-nav"
          >
            Home
          </button>
          <button
            onClick={() => router.push("/big-board")}
            className="dove-nav"
          >
            {PAGE_NAMES.bigBoard}
          </button>
        </div>
      </motion.header>

      {/* ── Connection / phase error banners ── */}
      <AnimatePresence>
        {!data.realtimeConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 px-8 py-3 text-center font-sans text-[16px] font-medium"
            style={{ background: "#262529", color: "#2C2419" }}
          >
            Live updates paused — data may be stale. Reconnecting...
          </motion.div>
        )}
        {data.phaseError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 px-8 py-3 text-center font-sans text-[16px] font-medium"
            style={{ background: BRAND.colors.primary, color: "#2C2419" }}
          >
            {data.phaseError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category tabs row — the pillar is the thing right now (Kruger bar) ── */}
      <div
        className="flex items-center px-8 py-2 shrink-0 gap-1"
        style={{ borderBottom: "1px solid rgba(107,93,74,0.22)" }}
      >
        {PILLAR_LIST.map((p) => {
          const isActive = activePillar === p.slug && currentView !== "full_lineup";
          return (
            <button
              key={p.slug}
              onClick={() => switchPillar(p.slug)}
              className="px-6 py-2.5 font-bold text-[16px] tracking-[1.5px] uppercase cursor-pointer border-none transition-all duration-200"
              // Navigation never carries the Kruger — active nav chrome is white; red marks the room's current object
              style={{
                background: "transparent",
                color: isActive ? "#2C2419" : "#8A7A62",
                boxShadow: isActive ? "inset 0 -3px 0 #fff" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(0,38,99,0.05)";
                  e.currentTarget.style.color = "#2C2419";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#8A7A62";
                }
              }}
            >
              {p.label}
            </button>
          );
        })}

        <button
          onClick={showFullLineup}
          className="px-5 py-2.5 font-bold text-[16px] tracking-[1.5px] uppercase cursor-pointer border-none transition-all duration-200 ml-auto"
          style={{
            background: "transparent",
            color: currentView === "full_lineup" ? "#2C2419" : "#8A7A62",
            boxShadow: currentView === "full_lineup" ? "inset 0 -3px 0 #fff" : "none",
          }}
          onMouseEnter={(e) => {
            if (currentView !== "full_lineup") {
              e.currentTarget.style.background = "rgba(0,38,99,0.05)";
              e.currentTarget.style.color = "#2C2419";
            }
          }}
          onMouseLeave={(e) => {
            if (currentView !== "full_lineup") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#8A7A62";
            }
          }}
        >
          ★ THE FULL SHORTLIST
        </button>
      </div>

      {/* ── Main content ── */}
      <div className={`flex-1 min-h-0 flex flex-col ${currentView ? "horizon-glow" : ""}`}>
        {currentView === "pillar" && (
          <PillarView
            pillarSlug={activePillar}
            ideas={pillarIdeas}
            teams={data.teams}
            spotlightTeam={activeTeam}
            onSpotlightTeam={spotlightTeam}
            workshopState={data.workshopState}
            voteCounts={data.voteCounts}
            totalVoters={data.totalVoters}
            totalParticipants={data.totalParticipants}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onBench={data.benchIdea}
            onUnbench={data.unbenchIdea}
            onPromote={data.promoteIdea}
            onDemote={data.demoteIdea}
            onSetWave={data.setIdeaWave}
            onOpenIdea={(idea) => setOpenedIdea(idea)}
            onAddIdea={async (teamSlug, name, description) => {
              const team = data.teams.find((t) => t.slug === teamSlug);
              if (!team) return;
              const r = await write("ideas.insert:stage-add", supabase.from("ideas").insert({
                team_id: team.id,
                category: activePillar,
                name,
                description: description || null,
                source: "team",
                status: "draft",
              }));
              if (!r.ok) {
                setToast("Not added — the wall did not take it");
                return;
              }
              data.fetchIdeas();
            }}
            combining={combining}
            newlyCreatedId={newlyCreatedId}
          />
        )}

        {currentView === "lineup" && (
          <LineupView
            pillarSlug={activePillar}
            ideas={pillarIdeas}
            teams={data.teams}
            onDemote={data.demoteIdea}
            onSetWave={data.setIdeaWave}
            onOpen={(idea) => setOpenedIdea(idea)}
          />
        )}

        {currentView === "full_lineup" && (
          <FullLineupView
            ideas={data.ideas}
            teams={data.teams}
            onSetWave={data.setIdeaWave}
            onOpen={(idea) => setOpenedIdea(idea)}
          />
        )}

        {!currentView && (
          <div className="halftone-dark flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            <AmbientField preset="ember" opacity={0.4} className="z-0" />
            <div
              className="absolute inset-0 z-[1] pointer-events-none"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(10,10,12,0.75), rgba(10,10,12,0.94))" }}
            />
            <h1 className="font-display text-[96px] leading-none text-[#2C2419] relative z-10">
              {PAGE_NAMES.centerCourt}
            </h1>
            <p className="text-[28px] mt-4 relative z-10" style={{ color: "#8A7A62" }}>
              Ready when you are.
            </p>
            <div className="tartan-band absolute bottom-0 left-0 right-0 h-[8px] z-[2]" style={{ opacity: 0.45 }} />
          </div>
        )}
      </div>

      {/* ── Expanded Idea Modal ── */}
      <AnimatePresence>
        {openedIdea && (() => {
          const team = data.teams.find((t) => t.id === openedIdea.team_id);
          const group = team ? Object.values(GROUPS).find((g) => g.slug === team.slug) : null;
          return (
            <>
              <ExpandedCard
                idea={openedIdea}
                teamColor={group?.color || BRAND.colors.primary}
                teamSlug={team?.slug}
                teamName={team?.display_name || team?.name}
                platformName={team?.creative_platform_name || undefined}
                trainingNotes={[]}
                allIdeas={data.ideas}
                onClose={() => { setOpenedIdea(null); data.fetchIdeas(); }}
                onUpdate={() => data.fetchIdeas()}
                presentationMode
                teams={data.teams.map((t) => ({ id: t.id, name: t.display_name || t.name, slug: t.slug, color: Object.values(GROUPS).find((g) => g.slug === t.slug)?.color || BRAND.colors.primary }))}
                onReassign={(newTeamId) => { data.reassignIdea(openedIdea.id, newTeamId); setOpenedIdea(null); }}
                onPromote={() => { data.promoteIdea(openedIdea.id); }}
                onBench={() => { data.benchIdea(openedIdea.id); }}
                onDemote={() => { data.demoteIdea(openedIdea.id); }}
                onNavigateToIdea={(idea) => setOpenedIdea(idea)}
                // The idea's own stable № — the number it wears on the
                // wall behind this card and on its team's Board.
                frameNo={stableNo.get(openedIdea.id)}
                // Qualified only where the collection behind the card
                // mixes teams: the shortlist views. On the presenting
                // wall and the returns the Kruger above already says
                // whose idea this is, so the number stands bare.
                teamTag={
                  currentView === "full_lineup" || currentView === "lineup"
                    ? group?.name
                    : undefined
                }
              />
              {/* Prev/Next navigation arrows */}
              {orderedIdeas.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateIdea("prev"); }}
                    className="fixed left-6 top-1/2 -translate-y-1/2 z-[10001] w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border-none transition-all"
                    style={{ background: "rgba(0,38,99,0.06)", color: "#2C2419", fontSize: 24 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,38,99,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,38,99,0.06)"; }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateIdea("next"); }}
                    className="fixed right-6 top-1/2 -translate-y-1/2 z-[10001] w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border-none transition-all"
                    style={{ background: "rgba(0,38,99,0.06)", color: "#2C2419", fontSize: 24 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,38,99,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,38,99,0.06)"; }}
                  >
                    ›
                  </button>
                  {openedIdea?.status !== "bench" && currentView !== "full_lineup" && currentView !== "lineup" && (() => {
                    const ideaTeam = data.teams.find((t) => t.id === openedIdea.team_id);
                    const ideaGroup = ideaTeam ? Object.values(GROUPS).find((g) => g.slug === ideaTeam.slug) : null;
                    const teamIdeasInOrder = orderedIdeas.filter((i) => i.team_id === openedIdea.team_id);
                    const teamIndex = teamIdeasInOrder.findIndex((i) => i.id === openedIdea.id);
                    return (
                      // THE ONE KRUGER. The Stage's overview deliberately
                      // carries none — the viewport itself marks the
                      // presenting team — so the single red bar belongs
                      // here, on the idea the room has actually opened:
                      // the Kruger marks the current OBJECT, never
                      // navigation and never a team (Round 7 item 1, and
                      // the U1 verdict carried into this unit). It rides
                      // ABOVE the open card: at 720p the card fills the
                      // viewport to within 40px, so a taller chip sat on
                      // the card's own top edge.
                      <div
                        data-qa="focus-kruger"
                        className="kruger-bar fixed top-2 left-1/2 -translate-x-1/2 z-[10001] text-[14px] tracking-[2px] uppercase flex items-center gap-3 px-5 py-1.5"
                      >
                        {ideaGroup && <span>{ideaGroup.shortLabel}</span>}
                        <span className="tabular" style={{ color: "rgba(44,36,25,0.8)" }}>
                          {teamIndex + 1}/{teamIdeasInOrder.length}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg text-[15px]"
            style={{ background: "#262529", border: "1px solid rgba(107,93,74,0.22)", color: "#2C2419" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Control Strip — the shell's fixed foot; it never scrolls ── */}
      <div data-qa="control-strip" className="shrink-0">
      <ControlStrip
        workshopState={effectiveWorkshopState}
        pillarLabel={PILLARS[activePillar]?.label || "Category"}
        teamName={activeTeamGroup?.name || "Team"}
        teamColor={activeTeamGroup?.color || "#555"}
        votingEnabled={data.votingEnabled}
        selectedCount={selectedIds.size}
        totalVoters={data.totalVoters}
        totalParticipants={data.totalParticipants}
        onOpenVoting={openVoting}
        onCloseVoting={closeVoting}
        onShowCounts={showCounts}
        onAdvanceToLineup={advanceToLineup}
        onBackToPresenting={backToPresenting}
        onNextTeam={nextTeam}
        onNextPillar={nextPillar}
        onShowFullLineup={showFullLineup}
        onBenchSelected={benchSelected}
        onCombineSelected={combineSelected}
        onLinkSelected={linkSelected}
        combining={combining}
        isLastPillar={isLastPillar}
      />
      </div>
    </div>
  );
}
