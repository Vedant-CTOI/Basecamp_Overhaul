"use client";

// ============================================================
// ROUND 6 — HOW THE COACH'S WORDS ARRIVE (LAB ONLY, DO NOT SHIP)
// ============================================================
// The reframing that governs this study (user ruling, and it
// overrides the emphasis in docs/research-coach-modalities.md):
// the coach's content is usually NEW MATERIAL — for the
// Provocateur it's new pushes, new things to think about,
// insights from yesterday the room might have missed — NOT an
// annotation of the sentence the team just typed. So the
// question here is not "where does the mark land on their
// text"; it is HOW NEW MATERIAL ARRIVES with presence in a
// projected room. Marginalia and anchored comments are a
// SECONDARY mode, for the minority case where a coach points at
// a phrase the team actually wrote.
//
// Five arrivals, identical in every other respect: the same
// Provocateur reply from lib/showcase-data.ts, the same dark
// register, the same coach banner, the same 850ms gather. Only
// the arrival differs. Each replays on demand, because the
// judgement is "does it survive the twentieth time," not the
// first.
//
// Laws observed (docs/ogilvy-showcase-direction.md):
// - Motion is an event, never a texture: every treatment lands
//   and then STOPS. Nothing here loops.
// - Arrivals decelerate on EASE; no springs, no overshoot.
// - The develop is two beats, never a fade (Round 8 item 3).
// - Courier is slugs and stamps only; the reply body is Sans
//   at 19px (Round 6 item 5 — room legibility beats costume).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COACH_DEFS } from "@/lib/config";
import { SHOWCASE_COACH_REPLIES } from "@/lib/showcase-data";
import { EASE, DUR } from "@/lib/motion";

const RED = "#002663";
const GROUND = "#0A0A0C";
const PANEL = "#1B1A1D";
const CAPTION = "rgba(255,255,255,0.60)";
const SLUG_DIM = "#8A8689";

const COACH = COACH_DEFS.provocateur;
const REPLY = SHOWCASE_COACH_REPLIES.provocateur ?? "";
const ASK = "Give us your first read on this idea.";

/** The coach gathering a thought — identical across all five. */
const GATHER = 850;

/** The coach's page, exactly as TypedPage renders it today. */
const PAGE: React.CSSProperties = {
  background: "rgba(255,255,255,0.055)",
  color: "#E6E4E5",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 2,
  borderLeft: `3px solid ${COACH.color}`,
};

// PrintReveal's chemistry, retuned for type on a dark ground.
// Grayscale is doing real work here: it holds the coach's red
// spine and name back until the ink floods in beat two.
const GHOST = "grayscale(1) contrast(0.52) brightness(1.06)";
const DENSE = "grayscale(0.85) contrast(0.9) brightness(1.01)";
const INKED = "grayscale(0) contrast(1) brightness(1)";

/** Three or four chunks — sentences, then the scripted-round note. */
const CHUNKS: string[] = (() => {
  const [head, tail] = REPLY.split("\n\n");
  const sentences = (head.match(/[^.!?]+[.!?]+/g) ?? [head]).map((s) => s.trim());
  return tail ? [...sentences, tail.trim()] : sentences;
})();

// ── Shared anatomy (identical in every treatment) ────────────

function Dots() {
  return (
    <span className="flex items-center gap-2 py-1">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity, delay }}
          className="w-2 h-2 rounded-full"
          style={{ background: COACH.color }}
        />
      ))}
    </span>
  );
}

function SlugRow() {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={COACH.avatar} alt="" className="w-[24px] h-[24px] rounded-full shrink-0" />
      <span className="slug text-[13px]">
        <span style={{ color: COACH.color }}>{COACH.name}</span>
        <span style={{ color: SLUG_DIM }}> · Round 01</span>
      </span>
    </div>
  );
}

function ReplyBody({ text, cursor }: { text: string; cursor?: boolean }) {
  return (
    <p className="text-[19px] leading-[1.6] whitespace-pre-wrap">
      {text}
      {cursor && (
        <span
          className="inline-block w-[10px] h-[20px] ml-0.5 align-middle animate-pulse"
          style={{ background: "#E6E4E5" }}
        />
      )}
    </p>
  );
}

/** The settled page — what every treatment must end up as. */
function StaticPage() {
  return (
    <div className="w-full p-8" style={PAGE}>
      <SlugRow />
      <ReplyBody text={REPLY} />
    </div>
  );
}

/** The settled split-flap page — one block per chunk. */
function StaticFlapPage() {
  return (
    <div className="w-full p-8" style={PAGE}>
      <SlugRow />
      <div className="text-[19px] leading-[1.6]">
        {CHUNKS.map((c, i) => (
          <span key={i} className="block">{c}</span>
        ))}
      </div>
    </div>
  );
}

