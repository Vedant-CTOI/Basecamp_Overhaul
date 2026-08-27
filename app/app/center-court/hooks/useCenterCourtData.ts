"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase, isShowcaseMode } from "@/lib/supabase";
import { write } from "@/lib/db";
import { Idea, Team } from "@/lib/types";
import { GROUPS, GROUP_LIST, PILLAR_LIST, type PillarSlug, type GroupSlug, type Wave } from "@/lib/config";
import { WorkshopState, parseWorkshopState, getIdleState } from "@/lib/workshop-phase";

// ── Debounce utility ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export interface TeamStats {
  team: Team;
  ideas: Idea[];
  total: number;
  coached: number;
  faSigned: number;
  startingLineup: number;
}

export interface VoteCounts {
  [ideaId: string]: number;
}

export function useCenterCourtData() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [totalVoters, setTotalVoters] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(20);
  const [workshopState, setWorkshopState] = useState<WorkshopState>(getIdleState());
  const [activePillar, setActivePillar] = useState<PillarSlug | null>(PILLAR_LIST[0]?.slug || null);
  const [activeTeam, setActiveTeam] = useState<string | null>(GROUP_LIST[0]?.slug || null);
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Track what the Realtime channel is filtered on
  const currentPillarFilter = useRef<PillarSlug | null>(null);

  // ── Fetch functions ──

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
    if (data) setTeams(data);
  }, []);

  const fetchIdeas = useCallback(async () => {
    const { data } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
    if (data) setIdeas(data);
  }, []);

  const fetchVoteCounts = useCallback(async (pillar: PillarSlug) => {
    const { data } = await supabase
      .from("votes")
      .select("idea_id, voter_id")
      .eq("category", pillar);

    if (data) {
      const counts: VoteCounts = {};
      const voters = new Set<string>();
      data.forEach((v: { idea_id: string; voter_id: string }) => {
        counts[v.idea_id] = (counts[v.idea_id] || 0) + 1;
        voters.add(v.voter_id);
      });
      setVoteCounts(counts);
      setTotalVoters(voters.size);
    }
  }, []);

  // Debounced versions for Realtime events
  const debouncedFetchVoteCounts = useMemo(
    () => debounce((pillar: PillarSlug) => fetchVoteCounts(pillar), 400),
    [fetchVoteCounts]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchIdeas = useMemo(
    () => debounce(() => fetchIdeas(), 500),
    [fetchIdeas]
  );


  const fetchWorkshopState = useCallback(async () => {
    const { data } = await supabase
      .from("workshop_settings")
      .select("value")
      .eq("key", "workshop_state")
      .single();

    if (data) {
      const state = parseWorkshopState(data.value);
      setWorkshopState(state);
    }

    // Also fetch total participants
    const { data: pData } = await supabase
      .from("workshop_settings")
      .select("value")
      .eq("key", "total_participants")
      .single();

    if (pData) {
      const n = parseInt(pData.value, 10);
      if (!isNaN(n)) setTotalParticipants(n);
    }
  }, []);

  // ── Phase transition (with retry) ──

  const [phaseError, setPhaseError] = useState<string | null>(null);

  /** The Stage's one place for "that did not take". It already existed
   *  for a failed phase change; U3 gives every operator action on this
   *  hook the same voice rather than inventing a second one. It clears
   *  itself, because the Control Strip is the room's screen and a mark
   *  that outstays the fact is worse than none. */
  const reportFailure = useCallback((message: string) => {
    setPhaseError(message);
    setTimeout(() => setPhaseError(null), 8000);
  }, []);

  const setPhase = useCallback(async (state: WorkshopState) => {
    setPhaseError(null);
    if (isShowcaseMode) {
      // No backend in showcase mode — write workshop_state through the
      // showcase client; its engine emits realtime to every subscribed surface.
      const r = await write(
        "workshop_settings.upsert:phase",
        supabase.from("workshop_settings").upsert(
          { key: "workshop_state", value: JSON.stringify(state), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )
      );
      if (!r.ok) {
        // Same band the live path already uses when a phase change does
        // not take — the Control Strip's own status, no second primary.
        reportFailure("Phase change failed — the room's screen did not move");
        return false;
      }
      setWorkshopState(state);
      return true;
    }
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch("/api/phase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (res.ok) {
          setWorkshopState(state);
          return true;
        }
        // U5: the phase route now requires the facilitator session. A
        // refused session is not a flaky network — retrying it three
        // times burns two seconds in front of the room and then reports
        // the wrong cause. Say what actually happened, and where the fix
        // is. Nothing the ROOM is doing has stopped; only this console
        // has lost its session.
        if (res.status === 401 || res.status === 503) {
          setPhaseError(
            res.status === 503
              ? "This deployment has no facilitator password set — phase control is closed. The room is unaffected."
              : "Your facilitator session has ended. Open /admin-login in another tab, enter the password, and try again."
          );
          setTimeout(() => setPhaseError(null), 20000);
          return false;
        }
      } catch {
        // Network error — retry
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setPhaseError("Phase change failed — check connection and try again");
    setTimeout(() => setPhaseError(null), 8000);
    return false;
  }, [reportFailure]);

  // ── Idea mutations ──

  const benchIdea = useCallback(async (ideaId: string) => {
    const r = await write("ideas.update:bench", supabase.from("ideas").update({ status: "bench", updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Set aside failed — the idea is still on the wall");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  const unbenchIdea = useCallback(async (ideaId: string) => {
    const r = await write("ideas.update:unbench", supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Bring back failed — the idea is still set aside");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  const promoteIdea = useCallback(async (ideaId: string) => {
    const r = await write("ideas.update:promote", supabase.from("ideas").update({ status: "starting_lineup", updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Shortlist failed — the idea is still where it was");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  const demoteIdea = useCallback(async (ideaId: string) => {
    const r = await write("ideas.update:demote", supabase.from("ideas").update({ status: "coached", updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Remove failed — the idea is still on the shortlist");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  const setIdeaWave = useCallback(async (ideaId: string, wave: Wave | null) => {
    const r = await write("ideas.update:wave", supabase.from("ideas").update({ wave, updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Wave change failed — the idea kept its wave");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  const fetchVotingEnabled = useCallback(async () => {
    const { data } = await supabase
      .from("workshop_settings")
      .select("value")
      .eq("key", "voting_enabled")
      .single();
    if (data) setVotingEnabled(data.value === "true");
  }, []);

  // ── Initial fetch ──

  useEffect(() => {
    fetchTeams();
    fetchIdeas();
    fetchWorkshopState();
    fetchVotingEnabled();
  }, [fetchTeams, fetchIdeas, fetchWorkshopState, fetchVotingEnabled]);

  // ── Fetch vote counts when active pillar changes ──

  useEffect(() => {
    if (activePillar) {
      fetchVoteCounts(activePillar);
    } else {
      setVoteCounts({});
      setTotalVoters(0);
    }
  }, [activePillar, fetchVoteCounts]);

  // ── Realtime subscription ──
  // Realtime subscription + single-client polling fallback for votes only

  const lastVoteRealtimeAt = useRef(0);

  useEffect(() => {
    const channelName = `center-court-${activePillar || "idle"}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" },
        () => debouncedFetchIdeas())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workshop_settings" },
        () => fetchWorkshopState());

    // Listen for all vote changes
    if (activePillar) {
      channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "votes",
      }, () => {
        lastVoteRealtimeAt.current = Date.now();
        debouncedFetchVoteCounts(activePillar);
      });
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeConnected(true);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeConnected(false);
      }
    });
    currentPillarFilter.current = activePillar;

    // 60-second reconciliation safety net (replaces the old 8-second polling fallback)
    // Per Coke postmortem: frequent polling + realtime on same data caused connection pool exhaustion
    const interval = activePillar ? setInterval(() => {
      fetchVoteCounts(activePillar);
      fetchIdeas();
    }, 60000) : undefined;

    return () => {
      supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [activePillar, fetchIdeas, debouncedFetchIdeas, fetchWorkshopState, debouncedFetchVoteCounts, fetchVoteCounts]);

  // ── Computed: ideas for a pillar ──

  const getIdeasForPillar = useCallback((pillar: PillarSlug) => {
    return ideas.filter((i) => i.category === pillar);
  }, [ideas]);

  // ── Computed: ideas for a team (across all pillars) ──

  const getIdeasForTeam = useCallback((teamSlug: string) => {
    const team = teams.find((t) => t.slug === teamSlug);
    if (!team) return [];
    return ideas.filter((i) => i.team_id === team.id);
  }, [ideas, teams]);

  // ── Idea reassignment between teams ──

  const reassignIdea = useCallback(async (ideaId: string, newTeamId: string) => {
    const r = await write("ideas.update:reassign", supabase.from("ideas").update({ team_id: newTeamId, updated_at: new Date().toISOString() }).eq("id", ideaId));
    if (!r.ok) return reportFailure("Move failed — the idea is still with its team");
    fetchIdeas();
  }, [fetchIdeas, reportFailure]);

  // ── Computed: team stats ──

  const teamStats = useMemo((): TeamStats[] => {
    return Object.values(GROUPS).map((group) => {
      const team = teams.find((t) => t.slug === group.slug);
      if (!team) return { team: { id: "", name: group.name, slug: group.slug, display_name: null, color: group.color, assigned_pillars: [], facilitator_notes: null, creative_platform_name: null, creative_platform_brief: null, created_at: "" }, ideas: [], total: 0, coached: 0, faSigned: 0, startingLineup: 0 };
      const teamIdeas = ideas.filter((i) => i.team_id === team.id);
      return {
        team,
        ideas: teamIdeas,
        total: teamIdeas.length,
        coached: teamIdeas.filter((i) => i.status === "coached" || i.status === "starting_lineup").length,
        faSigned: teamIdeas.filter((i) => i.source === "ai_scouted").length,
        startingLineup: teamIdeas.filter((i) => i.status === "starting_lineup").length,
      };
    });
  }, [teams, ideas]);

  // ── Computed: vision for a pillar ──


  return {
    // Data
    teams,
    ideas,
    voteCounts,
    totalVoters,
    totalParticipants,
    workshopState,
    teamStats,

    // Active pillar (local UI state)
    activePillar,
    setActivePillar,

    // Active team (local UI state)
    activeTeam,
    setActiveTeam,

    // Voting
    votingEnabled,

    // State transitions
    setPhase,
    phaseError,
    realtimeConnected,

    // Idea mutations
    benchIdea,
    unbenchIdea,
    promoteIdea,
    demoteIdea,
    setIdeaWave,
    reassignIdea,

    // Queries
    getIdeasForPillar,
    getIdeasForTeam,

    // Refetch
    fetchIdeas,
    fetchVoteCounts,
  };
}
