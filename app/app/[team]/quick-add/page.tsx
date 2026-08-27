"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { Category, Idea } from "@/lib/types";
import { GROUPS, PILLARS, PILLAR_LIST, BRAND, PAGE_NAMES } from "@/lib/config";
import type { PillarSlug } from "@/lib/config";
import { parseWorkshopState, type WorkshopState } from "@/lib/workshop-phase";
import { seededShuffle } from "@/lib/seeded-shuffle";
import { presentedInCategory } from "@/lib/present-gate";
import Ballot, { type BallotTeam } from "@/components/Ballot";

const INK = BRAND.colors.ink;
const RED = BRAND.colors.primary;
const PAPER = BRAND.colors.paper;

// All groups use the light register — team color is a thin top band only
function makeQuickAddTheme(color: string) {
  return {
    name: "", color, bg: PAPER, text: INK, muted: `${INK}8C`,
    inputBg: PAPER, inputBorder: `${INK}33`,
    inputFocusBorder: `${INK}99`, borderBase: `${INK}26`,
  };
}

const TEAM_THEMES: Record<string, ReturnType<typeof makeQuickAddTheme> & { name: string }> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, { ...makeQuickAddTheme(g.color), name: g.name }])
);

const CATEGORIES = PILLAR_LIST.map((p) => ({
  key: p.slug as Category,
  label: p.label,
  abbr: p.abbr,
  color: p.color,
}));

