"use client";

import { motion } from "framer-motion";
import type { Idea } from "@/lib/types";
import { BRAND, PAGE_NAMES, paperType } from "@/lib/config";
import { EASE, STAGGER_DENSE } from "@/lib/motion";
import { ideaNumbers, qualifiedIdeaNo } from "@/lib/idea-number";

// ── THE PAPER BALLOT ─────────────────────────────────────────
// ONE implementation, read by both phone surfaces — /vote and the
// team's quick-add when the facilitator calls the vote. They were two
// copies of the same screen and drifted exactly the way the present
// gate did before Round 16 put it in one function: quick-add's copy
// never got the gate at all, so a team's phone offered ideas the room
// had never been shown.
//
// WHAT A VOTER HAS TO KNOW, and where each answer lives:
//   whose idea is this   → the swatch and the qualified № under the
//                          title (`TOUFFOU 03`), the returns' own
//                          device. A bare colour dot was a key with no
//                          legend — three hues and nothing naming them.
//   what do I tap        → the instruction line under the masthead. The
//                          circle takes the vote and the row does not
//                          (deliberate: a thumb resting on a long
//                          description must never spend a vote), which
//                          is undiscoverable unless the ballot says so.
//   how many are left    → the counter, and the same instruction line,
//                          which changes at the limit and tells the
//                          voter how to take a vote back.
//
// NO CIRCLING (Round 18): a cast vote is the filled red circle and
// nothing else. No ChinaMark on any phone surface.

const INK = BRAND.colors.ink;
const RED = BRAND.colors.primary;
const PAPER = BRAND.colors.paper;
const HAIRLINE = `1px solid ${INK}26`;

export type BallotTeam = { name: string; color: string };

export type BallotProps = {
  /** The category being voted, as the room heard it called. */
  categoryLabel: string;
  /**
   * EVERY idea in this category — all teams, all statuses, set-aside
   * included. The stable № is derived from this, never from the gated
   * list: a number taken off a filtered slice is a position again
   * (lib/idea-number's caller contract).
   */
  allIdeas: Idea[];
  /** The present-gated set the Stage actually showed, in voter order. */
  ideas: Idea[];
  teams: Record<string, BallotTeam>;
  votedIds: Set<string>;
  maxVotes: number;
  onToggle: (ideaId: string) => void;
  expandedId: string | null;
  onExpand: (ideaId: string | null) => void;
  /** The masthead pins on /vote (a whole-page ballot) and scrolls on
      quick-add (where the team band above it is the page's identity). */
  sticky?: boolean;
  /** The connection dot — /vote carries one, quick-add does not. */
  headerAside?: React.ReactNode;
};

/** What the ballot says about the tap, in the state the voter is in. */
function instruction(used: number, max: number): string {
  if (used === 0) {
    return `You have ${max} votes. Tap a circle to cast one, and tap an idea to read all of it.`;
  }
  if (used < max) {
    const left = max - used;
    return `${left} ${left === 1 ? "vote" : "votes"} left. Tap a circle to cast one, or tap a filled circle to take a vote back.`;
  }
  return `All ${max} of your votes are cast. Tap a filled circle to take one back and spend it somewhere else.`;
}

