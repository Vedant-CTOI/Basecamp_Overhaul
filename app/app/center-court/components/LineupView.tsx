"use client";

import { motion } from "framer-motion";
import { Idea, Team } from "@/lib/types";
import { GROUPS, GROUP_LIST, PILLARS, BRAND, IMAGE_VOCAB as V, type PillarSlug, type Wave } from "@/lib/config";
import { ideaNumbers, qualifiedIdeaNo } from "@/lib/idea-number";
import PrintReveal from "@/components/PrintReveal";

interface LineupViewProps {
  pillarSlug: PillarSlug;
  ideas: Idea[];                 // already scoped to this pillar, all teams
  teams: Team[];
  onDemote: (id: string) => void;
  onSetWave: (id: string, wave: Wave | null) => void;
  onOpen: (idea: Idea) => void;
}

const TWEEN_ENTER = {
  type: "tween" as const,
  duration: 0.35,
  ease: [0.05, 0.7, 0.1, 1] as [number, number, number, number],
};

export default function LineupView({
  pillarSlug,
  ideas,
  teams,
  onDemote,
  onOpen,
}: LineupViewProps) {
  const pillarDef = PILLARS[pillarSlug];
  // THE STABLE № — from the whole category, never from the shortlist
  // this view renders (lib/idea-number).
  const stableNo = ideaNumbers(ideas);

  // Shortlisted ideas of this pillar, in team order (GROUPS), newest first within each
  const startingLineup = (() => {
    const lineup = ideas.filter((i) => i.status === "starting_lineup");
    const ordered: Idea[] = [];
    for (const group of GROUP_LIST) {
      const team = teams.find((t) => t.slug === group.slug);
      if (!team) continue;
      ordered.push(
        ...lineup
          .filter((i) => i.team_id === team.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    }
    // Any unmatched ideas at the end
    const seen = new Set(ordered.map((i) => i.id));
    lineup.filter((i) => !seen.has(i.id)).forEach((i) => ordered.push(i));
    return ordered;
  })();

  // Get team group (color + name) for an idea
  const getGroupForIdea = (idea: Idea) => {
    const team = teams.find((t) => t.id === idea.team_id);
    return team ? Object.values(GROUPS).find((g) => g.slug === team.slug) : undefined;
  };

  // Empty state
  if (startingLineup.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="font-display text-[64px] text-[#2C2419]">
          Nothing shortlisted yet.
        </h2>
        <p className="text-[24px] mt-3" style={{ color: "#8A7A62" }}>
          Shortlist ideas from the presenting view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Pillar header + count */}
      <motion.div
        className="flex items-baseline justify-between mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TWEEN_ENTER }}
      >
        <h2 className="font-display text-[44px] text-[#2C2419]">
          The shortlist — {pillarDef?.label || pillarSlug}
        </h2>
        <div>
          <span className="font-display text-[28px] tabular text-[#2C2419]">
            {startingLineup.length}
          </span>
          <span
            className="font-bold text-[12px] tracking-[2px] uppercase ml-2"
            style={{ color: "#8A7A62" }}
          >
            {startingLineup.length === 1 ? "IDEA" : "IDEAS"}
          </span>
        </div>
      </motion.div>

      {/* Idea rows */}
      <div className="flex flex-col gap-2">
        {startingLineup.map((idea, i) => {
          const group = getGroupForIdea(idea);
          const teamColor = group?.color || "#555";
          return (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                ...TWEEN_ENTER,
                delay: 0.08 + i * 0.06,
              }}
              onClick={() => onOpen(idea)}
              className="relative rounded-lg cursor-pointer transition-all duration-200 overflow-hidden"
              style={{
                background: "transparent",
                // Every row here is a select, and the select is the
                // frame — the same red border the card carries on the
                // board and on the presenting wall.
                border: `2px solid ${BRAND.colors.primary}`,
              }}
            >
              {/* Row content */}
              <div className="flex items-center gap-5 pl-5 pr-5 py-4">
                {/* Idea name. The team reads as swatch + name — the
                    returns card's device. A full-height team spine sat
                    directly inside the red select border, and on the
                    team whose hue IS a red it vanished into it. */}
                <div className="w-[280px] shrink-0">
                  {/* Serif law: idea titles are Sans Bold on every surface */}
                  <h3 className="font-bold text-[22px] text-[#2C2419] leading-tight tracking-[-0.01em]">
                    {idea.name}
                  </h3>
                  {/* QUALIFIED: this shortlist stacks every team's keeps
                      together, so the idea is named the way the room says
                      it — `TOUFFOU 03`, team and number, never a bare
                      number three teams could each claim. */}
                  <span className="flex items-center gap-2 mt-1.5">
                    <span className="w-[12px] h-[12px] shrink-0" style={{ background: teamColor }} />
                    <span
                      data-qa="idea-no"
                      className="font-bold text-[12px] tracking-[1.5px] uppercase"
                      style={{ color: "#2C2419" }}
                    >
                      {qualifiedIdeaNo(stableNo.get(idea.id), group?.name) || group?.name || "—"}
                    </span>
                  </span>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  {idea.description && (
                    <p
                      className="text-[16px] leading-[1.5] line-clamp-2"
                      // Running text holds a measure (Round 8 item 2).
                      // Unmeasured, this row ran ~170 characters to a
                      // line at 1920 — the longest line anywhere in the
                      // system, on a surface the room reads standing up.
                      style={{ color: "#6B5D4A", maxWidth: "48ch", textWrap: "pretty" }}
                    >
                      {idea.description}
                    </p>
                  )}
                </div>

                {/* The print the room chose — the FULL 16:9 frame
                    (format law), the returns' grammar at row scale. A
                    shortlist that hid the pictures would be the only
                    Stage surface that did. */}
                {idea.print_status === "developed" && idea.print_url && (
                  <div
                    className="shrink-0 w-[176px] relative overflow-hidden"
                    style={{ aspectRatio: "16 / 9", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    <PrintReveal src={idea.print_url} alt={`${V.artifact} — ${idea.name}`} />
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDemote(idea.id);
                  }}
                  className="px-2 py-1 text-[11px] tracking-[1px] uppercase cursor-pointer rounded transition-colors shrink-0 opacity-30 hover:opacity-80"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(107,93,74,0.25)",
                    color: "#6B5D4A",
                  }}
                >
                  Remove
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
