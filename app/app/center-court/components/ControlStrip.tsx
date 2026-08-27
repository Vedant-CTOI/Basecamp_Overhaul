"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type WorkshopState, getStateLabel } from "@/lib/workshop-phase";
import { BRAND } from "@/lib/config";

interface ControlStripProps {
  workshopState: WorkshopState;
  pillarLabel: string;
  teamName: string;
  teamColor: string;
  votingEnabled: boolean;
  selectedCount: number;
  totalVoters: number;
  totalParticipants: number;
  onOpenVoting: () => void;
  onCloseVoting: () => void;
  onShowCounts: () => void;
  onAdvanceToLineup: () => void;
  onNextTeam: () => void;
  onNextPillar: () => void;
  onShowFullLineup: () => void;
  onBenchSelected: () => void;
  onCombineSelected: () => void;
  onLinkSelected: () => void;
  combining: boolean;
  onBackToPresenting: () => void;
  isLastPillar: boolean;
}

// Dove pill controls — the facilitator's strip wears the same language
// as every other surface: rounded pills, lift + glow on the primary.
// Overhaul register: soft neumorphic pills on cream
const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg, #002663 0%, #0A3478 100%)",
  border: "1px solid rgba(183,137,56,0.5)",
  color: "#fff",
  borderRadius: 999,
  boxShadow: "0 3px 14px rgba(0,38,99,0.28)",
};
const secondaryBtn: React.CSSProperties = {
  background: "#FBF8F3",
  border: "1.5px solid rgba(167,151,128,0.5)",
  color: "#2C2419",
  borderRadius: 999,
  boxShadow: "var(--neo-raised-sm)",
};
const primaryHoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "translateY(-1px)";
  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,38,99,0.4)";
};
const primaryHoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = "none";
  e.currentTarget.style.boxShadow = "0 3px 14px rgba(0,38,99,0.28)";
};
const secondaryHoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = "#B78938";
  e.currentTarget.style.transform = "translateY(-1px)";
};
const secondaryHoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = "rgba(167,151,128,0.5)";
  e.currentTarget.style.transform = "none";
};

