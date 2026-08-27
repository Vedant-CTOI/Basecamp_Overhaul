"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { Idea, type PillarSlug } from "@/lib/types";
import { PILLARS, GROUPS, BRAND, PAGE_NAMES } from "@/lib/config";
import { parseWorkshopState, isActiveState, getStateLabel, type WorkshopState } from "@/lib/workshop-phase";
import { seededShuffle } from "@/lib/seeded-shuffle";
import { presentedInCategory } from "@/lib/present-gate";
import Ballot, { type BallotTeam } from "@/components/Ballot";
import DoveMark from "@/components/DoveMark";

const INK = BRAND.colors.ink;
const RED = BRAND.colors.primary;
const PAPER = BRAND.colors.paper;

function getVoterId(): string {
  const key = "voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// ── THE RECEIPT ─────────────────────────────────────────────────
//
// A phone that voted and then watched the facilitator close the ballot
// must be told what it did, not handed the cold "waiting for the room"
// sheet. That standing was React state, so a reload — a locked phone
// picked up again, a browser reaping a background tab, a participant
// pulling to refresh because the screen looked stuck — threw it away
// and told someone who had just voted that nothing had happened.
//
// It lives in localStorage now, and every part of the shape is there to
// stop it saying something untrue:
//
//   keyed by CATEGORY   a second ballot in a second category writes its
//     own receipt; the first is still on the phone but can only ever be
//     shown against the category it belongs to.
//   the VOTER ID        a receipt is a fact about this device's ballot.
//     A phone whose voter id has been reset is a different voter, and
//     its old receipt is not its own to show.
//   the WORKSHOP        a second engagement on the same origin is a
//     different room. Its ballots are not this one's.
//   an EXPIRY           a workshop is a day. A receipt that outlives one
//     is a stale claim about a room that has gone home.
//
// Nothing here is a vote record. The votes are in the database; this is
// only what this phone is entitled to say about them.
const RECEIPTS_KEY = "basecamp:ballot-receipts:v1";
const RECEIPT_TTL_MS = 12 * 60 * 60 * 1000; // one working day

type Receipt = {
  category: PillarSlug;
  label: string;
  votes: number;
  at: number;
  voterId: string;
  workshop: string;
};

type ReceiptBook = Partial<Record<PillarSlug, Receipt>>;

function readReceipts(): ReceiptBook {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECEIPTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const voterId = getVoterId();
    const now = Date.now();
    const book: ReceiptBook = {};
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const r = value as Receipt;
      if (!r || typeof r !== "object") continue;
      if (typeof r.category !== "string" || typeof r.label !== "string") continue;
      if (typeof r.votes !== "number" || r.votes <= 0) continue;
      if (r.voterId !== voterId) continue;
      if (r.workshop !== BRAND.workshopTitle) continue;
      if (typeof r.at !== "number" || now - r.at > RECEIPT_TTL_MS) continue;
      book[r.category] = r;
    }
    return book;
  } catch {
    // A phone with storage denied simply has no receipt. It falls back
    // to the standing it had before this existed; it never breaks.
    return {};
  }
}

/**
 * Write what this phone has in for a category — or clear it, because a
 * voter who takes every tick back has no ballot in and must not be told
 * otherwise. Returns the book so the caller renders from one truth.
 */
function writeReceipt(category: PillarSlug, label: string, votes: number): ReceiptBook {
  const book = readReceipts();
  if (votes > 0) {
    book[category] = {
      category,
      label,
      votes,
      at: Date.now(),
      voterId: getVoterId(),
      workshop: BRAND.workshopTitle,
    };
  } else {
    delete book[category];
  }
  try {
    window.localStorage.setItem(RECEIPTS_KEY, JSON.stringify(book));
  } catch {
    /* storage denied — the standing degrades to this session only */
  }
  return book;
}

/**
 * WHICH receipt a closed ballot is allowed to show.
 *
 * If the room is still standing on a category, only THAT category's
 * receipt may speak: a phone that sat out the second vote must not be
 * told its ballot is in because it voted in the first. Only when the
 * room is on no category at all does the phone fall back to its most
 * recent ballot — and even then the copy names the category, so the
 * receipt can never be read as belonging to a vote it does not.
 */
function receiptFor(book: ReceiptBook, roomPillar: PillarSlug | null): Receipt | null {
  if (roomPillar) return book[roomPillar] ?? null;
  const all = Object.values(book) as Receipt[];
  if (!all.length) return null;
  return all.reduce((newest, r) => (r.at > newest.at ? r : newest));
}

