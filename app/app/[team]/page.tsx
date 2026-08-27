"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, DUR, STAGGER, BEAT } from "@/lib/motion";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { Idea, Category, TrainingNote, Team } from "@/lib/types";
import { GROUPS, PILLARS, PILLAR_LIST, BRAND, PAGE_NAMES, paperType, withAlpha, type PillarSlug , PILLAR_SLUGS } from "@/lib/config";
import DoveMark from "@/components/DoveMark";
import { SoftTabs, LiquidBlob } from "@/components/OverhaulUI";
import { SHOWCASE_SCOUT_PITCHES } from "@/lib/showcase-data";
import { ideaNumbers } from "@/lib/idea-number";
import CategoryTabs from "@/components/CategoryTabs";
import { MarkScout } from "@/components/Marks";
import IdeaCard from "@/components/IdeaCard";
import ExpandedCard from "@/components/ExpandedCard";
import AddIdeaModal from "@/components/AddIdeaModal";
import { QRCodeSVG } from "qrcode.react";

// The team board is the proof sheet: paper ground, ink type, the team's
// hue flooding only the hero band. Register contract:
// docs/ogilvy-showcase-direction.md ("Team Board — the proof sheet").
const INK = "#231F20";
const HAIRLINE = "rgba(35,31,32,0.15)";

// White or ink on the team-color hero band, by luminance — same rule as
// the ticker chips (warm-stone Baskerville → ink, cobalt/oxblood → white).
function bandText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 128 ? INK : "#fff";
}

// The paper-side companion to bandText lives in lib/config (`paperType`):
// the band is a team-hue GROUND, so luminance picks the type on top of
// it; the header's chip is the converse — the hue IS the type, on white —
// and a hue too light to carry ink is also too light to be ink.

// ── THE WALL'S MASONRY ───────────────────────────────────────
// USER RULING 2026-08-03 ("I don't know if the way it fills the rows
// with ideas here makes any sense"). It didn't. The wall was CSS
// multi-column, and multicol balances by HEIGHT: with one tall printed
// frame in play the browser filled column one to the floor before it
// started column two, so №01 sat alone above a dead gap, №02 and №03
// stacked in column two, and the wall read down-then-across while the
// numbers scattered.
//
// REAL MASONRY now. Every card is handed, IN ORDER, to whichever column
// is currently SHORTEST — the standard shortest-column-first placement.
// The top row reads 01 · 02 · 03 left to right, every card keeps its own
// content height (a printed frame is taller; that is the point), and no
// column trails a hole while its neighbour is full.
//
// REAL FLEX COLUMNS, not absolutely positioned cards: a stale or missing
// measurement can only cost balance for a frame, never overlap the wall.
// The № is untouched by any of this — it comes from lib/idea-number and
// is the idea's identity, never its seat.

/** The vertical gutter between cards, in px — matches `gap-6`. */
const WALL_GUTTER = 24;

/** Column count at the same breakpoints the multicol wall rode (sm / lg). */
function wallColumnCount(width: number): number {
  return width >= 1024 ? 3 : width >= 640 ? 2 : 1;
}