export default function ControlStrip({
  workshopState,
  pillarLabel,
  teamName,
  teamColor,
  votingEnabled,
  selectedCount,
  totalVoters,
  totalParticipants,
  onOpenVoting,
  onCloseVoting,
  onShowCounts,
  onAdvanceToLineup,
  onNextTeam,
  onNextPillar,
  onShowFullLineup,
  onBenchSelected,
  onCombineSelected,
  onLinkSelected,
  combining,
  onBackToPresenting,
  isLastPillar,
}: ControlStripProps) {
  const stateLabel = getStateLabel(workshopState);
  const view = workshopState.view;
  const presenting = view === "pillar" && !workshopState.voting_open && !workshopState.show_counts;

  // One primary per state: once returns exist, "Show the returns" is the forward
  // action and "Open the ballot" recedes to secondary. Never two red buttons.
  const hasReturns = totalVoters > 0;
  const openBallotStyle = hasReturns ? secondaryBtn : primaryBtn;
  const openBallotHoverOn = hasReturns ? secondaryHoverOn : primaryHoverOn;
  const openBallotHoverOff = hasReturns ? secondaryHoverOff : primaryHoverOff;

  // Contextual "what's next" hint based on current state
  const nextHint = (() => {
    if (view === "full_lineup") return null; // no next step here
    if (view === "lineup") return isLastPillar ? "→ The full shortlist" : "→ Next category";
    if (workshopState.show_counts) return "→ Shortlist ideas, then advance";
    if (workshopState.voting_open) return "→ Close the ballot when ready";
    if (view === "pillar") return votingEnabled ? "→ Rotate the teams, then open the ballot" : "→ Shortlist or set aside ideas, then advance";
    return null;
  })();

  return (
    <div
      className="h-[52px] flex items-center justify-between px-6 shrink-0"
      style={{
        background: "#EDE6DC",
        borderTop: "1px solid rgba(167,151,128,0.4)",
        boxShadow: "0 -6px 18px rgba(166,146,116,0.12)",
      }}
    >
      {/* Left: Status — the pillar is the unit; the team is the turn */}
      <div className="flex items-center gap-3">
        {view === "full_lineup" ? (
          <span className="font-bold text-[14px] tracking-[2px] uppercase" style={{ color: "#fff" }}>
            THE FULL SHORTLIST
          </span>
        ) : (
          <>
            <span className="font-bold text-[14px] tracking-[2px] uppercase" style={{ color: "rgba(44,36,25,0.65)" }}>
              {pillarLabel.toUpperCase()}
            </span>
            {presenting && (
              // Round 7 item 5 — NO COLOURED DISPLAY TYPE ON DARK. The
              // team's turn is the loud half of this line, but it is
              // loud in white: cobalt caps sat at ~2:1 here and red caps
              // bloomed on the projector. Team hue lives in the spine
              // beside the header, never in room-facing type.
              <span className="font-bold text-[14px] tracking-[2px] uppercase" style={{ color: "#2C2419" }}>
                · {teamName.toUpperCase()}
              </span>
            )}
          </>
        )}
        <span className="text-[13px] tracking-[1px] uppercase" style={{ color: "#8A7A62" }}>
          {workshopState.voting_open && (
            <span className="inline-flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full live-pulse"
                style={{ background: BRAND.colors.primary }}
              />
              <span style={{ color: "#fff" }}>BALLOT OPEN</span>
              <span className="tabular" style={{ color: "#8A7A62" }}>
                {totalVoters} of {totalParticipants}
              </span>
            </span>
          )}
          {!workshopState.voting_open && view !== "full_lineup" && stateLabel}
        </span>
        {nextHint && (
          <span className="text-[12px] tracking-[1px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            {nextHint}
          </span>
        )}
      </div>

      {/* Right: Contextual actions */}
      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          {/* Presenting — no selection: rotate the turn, then open the ballot */}
          {votingEnabled && presenting && selectedCount === 0 && (
            <motion.div
              key="open-voting"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={onNextTeam}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                Next team
              </button>
              <button
                onClick={onOpenVoting}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer transition-all duration-200 rounded"
                style={openBallotStyle}
                onMouseEnter={openBallotHoverOn}
                onMouseLeave={openBallotHoverOff}
              >
                Open the ballot →
              </button>
            </motion.div>
          )}

          {/* Presenting — no voting, no selection: rotate, or advance to the shortlist */}
          {!votingEnabled && presenting && selectedCount === 0 && (
            <motion.div
              key="advance-no-voting"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={onNextTeam}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                Next team
              </button>
              <button
                onClick={onAdvanceToLineup}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-all duration-200"
                style={primaryBtn}
                onMouseEnter={primaryHoverOn}
                onMouseLeave={primaryHoverOff}
              >
                Advance to the Shortlist →
              </button>
            </motion.div>
          )}

          {/* Presenting — ideas selected */}
          {presenting && selectedCount > 0 && (
            <motion.div
              key="selection-actions"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="text-[12px] tracking-[1px] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
                {selectedCount} selected
              </span>
              <button
                onClick={onBenchSelected}
                className="px-3 py-1.5 text-[12px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                Set aside
              </button>
              {selectedCount >= 2 && (
                <>
                  <button
                    onClick={onCombineSelected}
                    disabled={combining}
                    className="px-3 py-1.5 text-[12px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors disabled:opacity-50 flex items-center gap-2"
                    style={secondaryBtn}
                    onMouseEnter={secondaryHoverOn}
                    onMouseLeave={secondaryHoverOff}
                  >
                    {combining && <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/70 animate-spin" />}
                    {combining ? "Combining..." : "Combine"}
                  </button>
                  <button
                    onClick={onLinkSelected}
                    className="px-3 py-1.5 text-[12px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                    style={secondaryBtn}
                    onMouseEnter={secondaryHoverOn}
                    onMouseLeave={secondaryHoverOff}
                  >
                    Link
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Voting open */}
          {votingEnabled && view === "pillar" && workshopState.voting_open && (
            <motion.div
              key="close-voting"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={onCloseVoting}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                Close the ballot
              </button>
            </motion.div>
          )}

          {/* Voting closed, counts not shown yet */}
          {votingEnabled && presenting && selectedCount === 0 && totalVoters > 0 && (
            <motion.div
              key="show-results"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={onShowCounts}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={primaryBtn}
                onMouseEnter={primaryHoverOn}
                onMouseLeave={primaryHoverOff}
              >
                Show the returns
              </button>
            </motion.div>
          )}

          {/* Results showing — back or advance to the shortlist */}
          {view === "pillar" && workshopState.show_counts && (
            <motion.div
              key="advance-lineup"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={onBackToPresenting}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                ← Presenting
              </button>
              <button
                onClick={onAdvanceToLineup}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-all duration-200"
                style={primaryBtn}
                onMouseEnter={primaryHoverOn}
                onMouseLeave={primaryHoverOff}
              >
                Advance to the Shortlist →
              </button>
            </motion.div>
          )}

          {/* Pillar shortlist view — on to the next category, or the full shortlist */}
          {view === "lineup" && (
            <motion.div
              key="next-pillar"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3"
            >
              <button
                onClick={onBackToPresenting}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-colors"
                style={secondaryBtn}
                onMouseEnter={secondaryHoverOn}
                onMouseLeave={secondaryHoverOff}
              >
                ← Presenting
              </button>
              <button
                onClick={isLastPillar ? onShowFullLineup : onNextPillar}
                className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase cursor-pointer rounded transition-all duration-200"
                style={primaryBtn}
                onMouseEnter={primaryHoverOn}
                onMouseLeave={primaryHoverOff}
              >
                {isLastPillar ? "Show the full shortlist ★" : "Next category →"}
              </button>
            </motion.div>
          )}

          {/* Full Shortlist — no navigation needed (all categories visible) */}
        </AnimatePresence>
      </div>
    </div>
  );
}