/**
 * Every state that is NOT an open ballot is the same paper sheet — the
 * masthead, one line of standing, one line of instruction. Hoisted out
 * of the page so a re-render swaps its copy rather than remounting it.
 * The notch is cleared here too: a centred screen still has to keep its
 * type out of the sensor housing.
 */
function Sheet({ standing, helper }: { standing: string; helper: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{
        background: PAPER,
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <DoveMark size={56} color="#96702E" />
      <h1 className="font-display text-[40px] font-bold mt-4 mb-3" style={{ color: INK }}>{PAGE_NAMES.vote}</h1>
      <p className="text-[18px] mb-2" style={{ color: `${INK}99` }}>{standing}</p>
      <p className="text-[16px] max-w-[340px] leading-snug" style={{ color: `${INK}8C`, textWrap: "pretty" }}>
        {helper}
      </p>
    </div>
  );
}

export default function VotePage() {
  const [wsState, setWsState] = useState<WorkshopState | null>(null);
  // EVERY idea in the open category, all statuses — the stable №'s
  // caller contract (lib/idea-number). The gate is applied on the way
  // to the screen, never on the way to the numbering.
  const [categoryIdeas, setCategoryIdeas] = useState<Idea[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<Set<string>>(new Set());
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [maxVotes, setMaxVotes] = useState(3);
  const [teams, setTeams] = useState<Record<string, BallotTeam>>({});
  const [votingEnabled, setVotingEnabled] = useState<boolean | null>(null);
  // A tap that never reached the room, told apart from a vote the room
  // refused (U3). Both used to be one silent revert.
  const [ballotFailed, setBallotFailed] = useState(false);
  // What this phone has already put in, so the ballot can acknowledge
  // it after the facilitator closes the vote instead of falling back to
  // "the ballot opens when the facilitator calls the vote" — the one
  // line a voter who has just voted should never be shown. Read from
  // localStorage on mount, so a reload after the vote closes still says
  // what this phone did.
  const [receipts, setReceipts] = useState<ReceiptBook>({});
  // Which pillar's votes this phone has actually READ back. Until it
  // has, an empty vote set means "not fetched yet", not "voted for
  // nothing" — and clearing a receipt on that would delete the answer
  // the reload came back for.
  const [votesLoadedFor, setVotesLoadedFor] = useState<PillarSlug | null>(null);

  // Build team_id → identity map once on mount
  useEffect(() => {
    supabase.from("teams").select("id, slug").then(({ data }) => {
      if (!data) return;
      const map: Record<string, BallotTeam> = {};
      data.forEach((t: { id: string; slug: string }) => {
        const group = Object.values(GROUPS).find((g) => g.slug === t.slug);
        if (group) map[t.id] = { name: group.name, color: group.color };
      });
      setTeams(map);
    });
  }, []);

  // Check if voting is enabled at the workshop level
  useEffect(() => {
    supabase.from("workshop_settings").select("value").eq("key", "voting_enabled").single().then(({ data }) => {
      setVotingEnabled(data?.value === "true");
    });
  }, []);

  const activePillar = wsState && wsState.voting_open && wsState.pillar ? wsState.pillar : null;
  const pillarDef = activePillar ? PILLARS[activePillar] : null;

  // THE BALLOT VOTES ON WHAT THE ROOM SAW (user ruling 2026-08-03): the
  // phone offers exactly the collection the Stage presented for this
  // category — every idea a team brought to the Stage, and a team that
  // brought nothing puts its whole active board up, unchanged. Set-aside
  // ideas stay out. The gate is the Stage's own (lib/present-gate), so
  // the two surfaces cannot drift.
  //
  // U4: the gate now reports a THIRD state — the deployment cannot read
  // `presenting` at all. On that fact this page refuses to open the
  // ballot (see the Sheet below) rather than falling back to every
  // active idea, which would silently widen the vote to ideas the room
  // was never shown.
  const gate = useMemo(() => presentedInCategory(categoryIdeas), [categoryIdeas]);
  const presented = gate.ideas;

  // Stable per-voter shuffle to eliminate position bias
  const shuffledIdeas = useMemo(
    () => seededShuffle(presented, typeof window !== "undefined" ? getVoterId() : ""),
    [presented]
  );

  // Effective votes = server votes + pending (optimistic)
  const effectiveMyVotes = useMemo(() => {
    const merged = new Set(myVoteIds);
    for (const id of pendingVoteIds) merged.add(id);
    return merged;
  }, [myVoteIds, pendingVoteIds]);

  const votesRemaining = maxVotes - effectiveMyVotes.size;

  // Fetch current phase + vote limit
  const fetchPhase = useCallback(async () => {
    const [stateRes, voteLimitRes] = await Promise.all([
      supabase.from("workshop_settings").select("value").eq("key", "workshop_state").single(),
      supabase.from("workshop_settings").select("value").eq("key", "max_votes_per_pillar").single(),
    ]);
    if (stateRes.data) setWsState(parseWorkshopState(stateRes.data.value));
    if (voteLimitRes.data) {
      const parsed = parseInt(voteLimitRes.data.value, 10);
      if (!isNaN(parsed) && parsed > 0) setMaxVotes(parsed);
    }
  }, []);

  // Fetch the WHOLE category — set-aside included. The gate runs on the
  // display list; the numbering needs the complete bucket.
  const fetchIdeas = useCallback(async (pillar: PillarSlug) => {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("category", pillar)
      .order("created_at");
    if (data) setCategoryIdeas(data as Idea[]);
  }, []);

  // Fetch my votes for the active pillar
  const fetchMyVotes = useCallback(async (pillar: PillarSlug) => {
    const voterId = getVoterId();
    const { data } = await supabase
      .from("votes")
      .select("idea_id")
      .eq("category", pillar)
      .eq("voter_id", voterId);
    if (data) setMyVoteIds(new Set(data.map((v: { idea_id: string }) => v.idea_id)));
    setVotesLoadedFor(pillar);
  }, []);

  // Initial load
  useEffect(() => {
    fetchPhase().then(() => setLoading(false));
  }, [fetchPhase]);

  // The receipt this phone already holds, read once on mount. This is
  // the line that survives a reload: everything else about the ballot
  // is refetched from the room, and this is the one fact only the
  // phone has.
  useEffect(() => { setReceipts(readReceipts()); }, []);

  // When pillar changes, fetch ideas + my votes (jittered to prevent thundering herd)
  useEffect(() => {
    if (!activePillar) return;
    const jitter = Math.random() * 800;
    const t = setTimeout(() => {
      fetchIdeas(activePillar);
      fetchMyVotes(activePillar);
    }, jitter);
    return () => clearTimeout(t);
  }, [activePillar, fetchIdeas, fetchMyVotes]);

  // Record the ballot this phone actually cast, so closing the vote
  // reads as a receipt rather than as a reset — and so does a reload.
  // It writes on every change while the ballot is open, including back
  // down to nothing: a voter who takes every tick back has no ballot
  // in, and the receipt must not outlive the votes it counted.
  useEffect(() => {
    if (!activePillar || !pillarDef) return;
    if (votesLoadedFor !== activePillar) return;
    setReceipts(writeReceipt(activePillar, pillarDef.label, effectiveMyVotes.size));
  }, [activePillar, pillarDef, effectiveMyVotes, votesLoadedFor]);

  // Subscribe to phase changes
  useEffect(() => {
    const channel = supabase
      .channel("vote-page")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workshop_settings" },
        () => { fetchPhase(); }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          fetchPhase();
          if (activePillar) fetchMyVotes(activePillar);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [fetchPhase, activePillar, fetchMyVotes]);

  // Per-idea mutation guard — prevents rapid double-tap race conditions
  const mutatingIds = useRef<Set<string>>(new Set());

  // Cast vote via RPC
  const handleVote = async (ideaId: string) => {
    if (!activePillar) return;
    if (mutatingIds.current.has(ideaId)) return;
    mutatingIds.current.add(ideaId);

    try {
      const alreadyVoted = effectiveMyVotes.has(ideaId);

      if (alreadyVoted) {
        // Un-vote
        setMyVoteIds((prev) => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
        const voterId = getVoterId();
        const un = await write(
          "votes.delete:un-vote",
          supabase.from("votes").delete().eq("idea_id", ideaId).eq("voter_id", voterId)
        );
        if (!un.ok) {
          // The vote is still cast. Put the tick back rather than
          // showing a ballot the room's count will contradict.
          setMyVoteIds((prev) => new Set(prev).add(ideaId));
          setBallotFailed(true);
          return;
        }
        setBallotFailed(false);
        return;
      }

      if (votesRemaining <= 0) return;

      // Optimistic add
      setPendingVoteIds((prev) => new Set(prev).add(ideaId));

      const voterId = getVoterId();
      const cast = await write<boolean>("rpc:cast_vote", supabase.rpc("cast_vote", {
        p_idea_id: ideaId,
        p_category: activePillar,
        p_voter_id: voterId,
      }));

      // Three outcomes now, where there were two. `cast.ok === false` is
      // the call not reaching the room; `cast.data === false` is the
      // room REFUSING the vote (the limit, or a duplicate). Both used to
      // drop the tick in silence and look identical to the voter.
      if (!cast.ok) {
        setBallotFailed(true);
      } else {
        setBallotFailed(false);
        if (cast.data) setMyVoteIds((prev) => new Set(prev).add(ideaId));
      }
      setPendingVoteIds((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    } finally {
      mutatingIds.current.delete(ideaId);
    }
  };

  // Voting gate — loading state
  if (votingEnabled === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>
        <p className="font-display italic text-[18px]" style={{ color: `${INK}99` }}>One moment…</p>
      </div>
    );
  }

  // Voting gate — disabled for the whole workshop
  if (votingEnabled === false) {
    return (
      <Sheet
        standing="Not open."
        helper={<>The ballot opens when the facilitator calls the vote. In the showcase, voting opens from The&nbsp;Stage.</>}
      />
    );
  }

  if (!activePillar || !pillarDef) {
    // THE RECEIPT. A phone that voted and then watched the facilitator
    // close the ballot gets its own standing, not the cold "waiting"
    // copy — the returns are on the Stage, and this phone is done.
    // Scoped to the category the room is standing on, so a phone that
    // sat the second vote out is never told its ballot is in.
    const ballotIn = receiptFor(receipts, wsState?.pillar ?? null);
    if (ballotIn) {
      return (
        <Sheet
          standing="Your ballot is in."
          helper={
            <>
              {ballotIn.votes} {ballotIn.votes === 1 ? "vote" : "votes"} counted under {ballotIn.label}. The
              returns go up on The&nbsp;Stage, and this phone opens again when the next vote is called.
            </>
          }
        />
      );
    }
    return (
      <Sheet
        standing={wsState && isActiveState(wsState) ? getStateLabel(wsState) : "Waiting for the room."}
        helper={<>The ballot opens when the facilitator calls the vote. In the showcase, voting opens from The&nbsp;Stage.</>}
      />
    );
  }

  // U4 — THE BALLOT REFUSES ON AN UNREADABLE GATE. Which ideas the room
  // was shown could not be read (lib/present-gate: no active row in some
  // team's bucket carries `presenting` at all — the missing-column
  // signature, not a team that chose nothing). Offering every active
  // idea here would widen the vote to ideas the Stage never presented,
  // silently — Round 16's corollary is absolute, so the ballot stops
  // and says why. Refusing halts a vote; widening corrupts one. The
  // standing rides the same paper Sheet as every other non-ballot
  // state, and the empty-fetch beat is excluded (no rows yet is "still
  // loading", not "unreadable").
  if (gate.unreadable && categoryIdeas.length > 0) {
    return (
      <Sheet
        standing="The ballot can’t open."
        helper={
          <>
            Which ideas the room was shown could not be read, and the ballot must never offer more
            than the room saw. Facilitator: the deployment is not carrying the present-gate field
            (&ldquo;presenting&rdquo; on ideas) — apply the schema fix, then reload this&nbsp;page.
          </>
        }
      />
    );
  }

  return (
    <div
      className="overhaul-page min-h-screen"
      style={{
        background: PAPER,
        color: INK,
        // The home indicator: the last option's rule must not sit under it.
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Connection indicator */}
      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 text-white text-center py-2 text-[14px] font-bold" style={{ background: RED, paddingTop: "max(8px, env(safe-area-inset-top))" }}>
          Reconnecting…
        </div>
      )}

      {/* The tap did not reach the room. The ballot's own register — no
          banner, no modal; the reconnecting bar above already owns the
          top of this screen and a second one would fight it. */}
      {ballotFailed && (
        <p
          data-qa="ballot-failed"
          className="slug text-[13px] px-6 pt-4"
          style={{ color: RED }}
        >
          Not counted · that tap did not reach the room. Try again.
        </p>
      )}

      <Ballot
        categoryLabel={pillarDef.label}
        allIdeas={categoryIdeas}
        ideas={shuffledIdeas}
        teams={teams}
        votedIds={effectiveMyVotes}
        maxVotes={maxVotes}
        onToggle={handleVote}
        expandedId={expandedIdea}
        onExpand={setExpandedIdea}
        sticky
        headerAside={
          <div
            className="w-2 h-2 rounded-full"
            title={connected ? "Connected to the room" : "Reconnecting"}
            style={{ background: connected ? `${INK}33` : RED }}
          />
        }
      />
    </div>
  );
}
