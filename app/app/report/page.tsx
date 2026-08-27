"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Idea, Team } from "@/lib/types";
import { PILLAR_LIST, BRAND, PAGE_NAMES, WAVE_LIST, FRAMEWORK_FIELDS } from "@/lib/config";
import { EASE } from "@/lib/motion";
import Link from "next/link";
import ChinaMark from "@/components/ChinaMark";

const INK = BRAND.colors.ink;
const RED = BRAND.colors.primary;
const PAPER = BRAND.colors.paper;
const RULE = `1px solid ${INK}40`;

interface PillarData {
  pillar: typeof PILLAR_LIST[number];
  startingLineup: Idea[];
  benched: Idea[];
  totalIdeas: number;
  totalVotes: number;
}

function EditionLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: PAPER }}>
      <p className="font-display italic text-[18px]" style={{ color: `${INK}99` }}>Composing the Edition…</p>
    </div>
  );
}

// Crop marks — this surface genuinely prints
function CropMarks() {
  const stroke = `${INK}59`;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="absolute" style={{ top: 26, left: 8, width: 16, height: 1, background: stroke }} />
      <span className="absolute" style={{ top: 8, left: 26, width: 1, height: 16, background: stroke }} />
      <span className="absolute" style={{ top: 26, right: 8, width: 16, height: 1, background: stroke }} />
      <span className="absolute" style={{ top: 8, right: 26, width: 1, height: 16, background: stroke }} />
      <span className="absolute" style={{ bottom: 26, left: 8, width: 16, height: 1, background: stroke }} />
      <span className="absolute" style={{ bottom: 8, left: 26, width: 1, height: 16, background: stroke }} />
      <span className="absolute" style={{ bottom: 26, right: 8, width: 16, height: 1, background: stroke }} />
      <span className="absolute" style={{ bottom: 8, right: 26, width: 1, height: 16, background: stroke }} />
    </div>
  );
}

