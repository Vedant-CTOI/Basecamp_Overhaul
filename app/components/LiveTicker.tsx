"use client";

import { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { GROUPS, BRAND } from "@/lib/config";

// Partial idea shape — only the columns LiveTicker selects
type TickerIdea = {
  id: string;
  name: string;
  status: string;
  source: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// White or ink on a team-color ground, by luminance (cobalt/olive → white, rose → ink)
function chipText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 128 ? BRAND.colors.ink : "#fff";
}

const TEAM_TAGS: Record<string, { label: string; color: string; textColor: string }> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [
    g.slug,
    { label: g.shortLabel, color: g.color, textColor: chipText(g.color) },
  ])
);

const TICKER_GAP = 60;

interface TickerEvent {
  teamSlug: string;
  text: string;
  time: string;
}

export default function LiveTicker() {
  const pathname = usePathname();
  const [events, setEvents] = useState<TickerEvent[]>([
    { teamSlug: "", text: BRAND.workshopTitle || BRAND.name, time: "" },
  ]);
  const [customMessages, setCustomMessages] = useState<TickerEvent[]>([]);
  const [breakingNews, setBreakingNews] = useState<{ id: string; message: string; reporter?: string } | null>(null);
  const knownIdeaIds = useRef<Set<string>>(new Set());
  const knownStatuses = useRef<Record<string, string>>({});
  const knownNames = useRef<Record<string, string>>({});
  const initialized = useRef(false);

  const teamsRef = useRef<Record<string, string>>({});

  // Fetch teams once (they never change during workshop)
  const teamsFetched = useRef(false);
  const fetchTeamsOnce = useCallback(async () => {
    if (teamsFetched.current) return;
    const { data: teamsData } = await supabase.from("teams").select("id,slug");
    if (teamsData) {
      teamsData.forEach((t: { id: string; slug: string }) => {
        teamsRef.current[t.id] = t.slug;
      });
      teamsFetched.current = true;
    }
  }, []);

  const pollIdeas = useCallback(async () => {
    await fetchTeamsOnce();
    let data;
    try {
      ({ data } = await supabase
        .from("ideas")
        .select("id, name, status, source, team_id, created_at, updated_at")
        .order("created_at", { ascending: false }));
    } catch (err) {
      console.error("LiveTicker poll failed:", err);
      return;
    }
    if (!data) return;

    if (!initialized.current) {
      const seedEvents: TickerEvent[] = [];
      data.forEach((idea: TickerIdea) => {
        knownIdeaIds.current.add(idea.id);
        knownStatuses.current[idea.id] = idea.status;
        knownNames.current[idea.id] = idea.name;
        const teamSlug = idea.team_id ? teamsRef.current[idea.team_id] || "" : "";
        if (idea.source === "ai_scouted") {
          seedEvents.push({ teamSlug, text: `Scouted "${idea.name}"`, time: "" });
        } else if (idea.status === "starting_lineup") {
          seedEvents.push({ teamSlug, text: `Shortlisted "${idea.name}"`, time: "" });
        } else if (idea.status === "coached") {
          seedEvents.push({ teamSlug, text: `Coached "${idea.name}"`, time: "" });
        } else {
          seedEvents.push({ teamSlug, text: `Added "${idea.name}" to the board`, time: "" });
        }
      });
      if (seedEvents.length > 0) {
        setEvents((prev) => [...seedEvents, ...prev]);
      }
      initialized.current = true;
      return;
    }

    const newEvents: TickerEvent[] = [];
    data.forEach((idea: TickerIdea) => {
      const teamSlug = idea.team_id ? teamsRef.current[idea.team_id] || "" : "";

      if (!knownIdeaIds.current.has(idea.id)) {
        knownIdeaIds.current.add(idea.id);
        knownStatuses.current[idea.id] = idea.status;
        knownNames.current[idea.id] = idea.name;
        newEvents.push({ teamSlug, text: idea.source === "ai_scouted" ? `Scouted "${idea.name}"` : `Added "${idea.name}" to the board`, time: "now" });
      } else {
        // Detect name change
        if (knownNames.current[idea.id] && knownNames.current[idea.id] !== idea.name) {
          newEvents.push({ teamSlug, text: `Renamed "${knownNames.current[idea.id]}" → "${idea.name}"`, time: "now" });
          knownNames.current[idea.id] = idea.name;
        }
        // Detect status change
        if (knownStatuses.current[idea.id] !== idea.status) {
          const oldStatus = knownStatuses.current[idea.id];
          knownStatuses.current[idea.id] = idea.status;
          if (idea.status === "starting_lineup") {
            newEvents.push({ teamSlug, text: `Shortlisted "${idea.name}"`, time: "now" });
          } else if (idea.status === "coached" && oldStatus === "draft") {
            newEvents.push({ teamSlug, text: `Coached "${idea.name}"`, time: "now" });
          }
        }
      }
    });

    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, 16));
    }
  }, []);

  const lastBreakingId = useRef<string | null>(null);
  const mountedAt = useRef(Date.now());

  const fetchCustomMessages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("ticker_messages")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) {
        // Separate standard ticker messages from breaking news
        const standard = data.filter((m: { style?: string }) => !m.style || m.style === "standard");
        setCustomMessages(
          standard.map((m: { message: string }) => ({
            teamSlug: "",
            text: m.message,
            time: "",
          }))
        );

        // Show breaking news ONLY if it was created after this component mounted
        // (i.e., it's a genuinely new event, not a pre-existing DB row)
        const breaking = data.find((m: { style?: string }) => m.style === "breaking");
        if (breaking && breaking.id !== lastBreakingId.current) {
          lastBreakingId.current = breaking.id;
          const createdAt = new Date(breaking.created_at).getTime();
          if (createdAt > mountedAt.current - 3000) {
            setBreakingNews({
              id: breaking.id,
              message: breaking.message,
              reporter: breaking.reporter || undefined,
            });
            setTimeout(() => setBreakingNews(null), 5000);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch ticker messages:", err);
    }
  }, []);

  // Ctrl+Cmd+Shift+B — instant breaking news from pre-generated pool (demo only)
  const demoBreakingRef = useRef(0);
  useEffect(() => {
    // Bespoke layer: rewrite per engagement to match the room's voice.
    const DEMO_BREAKING: { message: string }[] = [
      { message: "The showcase can push breaking-news moments to every screen — facilitators fire them live" },
      { message: "This announcement landed on every screen in the room at once. It came from a keyboard shortcut." },
      { message: "Facilitators use these for milestones — a voting call, a surge, a moment the whole room should see" },
    ];
    const handler = (e: KeyboardEvent) => {
      // Only allow on facilitator pages (center-court, admin, big-board)
      const path = window.location.pathname;
      const isFacilitator = path.startsWith("/center-court") || path.startsWith("/admin") || path.startsWith("/big-board");
      if (!isFacilitator) return;

      if (e.ctrlKey && e.metaKey && e.shiftKey && (e.key === "B" || e.key === "b" || e.code === "KeyB")) {
        e.preventDefault();
        const item = DEMO_BREAKING[demoBreakingRef.current % DEMO_BREAKING.length];
        demoBreakingRef.current++;
        // Show toast immediately — demo only, no DB insert
        setBreakingNews({
          id: `demo-${Date.now()}`,
          message: item.message,
        });
        setTimeout(() => setBreakingNews(null), 5000);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isHidden =
    pathname === "/report" ||
    pathname === "/vote" ||
    pathname === "/center-court" ||
    pathname === "/admin" ||
    pathname === "/mountain-mark" ||
    pathname === "/card-lab" || // option-study sheet — no chrome over the comparison
    pathname === "/stage-lab"; // Stage mock — mirrors /center-court, which carries no wire

  // Debounce pollIdeas for realtime events (1.5s) — ticker is ambient, delay is fine
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedPollIdeas = useMemo(() => debounce(() => pollIdeas(), 1500), [pollIdeas]);

  useEffect(() => {
    if (isHidden) return; // Don't fetch or subscribe on hidden pages
    fetchCustomMessages();
    pollIdeas();

    const channel = supabase
      .channel("ticker-messages-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_messages" },
        () => { fetchCustomMessages(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" },
        () => { debouncedPollIdeas(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pollIdeas, debouncedPollIdeas, fetchCustomMessages, isHidden]);

  // Weave custom messages (instruction + heritage) between idea activity events
  const allEvents: TickerEvent[] = [];
  let customIdx = 0;
  events.forEach((event, i) => {
    allEvents.push(event);
    if ((i + 1) % 2 === 0 && customIdx < customMessages.length) {
      allEvents.push(customMessages[customIdx++]);
    }
  });
  allEvents.push(...customMessages.slice(customIdx));

  // Build one set long enough to fill the screen, then duplicate for seamless loop.
  const minItems = Math.max(12, allEvents.length);
  const repeats = Math.ceil(minItems / allEvents.length);
  const oneSet: TickerEvent[] = [];
  for (let r = 0; r < repeats; r++) oneSet.push(...allEvents);

  // JS-driven scroll — pixel-perfect, no jump on re-render or loop seam
  const trackRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const half = halfRef.current;
    if (!track || !half) return;

    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      const halfWidth = half.offsetWidth;
      const loopWidth = halfWidth + TICKER_GAP;
      const speed = 0.05; // fixed ambient speed — px per ms (~50px/sec)

      posRef.current -= speed * dt;
      if (posRef.current <= -loopWidth) {
        posRef.current += loopWidth;
      }

      track.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [oneSet.length, isHidden]);

  if (isHidden) return null;

  return (
    <>
    {/* Breaking News Toast (top-right, desktop notification style) */}
    <AnimatePresence>
      {breakingNews && (
        <motion.div
          key={breakingNews.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-5 right-5 z-[10000] w-[380px] overflow-hidden rounded-[2px]"
          style={{ background: BRAND.colors.ink, border: "1px solid rgba(107,93,74,0.22)", borderLeft: `4px solid ${BRAND.colors.primary}` }}
        >
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: "1px solid rgba(107,93,74,0.22)" }}>
            <div className="w-1.5 h-1.5 rounded-full live-pulse" style={{ background: BRAND.colors.primary }} />
            <span className="text-[10px] font-bold tracking-[3px] uppercase text-[#2C2419]">Breaking</span>
          </div>
          <div className="flex items-start gap-3 p-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: BRAND.colors.primary }}
            >
              <span className="font-serif italic text-[20px] leading-none text-[#2C2419]">B</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#2C2419] leading-tight" style={{ textWrap: "balance" } as React.CSSProperties}>{breakingNews.message}</p>
              {breakingNews.reporter && (
                <p className="text-[11px] text-[#2C2419]/40 mt-1.5">
                  {breakingNews.reporter} — just now
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Standard scrolling ticker */}
    <div
      id="live-ticker"
      className="fixed bottom-0 left-0 right-0 h-[40px] z-[9999] flex items-center overflow-hidden"
      style={{ background: BRAND.colors.ink }}
    >
      {/* LIVE label */}
      <div
        className="flex items-center gap-2 px-4 h-full shrink-0 whitespace-nowrap"
        style={{ background: BRAND.colors.primary }}
      >
        <span
          className="w-[6px] h-[6px] rounded-full live-pulse"
          style={{ background: "#fff" }}
        />
        <span
          className="font-bold text-[11px] tracking-[2px] uppercase text-[#2C2419]"
        >
          LIVE
        </span>
      </div>

      {/* Scrolling track — two identical halves, JS-driven scroll */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={trackRef}
          className="flex whitespace-nowrap"
          style={{ gap: TICKER_GAP, willChange: "transform" }}
        >
          {[0, 1].map((half) => (
            <div
              key={half}
              ref={half === 0 ? halfRef : undefined}
              className="flex shrink-0 whitespace-nowrap"
              style={{ gap: TICKER_GAP }}
              aria-hidden={half === 1 ? "true" : undefined}
            >
              {oneSet.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-[10px] shrink-0 font-[500] text-[13px] text-[#2C2419]"
                >
                  {event.teamSlug && TEAM_TAGS[event.teamSlug] ? (
                    <span
                      className="font-bold text-[10px] tracking-[1px] px-2 py-[2px]"
                      style={{
                        background: TEAM_TAGS[event.teamSlug].color,
                        color: TEAM_TAGS[event.teamSlug].textColor,
                      }}
                    >
                      {TEAM_TAGS[event.teamSlug].label}
                    </span>
                  ) : (
                    <span className="font-bold text-[13px] opacity-50">·</span>
                  )}
                  <span>{event.text}</span>
                  {!event.teamSlug && (
                    <span className="font-bold text-[13px] opacity-50">·</span>
                  )}
                  {event.time && (
                    <span className="font-mono text-[10px] opacity-60">{event.time}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
