"use client";

import { motion } from "framer-motion";
import { Idea, Team } from "@/lib/types";
import { GROUPS, PILLARS, PILLAR_LIST, GROUP_LIST, BRAND, IMAGE_VOCAB as V, type PillarSlug, type Wave } from "@/lib/config";
import { ideaNumbers, qualifiedIdeaNo } from "@/lib/idea-number";
import PrintReveal from "@/components/PrintReveal";
import StageIdeaPlate from "@/components/StageIdeaPlate";

interface FullLineupViewProps {
  ideas: Idea[];
  teams: Team[];
  onSetWave: (id: string, wave: Wave | null) => void;
  onOpen: (idea: Idea) => void;
}

const TWEEN_ENTER = {
  type: "tween" as const,
  duration: 0.35,
  ease: [0.05, 0.7, 0.1, 1] as [number, number, number, number],
};

export default function FullLineupView({
  ideas,
  teams,
  onOpen,
}: FullLineupViewProps) {
  const startingLineup = ideas.filter((i) => i.status === "starting_lineup");
  // THE STABLE № — derived from the WHOLE idea set this view is handed,
  // never from the shortlist it renders: a number taken from a filtered
  // slice is a position again (lib/idea-number).
  const stableNo = ideaNumbers(ideas);

  if (startingLineup.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="font-display text-[64px] text-[#2C2419]">
          Nothing shortlisted yet.
        </h2>
        <p className="text-[24px] mt-3" style={{ color: "#8A7A62" }}>
          Shortlist ideas from each team&apos;s presenting view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Header */}
      <motion.div
        className="flex items-baseline justify-between mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TWEEN_ENTER }}
      >
        <h2 className="font-display text-[44px] text-[#2C2419]">
          The full shortlist
        </h2>
        <div>
          <span className="font-display text-[28px] tabular text-[#2C2419]">
            {startingLineup.length}
          </span>
          <span className="font-bold text-[12px] tracking-[2px] uppercase ml-2" style={{ color: "#8A7A62" }}>
            {startingLineup.length === 1 ? "IDEA" : "IDEAS"} ACROSS {GROUP_LIST.length} TEAMS
          </span>
        </div>
      </motion.div>

      {/* 3-column grid — one column per team */}
      <motion.div
        className="grid grid-cols-3 gap-5 items-start"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TWEEN_ENTER, delay: 0.1 }}
      >
        {GROUP_LIST.map((groupDef) => {
          const teamRecord = teams.find((t) => t.slug === groupDef.slug);
          const teamId = teamRecord?.id;
          if (!teamId) return <div key={groupDef.slug} />;

          // The column's own order, made explicit: pillar by pillar,
          // newest first inside each — the SAME order the Stage page
          // walks with previous/next. The ORDER is this column's; the
          // NUMBER is the idea's own and comes from `stableNo`.
          const byPillar = PILLAR_LIST.map((pillarDef) => ({
            pillarDef,
            ideas: startingLineup
              .filter((i) => i.team_id === teamId && i.category === pillarDef.slug)
              .sort((a, b) => b.created_at.localeCompare(a.created_at)),
          }));
          const teamIdeas = byPillar.flatMap((g) => g.ideas);

          return (
            <div key={groupDef.slug} className="flex flex-col gap-3">
              {/* Team header — platform name as hero */}
              <div
                className="flex flex-col gap-1 px-3 py-3 rounded"
                style={{ background: `${groupDef.color}15`, borderLeft: `4px solid ${groupDef.color}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[12px] tracking-[3px] uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {groupDef.name}
                  </span>
                  <span className="font-bold text-[16px] tabular text-[#2C2419]">
                    {teamIdeas.length}
                  </span>
                </div>
                {/* Platform name stays high-contrast white — team hue lives in the spine
                    and tint (colored display type on dark fails the projector rule). */}
                {teamRecord?.creative_platform_name && (
                  <span className="font-bold text-[16px] tracking-[1px] uppercase leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>
                    {teamRecord.creative_platform_name}
                  </span>
                )}
              </div>

              {/* Pillar sub-groups */}
              {byPillar.map(({ pillarDef, ideas: pillarIdeas }) => {
                if (pillarIdeas.length === 0) return null;
                return (
                  <div key={pillarDef.slug} className="flex flex-col gap-1">
                    <span className="font-bold text-[12px] tracking-[2px] uppercase px-3" style={{ color: "#6B5D4A" }}>
                      {pillarDef.label}
                    </span>
                    {pillarIdeas.map((idea) => {
                      const hasPrint = idea.print_status === "developed" && !!idea.print_url;
                      const frameNo = stableNo.get(idea.id);
                      return (
                        <div
                          key={idea.id}
                          data-qa="shortlist-card"
                          data-fill={hasPrint ? "print" : "plate"}
                          onClick={() => onOpen(idea)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(idea); } }}
                          aria-label={`Open ${idea.name}`}
                          className="flex flex-col rounded cursor-pointer transition-colors overflow-hidden"
                          // The select is the frame here too — every card
                          // on this wall was kept, and it wears the same
                          // red border it wears everywhere else.
                          style={{ background: "transparent", border: `2px solid ${BRAND.colors.primary}` }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* ONE ANATOMY, TWO FILLS — the room chooses from
                              this wall, so a text-only idea cannot arrive
                              at the choosing moment as a thin caption box
                              beside a full key visual. Every card here is
                              a 16:9 mat: a print when the team developed
                              one, the shared typographic plate when they
                              did not. The plate carries the name, so it
                              needs no caption under it; the print does. */}
                          {hasPrint ? (
                            <>
                              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                                <PrintReveal src={idea.print_url!} alt={`${V.artifact} — ${idea.name}`} />
                              </div>
                              <div className="flex flex-col px-3 pt-2.5 pb-3.5">
                                {/* QUALIFIED: this wall stands all three
                                    teams side by side, and each of them
                                    owns a №01 — so the number names its
                                    team, `TOUFFOU 03`. */}
                                <span data-qa="idea-no" className="font-bold text-[12px] leading-none uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.66)" }}>
                                  {qualifiedIdeaNo(frameNo, groupDef.name)}
                                </span>
                                {/* THE shortlist's one title size — the
                                    plate beside it wears exactly this.
                                    24, not 20: this is the wall the room
                                    chooses from, and a 20px name lost to
                                    the 44px masthead above it. */}
                                <h3 className="font-bold text-[24px] leading-[1.15] tracking-[-0.01em] text-[#2C2419] line-clamp-2 mt-1.5">
                                  {idea.name}
                                </h3>
                              </div>
                            </>
                          ) : (
                            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                              <StageIdeaPlate
                                idea={idea}
                                frameNo={frameNo}
                                teamTag={groupDef.name}
                                teamColor={groupDef.color}
                                showCategory={false}
                                titlePx={24}
                                // 16 is the standing projector floor for
                                // anything the room reads; 13 sat under
                                // it on the one surface the room chooses
                                // from.
                                descPx={16}
                                descLines={3}
                                slugPx={12}
                                ground="#131215"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty state */}
              {teamIdeas.length === 0 && (
                <div className="px-3 py-2 text-[12px] italic" style={{ color: "#4a4749" }}>
                  —
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
