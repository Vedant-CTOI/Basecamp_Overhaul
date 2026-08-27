"use client";

import { useState, useEffect, useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import AmbientField from "@/components/AmbientField";
import OrbitalEntry from "@/components/OrbitalEntry";
import TeamMedallion from "@/components/TeamMedallion";
import TeamConstellation from "@/components/TeamConstellation";
import TeamPods from "@/components/TeamPods";
import { MarkWelcome, MarkGenerate, MarkCoach, MarkDecide, MarkFollow } from "@/components/Marks";

import { GROUP_LIST, BRAND, PAGE_NAMES, TEAM_SELECT_CONFIG } from "@/lib/config";
import { EASE, DUR, SEAM_REST, STAGGER, BEAT } from "@/lib/motion";

const TEAMS = GROUP_LIST.map((g) => ({
  name: g.name,
  slug: g.slug,
  color: g.color,
}));

// Unlock-clip slot: drop a trimmed archival clip at this path and the unlock
// ritual plays it after ACCESS GRANTED (with a Skip control), then proceeds
// to team select. No file present → the typographic ritual runs unchanged.
// Intended clip: David Ogilvy, "The View from Touffou" (1981), the big-idea
// line. Keep it under ~20s. Update the caption to match your trim.
const UNLOCK_CLIP = "/video/unlock-quote.mp4";

// The quiet serif line under the drum: platform name plus the first clause
// of the platform brief, cut at the first sentence break or em dash.
function platformEchoLine(platform: { name: string; brief: string | null }): string {
  if (!platform.brief) return platform.name;
  const clause = platform.brief.split(/\s+—\s+/)[0].match(/^[^.:!?]+/)?.[0]?.trim();
  if (!clause) return platform.name;
  return `${platform.name} — ${clause}.`;
}
const UNLOCK_CLIP_CAPTION =
  "“Unless your advertising has a big idea, it will pass like a ship in the night.”";
const UNLOCK_CLIP_CREDIT = "DAVID OGILVY · THE VIEW FROM TOUFFOU · 1981";

export default function Home() {
  const router = useRouter();
  // Hydration-safe: server-side initial state is always falsy. We read sessionStorage
  // in useIsomorphicLayoutEffect below, which fires synchronously after hydration but
  // BEFORE the browser paints — so the client never visibly renders the hero frame
  // when sessionStorage already has the room code.
  const [roomCode, setRoomCode] = useState("");
  const [entered, setEntered] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [correctCode, setCorrectCode] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  // If already entered on mount (refresh/nav back), skip animation — show panels immediately
  const [panelsReady, setPanelsReady] = useState(false);
  // Gate rendering until we've read sessionStorage — prevents hero flash on navigation
  const [mounted, setMounted] = useState(false);
  // Unlock-clip slot: present only when the asset ships
  const [clipReady, setClipReady] = useState(false);
  const [showClip, setShowClip] = useState(false);
  const clipCapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockGuideRef = useRef(false);
  // The wake ripple gets an arrival delay only on its first play (the
  // "wake settles" beat); every focus change after that ripples instantly.
  const firstWakeRef = useRef(true);

  useEffect(() => {
    fetch(UNLOCK_CLIP, { method: "HEAD" })
      .then((r) => setClipReady(r.ok && (r.headers.get("content-type") ?? "").startsWith("video")))
      .catch(() => setClipReady(false));
  }, []);

  // Read sessionStorage AFTER hydration but before paint. This avoids the hydration
  // mismatch (server has no window) while still preventing a visible hero flash for
  // users who already entered the room and refreshed or navigated back.
  useIsomorphicLayoutEffect(() => {
    const code = sessionStorage.getItem("workshop-room-code");
    if (code) {
      setRoomCode(code);
      setEntered(true);
      setPanelsReady(true);
    }
    setMounted(true);
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [launching, setLaunching] = useState<typeof TEAMS[number] | null>(null);
  const [platforms, setPlatforms] = useState<Record<string, { name: string; brief: string | null }>>({});

  useEffect(() => {
    supabase
      .from("workshop_settings")
      .select("value")
      .eq("key", "room_code")
      .single()
      .then(({ data }) => {
        if (data?.value) setCorrectCode(data.value.trim().toUpperCase());
      });
    supabase.from("teams").select("slug, creative_platform_name, creative_platform_brief").then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; brief: string | null }> = {};
        data.forEach((t: { slug: string; creative_platform_name: string | null; creative_platform_brief: string | null }) => {
          if (t.creative_platform_name) map[t.slug] = { name: t.creative_platform_name, brief: t.creative_platform_brief ?? null };
        });
        setPlatforms(map);
      }
    });
  }, []);

  const handleEnter = () => {
    const input = roomCode.trim().toUpperCase();
    if (!input) return;

    // If a code is configured, validate against it
    if (correctCode && input !== correctCode) {
      setCodeError(true);
      setTimeout(() => setCodeError(false), 1200);
      return;
    }

    if (input.length > 0) {
      sessionStorage.setItem("workshop-room-code", input);
      setUnlocking(true);
      unlockGuideRef.current = !localStorage.getItem("workshop-guide-seen");
      if (clipReady) {
        // ACCESS GRANTED beat, then the archival clip carries the ritual;
        // finishUnlock fires on clip end/skip (25s safety cap).
        setTimeout(() => setShowClip(true), 2700);
        clipCapRef.current = setTimeout(finishUnlock, 27000);
      } else {
        setTimeout(finishUnlock, 3900);
      }
    }
  };

  // No curtain, no second wipe: the portal zoom WAS the transition. The
  // unlock overlay simply exhales (exit fade on its wrapper) and team
  // select runs its sequenced arrival out of the same darkness.
  const finishUnlock = () => {
    if (clipCapRef.current) {
      clearTimeout(clipCapRef.current);
      clipCapRef.current = null;
    }
    if (unlockGuideRef.current) setShowGuide(true);
    setEntered(true);
    setUnlocking(false);
    setShowClip(false);
  };

  const [guideSlide, setGuideSlide] = useState(0);

  // Onboarding slide deck shown to participants on first room-code unlock.
  // Bespoke layer: rewrite per engagement to match the workshop's narrative,
  // surface names, and mechanics. Defaults below are the showcase voice —
  // each slide is a place, a verb, one honest sentence, and its drawn mark
  // (components/Marks.tsx — the china-marker icon family).
  const GUIDE_SLIDES = [
    {
      verb: "WELCOME",
      mark: MarkWelcome,
      place: "Welcome to Basecamp",
      body: "Dove’s co-creation workshop platform. Three teams, four coaches, one room — championing authentic self-expression in a synthetic world.",
    },
    {
      verb: "GENERATE",
      mark: MarkGenerate,
      place: "The Board",
      body: "Every team gets a board of its own. Add an idea and it lands on the wall for the whole team the moment you file it.",
    },
    {
      verb: "COACH",
      mark: MarkCoach,
      place: "The Coaching Room",
      body: "Bring an idea to the coaches — they make it bigger, hold it to the brief, and speak for the audience. Edit the idea live as they talk.",
    },
    {
      verb: "DECIDE",
      mark: MarkDecide,
      place: "The Stage",
      body: "When it’s time, the Stage carries each team’s ideas to the room — and the room decides what advances.",
    },
    {
      verb: "FOLLOW",
      mark: MarkFollow,
      place: "The Feed",
      body: "All the while, the Feed follows the whole room at once. Every idea, coaching session, and shortlist crosses its wire.",
    },
  ];
  const ActiveGuideMark = GUIDE_SLIDES[guideSlide].mark;

  const dismissGuide = () => {
    setShowGuide(false);
    setGuideSlide(0);
    localStorage.setItem("workshop-guide-seen", "1");
  };

  // Trigger panel animation after guide closes or on refresh/navigate back
  useEffect(() => {
    if (entered && !showGuide && !panelsReady) {
      // 500ms delay lets guide exit animation finish before panels slide in
      const t = setTimeout(() => setPanelsReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [entered, showGuide, panelsReady]);

  const rotateRing = (direction: number) => {
    firstWakeRef.current = false;
    setActiveIndex((prev) => (prev + direction + TEAMS.length) % TEAMS.length);
    setRotationAngle((prev) => prev - direction * 120);
  };

  const goToRing = (index: number) => {
    firstWakeRef.current = false;
    let diff = index - activeIndex;
    if (diff > 1) diff -= TEAMS.length;
    if (diff < -1) diff += TEAMS.length;
    setActiveIndex(index);
    setRotationAngle((prev) => prev - diff * 120);
  };

  // The drum draws its own ‹ › paddles, so the arrow keys were the one control
  // the room reached for that did nothing. They turn the ring — and only while
  // the ring is the screen (never behind the guide, the unlock, or a launch).
  const ringLive = entered && !showGuide && !unlocking && !launching;
  useEffect(() => {
    if (!ringLive) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // rotateRing only uses functional setState and a ref, so the closure
      // captured here can never go stale.
      if (e.key === "ArrowLeft") { e.preventDefault(); rotateRing(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); rotateRing(1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringLive]);

  // Don't render until useIsomorphicLayoutEffect has read sessionStorage.
  // This prevents the hero flash on both full page loads AND client-side navigation.
  // useLayoutEffect fires before paint, so the user never sees this empty frame.
  if (!mounted) return <div className="relative overflow-hidden h-screen" style={{ background: "#F3EEE7" }} />;

  return (
    <div className="halftone-dark relative overflow-hidden h-screen">
      {/* initial={false} prevents Framer Motion from running an entry animation
          on the first render. Critical for the useIsomorphicLayoutEffect fix —
          without it, Motion's async animation would still cause a visible hero
          flash on returning visitors with a saved room code. */}
      <AnimatePresence mode="wait" initial={false}>
        {!entered ? (
          /* ═══ ORBITAL CORE — configurable entry primitive ═══ */
          <OrbitalEntry
            roomCode={roomCode}
            onRoomCodeChange={(value) => {
              setRoomCode(value.toUpperCase());
              setCodeError(false);
            }}
            onEnter={handleEnter}
            codeError={codeError}
            unlocking={unlocking}
          />
        ) : (
          /* ═══ TEAM SELECT: 3D MEDALLION RING ═══
              Arrival is a sequenced event in the house grammar, gated on
              panelsReady so it plays AFTER the guide closes (or straight out
              of the portal darkness): structure → headline → drum → wake. */
          <motion.section
            key="teams"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR.cut }}
            className="overhaul-page h-screen flex flex-col overflow-hidden relative"
            style={{ background: "#F3EEE7" }}
          >
            {/* The wake as the room's glow: a pool of the chosen team's light
                behind the drum, on black. It blooms as the drum lands. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: panelsReady ? 1 : 0 }}
              transition={{ duration: 1.0, delay: 0.35, ease: "easeOut" }}
              className="absolute inset-0 z-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 42% 38% at 50% 55%, ${TEAMS[activeIndex].color}47, ${TEAMS[activeIndex].color}14 55%, transparent 74%)`,
                transition: "background 1s ease",
              }}
            />
            {/* ...and each focus change ripples its color out from the drum.
                First play waits for the drum (the closing arrival beat);
                every later ripple fires on the focus change itself. */}
            {panelsReady && (
              <motion.div
                key={`wake-${activeIndex}`}
                initial={{ scale: 0.25, opacity: 0.7 }}
                animate={{ scale: 10, opacity: 0 }}
                transition={{ duration: 0.9, ease: EASE, delay: firstWakeRef.current ? BEAT.detail : 0 }}
                className="absolute left-1/2 top-1/2 z-[2] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none mix-blend-screen"
                style={{ background: `radial-gradient(circle, ${TEAMS[activeIndex].color} 0%, ${TEAMS[activeIndex].color}00 68%)` }}
              />
            )}
            {/* Header — beat 1: the structure arrives */}
            <motion.div
              initial={{ y: -56, opacity: 0 }}
              animate={panelsReady ? { y: 0, opacity: 1 } : { y: -56, opacity: 0 }}
              transition={{ duration: DUR.beat, delay: BEAT.structure, ease: EASE }}
              className="flex items-center justify-between px-10 py-5 shrink-0 z-10"
              style={{ background: "#F3EEE7", borderBottom: "1px solid rgba(107,93,74,0.2)" }}
            >
              <div className="flex items-center gap-4">
                <img src="/logos/dove-logo-ink.svg" alt="Dove" className="h-[30px] w-auto" />
                <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.2)" }} />
                <h2 className="font-display text-[24px] text-[#2C2419]">
                  {PAGE_NAMES.teamSelect}
                </h2>
              </div>
              <div className="flex items-center gap-7">
                <button
                  onClick={() => router.push("/big-board")}
                  className="px-1 py-2 font-bold text-[12px] tracking-[2px] uppercase cursor-pointer bg-transparent border-none transition-colors duration-300"
                  style={{ color: "#a8a5a6" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#a8a5a6"; }}
                >
                  {PAGE_NAMES.bigBoard}
                </button>
                <button
                  onClick={() => router.push("/center-court")}
                  className="px-1 py-2 font-bold text-[12px] tracking-[2px] uppercase cursor-pointer bg-transparent border-none transition-colors duration-300"
                  style={{ color: "#a8a5a6" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#a8a5a6"; }}
                >
                  {PAGE_NAMES.centerCourt}
                </button>
              </div>
            </motion.div>

            {/* Ring stage */}
            {/* THE COMPOSITION, AND THEREFORE THE THING THAT SCALES.
                This plain div is the whole arrival picture — the headline
                and the drum, which must grow together or not at all. The
                scale lives here rather than on the section (that is
                `h-screen`, and scaling a viewport-locked container
                overflows the screen it is locked to — how the Stage
                broke) and rather than on the motion children (Framer
                writes their `transform` inline, so CSS never lands —
                how the first attempt here failed). Being a plain
                element, it holds a transform of its own while every
                child animation composes on top and plays untouched. */}
            <div className="room-fit flex-1 flex flex-col justify-center relative z-10">
              {/* Beat 2: the giant headline backdrop settles */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={panelsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                transition={{ duration: 0.6, delay: BEAT.hero, ease: EASE }}
                className="relative z-0 text-center px-10 -mb-4"
              >
                <div className="font-bold text-[12px] tracking-[4px] uppercase mb-4" style={{ color: "#a8a5a6" }}>
                  {BRAND.workshopTitle}
                </div>
                <h2
                  className="font-display leading-[0.98] text-[#2C2419]"
                  style={{ fontSize: "clamp(72px, 8.5vw, 128px)", textWrap: "balance", letterSpacing: "-0.02em", opacity: 0.96 }}
                >
                  {TEAM_SELECT_CONFIG.headline}
                </h2>
              </motion.div>

              {/* THE CONSTELLATION — beat 3: the stars settle into the sky */}
                <motion.div
                  initial={{ opacity: 0, y: 26 }}
                  animate={panelsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
                  transition={{ duration: 0.6, delay: BEAT.content, ease: EASE }}
                  className="relative z-10 max-w-[1200px] mx-auto w-full px-6"
                >
                  <TeamPods
                    ctaLabel={TEAM_SELECT_CONFIG.ctaLabel}
                    launching={launching ? launching.slug : null}
                    platforms={platforms}
                    onLaunch={(slug) => {
                      const team = TEAMS.find((t) => t.slug === slug);
                      if (!team) return;
                      setLaunching(team);
                      // write-unchecked: an arrival line on the wire is
                      // decoration on a navigation this tab is leaving for —
                      // write() still logs it server-side.
                      void write("ticker_messages.insert:arrival", supabase.from("ticker_messages").insert({
                        message: `${team.name.toUpperCase()} — enters the board.`,
                        style: "standard",
                        is_active: true,
                      }));
                      setTimeout(() => router.push(`/${team.slug}`), 1800);
                    }}
                  />
                </motion.div>
            </div>

            {/* Guide reopen + Dev reset */}
            <div className="fixed bottom-14 right-4 z-50 flex items-center gap-4">
              <button
                onClick={() => setShowGuide(true)}
                className="font-bold text-[11px] tracking-[2px] uppercase text-[#444] hover:text-[#888] transition-colors cursor-pointer bg-transparent border-none"
              >
                ? Guide
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem("workshop-room-code");
                  localStorage.removeItem("workshop-guide-seen");
                  setEntered(false);
                  setRoomCode("");
                }}
                className="font-mono text-[10px] text-[#333] hover:text-[#666] transition-colors cursor-pointer bg-transparent border-none"
              >
                reset
              </button>
            </div>

            {/* Launch sequence overlay */}
            <AnimatePresence>
              {launching && (
                <>
                  {/* Beat 1 — black takeover + the team-color burst (the launch
                      peak). z above the wire: the ritual owns the stage. */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: DUR.cut }}
                    className="fixed inset-0 z-[10500]"
                    style={{ background: "#F3EEE7" }}
                  />
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 10, opacity: [0, 0.6, 0.2] }}
                    transition={{ duration: 1.0, ease: EASE }}
                    className="fixed z-[10501] rounded-full"
                    style={{
                      width: 300,
                      height: 300,
                      top: "50%",
                      left: "50%",
                      marginTop: -150,
                      marginLeft: -150,
                      background: `radial-gradient(circle, ${launching.color} 0%, transparent 70%)`,
                    }}
                  />

                  {/* Beat 2 — the seam draws across in team color, then settles
                      to a hairline under the name (house grammar, not a wipe) */}
                  <motion.div
                    initial={{ scaleX: 0, opacity: 1 }}
                    animate={{ scaleX: 1, opacity: [1, 1, SEAM_REST] }}
                    transition={{
                      duration: DUR.draw, delay: 0.2, ease: EASE,
                      opacity: { duration: DUR.settle, delay: 0.2, times: [0, 0.55, 1] },
                    }}
                    className="fixed z-[10502] h-[2px] left-0 right-0 top-1/2 origin-left"
                    style={{ background: launching.color }}
                  />

                  {/* Beat 3 — the name arrives over the settled seam */}
                  <div className="fixed inset-0 z-[10503] flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.45, ease: EASE }}
                      className="font-bold text-[12px] tracking-[6px] uppercase mb-5 text-[#6B5D4A]"
                    >
                      Entering the Room
                    </motion.div>
                    <motion.h1
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DUR.beat, delay: 0.55, ease: EASE }}
                      className="font-display text-[100px] leading-none text-[#2C2419]"
                    >
                      {launching.name}
                    </motion.h1>

                    {/* Pulsing dots — the loading heartbeat while the board readies */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.0 }}
                      className="flex gap-2 mt-8"
                    >
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay }}
                          className="w-2 h-2 rounded-full"
                          style={{ background: launching.color }}
                        />
                      ))}
                    </motion.div>
                  </div>
                </>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ UNLOCK SEQUENCE — root level so z-index beats guide at z-[150].
          One transition, not three: the portal zoom (in OrbitalEntry) IS the
          transition. Darkness completes it from the core's own interior tone,
          ACCESS GRANTED is stamped inside that darkness in the house three-beat
          grammar, and the whole overlay exhales into team select's arrival.
          No curtains, no full-screen sweeps. ═══ */}
      <AnimatePresence>
        {unlocking && (
          /* z-[10500]: above the wire (z-[9999]) — full-screen rituals own the
             whole stage, the way CoachTakeover (z-[10001]) already does. */
          <motion.div
            key="unlock"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="fixed inset-0 z-[10500]"
          >
            {/* ── The portal swallows the screen (0–1.05s): the zoom carries
                the first beat; the core's interior tone deepens to black ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.65 }}
              className="absolute inset-0"
              style={{ background: "radial-gradient(circle at 50% 44%, #1D1114 0%, #000 78%)" }}
            />

            {/* ── ACCESS GRANTED, three beats inside the darkness:
                the frame rules draw and settle · the words track in ·
                the stamp details stagger ── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Beat 1 — the top rule draws left-to-right, settles quiet */}
              <motion.div
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: 1, opacity: [1, 1, 0.55] }}
                transition={{
                  duration: DUR.draw, delay: 1.15, ease: EASE,
                  opacity: { duration: DUR.settle, delay: 1.15, times: [0, 0.55, 1] },
                }}
                className="w-[240px] h-px mb-6 origin-left"
                style={{ background: BRAND.colors.primary }}
              />
              {/* Beat 2 — the words arrive by tracking, the letterpress landing */}
              <motion.div
                initial={{ opacity: 0, letterSpacing: "12px" }}
                animate={{ opacity: 1, letterSpacing: "4px" }}
                transition={{ duration: DUR.beat, delay: 1.35, ease: EASE }}
                className="font-display text-[40px] uppercase text-[#2C2419]"
              >
                Access Granted
              </motion.div>
              {/* Beat 3 — stamp details, house stagger */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 0.3, delay: 1.65 }}
                className="tartan-band w-[240px] h-[6px] mt-4"
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 1.65 + STAGGER }}
                className="font-mono text-[14px] tracking-[4px] mt-5"
                style={{ color: "#a8a5a6" }}
              >
                ROOM CODE &middot; {roomCode.trim()}
              </motion.div>
              {/* The bottom rule closes the frame, one stagger behind the top */}
              <motion.div
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: 1, opacity: [1, 1, 0.55] }}
                transition={{
                  duration: DUR.draw, delay: 1.15 + STAGGER, ease: EASE,
                  opacity: { duration: DUR.settle, delay: 1.15 + STAGGER, times: [0, 0.55, 1] },
                }}
                className="w-[240px] h-px mt-6 origin-right"
                style={{ background: BRAND.colors.primary }}
              />
            </div>

            {/* "Finding your team" holds while the ritual plays out */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 2.3 }}
              className="absolute bottom-[80px] left-0 right-0 flex justify-center"
            >
              <div className="text-[15px]" style={{ color: "#a8a5a6" }}>
                Finding your team
              </div>
            </motion.div>

            {/* ── The archival clip (optional slot) — plays after ACCESS GRANTED ── */}
            {showClip && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 bg-black flex flex-col items-center justify-center px-10"
              >
                {/* True-size matte: the 1981 footage sits framed on black
                    rather than blown up full-bleed; caption lives on the
                    margin below, never over the picture. */}
                <video
                  src={UNLOCK_CLIP}
                  autoPlay
                  playsInline
                  onEnded={finishUnlock}
                  onError={finishUnlock}
                  className="max-h-[56vh] w-auto max-w-[78vw]"
                  style={{ border: "1px solid rgba(255,255,255,0.14)" }}
                />
                <div className="pointer-events-none mt-9 max-w-[760px] text-center">
                  <div
                    className="font-display italic text-[#2C2419] text-[25px]"
                    style={{ textWrap: "balance" } as React.CSSProperties}
                  >
                    {UNLOCK_CLIP_CAPTION}
                  </div>
                  <div className="slug mt-3" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {UNLOCK_CLIP_CREDIT}
                  </div>
                </div>
                <button
                  onClick={finishUnlock}
                  className="absolute top-6 right-8 text-[13px] font-bold uppercase tracking-[2px] transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Skip →
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ GUIDE OVERLAY — root level so it covers team page mount seamlessly ═══ */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[150] flex items-center justify-center"
            style={{ background: "#F3EEE7" }}
            onClick={dismissGuide}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[900px] mx-6 flex flex-col overflow-hidden rounded-lg"
              style={{ background: "#1B1A1D", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <div className="tartan-band w-full" style={{ height: 5, opacity: 0.55 }} aria-hidden="true" />
              {/* Top — red segmented progress */}
              <div
                className="flex items-stretch gap-2 px-6 pt-5 pb-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
              >
                {GUIDE_SLIDES.map((slide, i) => {
                  const isActive = i === guideSlide;
                  const isPast = i < guideSlide;
                  return (
                    <button
                      key={i}
                      onClick={() => setGuideSlide(i)}
                      className="flex-1 flex flex-col gap-2.5 bg-transparent border-none cursor-pointer p-0 text-left"
                    >
                      <span
                        className="block h-[3px] w-full"
                        style={{
                          background: isActive || isPast ? BRAND.colors.primary : "rgba(255,255,255,0.15)",
                          transition: "background 0.25s ease",
                        }}
                      />
                      <span
                        className="text-[11px] tracking-[1.5px] uppercase font-bold whitespace-nowrap"
                        style={{ color: isActive ? BRAND.colors.primaryBright : "rgba(255,255,255,0.4)" }}
                      >
                        {slide.verb}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Content area */}
              <div className="flex-1 flex flex-col">
                <div className="px-14 pt-10 pb-8 flex-1 flex flex-col" style={{ minHeight: 380 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={guideSlide}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="flex-1 flex flex-col"
                    >
                      {/* Verb label + its drawn mark */}
                      <span
                        className="flex items-center gap-2.5 font-bold text-[15px] tracking-[5px] uppercase mb-6"
                        style={{ color: BRAND.colors.primary }}
                      >
                        <ActiveGuideMark size={20} className="shrink-0" />
                        {GUIDE_SLIDES[guideSlide].verb}
                      </span>

                      {/* Place name */}
                      <h2
                        className="font-display text-[56px] leading-[1.05] mb-6"
                        style={{ color: "#FFFFFF", textWrap: "balance" }}
                      >
                        {GUIDE_SLIDES[guideSlide].place}
                      </h2>

                      {/* Body */}
                      <p
                        className="text-[21px] leading-[1.6] max-w-[640px]"
                        style={{ color: "#A8A5A6", textWrap: "pretty" }}
                      >
                        {GUIDE_SLIDES[guideSlide].body}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Bottom nav */}
                <div
                  className="flex items-center justify-end gap-3 px-12 py-5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {guideSlide > 0 && (
                    <button
                      onClick={() => setGuideSlide((s) => s - 1)}
                      className="font-bold text-[14px] px-6 py-3 cursor-pointer transition-colors"
                      style={{ color: "rgba(255,255,255,0.75)", background: "transparent", border: "1px solid rgba(255,255,255,0.35)" }}
                    >
                      Back
                    </button>
                  )}
                  {guideSlide < GUIDE_SLIDES.length - 1 ? (
                    <button
                      onClick={() => setGuideSlide((s) => s + 1)}
                      className="font-bold text-[14px] px-8 py-3 cursor-pointer transition-colors rounded-sm text-white border-none"
                      style={{ background: BRAND.colors.primary }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.colors.primaryBright; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.colors.primary; }}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={dismissGuide}
                      className="font-bold text-[14px] px-8 py-3 cursor-pointer transition-colors rounded-sm text-white border-none"
                      style={{ background: BRAND.colors.primary }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.colors.primaryBright; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = BRAND.colors.primary; }}
                    >
                      Let&apos;s go
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