/** The coach gathering — the state all five share before the arrival. */
function GatherPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full p-8"
      style={PAGE}
    >
      <SlugRow />
      <Dots />
    </motion.div>
  );
}

function UserLine() {
  return (
    <div className="self-end max-w-[75%]">
      <div className="slug text-[13px] mb-1.5 text-right" style={{ color: "rgba(255,255,255,0.4)" }}>
        You
      </div>
      <div
        className="px-5 py-4"
        style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 2 }}
      >
        <p className="text-[17px] leading-[1.6]" style={{ color: "#e6e4e5" }}>{ASK}</p>
      </div>
    </div>
  );
}

/**
 * The slot: a hidden copy of the settled page reserves the exact
 * height, and the live treatment sits on top of it. Every panel
 * therefore holds still while its arrival plays — the grid never
 * reflows, so the five can be compared without the page moving.
 */
function Slot({ ghost, children }: { ghost: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="invisible" aria-hidden>{ghost}</div>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

// ── A · TYPEWRITER (the control — what ships today) ──────────

function ArrivalTypewriter() {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const words = REPLY.split(" ");
    let i = 0;
    let alive = true;
    let tick: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!alive) return;
      if (i >= words.length) { setTyping(false); return; }
      i += 1;
      setText(words.slice(0, i).join(" "));
      tick = setTimeout(step, 18);
    };
    const start = setTimeout(step, GATHER);
    return () => { alive = false; clearTimeout(start); clearTimeout(tick); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full p-8"
      style={PAGE}
    >
      <SlugRow />
      {text ? <ReplyBody text={text} cursor={typing} /> : <Dots />}
    </motion.div>
  );
}

// ── B · THE PLATE (the slot reserves, then it lands) ─────────

function ArrivalPlate() {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), GATHER);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="w-full p-8 relative"
      style={PAGE}
      initial={{ backgroundColor: "rgba(255,255,255,0.014)", borderLeftColor: "rgba(235,63,67,0.32)" }}
      animate={{
        backgroundColor: landed ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.014)",
        borderLeftColor: landed ? RED : "rgba(235,63,67,0.32)",
      }}
      transition={{ duration: DUR.beat, ease: EASE }}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={landed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: DUR.beat, ease: EASE }}
      >
        <SlugRow />
        <ReplyBody text={REPLY} />
      </motion.div>
      {!landed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Dots />
        </div>
      )}
    </motion.div>
  );
}

// ── C · THE DEVELOP (whole, but exposed) ─────────────────────

function ArrivalDevelop() {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), GATHER);
    return () => clearTimeout(t);
  }, []);

  if (!arrived) return <GatherPage />;

  return (
    <motion.div
      className="w-full p-8"
      style={PAGE}
      initial={{ opacity: 0.18, filter: GHOST }}
      animate={{ opacity: [0.18, 0.72, 1], filter: [GHOST, DENSE, INKED] }}
      transition={{ duration: DUR.settle, times: [0, 0.62, 1], ease: ["easeInOut", [...EASE]] }}
    >
      <SlugRow />
      <ReplyBody text={REPLY} />
    </motion.div>
  );
}

// ── D · THE SPLIT-FLAP (chunks resolve, staggered) ───────────

const FLAP_STAGGER = 90;
const FLAP_FACE = 130;