function useMasonry<T extends { id: string }>(items: T[], firstColumnSeed = 0) {
  // Three on the server and at hydration — the widest case, corrected
  // before the first paint by the layout effect below.
  const [columnCount, setColumnCount] = useState(3);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(() => new Map());

  const elements = useRef(new Map<string, HTMLElement>());
  const idOf = useRef(new WeakMap<Element, string>());
  const refs = useRef(new Map<string, (el: HTMLDivElement | null) => void>());
  const observer = useRef<ResizeObserver | null>(null);
  const pending = useRef(new Map<string, number>());
  const frame = useRef(0);

  // Only a height that really moved is worth a re-render. And a card's
  // height cannot depend on WHICH column holds it — every column is the
  // same width — so re-placing never feeds the observer a new
  // measurement: the pass settles in one step instead of oscillating.
  const merge = useCallback((batch: Map<string, number>, prune: boolean) => {
    setHeights((prev) => {
      const next = prune ? new Map<string, number>() : new Map(prev);
      let changed = prune && prev.size !== batch.size;
      for (const [id, h] of batch) {
        const was = prev.get(id);
        if (was === undefined || Math.abs(was - h) > 0.5) changed = true;
        next.set(id, h);
      }
      return changed ? next : prev;
    });
  }, []);

  // The classic masonry bug is a card whose height changes AFTER the
  // first paint — a print landing, a font swapping, a description
  // growing under an edit. One ResizeObserver catches all of them, and
  // one rAF batches a burst of them into a single re-place.
  const observe = useCallback((el: HTMLElement) => {
    if (typeof ResizeObserver === "undefined") return;
    if (!observer.current) {
      observer.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = idOf.current.get(entry.target);
          if (id) pending.current.set(id, (entry.target as HTMLElement).getBoundingClientRect().height);
        }
        if (frame.current) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const batch = pending.current;
          pending.current = new Map();
          merge(batch, false);
        });
      });
    }
    observer.current.observe(el);
  }, [merge]);

  useEffect(() => () => {
    observer.current?.disconnect();
    observer.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  /** One stable ref per card id, so a re-render never re-attaches. */
  const cardRef = useCallback((id: string) => {
    let fn = refs.current.get(id);
    if (!fn) {
      fn = (el: HTMLDivElement | null) => {
        const held = elements.current.get(id);
        if (held && held !== el) observer.current?.unobserve(held);
        if (el) {
          elements.current.set(id, el);
          idOf.current.set(el, id);
          observe(el);
        } else {
          elements.current.delete(id);
          refs.current.delete(id);
        }
      };
      refs.current.set(id, fn);
    }
    return fn;
  }, [observe]);

  useIsomorphicLayoutEffect(() => {
    const read = () => setColumnCount(wallColumnCount(window.innerWidth));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // A synchronous re-measure whenever the SET of cards changes (a
  // category switch, a realtime insert, a kill) or the columns get a new
  // width — before paint, so the corrected placement lands in the same
  // frame the cards do. Between those moments the observer has the wall.
  const signature = `${items.map((i) => i.id).join("|")}@${columnCount}`;
  useIsomorphicLayoutEffect(() => {
    const batch = new Map<string, number>();
    for (const [id, el] of elements.current) batch.set(id, el.getBoundingClientRect().height);
    merge(batch, true);
  }, [signature, merge]);

  const columns = useMemo(() => {
    const cols: T[][] = Array.from({ length: columnCount }, () => []);
    if (items.length === 0) return cols;
    // A card nobody has measured yet — just filed, just arrived over
    // realtime — is estimated at the wall's median height, so it lands
    // somewhere sane and settles on the next frame instead of throwing
    // the whole wall into a reshuffle. On a cold wall every estimate is
    // equal, which places 01 · 02 · 03 across the top from the very
    // first paint.
    const known = items
      .map((i) => heights.get(i.id))
      .filter((h): h is number => typeof h === "number")
      .sort((a, b) => a - b);
    const estimate = known.length ? known[Math.floor(known.length / 2)] : 0;
    const running = new Array<number>(columnCount).fill(0);
    // The making pockets occupy the head of column one, so that column
    // starts lower. Seeding its running height is what sends the first
    // ideas to the columns BESIDE the pockets instead of beneath them.
    // At ONE column there is no beside: seeding would only bias a choice
    // that has no alternative, so the seed is a multi-column law only.
    if (columnCount > 1 && firstColumnSeed > 0) running[0] = firstColumnSeed + WALL_GUTTER;
    for (const item of items) {
      // A tie goes to the LEFTMOST column — that is what keeps the top
      // row in reading order.
      let target = 0;
      for (let c = 1; c < columnCount; c++) {
        if (running[c] < running[target] - 0.5) target = c;
      }
      cols[target].push(item);
      running[target] += (heights.get(item.id) ?? estimate) + WALL_GUTTER;
    }
    return cols;
  }, [items, columnCount, heights, firstColumnSeed]);

  return { columns, cardRef, columnCount };
}

const TEAM_CONFIG: Record<string, { name: string; color: string }> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, { name: g.name, color: g.color }])
);

const FALLBACK_TEAM_IDS: Record<string, string> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, `local-${g.slug}`])
);