function getVoterId(): string {
  const key = "voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Anything under this is browser furniture, not a keyboard — Chrome on
 * Android parts the two viewports by ~56px every time its address bar
 * collapses, and a filing bar that hopped on a scroll would be motion
 * where the system allows none.
 */
const KEYBOARD_FLOOR = 64;

/**
 * HOW FAR THE SOFTWARE KEYBOARD HAS COVERED THE FOOT OF THE PAGE.
 *
 * The layout viewport — the one `position: sticky` measures against —
 * and the VISUAL viewport — the one the participant can actually see —
 * come apart the instant iOS raises the keyboard: Safari does not
 * resize the layout viewport, it slides the visual one up and leaves
 * everything anchored to the bottom underneath the keys. The gap
 * between the two bottom edges is exactly how far a bottom-anchored
 * control has to ride, and `visualViewport` is the only place it is
 * published.
 *
 * The same expression is correct everywhere, which is the point:
 *  · iOS Safari — the layout viewport holds, the visual one shrinks,
 *    so this returns the keyboard's height and the bar rides it.
 *  · Chrome on Android — `interactive-widget=resizes-content` (set in
 *    app/layout.tsx) shrinks the LAYOUT viewport too, so the two edges
 *    never part, this returns 0, and `sticky bottom: 0` is already
 *    above the keyboard. No double-count.
 *  · A desktop, or any browser with no `visualViewport` at all — 0
 *    forever, and the bar is an ordinary sticky footer.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // sticky bottom:0 is the whole answer here
    const read = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > KEYBOARD_FLOOR ? Math.round(covered) : 0);
    };
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, []);

  return inset;
}

export default function QuickAddPage() {
  const params = useParams();
  const teamSlug = params.team as string;
  const theme = TEAM_THEMES[teamSlug];

  const [teamId, setTeamId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>(PILLAR_LIST[0].slug);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  // The two things this phone could not say before (U3): the board did
  // not take the idea, and the ballot did not reach anything. Both are
  // reported on the surface that issued the write, in its own register.
  const [addFailed, setAddFailed] = useState(false);
  const [ballotFailed, setBallotFailed] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [teams, setTeams] = useState<Record<string, BallotTeam>>({});
  const keyboardInset = useKeyboardInset();

  // Build team_id → identity map once on mount. The ballot names the
  // team beside the number, so the colour alone is not enough.
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

  // Voting state — driven by workshop_state, not teams table
  const [workshopState, setWorkshopState] = useState<WorkshopState | null>(null);
  const [maxVotesPerPillar, setMaxVotesPerPillar] = useState(3);
  // EVERY idea in the open category, all statuses — the stable №'s
  // caller contract (lib/idea-number).
  const [categoryIdeas, setCategoryIdeas] = useState<Idea[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<Set<string>>(new Set());
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);

  const votingPillar = workshopState?.voting_open ? workshopState.pillar : null;
  const isVoting = !!votingPillar;
  const votingPillarDef = votingPillar ? PILLARS[votingPillar] : null;
  const votesUsed = myVoteIds.size;
  const maxVotes = maxVotesPerPillar;

  // Hide the global ticker on this phone page
  useEffect(() => {
    const ticker = document.getElementById("live-ticker");
    if (ticker) ticker.style.display = "none";
    return () => {
      if (ticker) ticker.style.display = "";
    };
  }, []);

  // Fetch team ID
  useEffect(() => {
    async function fetchTeam() {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("slug", teamSlug)
        .single();
      if (data) setTeamId(data.id);
    }
    fetchTeam();
  }, [teamSlug]);

  // Fetch workshop state + vote limit
  const fetchWorkshopState = useCallback(async () => {
    const [stateRes, voteLimitRes] = await Promise.all([
      supabase.from("workshop_settings").select("value").eq("key", "workshop_state").single(),
      supabase.from("workshop_settings").select("value").eq("key", "max_votes_per_pillar").single(),
    ]);
    if (stateRes.data) setWorkshopState(parseWorkshopState(stateRes.data.value));
    if (voteLimitRes.data) {
      const parsed = parseInt(voteLimitRes.data.value, 10);
      if (!isNaN(parsed) && parsed > 0) setMaxVotesPerPillar(parsed);
    }
  }, []);

  useEffect(() => { fetchWorkshopState(); }, [fetchWorkshopState]);

  // Subscribe to workshop_state changes (single channel, no polling)
  useEffect(() => {
    const channel = supabase
      .channel("quick-add-voting")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "workshop_settings" },
        () => fetchWorkshopState()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWorkshopState]);

  // The whole category, set-aside included: the gate runs on the way to
  // the screen, the numbering needs the complete bucket.
  const fetchVotingIdeas = useCallback(async (pillar: PillarSlug) => {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("category", pillar)
      .order("created_at");
    if (data) setCategoryIdeas(data as Idea[]);
  }, []);

  // Fetch my votes for the voting pillar (NO aggregate counts — phones only track own votes)
  const fetchMyVotes = useCallback(async (pillar: PillarSlug) => {
    const voterId = getVoterId();
    const { data } = await supabase
      .from("votes")
      .select("idea_id")
      .eq("category", pillar)
      .eq("voter_id", voterId);
    if (data) setMyVoteIds(new Set(data.map((v: { idea_id: string }) => v.idea_id)));
  }, []);

  // When voting pillar changes, fetch ideas + my votes (jittered to prevent thundering herd)
  useEffect(() => {
    if (votingPillar) {
      const jitter = Math.random() * 800; // 0-800ms spread across 30 clients
      const t = setTimeout(() => {
        fetchVotingIdeas(votingPillar);
        fetchMyVotes(votingPillar);
      }, jitter);
      return () => clearTimeout(t);
    } else {
      setCategoryIdeas([]);
      setMyVoteIds(new Set());
    }
  }, [votingPillar, fetchVotingIdeas, fetchMyVotes]);

  // THE BALLOT VOTES ON WHAT THE ROOM SAW. This surface had never been
  // gated at all — a team's own phone offered every active idea in the
  // category while /vote and the returns offered only what the Stage
  // presented, which is the exact drift lib/present-gate exists to stop.
  //
  // U4: when the gate is UNREADABLE — the deployment cannot read
  // `presenting` at all — this ballot refuses to open rather than
  // silently widening to every active idea (see the refusal below).
  const gate = useMemo(() => presentedInCategory(categoryIdeas), [categoryIdeas]);
  const presented = gate.ideas;

  // Stable per-voter shuffle to eliminate position bias
  const shuffledVotingIdeas = useMemo(
    () => seededShuffle(presented, typeof window !== "undefined" ? getVoterId() : ""),
    [presented]
  );

  // Per-idea mutation guard — prevents rapid double-tap race conditions
  const mutatingIds = useRef<Set<string>>(new Set());

  // Vote using cast_vote RPC (atomic, with FOR UPDATE locking)
  const handleVote = async (ideaId: string) => {
    if (!votingPillar) return;
    if (mutatingIds.current.has(ideaId)) return;
    mutatingIds.current.add(ideaId);

    try {
      const voterId = getVoterId();
      const alreadyVoted = myVoteIds.has(ideaId);

      if (alreadyVoted) {
        // Optimistic un-vote
        setMyVoteIds((prev) => { const next = new Set(prev); next.delete(ideaId); return next; });
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
        // Reconcile
        fetchMyVotes(votingPillar);
        return;
      }

      if (votesUsed >= maxVotes) return;

      // Optimistic add
      setMyVoteIds((prev) => new Set(prev).add(ideaId));

      const cast = await write<boolean>("rpc:cast_vote", supabase.rpc("cast_vote", {
        p_idea_id: ideaId,
        p_category: votingPillar,
        p_voter_id: voterId,
      }));

      if (!cast.ok) {
        // The call never landed. That is a different fact from a vote
        // the room REFUSED — the refusal is the limit doing its job,
        // this is the ballot not reaching anything — and until now both
        // looked identical: a tick that quietly went away.
        setMyVoteIds((prev) => { const next = new Set(prev); next.delete(ideaId); return next; });
        setBallotFailed(true);
        return;
      }
      setBallotFailed(false);
      if (!cast.data) {
        // Revert optimistic add — rejected, not lost.
        setMyVoteIds((prev) => { const next = new Set(prev); next.delete(ideaId); return next; });
      }
    } finally {
      mutatingIds.current.delete(ideaId);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim() || !teamId) return;
    setSubmitting(true);

    try {
      const desc = description.trim();
      const ideaName = name.trim() || (desc.length <= 60 ? desc : desc.slice(0, 60).trim() + "...");

      const r = await write("ideas.insert:quick-add", supabase.from("ideas").insert({
        team_id: teamId,
        category,
        name: ideaName,
        description: desc,
        status: "draft",
        source: "team",
      }));

      if (!r.ok) {
        // ADDED does not fire and the textarea keeps every word. A
        // capture surface that clears its input on a failed write has
        // destroyed the idea it existed to take — the participant would
        // walk away believing it was on the board.
        setAddFailed(true);
        return;
      }

      setAddFailed(false);
      setDescription("");
      setName("");
      setCount((c) => c + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      descRef.current?.focus();
    } catch (err) {
      console.error("Failed to submit idea:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!theme) return null;

  const activeCategory = CATEGORIES.find((c) => c.key === category);

  return (
    <div
      // `svh`, not `vh`: on a phone `100vh` is the tallest the viewport
      // ever gets — the height it has with the browser's own toolbars
      // hidden — so a footer measured against it starts the session
      // below the fold. The SMALL viewport is the one that is always
      // true, and the filing bar below is anchored to this box.
      className="min-h-svh flex flex-col halftone-paper"
      style={{
        background: theme.bg,
        color: theme.text,
        // The home indicator sits under the primary action otherwise.
        // This is the filing bar's floor: the bar ends at this padding
        // box, so its ground never runs under the indicator.
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Team color band + header */}
      <div>
        <div className="h-[6px]" style={{ background: theme.color, marginTop: "env(safe-area-inset-top)" }} />
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${theme.borderBase}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-[8px] h-[8px] rounded-full"
              style={{ background: theme.color }}
            />
            <span
              className="font-sans font-[800] text-[13px] tracking-[3px] uppercase"
              style={{ color: INK }}
            >
              {theme.name}
            </span>
          </div>
          {isVoting ? (
            <div className="flex items-center gap-2">
              <span
                className="w-[6px] h-[6px] rounded-full animate-pulse"
                style={{ background: RED }}
              />
              <span
                className="font-sans font-[700] text-[11px] tracking-[2px] uppercase"
                style={{ color: RED }}
              >
                Voting Live
              </span>
            </div>
          ) : count > 0 ? (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-sans font-[700] text-[12px] tracking-[2px]"
              style={{ color: theme.muted }}
            >
              {/* The wire says "Added"; so does the button, so does the
                  stamp. One verb for one act. */}
              {count} added
            </motion.span>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isVoting && votingPillarDef ? (
          /* ========== VOTE MODE ========== */
          /* ONE ballot, shared with /vote (components/Ballot) — the same
             scope, the same team-qualified №, the same tap cue. This was
             a second copy of the screen and it had already drifted. */
          <motion.div
            key="vote"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col flex-1 pb-6"
          >
            {/* U4 — the same refusal /vote makes, in this page's own
                paper register: an unreadable present gate must stop the
                ballot, never widen it to ideas the room was not shown.
                The empty-fetch beat is excluded — no rows yet is "still
                loading", not "unreadable". */}
            {gate.unreadable && categoryIdeas.length > 0 ? (
              <div
                data-qa="ballot-unreadable"
                className="flex-1 flex flex-col items-center justify-center px-6 text-center"
              >
                <p className="text-[18px] mb-2" style={{ color: `${INK}99` }}>
                  The ballot can&rsquo;t open.
                </p>
                <p className="text-[16px] max-w-[340px] leading-snug" style={{ color: `${INK}8C`, textWrap: "pretty" }}>
                  Which ideas the room was shown could not be read, and the ballot must never offer
                  more than the room saw. Facilitator: the deployment is not carrying the
                  present-gate field (&ldquo;presenting&rdquo; on ideas) — apply the schema fix,
                  then reload this&nbsp;page.
                </p>
              </div>
            ) : (
              <>
                {/* The tap did not reach the room. Not a rejected vote —
                    that reverts on its own and is the limit working — but a
                    call that never landed, which used to look exactly the
                    same: a tick that quietly went away. */}
                {ballotFailed && (
                  <p
                    data-qa="ballot-failed"
                    className="slug text-[13px] px-6 pb-2"
                    style={{ color: RED }}
                  >
                    Not counted · that tap did not reach the room. Try again.
                  </p>
                )}
                <Ballot
                  categoryLabel={votingPillarDef.label}
                  allIdeas={categoryIdeas}
                  ideas={shuffledVotingIdeas}
                  teams={teams}
                  votedIds={myVoteIds}
                  maxVotes={maxVotes}
                  onToggle={handleVote}
                  expandedId={expandedIdea}
                  onExpand={setExpandedIdea}
                />
              </>
            )}
          </motion.div>
        ) : (
          /* ========== ADD MODE ========== */
          <motion.div
            key="add"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col flex-1"
          >
            <div className="px-6 pt-6 pb-2">
              <h1
                className="font-display text-[28px] font-bold mb-5"
                style={{ color: theme.text }}
              >
                {PAGE_NAMES.quickAdd}
              </h1>

              <div className="flex gap-2">
                {CATEGORIES.map((cat) => {
                  const isActive = category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setCategory(cat.key)}
                      aria-pressed={isActive}
                      className="flex-1 py-3 font-sans font-[800] text-[12px] tracking-[3px] uppercase transition-all duration-200 cursor-pointer rounded-full"
                      style={{
                        background: isActive ? INK : "transparent",
                        color: isActive ? "#fff" : `${INK}B3`,
                        border: `1.5px solid ${isActive ? INK : `${INK}40`}`,
                      }}
                    >
                      {cat.abbr}
                    </button>
                  );
                })}
              </div>
              {/* The chip wears the ABBREVIATION; this spells the
                  category out, because "Craft" and "New Craft" are not
                  the same words and the room works in the second.
                  Trimmed to the label alone on 2026-08-05 (user ruling,
                  "keep this lean"): it was "Filing under New Craft.",
                  which spent a sentence saying what one word says under
                  a row of chips the participant just tapped. */}
              {activeCategory && (
                <p className="text-[16px] mt-3" style={{ color: INK, fontWeight: 700 }}>
                  {activeCategory.label}
                </p>
              )}
            </div>

            <div className="flex flex-col px-6 pt-4 pb-6 gap-3">
              <div className="relative">
                <textarea
                  ref={descRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="What's the idea?"
                  rows={5}
                  className="dove-input w-full px-4 py-4 text-[18px] leading-relaxed focus:outline-none resize-vertical"
                  style={{
                    background: theme.inputBg,
                    border: `1.5px solid ${theme.inputBorder}`,
                    color: theme.text,
                    minHeight: 140,
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = theme.inputFocusBorder; }}
                  // No `window.scrollTo(0, 0)` on blur any more. That was
                  // compensation for the keyboard covering the button —
                  // it yanked the page back to the top under the
                  // participant's thumb, and it fights the filing bar,
                  // which now holds the action above the keys instead.
                  onBlur={(e) => { e.currentTarget.style.borderColor = theme.inputBorder; }}
                  autoFocus
                />

                <AnimatePresence>
                  {flash && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ background: "rgba(255,255,255,0.88)" }}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="font-sans font-[900] text-[22px] tracking-[4px] uppercase px-4 py-1"
                          style={{ color: RED, border: `3px solid ${RED}`, borderRadius: 2, transform: "rotate(-3deg)" }}
                        >
                          ADDED
                        </div>
                        {/* Where it went. The stamp says it happened;
                            this says where to go and look at it. */}
                        <div className="text-[16px]" style={{ color: `${INK}99` }}>
                          It&rsquo;s on {theme.name}&rsquo;s Board.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name it (optional)"
                className="dove-input w-full px-4 py-3.5 text-[16px] focus:outline-none"
                style={{
                  background: theme.inputBg,
                  border: `1.5px solid ${theme.inputBorder}`,
                  color: theme.text,
                  opacity: 0.6,
                  transition: "border-color 0.2s, opacity 0.2s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = theme.inputFocusBorder; e.currentTarget.style.opacity = "1"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = theme.inputBorder; e.currentTarget.style.opacity = "0.6"; }}
              />

              <p className="text-[16px] leading-snug" style={{ color: `${INK}8C`, textWrap: "pretty" }}>
                Every idea you add lands on {theme.name}&rsquo;s Board straight away, where the team can open it,
                coach it and put it up on The&nbsp;Stage.
              </p>
            </div>

            {/* THE FILING BAR — the primary action, held at the foot of
                the paper above whatever the phone has put there.

                The textarea autofocuses, so on a real handset the
                keyboard is up before the participant has read the
                screen, and ADD IDEA used to be the thing under it: an
                idea typed and no visible way to file it. The bar is one
                mechanism doing three jobs at once —

                  `sticky` + `mt-auto`  it sits at the bottom of the
                    paper when the page is short and pins to the bottom
                    of the viewport when the page is long, so it is
                    never off-screen and never floating over a page
                    that had room for it;
                  `bottom: keyboardInset`  a sticky element sticks that
                    many pixels ABOVE the foot of the viewport, so the
                    one number `visualViewport` publishes is the whole
                    keyboard fix — no fixed positioning, no scroll
                    maths, nothing to unwind when the keys go away;
                  the hairline  it brackets the sheet against the
                    header's own rule, so the bar reads as the foot of
                    a form rather than as a control that floated free.

                No transition on `bottom`: the keyboard animates its own
                arrival, and a bar easing after it would be motion where
                the room's grammar allows an event. It cuts. */}
            <div
              data-qa="quick-add-action"
              className="sticky mt-auto px-6 pt-3 pb-3"
              style={{
                bottom: keyboardInset,
                background: theme.bg,
                borderTop: `1px solid ${theme.borderBase}`,
              }}
            >
              {/* The board did not take it. One line ON the bar that
                  issued the write, above the action, so it is inside
                  the keyboard-safe box with the button — and the
                  textarea behind it still holds every word. */}
              {addFailed && (
                <p
                  data-qa="quick-add-failed"
                  className="slug text-[13px] pb-2"
                  style={{ color: RED }}
                >
                  Not added · your idea is still here. Try again.
                </p>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={!description.trim() || submitting || !teamId}
                className="w-full py-4 font-sans font-[800] text-[14px] tracking-[3px] uppercase disabled:opacity-25 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #002663 0%, #0A3478 100%)",
                  color: "#fff",
                  borderRadius: 999,
                  boxShadow: description.trim() ? "0 6px 24px rgba(0,38,99,0.35)" : "none",
                  transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                {submitting ? "ADDING…" : "ADD IDEA"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
