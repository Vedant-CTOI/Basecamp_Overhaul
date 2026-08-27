"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Idea, TrainingNote } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { write } from "@/lib/db";
import { COACH_LIST, COACH_DEFS, PILLARS, BRAND, FRAMEWORK_FIELDS, withAlpha, darkMark, type CoachType } from "@/lib/config";
import { SHOWCASE_COACH_REPLIES } from "@/lib/showcase-data";
import { MarkCoach } from "@/components/Marks";
import { EASE, DUR } from "@/lib/motion";

// In-place coaching: the coach comes to the idea. The board dims to a
// theater scrim; the idea sits as a paper card under a desk lamp on the
// left; the coach masthead — then the composed copy-deck reply — appears
// on the right. Esc/X returns to the board unchanged. The "new space" is
// staged with light, not a route change.
//
// The exchange itself follows the anatomy proven across the Coke and
// Sprite training rooms: a coach banner (face + name + title + switcher),
// per-coach histories that survive switching, a seeded opening ask, the
// coach's face and color on every reply, and the participant answering
// from the right — conversation anchored at the reply bar, growing upward.

// ── THE PLATE ────────────────────────────────────────────────────────
// The coach's words arrive COMPOSED — the whole paragraph set at once,
// layout stable from its first painted frame, fully re-readable. Nothing
// about the reading is metered: a room reading a projected screen
// together cannot regress or re-read while a tail is still moving, and
// our stream was never a window into a machine anyway — it walked
// pre-written copy at 18ms/word (docs/research-coach-modalities.md, P1;
// Round 6 of /card-lab, variant B).
//
// Aliveness moves BEFORE the words. While the coach composes, the slot
// reserves a bounded, near-empty page and holds a single hairline in the
// coach's colour, breathing slowly — the coach considering. Then the
// plate lands: the ground, the spine and the coach's name flood to full
// over one beat, and the copy is simply THERE, at full ink, from its
// first painted frame.

// The standard menu hairlines — same values the Newsroom's nav dropdown
// carries, so every dropdown in the house shares one anatomy.
const HAIRLINE = "1px solid rgba(255,255,255,0.18)";
const HAIRLINE_DIM = "1px solid rgba(255,255,255,0.10)";

// ── The cast is config, not geometry (D-5) ───────────────────────────
// The picker derives from COACH_LIST: four coaches compose as the 2×2
// masthead, three or fewer stand in one row, five or six run three
// across. The intro sentence counts the actual cast, so a recast
// engagement can never ship copy that lies about its own roster.
const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
const COACH_COUNT_WORD = COUNT_WORDS[COACH_LIST.length] ?? String(COACH_LIST.length);
const PICKER_COLS = COACH_LIST.length === 4 ? 2 : COACH_LIST.length <= 3 ? Math.max(COACH_LIST.length, 1) : 3;

/** The coach's page: hairline frame, ground, and the held-back ground it
 *  wears while the words are still being composed. */
const PAGE_EDGE = "rgba(255,255,255,0.10)";
const PAGE_GROUND = "rgba(255,255,255,0.055)";
const PAGE_GROUND_DIM = "rgba(255,255,255,0.014)";

/** THE BEAT IS THE WORK, NEVER ADDED TO IT.
 *  In a live deployment the coach's pause IS the model composing — the
 *  generation call goes in `fetchReply` below and the beat lasts exactly
 *  as long as it takes. Nothing is padded on top.
 *  MIN_BEAT_MS is the only timer that survives: a floor, so a fast reply
 *  doesn't flash the reserved page for two frames. If generation takes
 *  longer than the floor, the floor costs nothing.
 *  SHOWCASE_BEAT_MS stands in for generation here only because the
 *  scripted replies are already written and return instantly. */
const MIN_BEAT_MS = 450;
const SHOWCASE_BEAT_MS = 1100;

/** The reserved slot's bounded minimum — the floor the empty page holds
 *  while the coach composes, so the plate landing never shoves the
 *  exchange around. Hot metal invented this: the stop-press fudge box, a
 *  hole left in the layout before anyone knew what would fill it. The
 *  exchange grows upward off the reply bar, so an under-reserved slot
 *  shoves the ask above it; when the pending reply is already known
 *  (the showcase), `ComposingPage` sizes the hole to it exactly and
 *  nothing moves at all. */
const RESERVE_H = 188;

/** The same hue held back — the spine while the coach is still composing.
 *  One value, read by both the reserved slot and the plate that lands into
 *  it, so the flood always starts exactly where the waiting page left off. */