export default function FieldPage() {
  const params = useParams();
  const router = useRouter();
  const teamSlug = params.team as string;
  const config = TEAM_CONFIG[teamSlug];

  const [team, setTeam] = useState<Team | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [trainingNotes, setTrainingNotes] = useState<TrainingNote[]>([]);
  const groupDef = GROUPS[teamSlug as keyof typeof GROUPS];
  const [category, setCategory] = useState<Category>(
    (groupDef?.defaultPillars[0] as Category) || (PILLAR_LIST[0].slug as Category)
  );
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // AI Scout state
  const [scoutedIdeas, setScoutedIdeas] = useState<{ name: string; insight?: string; description: string; bbeiConnection: string }[] | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutModalOpen, setScoutModalOpen] = useState(false);
  const [scoutIndex, setScoutIndex] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  // Voting happens on The Stage (/center-court) and /vote, not here
  const lastIdeasRealtimeAt = useRef(0);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const { data } = await supabase
          .from("teams")
          .select("*")
          .eq("slug", teamSlug)
          .single();
        if (data) {
          setTeam(data);
        } else if (config) {
          setIsLocal(true);
          const groupDef = GROUPS[teamSlug as keyof typeof GROUPS];
          setTeam({
            id: FALLBACK_TEAM_IDS[teamSlug],
            name: config.name,
            slug: teamSlug,
            display_name: null,
            color: config.color,
            assigned_pillars: groupDef?.defaultPillars ?? [],
            facilitator_notes: null,
            creative_platform_name: null,
            creative_platform_brief: null,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Failed to fetch team:", err);
      }
    }
    fetchTeam();
  }, [teamSlug, config]);

  const fetchIdeas = useCallback(async () => {
    if (!team || isLocal) return;
    try {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("team_id", team.id)
        .order("created_at", { ascending: true });
      if (data) setIdeas(data);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
    }
  }, [team, isLocal]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  useEffect(() => {
    if (!team || isLocal) return;
    const channel = supabase
      .channel("ideas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ideas", filter: `team_id=eq.${team.id}` },
        () => { lastIdeasRealtimeAt.current = Date.now(); fetchIdeas(); }
      )
      .subscribe();
    // REMOVED: polling fallback — WebSocket-only per voting stability plan
    return () => { supabase.removeChannel(channel); };
  }, [team, isLocal, fetchIdeas]);

  // Keep the OPEN card in sync with realtime: when a develop lands for
  // the selected idea, hand it the fresh row so the new print develops
  // over the frontispiece live. Always a shallow CLONE — the showcase
  // shim mutates rows in place, so field comparison against the held
  // reference can never detect the change; the clone forces the prop
  // through, and ExpandedCard's same-id sync merges only the print
  // fields, so in-progress edits survive.
  useEffect(() => {
    setSelectedIdea((prev) => {
      if (!prev) return prev;
      const fresh = ideas.find((i) => i.id === prev.id);
      return fresh ? { ...fresh } : prev;
    });
  }, [ideas]);

  // Voting happens on /vote and The Stage — no voting state on team board

  const showcasePitches = () => {
    setScoutedIdeas(SHOWCASE_SCOUT_PITCHES.map((p) => ({
      name: p.name,
      description: p.description,
      bbeiConnection: p.platformConnection,
    })));
    setScoutIndex(0);
  };

  // Scout ideas (background generation)
  const scoutFreeAgents = async () => {
    if (!team || scoutLoading) return;
    setScoutLoading(true);
    setScoutedIdeas(null);
    try {
      const existingIdeas = filteredIdeas.map((i) => ({ name: i.name, description: i.description || "" }));
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, pillar: category, existingIdeas }),
      });
      if (res.ok) {
        const data = await res.json();
        const ideas = data.ideas || [];
        console.log("Scout returned", ideas.length, "ideas");
        if (ideas.length > 0) {
          setScoutedIdeas(ideas);
          setScoutIndex(0);
        } else {
          showcasePitches();
        }
      } else {
        const errorText = await res.text().catch(() => "Unknown error");
        console.error("Scout API error:", res.status, errorText);
        showcasePitches();
      }
    } catch (err) {
      console.error("Scout failed:", err);
      showcasePitches();
    }
    setScoutLoading(false);
  };

  const [scoutKeeping, setScoutKeeping] = useState(false);
  const [scoutFailed, setScoutFailed] = useState(false);

  const keepScoutedIdea = async () => {
    if (!team || !scoutedIdeas || scoutIndex >= scoutedIdeas.length || scoutKeeping) return;
    setScoutKeeping(true);
    const idea = scoutedIdeas[scoutIndex];
    if (isLocal) {
      const newIdea: Idea = {
        id: `local-${Date.now()}`,
        team_id: team.id,
        category,
        name: idea.name,
        description: idea.description,
        status: "draft",
        wave: null,
        bbei_connection: idea.bbeiConnection || null,
        key_partners: null,
        link_group: null,
        source: "ai_scouted",
        gifted_from_team_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setIdeas((prev) => [...prev, newIdea]);
    } else {
      const r = await write(
        "ideas.insert:scout-keep",
        supabase.from("ideas").insert({
          team_id: team.id,
          category,
          name: idea.name,
          description: idea.description,
          bbei_connection: idea.bbeiConnection,
          source: "ai_scouted",
          status: "draft",
        })
      );
      if (!r.ok) {
        // KEPT is a claim about the board. Do not make it, do not
        // advance past the pitch, and leave the scout card where it is
        // so the team can keep it again.
        setScoutKeeping(false);
        setScoutFailed(true);
        return;
      }
      setScoutFailed(false);
      fetchIdeas();
    }
    setTimeout(() => {
      setScoutKeeping(false);
      advanceScout();
    }, 800);
  };

  const advanceScout = () => {
    if (scoutedIdeas && scoutIndex < scoutedIdeas.length - 1) {
      setScoutIndex((i) => i + 1);
    } else {
      setScoutModalOpen(false);
      setScoutedIdeas(null);
    }
  };

  // Leave the pitch deck without ruling on the rest of it. The pitches are
  // kept, not discarded — the tile still reads "N pitches ready" and the deck
  // reopens where it left off. Without this the only way out of the modal was
  // to Keep or Pass every remaining pitch, which stranded a team mid-deck when
  // the room moved on.
  const closeScout = useCallback(() => setScoutModalOpen(false), []);

  useEffect(() => {
    if (!scoutModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeScout();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [scoutModalOpen, closeScout]);

  useEffect(() => {
    if (!selectedIdea || isLocal) return;
    async function fetchNotes() {
      try {
        const { data } = await supabase
          .from("training_notes")
          .select("*")
          .eq("idea_id", selectedIdea!.id)
          .order("created_at", { ascending: true });
        if (data) setTrainingNotes(data);
      } catch (err) {
        console.error("Failed to fetch training notes:", err);
      }
    }
    fetchNotes();
  }, [selectedIdea, isLocal]);

  const addIdeaLocally = (name: string, description: string | null) => {
    const newIdea: Idea = {
      id: `local-${Date.now()}`,
      team_id: team!.id,
      category,
      name,
      description,
      status: "draft",
      wave: null,
      bbei_connection: null,
      key_partners: null,
      link_group: null,
      source: "team",
      gifted_from_team_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setIdeas((prev) => [...prev, newIdea]);
  };

  // THE STABLE № — derived once from the team's WHOLE board (every
  // category, every status, set-aside included), so the wall's sort
  // below cannot move a number. `ideas` is exactly that fetch.
  const stableNo = ideaNumbers(ideas);

  const STATUS_ORDER: Record<string, number> = { starting_lineup: 0, coached: 1, draft: 2, bench: 3 };
  const filteredIdeas = ideas
    .filter((i) => i.category === category)
    .sort((a, b) => {
      // Shortlisted → Coached → Draft
      const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      // Shortlisted ideas sort above others
      if (a.status === "starting_lineup" && b.status !== "starting_lineup") return -1;
      if (b.status === "starting_lineup" && a.status !== "starting_lineup") return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const categoryCounts: Record<string, number> = {};
  for (const p of PILLAR_LIST) {
    categoryCounts[p.slug] = ideas.filter((i) => i.category === p.slug).length;
  }

  const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
    PILLAR_LIST.map((p) => [p.slug, p.label])
  );

  // The wall's placement — shortest column first, in board order.
  // The pockets ride the head of column one (124px), so the wall places
  // the first ideas alongside them rather than under them.
  const MAKING_H = 124;
  const { columns: wallColumns, cardRef: wallCardRef, columnCount: wallColumnCount } = useMasonry(filteredIdeas, MAKING_H);
  // On a bare wall the guidance takes the column BESIDE the pockets, so
  // the pockets keep their seat and their width. At one column there is
  // no beside, so it falls in under them.
  const guidanceColumn = wallColumnCount > 1 ? 1 : 0;
  // Render position, for the arrival stagger only — never identity.
  const seatOf = new Map(filteredIdeas.map((idea, i) => [idea.id, i]));

  // Navigate between ideas — uses filteredIdeas (same order as rendered on screen)
  const navigateIdea = useCallback((direction: "prev" | "next") => {
    if (!selectedIdea || filteredIdeas.length === 0) return;
    const idx = filteredIdeas.findIndex((i) => i.id === selectedIdea.id);
    if (idx === -1) return;
    const next = direction === "next"
      ? (idx + 1) % filteredIdeas.length
      : (idx - 1 + filteredIdeas.length) % filteredIdeas.length;
    setSelectedIdea(filteredIdeas[next]);
  }, [selectedIdea, filteredIdeas]);

  useEffect(() => {
    if (!selectedIdea) return;
    const handler = (e: KeyboardEvent) => {
      // Keys pressed inside a field belong to the field: arrows move the
      // caret, and Esc releases focus (a second press closes the card) —
      // never a silent navigation that discards in-progress edits.
      const t = e.target as HTMLElement | null;
      const editable = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        if (editable) { t.blur(); return; }
        setSelectedIdea(null);
        return;
      }
      // While the coach takeover holds the screen the chevrons are hidden;
      // the arrow keys must hold still with them.
      if (editable || coachOpen) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateIdea("prev"); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigateIdea("next"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdea, navigateIdea, coachOpen]);

  // Below every hook, so an unknown team slug can never change the hook
  // count between renders.
  if (!config) return null;

  // THE MAKING POCKETS — in the wall, not above it (user ruling 2026-08-03:
  // "I want each button to be half of one column, and then the other two
  // columns are filled with content"). The pair holds exactly ONE masonry
  // column, each pocket half of it, at the head of column one. The masonry
  // seeds that column with MAKING_H so the first ideas place in the columns
  // BESIDE the pockets rather than beneath them.
  //
  // Two earlier attempts and why they failed:
  //  · a 170px pocket occupying one whole column ABOVE the wall — it spent
  //    two thirds of its own height on nothing, left the rest of that row in
  //    white, and pushed every idea down the page;
  //  · a shallow full-width bar above the wall — it wasted no width, but it
  //    ignored the column rhythm entirely and still spent a whole band of
  //    the page on two controls.
  // Inside the wall the pair costs one column of one row and nothing else.
  //
  // AT ONE COLUMN the pockets unavoidably head the only column there is, so
  // they drop to 88px: still two half-column targets, but ~36px less of the
  // fold spent on controls, which keeps the first idea reachable on a short
  // phone. (88px still clears the Scout's mark + name + status stack.)
  const making = (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.beat, delay: BEAT.detail + STAGGER, ease: EASE }}
          data-qa="board-making"
          className="grid grid-cols-2 gap-2 h-[88px] sm:h-[124px] w-full"
        >
          {/* Slots read as recessed pockets on the sheet — finer, quieter
              dash than the printed frames, faint ground fill — so real
              ideas out-weigh the controls at a squint. */}
          <button
            onClick={() => setShowAddModal(true)}
            className="add-pocket flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            style={{ color: "#4a4749" }}
          >
            <span className="add-plus text-[20px] leading-none font-light" aria-hidden>+</span>
            <span className="text-[15px] font-bold">Add an idea</span>
          </button>
          <button
            onClick={() => {
              if (scoutedIdeas && !scoutLoading) {
                setScoutIndex(0);
                setScoutModalOpen(true);
              } else {
                scoutFreeAgents();
              }
            }}
            className="flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
            style={{
              border: scoutedIdeas ? `1.5px solid ${withAlpha(BRAND.colors.primary, 0.45)}` : "1.5px dashed rgba(35,31,32,0.22)",
              background: scoutedIdeas ? withAlpha(BRAND.colors.primary, 0.04) : "rgba(35,31,32,0.02)",
              color: "#4a4749",
            }}
            onMouseEnter={(e) => { if (!scoutedIdeas) { e.currentTarget.style.background = "rgba(35,31,32,0.045)"; e.currentTarget.style.borderColor = "rgba(35,31,32,0.5)"; e.currentTarget.style.color = INK; } }}
            onMouseLeave={(e) => { if (!scoutedIdeas) { e.currentTarget.style.background = "rgba(35,31,32,0.02)"; e.currentTarget.style.borderColor = "rgba(35,31,32,0.22)"; e.currentTarget.style.color = "#4a4749"; } }}
          >
            {scoutLoading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-[rgba(35,31,32,0.15)] border-t-[rgba(35,31,32,0.5)] animate-spin" />
                <span className="text-[13px]" style={{ color: "#8A8689" }}>Drafting pitches…</span>
              </>
            ) : scoutedIdeas ? (
              <>
                <MarkScout size={26} className="opacity-70" />
                <span className="font-bold text-[15px]" style={{ color: INK }}>The Scout</span>
                <span className="text-[13px] font-bold" style={{ color: BRAND.colors.primary }}>
                  {scoutedIdeas.length} {scoutedIdeas.length === 1 ? "pitch" : "pitches"} ready
                </span>
              </>
            ) : (
              <>
                <MarkScout size={26} className="opacity-70" />
                <span className="font-bold text-[15px]" style={{ color: INK }}>The Scout</span>
                <span className="text-[13px]" style={{ color: "#8A8689" }}>Ask for a pitch</span>
              </>
            )}
          </button>
        </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.cut }}
      className="overhaul-page room-scale min-h-screen relative"
      style={{ background: "#FFFFFF", color: INK }}
    >
      {/* Sticky header — beat 1: the structure arrives.

          THE PHONE BREAKPOINT (599px) is the Board's only one, and it
          exists because of a measurement: at 390×844 this row ran 562px
          wide and took the whole page sideways with it. The wall was
          never the cause — it collapses to one column correctly and
          holds its width — the chrome was. Two jobs were competing for
          one line: identity (wordmark · team · page name) and
          destinations (Home · The Feed · The Stage), 241px and
          272px of type that does not wrap, inside 294px of measure.

          They become two lines rather than one crushed one. Identity
          keeps the top line; the destinations take the second and
          spread across it, so each stays a real target instead of a
          shrunken one. The page name is what the phone drops — the
          participant navigated here deliberately, and the team chip
          beside the wordmark already says whose board this is.

          599px is MEASURED, not taken off a scale, and the number is
          the interesting part. The row's min-content width is not one
          number: it is 562px on Touffou and 593px on Baskerville,
          because the team's own name is in it. So the breakpoint has to
          clear the widest configured team, and a tidier 520 — which
          covers every portrait phone — would have left the 520–592 band
          still scrolling sideways on one team out of three. The ceiling
          is the Board's one-column state at 600×900, a settled
          composition (Round 19 item 3) that nothing here may reach.
          593 < 599 < 600 closes the whole measured range and leaves
          that composition untouched.

          The honest limit, on the record rather than discovered later:
          593px is what THIS engagement's team names and PAGE_NAMES
          measure. An engagement with longer names wants this
          re-measured, not inherited — and if it ever exceeds 600 the
          Board's own 600×900 composition is the thing to re-judge, not
          this breakpoint. */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: DUR.beat, delay: BEAT.structure, ease: EASE }}
        className="flex items-center justify-between px-12 py-4 sticky top-0 z-[100] max-[599px]:flex-col max-[599px]:items-stretch max-[599px]:gap-3 max-[599px]:py-3"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <div className="flex items-center gap-4 relative">
          <img src="/logos/dove-logo-ink.svg" alt={BRAND.subtitle} className="h-[26px] cursor-pointer" onClick={() => router.push("/")} />
          <div className="w-px h-5" style={{ background: HAIRLINE }} />
          {/* Team color badge — click to switch teams. The RULE keeps the
              team's own hue; the 12px LABEL takes the paper-safe shade of
              it, because a hue that reads fine as a 2px stroke can sit
              under 2.5:1 as tracked caps on white. */}
          <button
            onClick={() => setShowTeamMenu((v) => !v)}
            className="soft-btn"
            style={{ padding: "8px 18px", fontSize: 11, color: "#2C2419", fontWeight: 800 }}
          >
            {GROUPS[teamSlug as keyof typeof GROUPS]?.name || config.name}
            <span style={{ marginLeft: 8, color: "#B78938" }}>{showTeamMenu ? "▴" : "▾"}</span>
          </button>
          {/* The page name, and the rule that introduces it, are what
              the phone gives up. Below 599px there is no measure for a
              28px serif beside the identity AND the destinations, and
              a name that wraps to three lines is not a name. */}
          <div className="w-px h-5 max-[599px]:hidden" style={{ background: HAIRLINE }} />
          <span
            className="font-display text-[28px] cursor-pointer transition-opacity hover:opacity-70 max-[599px]:hidden"
            style={{ color: INK }}
            onClick={() => router.push("/")}
          >
            {PAGE_NAMES.teamBoard}
          </span>

          {/* Team switcher dropdown */}
          <AnimatePresence>
            {showTeamMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[200]"
                  style={{ background: "rgba(107,93,74,0.18)" }}
                  onClick={() => setShowTeamMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.65, 0, 0.35, 1] }}
                  className="absolute left-0 top-full mt-3 z-[201] overflow-hidden"
                  style={{
                    background: "var(--card)",
                    borderRadius: 20,
                    width: 280,
                    boxShadow: "0 24px 64px rgba(166,146,116,0.35), var(--neo-raised-sm)",
                  }}
                >
                  {Object.values(GROUPS).map((group, i) => (
                    <motion.button
                      key={group.slug}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => { router.push(`/${group.slug}`); setShowTeamMenu(false); }}
                      className="w-full flex items-center gap-3 px-5 py-[16px] text-left cursor-pointer bg-transparent border-none relative overflow-hidden transition-all duration-200 group"
                      style={{
                        borderBottom: i < Object.values(GROUPS).length - 1 ? "1px solid rgba(107,93,74,0.12)" : "none",
                        background: group.slug === teamSlug ? `${group.color}12` : "transparent",
                      }}
                      onMouseEnter={(e) => { if (group.slug !== teamSlug) e.currentTarget.style.background = `${group.color}14`; }}
                      onMouseLeave={(e) => { if (group.slug !== teamSlug) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div
                        className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full transition-all duration-200 group-hover:top-0 group-hover:bottom-0 group-hover:rounded-none"
                        style={{ background: group.color, opacity: 0.8 }}
                      />
                      {/* Same paper rule as the chip: the spine and the dot
                          keep the raw hue (they are marks), the 12px label
                          takes the paper-safe shade of it. */}
                      <span
                        className="font-bold text-[12px] tracking-[2px] uppercase opacity-80 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ color: group.slug === teamSlug ? INK : paperType(group.color) }}
                      >
                        {group.name}
                      </span>
                      {group.slug === teamSlug ? (
                        <span className="ml-auto text-[10px]" style={{ color: group.color }}>●</span>
                      ) : (
                        <span className="ml-auto text-[11px] opacity-0 group-hover:opacity-40 transition-opacity duration-200" style={{ color: INK }}>
                          →
                        </span>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        {/* The destinations. On the phone this is the header's second
            line and it spreads the full measure, so the three rooms sit
            at the thumb's own spacing rather than crushed together at
            one end. `data-qa` so the harness can hold the two lines
            apart without guessing at DOM order. */}
        <div data-qa="board-nav" className="flex items-center gap-6 max-[599px]:justify-between max-[599px]:gap-2">
          <button
            onClick={() => router.push("/")}
            className="dove-nav max-[599px]:min-h-[44px] max-[599px]:px-2"
          >
            Home
          </button>
          <button
            onClick={() => router.push("/big-board")}
            className="dove-nav max-[599px]:min-h-[44px] max-[599px]:px-2"
          >
            {PAGE_NAMES.bigBoard}
          </button>
          <button
            onClick={() => router.push("/center-court")}
            className="dove-nav max-[599px]:min-h-[44px] max-[599px]:px-2"
          >
            {PAGE_NAMES.centerCourt}
          </button>
        </div>
      </motion.header>

      {/* Team color hero band — the one flood on this surface.
          Beat 2: the flood DRAWS across left-to-right like a bar being laid
          down (house seam grammar), as its own layer so the content above it
          never distorts. */}
      <div data-qa="board-hero" className="overflow-hidden min-h-[108px] flex items-center px-12 py-3 relative">
        {/* position pinned inline: .halftone-band's un-layered position:relative
            outranks Tailwind's .absolute (same trap as horizon-glow on the Stage) */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DUR.draw, delay: BEAT.hero, ease: EASE }}
          style={{ position: "absolute", inset: 0, transformOrigin: "left center", background: config.color }}
          className="halftone-band"
          aria-hidden="true"
        />
        {/* The band carries ONE thing: the team's creative platform. The idea
            count is gone (R3) — a number that drove no decision, while the
            per-category counts that DO live in the tabs. With the count out of
            the way the name owns the whole measure, so it can size fluidly
            instead of colliding with a numeral at laptop widths (R5). The
            right pad reserves the QR pocket; a name long enough to need a
            second line grows the band rather than clipping. */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DUR.beat, delay: BEAT.content, ease: EASE }}
          className="relative z-10 min-w-0 flex-1 pr-[104px]"
        >
          <div
            className="text-[12px] font-bold tracking-[3px] uppercase mb-2"
            style={{ color: bandText(config.color), opacity: 0.85 }}
          >
            Team {config.name}
          </div>
          <h1
            className="font-display leading-none"
            style={{
              color: bandText(config.color),
              fontSize: "clamp(50px, 4.6vw, 66px)",
              textWrap: "balance",
            }}
          >
            {team?.creative_platform_name || CATEGORY_LABELS[category]}
          </h1>
        </motion.div>

        {/* QR button — absolute bottom-right of hero.
            z-20, ABOVE the name block, and that is the whole fix for a
            real regression: the name is `relative z-10 flex-1`, so its
            BOX spans the full band including the `pr-[104px]` QR pocket
            — padding is inside the box, it does not carve a hole in it.
            At z-[3] the button rendered perfectly and was unclickable,
            because every hit at its centre landed on the name div.
            Proven by elementFromPoint at the button's own centre
            returning the name block, and by the click timing out.
            Anything added to this band must clear z-10 or repeat it. */}
        <button
          onClick={() => setShowQR(true)}
          className="absolute bottom-4 right-12 flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer border-none transition-all duration-200 z-20"
          style={{ opacity: 0.55, background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.55"; e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: bandText(config.color) }}>
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/>
            <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
          </svg>
          <span className="font-bold text-[11px] tracking-[2px] uppercase" style={{ color: bandText(config.color) }}>QR</span>
        </button>

        {/* QR modal */}
        <AnimatePresence>
          {showQR && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999]"
                style={{ background: "rgba(20,19,22,0.65)" }}
                onClick={() => setShowQR(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="fixed z-[10000] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 p-12"
                style={{ background: "#FFFFFF", border: "1px solid rgba(35,31,32,0.2)", boxShadow: "0 24px 60px rgba(35,31,32,0.25)" }}
              >
                <div className="font-display text-[28px]" style={{ color: INK }}>
                  Add Your Idea
                </div>
                <div className="p-4 bg-white" style={{ border: "1px solid rgba(35,31,32,0.2)" }}>
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/${teamSlug}/quick-add`}
                    size={240}
                  />
                </div>
                <p className="text-[14px] leading-[1.5] text-center max-w-[280px]" style={{ color: "#4a4749" }}>
                  Scan to file ideas from your phone. They land on this board instantly.
                </p>
                <div className="slug" style={{ color: "#8A8689" }}>
                  {`/${teamSlug}/quick-add`}
                </div>
                <button
                  onClick={() => setShowQR(false)}
                  className="font-bold text-[11px] tracking-[3px] uppercase cursor-pointer bg-transparent border-none transition-colors"
                  style={{ color: "rgba(35,31,32,0.4)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = INK; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(35,31,32,0.4)"; }}
                >
                  Close
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Tartan rule */}

      {/* Category tabs.
          The second cause of the 390px sideways scroll, and the smaller
          one: the rail ran 353px inside a 294px measure. The category
          LABELS are engagement config, so no width can be assumed to
          fit — what gives is the rail's own generous 24px tab padding,
          which is a laptop measure sitting on a phone. Tightened here
          rather than in `components/CategoryTabs`, because the rail is
          shared with surfaces this pass has not measured. */}
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div data-qa="board-tabs" className="px-12 flex items-center justify-between max-[599px]:[&_button]:px-3">
          {/* Active underline is INK, not red: the band above already carries
              the team hue, and red stays reserved for marks/stamps/LIVE. On
              Team Touffou a red underline sat 40px under a #DA291C flood —
              two near-identical reds reading as a mismatch. */}
          <SoftTabs
            items={PILLAR_LIST.map((p) => ({
              id: p.slug,
              label: p.label,
              count: categoryCounts?.[p.slug],
            }))}
            active={category}
            onChange={(c) => { setCategory(c); setScoutedIdeas(null); setScoutModalOpen(false); }}
          />
          {/* Voting and The Shortlist happen on The Stage, not here */}
        </div>
      </div>

      {/* Ideas grid — beat 3: the working surface settles in */}
      <motion.main
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.beat, delay: BEAT.detail, ease: EASE }}
        className="px-12 pt-6 pb-16"
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={category}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            // REAL MASONRY — the placement lives in `useMasonry` above.
            // Each card goes, in board order, to whichever column is
            // currently shortest, so the wall reads left-to-right and no
            // column trails a dead gap while its neighbour is full. Every
            // card keeps its own content height: a printed frame is
            // taller than a text card, which is the point.
            data-qa="board-grid"
            className="flex items-start gap-6"
          >
            {/* THE COLUMNS ALWAYS RENDER — even with nothing to place.
                An empty category used to swap the whole wall for a line of
                guidance, which took the making pockets down with it: the
                one moment a team most needs Add and the Scout was the one
                moment the board offered neither. The guidance is now a
                CARD-SIZED note in the column beside the pockets (under
                them at one column), so a bare wall still opens with the
                two things that fill it. */}
            {wallColumns.map((column, ci) => (
                <div key={ci} data-qa="board-column" className="flex-1 min-w-0 flex flex-col gap-6">
                  {ci === 0 && making}
                  {filteredIdeas.length === 0 && ci === guidanceColumn && (
                    <div data-qa="board-empty" className="flex items-start px-2 py-6 sm:min-h-[124px]">
                      <div>
                        <DoveMark size={44} color="#96702E" glow={false} />
                        <p className="mt-3 font-display italic text-[22px] leading-snug" style={{ color: INK }}>
                          Nothing here yet.
                        </p>
                        <p className="mt-2 text-[15px] leading-[1.6]" style={{ color: "#8A8689" }}>
                          Real ideas only — add the first one, or ask the Scout to pitch you.
                        </p>
                      </div>
                    </div>
                  )}
                  {column.map((idea) => {
                    // The seat is the arrival stagger's cue only — the
                    // frame's № comes from the idea's own identity.
                    const seat = seatOf.get(idea.id) ?? 0;
                    return (
                      <div key={idea.id} ref={wallCardRef(idea.id)} data-qa="board-card" data-qa-seat={seat}>
                        <IdeaCard
                          idea={idea}
                          onClick={() => setSelectedIdea(idea)}
                          index={seat}
                          frameNo={stableNo.get(idea.id) ?? seat + 1}
                          teamName={team?.display_name || team?.name}
                        />
                      </div>
                    );
                  })}
                </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.main>

      {/* Modals */}
      <AnimatePresence>
        {selectedIdea && (
          <>
            <ExpandedCard
              idea={selectedIdea}
              teamColor={config.color}
              teamSlug={teamSlug}
              teamName={team?.display_name || team?.name}
              platformName={team?.creative_platform_name || undefined}
              trainingNotes={trainingNotes}
              allIdeas={ideas}
              onClose={() => setSelectedIdea(null)}
              onUpdate={fetchIdeas}
              onTrain={() => router.push(`/${teamSlug}/training-room?idea=${selectedIdea.id}`)}
              onCoachOpenChange={setCoachOpen}
              // The board's № — the idea's own stable number, the same
              // one its frame wears on the wall behind this card. No
              // team tag: the Board is one team's surface.
              frameNo={stableNo.get(selectedIdea.id)}
            />
            {filteredIdeas.length > 1 && !coachOpen && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateIdea("prev"); }}
                  className="fixed left-6 top-1/2 -translate-y-1/2 z-[10001] w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border-none transition-all"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 24 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                >
                  ‹
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateIdea("next"); }}
                  className="fixed right-6 top-1/2 -translate-y-1/2 z-[10001] w-12 h-12 flex items-center justify-center rounded-full cursor-pointer border-none transition-all"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 24 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                >
                  ›
                </button>
              </>
            )}
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddModal && team && (
          <AddIdeaModal
            teamId={team.id}
            teamSlug={teamSlug}
            category={category}
            onClose={() => setShowAddModal(false)}
            onSuccess={fetchIdeas}
            onAddLocal={isLocal ? addIdeaLocally : undefined}
          />
        )}
      </AnimatePresence>

      {/* The Scout Modal — stacked card deck */}
      <AnimatePresence>
        {scoutModalOpen && scoutedIdeas && scoutedIdeas[scoutIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(20,19,22,0.7)", backdropFilter: "blur(12px)" }}
            onClick={closeScout}
          >
            <div
              className="w-full max-w-[820px] mx-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dot indicators */}
              <div className="flex items-center justify-center gap-2 mb-6 shrink-0">
                {scoutedIdeas.map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      background: i === scoutIndex ? BRAND.colors.primary : i < scoutIndex ? withAlpha(BRAND.colors.primary, 0.3) : "rgba(255,255,255,0.3)",
                      transform: i === scoutIndex ? "scale(1.3)" : "scale(1)",
                    }}
                  />
                ))}
              </div>

              {/* Active card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={scoutIndex}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="relative overflow-hidden flex flex-col"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(35,31,32,0.25)",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
                    maxHeight: "calc(90vh - 60px)",
                  }}
                >
                  {/* Kept stamp overlay */}
                  <AnimatePresence>
                    {scoutKeeping && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 z-10 flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.75)" }}
                      >
                        <span
                          className="font-bold text-[56px] tracking-[0.2em] uppercase px-10 py-3"
                          style={{ color: BRAND.colors.primary, border: `5px solid ${BRAND.colors.primary}`, borderRadius: 4, transform: "rotate(-6deg)" }}
                        >
                          Kept
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Scrollable content area */}
                  <div className="overflow-y-auto flex-1 p-10 pb-0">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-6">
                      <span className="stamp" style={{ color: "#24298F" }}>
                        Scouted
                      </span>
                      {scoutFailed ? (
                        <span data-qa="scout-keep-failed" className="slug" style={{ color: BRAND.colors.primary }}>
                          Not kept · the board did not take it
                        </span>
                      ) : (
                        <span className="slug" style={{ color: "#8A8689" }}>
                          {scoutIndex + 1} / {scoutedIdeas.length}
                        </span>
                      )}
                    </div>

                    {/* Card content */}
                    <h2 className="font-display text-[36px] leading-tight mb-4" style={{ color: INK }}>
                      {scoutedIdeas[scoutIndex].name}
                    </h2>
                    {/* Sans italic, not serif: serif italic is reserved for
                        actual quotation (Round 4 serif law) */}
                    {scoutedIdeas[scoutIndex].insight && (
                      <p className="italic text-[17px] leading-relaxed mb-4" style={{ color: "#4a4749" }}>
                        {scoutedIdeas[scoutIndex].insight}
                      </p>
                    )}
                    <p className="text-[17px] leading-relaxed mb-5" style={{ color: "#4a4749" }}>
                      {scoutedIdeas[scoutIndex].description}
                    </p>
                    {scoutedIdeas[scoutIndex].bbeiConnection && (
                      <div className="p-4 mb-4" style={{ background: "rgba(35,31,32,0.03)", border: "1px solid rgba(35,31,32,0.12)" }}>
                        <div className="font-bold text-[11px] tracking-[3px] uppercase mb-2" style={{ color: "#8A8689" }}>{team?.creative_platform_name || 'Creative Platform'} Connection</div>
                        <p className="text-[15px] leading-relaxed" style={{ color: "#4a4749" }}>{scoutedIdeas[scoutIndex].bbeiConnection}</p>
                      </div>
                    )}
                  </div>

                  {/* Pinned buttons */}
                  <div className="flex gap-4 p-10 pt-6 shrink-0">
                    <button
                      onClick={keepScoutedIdea}
                      disabled={scoutKeeping}
                      className="flex-1 py-4 font-bold text-[15px] tracking-[1px] cursor-pointer transition-all duration-200 disabled:opacity-50"
                      style={{ background: BRAND.colors.primary, color: "#fff", border: "none" }}
                      onMouseEnter={(e) => { if (!scoutKeeping) e.currentTarget.style.background = BRAND.colors.primaryBright; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.colors.primary; }}
                    >
                      Keep
                    </button>
                    <button
                      onClick={advanceScout}
                      disabled={scoutKeeping}
                      className="flex-1 py-4 font-bold text-[15px] tracking-[1px] cursor-pointer transition-all duration-200 disabled:opacity-50"
                      style={{ background: "transparent", color: "#4a4749", border: "1px solid rgba(35,31,32,0.3)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(35,31,32,0.04)"; e.currentTarget.style.color = INK; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a4749"; }}
                    >
                      Pass
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