function ArrivalSplitFlap() {
  const [arrived, setArrived] = useState(false);
  // -1 waiting · 0,1 flap faces · 2 locked
  const [phase, setPhase] = useState<number[]>(() => CHUNKS.map(() => -1));

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const set = (i: number, v: number) =>
      setPhase((prev) => prev.map((p, j) => (j === i ? v : p)));
    timers.push(setTimeout(() => setArrived(true), GATHER));
    CHUNKS.forEach((_, i) => {
      const base = GATHER + i * FLAP_STAGGER;
      timers.push(setTimeout(() => set(i, 0), base));
      timers.push(setTimeout(() => set(i, 1), base + FLAP_FACE));
      timers.push(setTimeout(() => set(i, 2), base + FLAP_FACE * 2));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!arrived) return <GatherPage />;

  return (
    <div className="w-full p-8" style={PAGE}>
      <SlugRow />
      <div className="text-[19px] leading-[1.6]">
        {CHUNKS.map((chunk, i) => {
          const p = phase[i];
          return (
            <div key={i} className="relative" style={{ perspective: 700 }}>
              <motion.span
                className="block"
                animate={{ opacity: p === 2 ? 1 : 0 }}
                transition={{ duration: 0.12, ease: "linear" }}
              >
                {chunk}
              </motion.span>
              <AnimatePresence>
                {p < 2 && (
                  <motion.div
                    key={p}
                    className="absolute inset-0"
                    style={{
                      transformOrigin: "top center",
                      background: "rgba(255,255,255,0.13)",
                      borderTop: "1px solid rgba(255,255,255,0.10)",
                    }}
                    initial={{ rotateX: p < 0 ? 0 : -88 }}
                    animate={{ rotateX: 0 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{ duration: 0.13, ease: "easeOut" }}
                  >
                    {/* the flap's centre seam */}
                    <div
                      className="absolute left-0 right-0 top-1/2"
                      style={{ borderTop: "1px solid rgba(0,0,0,0.42)" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── E · THE DEALT CARD (laid onto the surface) ───────────────

function ArrivalDealt() {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), GATHER);
    return () => clearTimeout(t);
  }, []);

  if (!arrived) return <GatherPage />;

  return (
    <motion.div
      className="w-full p-8"
      style={PAGE}
      initial={{ opacity: 0, y: 56, x: 12, rotate: -1.8, scale: 0.985, boxShadow: "0 30px 60px rgba(0,0,0,0.62)" }}
      animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1, boxShadow: "0 6px 18px rgba(0,0,0,0.34)" }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <SlugRow />
      <ReplyBody text={REPLY} />
    </motion.div>
  );
}

// ── The panel: banner + exchange + caption ───────────────────

function Banner() {
  return (
    <div
      className="flex items-center gap-3 px-10 py-4 shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", minHeight: 77 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={COACH.avatar}
        alt=""
        className="w-[44px] h-[44px] rounded-full shrink-0"
        style={{ border: "1px solid rgba(255,255,255,0.2)" }}
      />
      <div className="min-w-0">
        <div className="font-display text-[22px] leading-tight text-white truncate">{COACH.name}</div>
        <div className="text-[12px] font-medium tracking-[0.04em] leading-tight truncate" style={{ color: SLUG_DIM }}>
          {COACH.title}
        </div>
      </div>
    </div>
  );
}

function ArrivalPanel({
  id,
  letter,
  name,
  mechanic,
  cost,
  ghost,
  onReplay,
  children,
}: {
  id: string;
  letter: string;
  name: string;
  mechanic: string;
  cost: string;
  ghost: React.ReactNode;
  onReplay: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="slug text-[13px]" style={{ color: RED }}>
          {letter} · {name}
        </p>
        <button
          onClick={onReplay}
          data-replay={letter.toLowerCase()}
          className="slug text-[11px] px-3 py-1.5 cursor-pointer transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.28)", background: "transparent", color: "rgba(255,255,255,0.75)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          ↺ Replay
        </button>
      </div>
      <div id={id} style={{ background: PANEL }}>
        <Banner />
        <div className="px-10 py-8 flex flex-col gap-5">
          <UserLine />
          <Slot ghost={ghost}>{children}</Slot>
        </div>
      </div>
      <p className="text-[14px] leading-[1.55] mt-3 max-w-[640px]" style={{ color: CAPTION }}>
        {mechanic}
      </p>
      <p className="slug text-[11px] mt-1.5" style={{ color: SLUG_DIM }}>
        {cost}
      </p>
    </div>
  );
}

// ── The round ────────────────────────────────────────────────

/** Roughly how long each arrival runs, for the play-all chain. */
const RUNTIME = [2250, 1450, 2350, 1700, 1500];

export default function ArrivalRound() {
  const [runs, setRuns] = useState<number[]>([0, 0, 0, 0, 0]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const replay = useCallback((i: number) => {
    setRuns((prev) => prev.map((v, j) => (j === i ? v + 1 : v)));
  }, []);

  const playAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let at = 0;
    RUNTIME.forEach((d, i) => {
      timers.current.push(setTimeout(() => replay(i), at));
      at += d + 700;
    });
  }, [replay]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div id="arrival-round" className="pt-8 mt-16" style={{ borderTop: "2px solid #231F20" }}>
      <p className="slug mb-2" style={{ color: RED }}>
        ROUND 6 · HOW THE COACH&rsquo;S WORDS ARRIVE · LAB ONLY — DO NOT SHIP
      </p>
      <h2 className="font-display font-bold text-[36px] leading-[1.1] mb-3">
        New material, arriving in a projected&nbsp;room.
      </h2>
      <p className="text-[16px] leading-[1.6] max-w-[760px] mb-4" style={{ color: "#4a4749" }}>
        <strong>The reframing this study runs on.</strong>{" "}The coach&rsquo;s contribution is
        usually <strong>new material</strong> — for the Provocateur it is new pushes, new things
        to think about, insights from yesterday the room might have missed. It is not an
        annotation of the sentence the team just typed. So the question here is not where a mark
        lands on their words; it is <em>how new material arrives with presence</em> when a room is
        reading one screen together and cannot scroll back. Marginalia and anchored comments stay
        on the table as a <strong>secondary mode</strong>, for the minority case where a coach
        points at a phrase the team actually wrote.
      </p>
      <p className="text-[16px] leading-[1.6] max-w-[760px] mb-8" style={{ color: "#4a4749" }}>
        Five arrivals, one variable. Same Provocateur reply from{" "}
        <span className="font-mono text-[14px]">showcase-data.ts</span>, same dark register, same
        coach banner, same 850ms gather before anything lands. Only the arrival differs. Replay
        each on its own, or run them in sequence — the test that matters is not the first viewing,
        it is the twentieth, because a coach speaks many times in a day.
      </p>

      <div className="p-10" style={{ background: GROUND }}>
        <div className="flex items-center justify-between gap-6 mb-9">
          <p className="slug text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            THE PROVOCATEUR · ROUND 01 · IDENTICAL COPY IN ALL FIVE
          </p>
          <button
            onClick={playAll}
            data-play-all
            className="font-bold text-[13px] tracking-[1px] uppercase px-7 py-3 cursor-pointer transition-opacity hover:opacity-85"
            style={{ background: RED, color: "#fff", border: "none" }}
          >
            ▶ Play all in sequence
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-14 items-start">
          <ArrivalPanel
            id="arrival-a"
            letter="A"
            name="Typewriter (control)"
            mechanic="What ships today. After the gather, the pre-written reply is walked out one word every 18ms and the page grows under the cursor. The room reads a moving tail; the last line lands about two seconds after the first."
            cost="BUILD: ZERO — THIS IS CoachTakeover.streamReply() AS IT STANDS"
            ghost={<StaticPage />}
            onReplay={() => replay(0)}
          >
            <ArrivalTypewriter key={runs[0]} />
          </ArrivalPanel>

          <ArrivalPanel
            id="arrival-b"
            letter="B"
            name="The Plate"
            mechanic="The slot is reserved before the reply exists — an empty bounded box holds the full height, spine dimmed, while the coach gathers. Then the finished page lands composed in one beat on the house EASE. Nothing below it ever moves."
            cost="BUILD: ~HALF A DAY — AND IT DELETES THE WORD-WALK LOOP AND THE ESC FAST-FORWARD"
            ghost={<StaticPage />}
            onReplay={() => replay(1)}
          >
            <ArrivalPlate key={runs[1]} />
          </ArrivalPanel>

          <ArrivalPanel
            id="arrival-c"
            letter="C"
            name="The Develop — RULED OUT"
            mechanic="RULED OUT 2026-08-07 (user): the develop-in was removed from the whole product, prints included — one more thing every engagement would have to form an opinion about, for too little. Kept as evidence of how the arrival round was judged; do not build from it. The mechanic as studied: the page arrives whole but undeveloped, a grayscale low-contrast ghost gathers density, then the ink floods and the coach's red spine and name come up, over DUR.settle. Every word is in place from the first frame; only the density changes."
            cost="RULED OUT — SEE docs/ogilvy-showcase-direction.md ROUND 8 ITEM 3 (AMENDED)"
            ghost={<StaticPage />}
            onReplay={() => replay(2)}
          >
            <ArrivalDevelop key={runs[2]} />
          </ArrivalPanel>

          <ArrivalPanel
            id="arrival-d"
            letter="D"
            name="The Split-Flap"
            mechanic="The reply resolves in four chunks like a departures board. Each chunk holds a blank flap face through two states, then locks; chunks stagger 90ms apart, top to bottom. Nothing unreadable is ever shown — the intermediate states are visibly machinery, not text."
            cost="BUILD: ~HALF A DAY IN THE TAKEOVER · ~1 DAY IF IT GOES TO THE STAGE"
            ghost={<StaticFlapPage />}
            onReplay={() => replay(3)}
          >
            <ArrivalSplitFlap key={runs[3]} />
          </ArrivalPanel>

          <ArrivalPanel
            id="arrival-e"
            letter="E"
            name="The Dealt Card"
            mechanic="The finished page is laid onto the surface — it travels up from below and slightly off-axis, settles square with no overshoot, and its shadow drops from carried to resting. A coach setting a provocation card on the table."
            cost="BUILD: ~2 HOURS ON TOP OF B — ONE TRANSFORM AND A SHADOW"
            ghost={<StaticPage />}
            onReplay={() => replay(4)}
          >
            <ArrivalDealt key={runs[4]} />
          </ArrivalPanel>
        </div>
      </div>
    </div>
  );
}