function held(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.32)`;
}

interface Line {
  role: "coach" | "user";
  coach?: CoachType;
  round?: number;
  text: string;
}

/** The seeded opening ask — the exchange starts as a conversation, the
 *  way the training rooms opened it, and it is the round-1 prompt the
 *  exchange record carries. */
const OPENING_ASK = "Give us your first read on this idea.";

export default function CoachTakeover({
  idea,
  teamSlug,
  onClose,
  onCoached,
}: {
  idea: Idea;
  /** For the exchange record — training_notes.team_slug, same as the
      training room files it. Optional so other hosts keep working. */
  teamSlug?: string | null;
  onClose: () => void;
  onCoached?: () => void;
}) {
  const [coach, setCoach] = useState<CoachType | null>(null);
  // Each coach keeps their own exchange — switching preserves history, the
  // way the training rooms did. The dot in the switcher marks who you've met.
  const [linesByCoach, setLinesByCoach] = useState<Partial<Record<CoachType, Line[]>>>({});
  const [cappedByCoach, setCappedByCoach] = useState<Partial<Record<CoachType, boolean>>>({});
  // U8 — the exchange is DURABLE. It used to live only in this state,
  // so closing the takeover (or refreshing the page) destroyed the
  // whole conversation while the idea went on counting as coached.
  // `hydrated` gates the seeded ask until the record has been read
  // back; `hydratedCounts` marks which lines are restored history, so
  // the plate-arrival flood stays reserved for material that is new.
  const [hydrated, setHydrated] = useState(false);
  const hydratedCounts = useRef<Partial<Record<CoachType, number>>>({});
  // The store refused the exchange record — said in the exchange's own
  // register, and the idea is NOT marked coached until a record lands.
  const [noteFailed, setNoteFailed] = useState(false);
  const [reply, setReply] = useState("");
  /** True while the coach is composing — the one pending flag. It drives
   *  the reserved slot, the banner's disabled controls, and (in a live
   *  deployment) would simply follow the model's own pending state. */
  const [busy, setBusy] = useState(false);
  /** The reply on its way, when it is already written. Showcase only —
   *  it lets the reserved slot hold the exact height the plate will need. */
  const [pending, setPending] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  // First encounter is theater; every one after is a colleague pulling up a
  // chair. The full "Meet the coaches" intro shows once per device, then the
  // picker quiets to "Bring in a coach."
  const [firstRun] = useState(() => typeof window !== "undefined" && !localStorage.getItem("coaches-met"));
  const [met, setMet] = useState(() => !(typeof window !== "undefined" && !localStorage.getItem("coaches-met")));
  const scrollRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const wasBusyRef = useRef(false);
  const abortRef = useRef(false);
  const busyRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);
  /** The mic runs until switched off; `onend` re-arms while this is true. */
  const wantMicRef = useRef(false);
  /** Text present before the mic opened — speech appends to it. */
  const micBaseRef = useRef("");
  const replyRef = useRef("");

  replyRef.current = reply;

  const lines = coach ? linesByCoach[coach] ?? [] : [];
  const capped = coach ? !!cappedByCoach[coach] : false;

  // The idea is a live manuscript — you rewrite it as the coach pushes. Edits
  // debounce-save so the board reflects them by the time you close.
  const [draft, setDraft] = useState({
    name: idea.name ?? "",
    description: idea.description ?? "",
    bbei_connection: (idea.bbei_connection as string) ?? "",
    key_partners: (idea.key_partners as string) ?? "",
  });
  // Same three truths the open card's slug tells (U3): saved, saving,
  // and the one this surface could not say before — the store refused
  // it. The rewrite stays in the fields either way.
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const saved = saveState === "saved";
  const [showFramework, setShowFramework] = useState(
    !!((idea.bbei_connection as string) || (idea.key_partners as string))
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);

  // Ref callback: size a textarea to its content on mount — onInput alone
  // leaves pre-filled manuscripts clipped at the default row height.
  const autoSize = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, []);
  draftRef.current = draft;

  // U7 — only what changed. The Board's open card, the Stage's open
  // card and the training room all debounce-save this same row; three
  // surfaces each sending all four fields is how a facilitator tidying
  // a title used to overwrite a team rewriting a description.
  const lastSavedRef = useRef({
    name: idea.name ?? "",
    description: idea.description ?? "",
    bbei_connection: (idea.bbei_connection as string) ?? "",
    key_partners: (idea.key_partners as string) ?? "",
  });

  const persist = useCallback(async () => {
    const d = draftRef.current;
    const changed: Record<string, unknown> = {};
    for (const f of ["name", "description", "bbei_connection", "key_partners"] as const) {
      if (d[f] === lastSavedRef.current[f]) continue;
      changed[f] = f === "name" || f === "description" ? d[f] : d[f] || null;
    }
    if (!Object.keys(changed).length) {
      setSaveState("saved");
      return;
    }
    const r = await write(
      "ideas.update:coach-autosave",
      supabase.from("ideas").update({ ...changed, updated_at: new Date().toISOString() }).eq("id", idea.id)
    );
    if (!r.ok) {
      // The rewrite stays on screen. The takeover holds the room's
      // attention; losing the words behind a silent failure is the one
      // thing it must never do.
      setSaveState("failed");
      return;
    }
    lastSavedRef.current = { ...draftRef.current };
    setSaveState("saved");
    // U8 — an edit is not an exchange. This used to call onCoached, so
    // rewriting a field in the coaching room stamped the idea COACHED
    // with no exchange on record; the stamp now follows the record
    // alone (composeReply, after the training_notes insert lands).
  }, [idea.id]);

  const editField = (field: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 700);
  };

  const closeAndSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!saved) persist();
    onClose();
  }, [saved, persist, onClose]);

  // U8 — REHYDRATE THE EXCHANGE. The takeover's persistence IS the
  // training_notes path the training rooms already write: one row per
  // completed exchange (idea, coach, team slug, prompt, reply), read
  // back here and folded into per-coach histories. THE SEAM: in
  // showcase mode this select runs against the in-memory shim (which
  // the BroadcastChannel bus carries across tabs); against a real
  // backend it is the same training_notes table, no adapter needed —
  // durability rides whatever store `lib/supabase` resolves to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("training_notes")
        .select("*")
        .eq("idea_id", idea.id)
        .order("created_at");
      if (cancelled) return;
      const restored: Partial<Record<CoachType, Line[]>> = {};
      for (const n of ((data as TrainingNote[] | null) ?? [])) {
        const type = n.coach_type as CoachType;
        if (!COACH_DEFS[type] || !n.ai_response) continue;
        const lines = (restored[type] ??= []);
        const round = lines.filter((l) => l.role === "coach").length + 1;
        if (n.user_prompt) lines.push({ role: "user", text: n.user_prompt });
        lines.push({ role: "coach", coach: type, round, text: n.ai_response });
      }
      for (const [type, lines] of Object.entries(restored)) {
        hydratedCounts.current[type as CoachType] = lines.length;
      }
      // History first, then anything this session already appended —
      // in practice nothing has: the seeded ask waits on `hydrated`.
      setLinesByCoach((prev) => {
        const merged: Partial<Record<CoachType, Line[]>> = { ...restored };
        for (const [type, lines] of Object.entries(prev)) {
          const t = type as CoachType;
          merged[t] = [...(restored[t] ?? []), ...(lines ?? [])];
        }
        return merged;
      });
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [idea.id]);

  // Esc closes, always. There is no stream to fast-forward any more — the
  // reply is composed, so the only thing a press during the composing beat
  // could skip is the beat itself, and abandoning the coach mid-thought is
  // exactly what the × button does. Listener lives in its own effect so
  // re-renders never touch the abort cleanup (mount-only below).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The takeover owns Esc while it holds the screen — capture +
      // stopPropagation so the host page's card-close handler never
      // fires from the same press (Esc must match the × button:
      // close the takeover, keep the card under it open).
      e.stopPropagation();
      // ...but a key pressed inside a field belongs to the field first. The
      // left column is a live manuscript, and a single Esc while rewriting the
      // idea was throwing the participant out of the coaching room mid-sentence
      // — the exchange does not survive the close. One press releases the
      // field, a second leaves the coach, which is the contract the board card
      // and the Stage already keep.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        t.blur();
        return;
      }
      closeAndSave();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeAndSave]);

  // The takeover is a full-screen ritual: freeze the page behind it. A fixed
  // overlay can never paint over the document scrollbar's gutter, so at
  // window sizes where the board scrolls, a jagged strip of board stayed
  // visible along the right edge. Hiding overflow removes the scrollbar —
  // the overlay then truly reaches the window edge at any size.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = prev; };
  }, []);

  useEffect(() => {
    // StrictMode double-mounts: the first cleanup fires before the real
    // mount, so re-arm the flag on every effect run or streams stay dead.
    abortRef.current = false;
    return () => {
      abortRef.current = true;
      wantMicRef.current = false;
      audioRef.current?.pause();
      recogRef.current?.stop?.();
    };
  }, []);

  // Close the coach switcher on outside click — same listener the training
  // rooms carried.
  useEffect(() => {
    if (!showSwitcher) return;
    const onDown = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSwitcher]);

  // Coach voice playback removed (Dove edition ruling: coaches are text-only).
  // Kept as a no-op so call sites and the replay control stay structurally valid.
  const playVoice = useCallback((_type: CoachType) => { /* text-only */ }, []);

  // Participant answers by voice — Chrome Web Speech transcribes into the
  // reply field (the participant's own voice, so no synthesis quality risk).
  // The mic stays open until it's switched off. Chrome's recognizer ends
  // itself at the first pause even with `continuous`, so the session is
  // re-armed on `end` while the participant still wants it listening —
  // otherwise a three-second think killed the mic mid-sentence.
  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      wantMicRef.current = false;
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    wantMicRef.current = true;
    // Text already typed is kept; speech appends to it.
    micBaseRef.current = reply ? reply.trimEnd() + " " : "";

    const start = () => {
      const recog = new SR();
      recog.lang = "en-US";
      recog.interimResults = true;
      recog.continuous = true;
      recog.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
        const heard = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        setReply(micBaseRef.current + heard);
      };
      recog.onend = () => {
        if (!wantMicRef.current) { setListening(false); return; }
        // Bank what was heard, then re-arm for the next breath.
        micBaseRef.current = replyRef.current ? replyRef.current.trimEnd() + " " : "";
        try { start(); } catch { setListening(false); }
      };
      recog.onerror = (e: { error?: string }) => {
        // A silent stretch is not a failure — only real faults stop us.
        if (e?.error === "no-speech" || e?.error === "aborted") return;
        wantMicRef.current = false;
        setListening(false);
      };
      recogRef.current = recog;
      recog.start();
    };

    setListening(true);
    start();
  };

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Entering or switching a coach lands on the newest exchange.
  useEffect(() => {
    if (coach) scrollToEnd();
  }, [coach, scrollToEnd]);

  // When the coach starts composing, pin the top of the reserved slot.
  // The slot holds its own height, so the plate lands into a space the
  // room is already looking at — nothing under it moves, and there is no
  // tail to chase.
  useEffect(() => {
    if (busy && !wasBusyRef.current) {
      requestAnimationFrame(() => {
        slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    wasBusyRef.current = busy;
  }, [busy]);

  const appendLine = useCallback((type: CoachType, line: Line) => {
    setLinesByCoach((prev) => ({ ...prev, [type]: [...(prev[type] ?? []), line] }));
  }, []);

  // The coach composes, then the plate lands. No metering, ever.
  const composeReply = useCallback(async (type: CoachType, round: number, prompt: string) => {
    const full = SHOWCASE_COACH_REPLIES[type] ?? "";
    setPending(full);
    setBusy(true);
    busyRef.current = true;

    // The one place a live deployment changes: return the model's reply
    // here. Whatever it costs in time IS the beat — the waiting page and
    // the landing are driven off `busy` alone and need no other edit.
    const fetchReply = async () => {
      await new Promise((r) => setTimeout(r, SHOWCASE_BEAT_MS)); // showcase stand-in for generation
      return full;
    };

    const startedAt = Date.now();
    const text = await fetchReply();
    // Floor only — never a pad. A reply that took longer than the floor
    // waits zero extra milliseconds.
    const remaining = MIN_BEAT_MS - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    if (abortRef.current) return;
    appendLine(type, { role: "coach", coach: type, round, text });
    // The voice speaks with the plate, never over an empty slot.
    playVoice(type);
    setBusy(false);
    busyRef.current = false;

    // U8 — THE RECORD, THEN THE STAMP. One training_notes row per
    // completed exchange, written the moment the reply lands (an
    // abandon AFTER this keeps the record; an abandon during the beat
    // was caught by abortRef above and leaves nothing). Same insert
    // shape as the training room's, so the Newsroom's exact coaching
    // count sees takeover exchanges too. Only if the record took does
    // the idea get marked coached — a COACHED stamp the count cannot
    // see is the disagreement U8 exists to end.
    const note = await write(
      "training_notes.insert:exchange",
      supabase.from("training_notes").insert({
        idea_id: idea.id,
        coach_type: type,
        team_slug: teamSlug ?? null,
        user_prompt: prompt,
        ai_response: text,
      })
    );
    if (!note.ok) {
      setNoteFailed(true);
      return;
    }
    setNoteFailed(false);
    if (round === 1) onCoached?.();
  }, [appendLine, idea.id, teamSlug, onCoached, playVoice]);

  // Selecting a coach only SELECTS — the seeding waits below.
  const chooseCoach = (type: CoachType) => {
    if (busyRef.current) return;
    if (!met) {
      localStorage.setItem("coaches-met", "1");
      setMet(true);
    }
    setShowSwitcher(false);
    setCoach(type);
  };

  // U8 — the seeded ask fires only once the record has been read back.
  // Seeding on the click could open a second round 1 over a history
  // about to land; gated on `hydrated`, a restored coach shows their
  // exchange and a genuinely new one gets the ask, exactly once — the
  // empty-lines guard holds across re-runs because the append itself
  // fills the lines.
  useEffect(() => {
    if (!coach || !hydrated || busyRef.current) return;
    if (linesByCoach[coach]?.length) return;
    appendLine(coach, { role: "user", text: OPENING_ASK });
    composeReply(coach, 1, OPENING_ASK);
  }, [coach, hydrated, linesByCoach, appendLine, composeReply]);

  const backToPicker = () => {
    if (busyRef.current) return;
    setShowSwitcher(false);
    audioRef.current?.pause();
    setVoiceOn(false);
    setCoach(null);
  };

  const sendReply = () => {
    if (!reply.trim() || busy || !coach) return;
    const prompt = reply.trim();
    const round = (linesByCoach[coach] ?? []).filter((l) => l.role === "coach").length + 1;
    appendLine(coach, { role: "user", text: prompt });
    setReply("");
    setTimeout(scrollToEnd, 60);
    if (round > 1) { setCappedByCoach((prev) => ({ ...prev, [coach]: true })); return; }
    composeReply(coach, round, prompt);
  };

  const activeCoach = coach ? COACH_DEFS[coach] : null;

  // Portaled to <body>: the takeover mounts inside the expanded-card modal,
  // and rendering in place would leave it subject to whatever that ancestor
  // does — padding, transforms, overflow clipping. The ritual owns the whole
  // viewport, so it hangs off the document root instead.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[10001] flex items-stretch"
      style={{ background: "rgba(16,15,17,0.96)" }}
      onClick={() => { if (!busyRef.current) closeAndSave(); }}
    >

      {/* The arrival, three beats: the idea travels to the desk (paper glides
          in from center-stage), the red rule draws down the seam, then the
          coaching side arrives. Taking the idea somewhere is the point. */}
      <motion.div
        exit={{ opacity: 0, y: 16, scale: 0.99, transition: { duration: 0.25 } }}
        className="relative m-auto flex w-full max-w-[1440px] h-[calc(100vh-48px)] overflow-hidden"
        style={{ boxShadow: "0 30px 90px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left — the idea as a live manuscript you edit as the coach pushes */}
        <motion.div
          initial={{ x: "34%", scale: 0.96, opacity: 0 }}
          animate={{ x: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
          className="w-1/2 shrink-0 flex flex-col justify-start px-14 pt-24 pb-12 relative overflow-y-auto"
          style={{ background: "#FFFFFF", color: "#231F20" }}
        >
          <div className="relative w-full max-w-[580px]">
            <div className="flex items-center justify-between mb-8">
              <span className="slug text-[12px]" style={{ color: "#8A8689" }}>
                On the desk · {PILLARS[idea.category]?.label ?? idea.category}
              </span>
              <span
                data-qa="coach-autosave-slug"
                data-state={saveState}
                className="slug text-[12px] transition-opacity duration-300"
                style={{ color: saveState === "failed" ? BRAND.colors.primary : "#8A8689", opacity: saved ? 0.5 : 1 }}
              >
                {saveState === "failed" ? "Not saved · Retry" : saved ? "Saved" : "Saving…"}
              </span>
            </div>

            <textarea
              ref={autoSize}
              value={draft.name}
              onChange={(e) => editField("name", e.target.value)}
              placeholder="Name this idea"
              rows={1}
              className="w-full bg-transparent resize-none font-display text-[46px] leading-[1.08] mb-6 outline-none overflow-hidden edit-field"
              style={{ color: "#231F20" }}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
            />

            <textarea
              ref={autoSize}
              value={draft.description}
              onChange={(e) => editField("description", e.target.value)}
              placeholder={"Describe the idea — and keep rewriting it as the coach pushes."}
              className="w-full bg-transparent resize-none text-[22px] leading-[1.55] outline-none min-h-[120px] overflow-hidden edit-field"
              style={{ color: "#4a4749" }}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
            />

            {/* The framework — where the idea fits. Quiet, editable, revealed
                when it has content or on demand, so a bare idea stays clean. */}
            {showFramework ? (
              <div className="mt-9 pt-7" style={{ borderTop: "1px solid rgba(35,31,32,0.14)" }}>
                {([["bbei_connection", FRAMEWORK_FIELDS[1].label], ["key_partners", FRAMEWORK_FIELDS[2].label]] as const).map(([field, label]) => (
                  <div key={field} className="mb-5 last:mb-0">
                    <div className="slug text-[12px] mb-2" style={{ color: "#8A8689" }}>{label}</div>
                    <textarea
                      ref={autoSize}
                      value={draft[field]}
                      onChange={(e) => editField(field, e.target.value)}
                      placeholder="—"
                      className="w-full bg-transparent resize-none text-[16px] leading-[1.5] outline-none min-h-[44px] overflow-hidden edit-field"
                      style={{ color: "#4a4749" }}
                      onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setShowFramework(true)}
                className="mt-8 slug text-[11px] cursor-pointer bg-transparent border-none transition-colors"
                style={{ color: "#8A8689" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#231F20"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8A8689"; }}
              >
                + Add the framework
              </button>
            )}
          </div>
        </motion.div>

        {/* Beat 2 — the red rule draws down the seam, then settles to a hairline */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 z-10 pointer-events-none">
          <motion.div
            initial={{ scaleY: 0, opacity: 1 }}
            animate={{ scaleY: 1, opacity: [1, 1, 0.25] }}
            transition={{ duration: 0.5, delay: 0.5, ease: EASE, opacity: { duration: 1.4, delay: 0.5, times: [0, 0.6, 1] } }}
            className="h-full w-full origin-top"
            style={{ background: BRAND.colors.primary }}
          />
        </div>

        {/* Beat 3 — the coaching side arrives to meet the idea */}
        <motion.div
          initial={{ x: "5%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.42, ease: EASE }}
          className="w-1/2 flex flex-col min-w-0"
          style={{ background: "#1B1A1D" }}
        >
          {/* Coach banner — face, name, title, switcher: the anatomy the
              training rooms landed on, in the Ogilvy dress. */}
          {/* One content column for the whole coaching side: banner, exchange,
              and reply bar all hang on the same 40px rails (px-10). */}
          <div
            className="flex items-center justify-between gap-3 px-10 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", minHeight: 77 }}
          >
            {activeCoach ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={backToPicker}
                  disabled={busy}
                  title="All coaches"
                  className="font-mono text-[22px] px-1 cursor-pointer bg-transparent border-none text-[#2C2419]/40 hover:text-[#2C2419] disabled:opacity-30 disabled:cursor-default transition-colors shrink-0"
                >
                  ‹
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeCoach.avatar}
                  alt=""
                  className="w-[44px] h-[44px] rounded-full shrink-0"
                  style={{ border: "1px solid rgba(107,93,74,0.25)" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[22px] leading-tight text-[#2C2419] truncate">{activeCoach.name}</span>

                  </div>
                  <div className="text-[12px] font-medium tracking-[0.04em] leading-tight truncate" style={{ color: "#8A8689" }}>
                    {activeCoach.title}
                  </div>
                </div>
              </div>
            ) : (
              <span className="flex items-center gap-3 font-display text-[26px] text-[#2C2419]">
                {met ? (
                  <>
                    <MarkCoach size={20} className="shrink-0 opacity-90" />
                    Bring in a coach
                  </>
                ) : (
                  ""
                )}
              </span>
            )}
            <div className="flex items-center gap-1 shrink-0">
              {activeCoach && (
                <div className="relative" ref={switcherRef}>
                  <button
                    onClick={() => setShowSwitcher((v) => !v)}
                    disabled={busy}
                    title="Switch coach"
                    className="flex flex-col gap-[5px] items-center justify-center cursor-pointer bg-transparent disabled:opacity-30 disabled:cursor-default transition-opacity"
                    style={{ width: 32, height: 32, border: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-[14px] h-[2px] rounded-full" style={{ background: "#8A8689" }} />
                    ))}
                  </button>
                  {/* The switcher is the standard house dropdown — the same
                      container, hover, and open/close motion as the Newsroom's
                      nav menu, with coach-color spines where teams carry theirs. */}
                  <AnimatePresence>
                    {showSwitcher && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="absolute right-0 top-[42px] z-50 overflow-hidden"
                        style={{ transformOrigin: "top right", background: "#262529", border: HAIRLINE, borderRadius: 2, width: 260 }}
                      >
                        {COACH_LIST.filter((c) => c.type !== coach).map((c, i, arr) => {
                          const hasHistory = !!linesByCoach[c.type]?.length;
                          const spine = c.color === "#231F20" ? "#A8A5A6" : c.color;
                          return (
                            <motion.button
                              key={c.type}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2, delay: i * 0.03, ease: EASE }}
                              onClick={() => chooseCoach(c.type)}
                              className="w-full flex items-center gap-3 px-5 py-[11px] text-left cursor-pointer bg-transparent border-none relative overflow-hidden transition-colors duration-200 group"
                              style={{ borderBottom: i < arr.length - 1 ? HAIRLINE_DIM : "none" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: spine }} />
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={c.avatar} alt="" className="w-[30px] h-[30px] rounded-full shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold tracking-[1px] uppercase text-[#2C2419] leading-tight opacity-90 group-hover:opacity-100 transition-opacity duration-200">{c.name}</div>
                                <div className="text-[11px] font-medium" style={{ color: "#8A8689" }}>{c.title}</div>
                              </div>
                              <span className="ml-auto flex items-center gap-2 shrink-0">
                                {hasHistory && (
                                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: "rgba(255,255,255,0.6)" }} />
                                )}
                                <span className="text-[11px] opacity-0 group-hover:opacity-40 transition-opacity duration-200 text-[#2C2419]">→</span>
                              </span>
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={closeAndSave}
                className="text-2xl leading-none p-2 text-[#2C2419]/50 hover:text-[#2C2419] transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {!coach ? (
            // Masthead — pick a coach
            <div className="flex-1 overflow-y-auto px-12 py-10 flex flex-col justify-center">
              {!met ? (
                <div className="mb-9">
                  <div className="slug mb-3 flex items-center gap-2.5" style={{ color: "#8A8689" }}>
                    <MarkCoach size={18} className="shrink-0 text-[#2C2419]" />
                    The Coaching Room
                  </div>
                  <h3 className="font-display text-[44px] leading-[1.02] mb-5 text-[#2C2419]">Meet the coaches</h3>
                  {/* Inline textWrap: the unlayered global `p { text-wrap: pretty }`
                      beats Tailwind's layered text-balance utility, and pretty
                      still strands "all of them." as a 92px stub on this measure.
                      Balance evens the three lines. */}
                  <p className="font-display italic text-[20px] leading-[1.55] max-w-[540px]" style={{ color: "#A8A5A6", textWrap: "balance" }}>
                    {COACH_COUNT_WORD} ways to push an idea. Each already knows your category brief. Bring one in, or work the idea through all of them.
                  </p>
                </div>
              ) : (
                // Inline textWrap: the global `p` pretty rule out-cascades the
                // text-balance utility; pretty alone orphans "brief." here.
                <p className="font-display italic text-[19px] leading-[1.55] mb-8 max-w-[520px]" style={{ color: "#A8A5A6", textWrap: "balance" }}>
                  Pick a coach to push this idea — each already knows your category brief.
                </p>
              )}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${PICKER_COLS}, minmax(0, 1fr))` }}
              >
                {COACH_LIST.map((c, ci) => (
                  <motion.button
                    key={c.type}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: (firstRun && !met ? 0.62 : 0.1) + ci * 0.08, ease: EASE }}
                    onClick={() => chooseCoach(c.type)}
                    className="relative overflow-hidden text-left cursor-pointer min-h-[230px] flex flex-col justify-end transition-transform duration-200 hover:scale-[1.015]"
                    style={{ background: c.color, border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {/* Full-bleed duotone portrait in the coach's color world;
                        face sits in the upper 2/3, name block over the scrim.
                        The path is the coach's own `portrait` slot (D-5 — no
                        filename remap here); a missing file falls through to
                        the monogram SVG that ships beside every avatar. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.portrait}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = c.avatar.replace(/\.png$/, ".svg");
                      }}
                      className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(to bottom, rgba(10,10,12,0) 42%, rgba(10,10,12,0.78) 100%)" }}
                    />
                    {linesByCoach[c.type]?.length ? (
                      <span className="absolute top-4 right-4 w-[6px] h-[6px] rounded-full" style={{ background: "rgba(255,255,255,0.85)" }} />
                    ) : null}
                    <div className="relative p-6 pt-0">
                      <div className="font-display text-[26px] text-[#2C2419] leading-tight">{c.name}</div>
                      <div className="text-[13px] font-medium tracking-[0.03em]" style={{ color: "rgba(255,255,255,0.85)" }}>{c.title}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            // The exchange — composed copy-deck plates, anchored at the reply
            // bar and growing upward. Newest stays visible; scroll for history.
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 flex flex-col gap-5">
                <div className="flex-1 shrink-0" />
                <AnimatePresence initial={false}>
                  {lines.map((line, i) => (
                    <ExchangeLine
                      key={`${coach}-${i}`}
                      line={line}
                      fallbackCoach={coach}
                      // Only the newest plate floods its ground and spine —
                      // it is the one that lands into the reserved slot.
                      // Restored history is not new material: it renders
                      // as printed fact, no arrival (Round 13).
                      arriving={i === lines.length - 1 && i >= (hydratedCounts.current[coach] ?? 0)}
                    />
                  ))}
                </AnimatePresence>
                {noteFailed && (
                  // U8 — the exchange is on screen but NOT on record,
                  // and the idea is not marked coached. True data, in
                  // the micro-register, holding still (Round 13).
                  <p data-qa="coach-note-failed" className="slug text-[12px]" style={{ color: BRAND.colors.primary }}>
                    Not recorded · this exchange is not on the idea&rsquo;s record. The next reply tries again.
                  </p>
                )}
                {busy && (
                  <div ref={slotRef}>
                    <ComposingPage
                      coach={coach}
                      round={lines.filter((l) => l.role === "coach").length + 1}
                      pending={pending}
                    />
                  </div>
                )}
                {capped && (
                  <p className="font-display italic text-[16px] leading-[1.5] max-w-[460px]" style={{ color: "#8A8689" }}>
                    With a live engagement key, this is a real conversation grounded in your brief — the showcase carries one scripted{" "}round.
                  </p>
                )}
              </div>
              <div
                className="flex items-center gap-3 px-10 py-5 shrink-0"
                style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
              >
                <button
                  onClick={toggleMic}
                  title="Answer by voice"
                  className="shrink-0 w-[46px] h-[46px] flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    border: `1px solid ${listening ? BRAND.colors.primary : "rgba(255,255,255,0.25)"}`,
                    background: listening ? withAlpha(BRAND.colors.primary, 0.15) : "transparent",
                  }}
                >
                  <span
                    className={listening ? "live-pulse" : ""}
                    style={{ color: listening ? BRAND.colors.primary : "rgba(255,255,255,0.6)", fontSize: 18 }}
                  >
                    ◉
                  </span>
                </button>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                  placeholder={listening ? "Listening…" : "Respond to the coach…"}
                  className="flex-1 bg-transparent text-[16px] text-[#2C2419] outline-none px-4 py-3.5"
                  style={{ border: "1px solid rgba(255,255,255,0.25)" }}
                />
                <button
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  className="font-bold text-[13px] tracking-[1px] uppercase px-7 py-3.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
                  style={{ background: BRAND.colors.primary, color: "#2C2419", border: "none" }}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function ExchangeLine({ line, fallbackCoach, arriving }: { line: Line; fallbackCoach: CoachType; arriving?: boolean }) {
  if (line.role === "user") {
    // The participant answers from the right — the position the training
    // rooms gave the team's voice.
    return (
      <motion.div
        data-qa="exchange-user"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="self-end max-w-[75%]"
      >
        <div className="slug text-[13px] mb-1.5 text-right" style={{ color: "rgba(255,255,255,0.4)" }}>You</div>
        {/* Same paper, hairline, and corner as the coach's page — one
            conversation system; the coach is distinguished by the spine. */}
        <div
          className="px-5 py-4"
          style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 2 }}
        >
          <p className="text-[17px] leading-[1.6]" style={{ color: "#e6e4e5" }}>{line.text}</p>
        </div>
      </motion.div>
    );
  }
  return <CoachPlate coach={line.coach ?? fallbackCoach} round={line.round ?? 1} text={line.text} arriving={arriving} />;
}