export default function Ballot({
  categoryLabel, allIdeas, ideas, teams, votedIds, maxVotes,
  onToggle, expandedId, onExpand, sticky = false, headerAside,
}: BallotProps) {
  const votesUsed = votedIds.size;
  const votesRemaining = maxVotes - votesUsed;
  const atLimit = votesRemaining <= 0;
  const stableNo = ideaNumbers(allIdeas);

  return (
    <>
      {/* ── The masthead ── */}
      <div
        className={sticky ? "sticky top-0 z-40 px-5" : "px-5"}
        style={{
          background: PAPER,
          borderBottom: "2px solid #B78938",  // the ballot's gold rule

          // The notch: a pinned masthead has to clear it, and the
          // browser's own chrome cannot be relied on to do it.
          paddingTop: sticky ? "max(12px, env(safe-area-inset-top))" : 12,
          paddingBottom: 12,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* SERIF LAW (Round 4 item 2): the masthead is the ballot's
                one named moment, so it earns the serif — at 28px, the
                size the law actually grants it. It sat at 24. */}
            <div
              className="font-display text-[28px] font-bold leading-none"
              style={{ color: INK, textWrap: "balance" } as React.CSSProperties}
            >
              {PAGE_NAMES.vote}
            </div>
            <div className="slug mt-1.5" style={{ color: `${INK}8C` }}>
              {categoryLabel}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div
                data-qa="ballot-counter"
                className="font-display tabular text-[28px] font-bold leading-none"
                style={{ color: atLimit ? RED : INK }}
              >
                {votesUsed}/{maxVotes}
              </div>
              <div className="text-[10px] tracking-[2px] uppercase mt-1.5" style={{ color: atLimit ? RED : `${INK}73` }}>
                auto-saved
              </div>
            </div>
            {headerAside}
          </div>
        </div>

        {/* THE TAP CUE. The row is not a target and the circle is —
            verified deliberate, and invisible until said out loud.
            RED DISCIPLINE: it stays ink in every state. The limit is
            already declared twice in red (the counter and the filled
            marks); two lines of red running text would make the helper
            the loudest thing on the sheet. */}
        <p
          data-qa="ballot-instruction"
          className="text-[16px] leading-snug mt-3"
          style={{ color: `${INK}A6`, textWrap: "pretty" }}
        >
          {instruction(votesUsed, maxVotes)}
        </p>
      </div>

      {/* ── The options ── */}
      <div className="px-5">
        {ideas.map((idea, i) => {
          const isVoted = votedIds.has(idea.id);
          const canVote = !atLimit || isVoted;
          const team = idea.team_id ? teams[idea.team_id] : undefined;
          const tag = qualifiedIdeaNo(stableNo.get(idea.id), team?.name?.toUpperCase());
          const isExpanded = expandedId === idea.id;

          return (
            <motion.div
              key={idea.id}
              data-qa="ballot-option"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: Math.min(i * STAGGER_DENSE, 0.5) }}
              className="relative py-4 flex items-start gap-4 select-none transition-opacity duration-200"
              style={{
                borderBottom: HAIRLINE,
                opacity: canVote ? 1 : 0.45,
                WebkitTapHighlightColor: "transparent",
                touchAction: "pan-y",
              }}
            >
              {/* The vote mark — fixed 48×48, no layout shift. Votes
                  register ONLY here, never on the row. */}
              <motion.button
                onClick={(e) => { e.stopPropagation(); if (canVote) onToggle(idea.id); }}
                disabled={!canVote}
                aria-pressed={isVoted}
                aria-label={isVoted ? `Take back your vote for ${idea.name}` : `Cast a vote for ${idea.name}`}
                whileTap={{ scale: 1.12 }}
                animate={isVoted ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 16 }}
                layout={false}
                className="ballot-circle rounded-full flex items-center justify-center"
                style={{
                  width: 48, height: 48, minWidth: 48, minHeight: 48,
                  background: isVoted ? RED : PAPER,
                  border: isVoted ? "2.5px solid #B78938" : "2px solid rgba(48,51,52,0.28)",
                  boxShadow: isVoted ? "0 4px 16px rgba(0,38,99,0.3)" : "none",
                  cursor: canVote ? "pointer" : "default",
                  transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease",
                }}
              >
                {isVoted ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                    <path d="M4 10l4 4 8-8" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 rounded-full" style={{ background: `${INK}26` }} />
                )}
              </motion.button>

              {/* The idea — tap to read all of it. */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => onExpand(isExpanded ? null : idea.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(isExpanded ? null : idea.id); }
                }}
              >
                {/* SERIF LAW: idea titles are Sans Bold on every
                    surface. This one had drifted to 19px serif. */}
                <h3 className="font-bold text-[19px] leading-tight" style={{ color: INK }}>
                  {idea.name}
                </h3>

                {/* WHOSE IDEA THIS IS. Three teams each own a №01, so
                    the ballot — the one phone surface that stands them
                    together — qualifies it: swatch, then `TOUFFOU 03`.
                    The swatch is a mark and keeps the raw hue; the label
                    is TYPE on white and takes paperType(), or the warm
                    stone reads 2.3:1 (Round 17 item 2). */}
                {(tag || idea.source === "tissue") && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {team && (
                      <span className="w-[12px] h-[12px] shrink-0" style={{ background: team.color }} />
                    )}
                    {tag && (
                      <span
                        data-qa="idea-no"
                        className="font-bold text-[12px] tracking-[1.5px] uppercase leading-none"
                        style={{ color: team ? paperType(team.color) : `${INK}B3` }}
                      >
                        {tag}
                      </span>
                    )}
                    {idea.source === "tissue" && (
                      <span className="stamp" style={{ color: `${INK}B3` }}>Starter</span>
                    )}
                  </div>
                )}

                {/* Arm's length: the paper register's running text is
                    16px everywhere else in the system (the Board card),
                    and this is the only place a voter reads an idea. */}
                {idea.description && (
                  <p
                    className={`text-[16px] leading-relaxed mt-1.5 transition-all duration-200 ${isExpanded ? "max-h-[280px] overflow-y-auto" : "line-clamp-2"}`}
                    style={{ color: `${INK}99`, textWrap: "pretty" }}
                  >
                    {idea.description}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}

        {ideas.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[16px]" style={{ color: `${INK}8C` }}>
              Nothing on the ballot for this category yet.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