function EditionContent() {
  const searchParams = useSearchParams();
  const presentMode = searchParams.get("present") === "true";

  const [teams, setTeams] = useState<Team[]>([]);
  const [pillarData, setPillarData] = useState<PillarData[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [revealedPillars, setRevealedPillars] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(presentMode);

  const fetchData = useCallback(async () => {
    const [teamsRes, ideasRes, votesRes] = await Promise.all([
      supabase.from("teams").select("*").order("slug"),
      supabase.from("ideas").select("*").order("category").order("wave").order("created_at"),
      supabase.from("votes").select("idea_id"),
    ]);

    if (teamsRes.data) setTeams(teamsRes.data as Team[]);

    // Count votes
    const counts: Record<string, number> = {};
    if (votesRes.data) {
      for (const v of votesRes.data) {
        counts[v.idea_id] = (counts[v.idea_id] || 0) + 1;
      }
    }
    setVoteCounts(counts);

    // Build pillar data
    const ideas = (ideasRes.data || []) as Idea[];

    const data: PillarData[] = PILLAR_LIST.map((pillar) => {
      const pillarIdeas = ideas.filter((i) => i.category === pillar.slug);
      return {
        pillar,
        startingLineup: pillarIdeas.filter((i) => i.status === "starting_lineup"),
        benched: pillarIdeas.filter((i) => i.status === "bench"),
        totalIdeas: pillarIdeas.length,
        totalVotes: pillarIdeas.reduce((sum, i) => sum + (counts[i.id] || 0), 0),
      };
    });

    setPillarData(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reveal one pillar at a time (for ceremony)
  const revealPillar = (slug: string) => {
    setRevealedPillars((prev) => new Set(prev).add(slug));
  };

  const revealAll = () => {
    setShowAll(true);
    setRevealedPillars(new Set(PILLAR_LIST.map((p) => p.slug)));
  };

  const totalStartingLineup = pillarData.reduce((s, d) => s + d.startingLineup.length, 0);

  const now = new Date();
  const dateline = [
    `${BRAND.subtitle} ${BRAND.name}`.trim(),
    BRAND.workshopTitle,
    `${now.getDate()} ${now.toLocaleDateString("en-GB", { month: "long" })} ${now.getFullYear()}`,
  ].filter(Boolean).join(" · ");

  if (loading) {
    return <EditionLoading />;
  }

  return (
    <div className="room-scale relative min-h-screen pb-16 flex flex-col halftone-paper" style={{ background: PAPER, color: INK }}>
      <CropMarks />

      {/* Masthead */}
      <div className="px-6 pt-14 pb-5 text-center">
        <h1 className="font-display text-[52px] md:text-[68px] font-bold leading-none" style={{ color: INK, textWrap: "balance" } as React.CSSProperties}>
          {PAGE_NAMES.report}
        </h1>
      </div>
      <div className="max-w-[1160px] mx-auto px-6">
        <div style={{ height: 2, background: RED }} />
        <div className="mt-[4px]" style={{ height: 5, borderTop: RULE, borderBottom: RULE }} />
        <div className="slug text-center py-2" style={{ color: `${INK}8C`, borderBottom: RULE }}>
          {dateline}
          {" · "}
          <span className="stamp text-[10px]" style={{ color: INK, transform: "none" }}>Late City Final</span>
        </div>
      </div>

      {/* Headline stat */}
      <div className="text-center mt-8 mb-10 px-6">
        <p className="font-display text-[21px]" style={{ color: INK }}>
          <span className="highlight-bar-chartreuse inline-block">
            <span className="font-bold tabular text-[32px]" style={{ color: INK }}>{totalStartingLineup}</span>
            {" shortlisted"}
          </span>
          {" across "}
          <span className="font-bold tabular text-[32px]" style={{ color: RED }}>{pillarData.length}</span>
          {" categories"}
        </p>
      </div>

      {/* Reveal controls (for facilitator ceremony) */}
      {!showAll && (
        <div className="px-6 mb-12 flex flex-wrap items-center justify-center gap-3">
          {PILLAR_LIST.map((pillar) => (
            <button
              key={pillar.slug}
              onClick={() => revealPillar(pillar.slug)}
              disabled={revealedPillars.has(pillar.slug)}
              className="px-5 py-3 text-[13px] font-bold tracking-[0.08em] uppercase transition-all disabled:opacity-30 cursor-pointer"
              style={{ background: PAPER, color: INK, border: `1px solid ${INK}59` }}
            >
              Reveal {pillar.label}
            </button>
          ))}
          <button
            onClick={revealAll}
            className="px-5 py-3 text-[13px] font-bold tracking-[0.08em] uppercase cursor-pointer"
            style={{ background: RED, color: "#fff", border: `1px solid ${RED}` }}
          >
            Show All
          </button>
        </div>
      )}

      {/* Category sections */}
      <div className="max-w-[1160px] mx-auto px-6 space-y-14">
        <AnimatePresence>
          {pillarData.map((data) => {
            const isRevealed = showAll || revealedPillars.has(data.pillar.slug);
            if (!isRevealed) return null;

            const unassigned = data.startingLineup.filter((i) => !i.wave);

            return (
              <motion.section
                key={data.pillar.slug}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                {/* Section header */}
                <div className="pt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1" style={{ borderTop: `2px solid ${INK}` }}>
                  <h2 className="font-display text-[30px] font-bold" style={{ color: INK }}>
                    {data.pillar.label}
                  </h2>
                  <div className="flex items-baseline gap-6">
                    <span className="flex items-baseline gap-2">
                      <span className="font-display tabular text-[22px] font-bold" style={{ color: RED }}>
                        {data.startingLineup.length}
                      </span>
                      <span className="slug" style={{ color: `${INK}8C` }}>shortlisted</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-display tabular text-[22px] font-bold" style={{ color: `${INK}99` }}>
                        {data.totalIdeas}
                      </span>
                      <span className="slug" style={{ color: `${INK}8C` }}>ideas filed</span>
                    </span>
                  </div>
                </div>

                {/* Shortlist by wave — labels from config (D-10), one
                    group per configured wave, the unplaced last */}
                <div className="mt-6">
                  {WAVE_LIST.map((w) => (
                    <WaveGroup
                      key={w.slug}
                      label={w.label}
                      ideas={data.startingLineup.filter((i) => i.wave === w.slug)}
                      teams={teams}
                      voteCounts={voteCounts}
                    />
                  ))}
                  <WaveGroup label="Unplaced" ideas={unassigned} teams={teams} voteCounts={voteCounts} />

                  {data.startingLineup.length === 0 && (
                    <p className="text-[15px] py-4" style={{ color: `${INK}8C` }}>Nothing shortlisted in this category yet.</p>
                  )}
                </div>

                {/* Set aside */}
                {data.benched.length > 0 && (
                  <details className="mt-2">
                    <summary className="slug cursor-pointer" style={{ color: `${INK}73` }}>
                      Set aside ({data.benched.length})
                    </summary>
                    <div className="md:columns-3 mt-3" style={{ columnGap: "2.5rem" }}>
                      {data.benched.map((idea) => (
                        <p key={idea.id} className="text-[13px] mb-1.5" style={{ color: `${INK}8C`, breakInside: "avoid" }}>
                          {idea.name}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 pt-16 text-center mt-auto">
        <div className="max-w-[1160px] mx-auto" style={{ borderTop: RULE }}>
          <div className="slug mt-4" style={{ color: `${INK}73` }}>
            {[BRAND.name, BRAND.subtitle, BRAND.year].filter(Boolean).join(" · ")}
          </div>
          <Link href="/center-court" className="inline-block mt-3 font-sans text-[12px] transition-colors" style={{ color: `${INK}8C` }}>
            ← Back to {PAGE_NAMES.centerCourt}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Wave Group (newspaper columns with thin rules) ──

function WaveGroup({
  label, ideas, teams, voteCounts,
}: {
  label: string;
  ideas: Idea[];
  teams: Team[];
  voteCounts: Record<string, number>;
}) {
  if (ideas.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="font-sans text-[11px] font-bold tracking-[3px] uppercase mb-4" style={{ color: `${INK}8C` }}>
        {label}
      </div>
      <div className="md:columns-2 lg:columns-3" style={{ columnGap: "2.5rem", columnRule: `1px solid ${INK}26` }}>
        {ideas.map((idea) => (
          <EditionItem key={idea.id} idea={idea}
            team={teams.find((t) => t.id === idea.team_id)} voteCount={voteCounts[idea.id]} />
        ))}
      </div>
    </div>
  );
}

// ── Edition Item (a newspaper entry, not a card) ──

// Framework labels come from config (D-9 rider): the report used to
// invent its own ("Platform Connection:"), so a relabel in
// FRAMEWORK_FIELDS never reached the printed deliverable.
const FIELD_LABEL = Object.fromEntries(FRAMEWORK_FIELDS.map((f) => [f.key, f.label]));

function EditionItem({
  idea, team, voteCount,
}: {
  idea: Idea;
  team?: Team;
  voteCount?: number;
}) {
  const slugLine = [
    team ? (team.display_name || team.name) : null,
    (voteCount ?? 0) > 0 ? `${voteCount} votes` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mb-7" style={{ breakInside: "avoid" }}>
      <h4 className="font-display text-[17px] font-bold leading-tight mb-1.5" style={{ color: INK }}>
        <span className="relative inline-block mr-1.5 align-[-1px]" style={{ width: 13, height: 13 }}>
          <ChinaMark variant="slash" strokeWidth={8} animate={false} />
        </span>
        {idea.name}
      </h4>
      {idea.description && (
        <p className="font-sans text-[13px] leading-relaxed mb-2" style={{ color: `${INK}A6` }}>{idea.description}</p>
      )}

      {idea.bbei_connection && (
        <p className="font-sans text-[12px] leading-relaxed mb-1.5" style={{ color: `${INK}8C` }}>
          <span className="font-bold" style={{ color: `${INK}B3` }}>{FIELD_LABEL.bbei_connection}:</span> {idea.bbei_connection}
        </p>
      )}
      {idea.key_partners && (
        <p className="font-sans text-[12px] leading-relaxed mb-1.5" style={{ color: `${INK}8C` }}>
          <span className="font-bold" style={{ color: `${INK}B3` }}>{FIELD_LABEL.key_partners}:</span> {idea.key_partners}
        </p>
      )}

      {slugLine && (
        <div className="slug mt-2" style={{ color: `${INK}73` }}>{slugLine}</div>
      )}
    </div>
  );
}

export default function OvernightEditionPage() {
  return (
    <Suspense fallback={<EditionLoading />}>
      <EditionContent />
    </Suspense>
  );
}