/** The page frame both states share, so the plate lands into exactly the
 *  box the reserved slot was holding. The left edge carries no colour
 *  here — it is animated, and a shorthand would fight the animation. */
const PAGE_FRAME: React.CSSProperties = {
  color: "#E6E4E5",
  borderRadius: 2,
  borderStyle: "solid",
  borderWidth: "1px 1px 1px 3px",
  borderTopColor: PAGE_EDGE,
  borderRightColor: PAGE_EDGE,
  borderBottomColor: PAGE_EDGE,
};

/** The slug line: the coach's face, their name in their own colour, and
 *  the round — Courier, per the copy-deck grammar. */
function SlugRow({ coach, round }: { coach: CoachType; round: number }) {
  const def = COACH_DEFS[coach];
  return (
    <div className="flex items-center gap-2.5 mb-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={def.avatar} alt="" className="w-[24px] h-[24px] rounded-full shrink-0" />
      <span className="slug text-[13px]">
        <span style={{ color: darkMark(def.color) }}>{def.name}</span>
        <span style={{ color: "#8A8689" }}> · Round {String(round).padStart(2, "0")}</span>
      </span>
    </div>
  );
}

/** The reply's own type — one declaration, so the reserved hole and the
 *  landed plate set to identical measure and leading. */
const BODY = "text-[19px] leading-[1.6] whitespace-pre-wrap";

// THE BEAT BEFORE THE WORDS. The page is already addressed — the coach's
// face and name are set at half strength, the way a fudge box carried its
// slug before the copy existed — and a single hairline in their colour
// breathes on the first line. One held mark, not a three-dot bounce and
// not a spinner: it says a person is considering, and says nothing about
// progress, because there is none to report.
function ComposingPage({ coach, round, pending }: { coach: CoachType; round: number; pending?: string }) {
  const spine = darkMark(COACH_DEFS[coach].color);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.cut, ease: EASE }}
      className="w-full p-8"
      style={{ ...PAGE_FRAME, background: PAGE_GROUND_DIM, borderLeftColor: held(spine) }}
      aria-live="polite"
      aria-label={`${COACH_DEFS[coach].name} is composing a reply`}
    >
      <div style={{ opacity: 0.5 }}>
        <SlugRow coach={coach} round={round} />
      </div>
      <div className="relative" style={{ minHeight: RESERVE_H }}>
        {/* Sizes the hole to the copy that is coming, so nothing above it
            moves when the plate lands. Live replies aren't known yet and
            fall back to the bounded minimum. */}
        {pending ? <p className={`invisible ${BODY}`} aria-hidden>{pending}</p> : null}
        {/* The mark rests on the first line's own band (19px × 1.6), so the
            copy sets straight over it. One slow breath fills the beat. */}
        <div className="absolute inset-x-0 top-0 flex items-center" style={{ height: 30 }}>
          <motion.span
            className="block w-[128px]"
            style={{ background: spine, height: 2 }}
            initial={{ opacity: 0.28 }}
            animate={{ opacity: [0.28, 1, 0.28] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// A coach reply as the training rooms had it: a dark bubble in the room,
// the coach's color as its left spine, face on the Courier slug line, Sans
// body in light ink (room legibility). No white slab on the dark panel.
//
// `arriving` marks the plate that lands into the reserved slot. Over one
// beat the ground and the coach's spine flood from held-back to full and
// the slug line comes up from half strength — the arrival registers on the
// FRAME and the NAME, never on the reading. The copy carries no animation
// at all: it is set, at full ink, on its first painted frame, and it never
// moves again. A plate strikes; the ink is either there or it isn't. No
// low-contrast ramp on running text (Round 8 item 3), nothing per-word.
function CoachPlate({ coach, round, text, arriving }: { coach: CoachType; round: number; text: string; arriving?: boolean }) {
  const spine = darkMark(COACH_DEFS[coach].color);
  return (
    <motion.div
      data-qa="exchange-plate"
      className="w-full p-8"
      style={PAGE_FRAME}
      initial={{
        backgroundColor: arriving ? PAGE_GROUND_DIM : PAGE_GROUND,
        borderLeftColor: arriving ? held(spine) : spine,
      }}
      animate={{ backgroundColor: PAGE_GROUND, borderLeftColor: spine }}
      transition={{ duration: DUR.beat, ease: EASE }}
    >
      <motion.div
        initial={{ opacity: arriving ? 0.5 : 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.beat, ease: EASE }}
      >
        <SlugRow coach={coach} round={round} />
      </motion.div>
      <p className={BODY}>{text}</p>
    </motion.div>
  );
}
