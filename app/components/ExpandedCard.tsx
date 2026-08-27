"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Idea, TrainingNote } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { write, matchedNothing } from "@/lib/db";
import { GROUPS, PILLARS, PILLAR_LIST, BRAND, STATUS_LABELS, IMAGE_VOCAB as V, FRAMEWORK_FIELDS as CONFIG_FIELDS, paperType } from "@/lib/config";
import CoachTakeover from "@/components/CoachTakeover";
import { MarkCoach, MarkKill, MarkGenerate } from "@/components/Marks";
import { chooseFrame, commissionPrint, isInDarkroom, isPrintStale, noteSlug, printSourceOf, recoverStalledPrint, useStalledDevelop } from "@/lib/darkroom";
import { qualifiedIdeaNo } from "@/lib/idea-number";
import { EASE, EASE_EXIT, DUR } from "@/lib/motion";
import ContactSheet from "@/components/ContactSheet";
import DarkroomNote from "@/components/DarkroomNote";
import PrintReveal from "@/components/PrintReveal";
import PrintLightbox from "@/components/PrintLightbox";
import StageIdeaPlate from "@/components/StageIdeaPlate";

// ── THE SPREAD ───────────────────────────────────────────────
// The open card is ONE state (user ruling — the poster ⇄ manuscript
// two-state and its Edit/Poster chrome are retired). A printed idea
// opens as a left/right spread: the content column (~1/3) carries the
// slug row, the serif title and the editable manuscript fields; the
// print takes the remaining ~2/3, LARGE.
//
// ACTION LAW (Round 10, user ruling): actions are split by WHAT THEY
// ACT ON, not by where there was room.
//   · IDEA actions run in ONE FULL-WIDTH BAR at the foot of the card,
//     under both columns — the same anatomy every other card carries,
//     so the whole system shares one action UI. Done + Coach are the
//     primary pair at the left margin; Present and Kill sit on the
//     quiet line laid out across the full measure.
//   · PICTURE actions are anchored ON THE PRINT — compact dark chips
//     inset 12px inside the picture region's bottom-right corner
//     ("Choose another frame" / "New sheet", or "Picture it again"
//     when the print has gone stale). This answers the objection the
//     bar alone raised: picture actions stranded under text, with Kill
//     reading as if it belonged to the photograph.
//   · An UNPRINTED idea has no print to anchor to, so its "Picture it"
//     stays on the bar's quiet line. Same bar, no chips.
//
// FORMAT LAW, AMENDED (Round 9 amendment, user ruling): on the spread
// the print MAY crop modestly — it cover-fits the picture region,
// aiming to keep most of the frame (≥75% area) visible. The photo box
// remains the full-frame truth (portal morph unchanged); board cards
// and the contact sheet still mount the full frame.
//
// VOCABULARY (Round 11, user ruling): every image label on this card
// reads from IMAGE_VOCAB (lib/config) — "Picture it / New sheet /
// Choose another frame / In the darkroom…" is the EDITORIAL SKIN this
// showcase selects, not a primitive. The base register says Visualize
// / Generate again / Choose another / Generating…. Comments here keep
// the editorial words because they describe THIS build; code
// identifiers (print_url, commissionPrint, …) are not vocabulary and
// never change with the skin.
//
// Unprinted ideas open with the same anatomy, picture region absent —
// the content column widens to a comfortable measure (~68ch cap),
// never full spread width. When the contact sheet awaits its choice
// (or is reopened on taste), the SHEET renders in the picture region.
const E = `cubic-bezier(${EASE.join(",")})`;
const MORPH = `${DUR.beat}s ${E}`;

// ── The manuscript's four fields, and how they persist ───────
// U7: the autosave sends ONLY what changed. Three surfaces
// debounce-save this same row (this card on the Board, this card on the
// Stage, the training room), and until now all three sent all four
// fields on every save — so a facilitator tidying a title clobbered a
// team rewriting a description, silently. Sending only the changed
// field removes the great majority of those collisions with no UI at
// all.
const AUTOSAVE_FIELDS = ["name", "description", "bbei_connection", "key_partners"] as const;
type AutosaveField = (typeof AUTOSAVE_FIELDS)[number];

/** REMOVABLE IN ONE LINE — set this to false.
 *
 *  The second half of U7: the open card's save carries
 *  `.eq("updated_at", seenAt)`, so a save that matches nothing means
 *  somebody else wrote first, and the card reports it instead of
 *  overwriting them.
 *
 *  HONESTLY UNPROVABLE HERE. It depends on the store comparing a
 *  timestamp to the exact string this app itself wrote. The app writes
 *  `updated_at` explicitly (there is no trigger), so it SHOULD
 *  round-trip — but "should" is not verified: this checkout has no
 *  database, the showcase shim compares JS strings, and a precision or
 *  timezone difference would make every save in the room look like a
 *  conflict. That is a room-breaking failure mode, which is why it
 *  ships behind this flag. It is step 9 of the deployment verification
 *  procedure; if that step fails, flip this to false and field-level
 *  writes carry on alone. */
const USE_UPDATED_AT_PRECONDITION = true;

/** What the autosave slug is currently saying. `Saved` / `Saving…`
 *  were the only two truths this card could tell; a write that failed
 *  simply went on saying `Saved`. The two failure states live in the
 *  same slug, in the same micro-register — no new component, no toast,
 *  no red flood (Round 13: a mark registers once and then holds
 *  still). */
type SaveState = "saved" | "saving" | "failed" | "conflict";
const SAVE_SLUG: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  failed: "Not saved · Retry",
  conflict: "Not saved · Edited elsewhere",
};
/** The spread's width — print-dominant, content column ~1/3. Sized so
    the host's idea-nav chevrons keep the dim at laptop width instead
    of floating on the paper. */
const SPREAD_MAX_W = 1420;
/** The unprinted card's width — a comfortable manuscript measure. */
const COLUMN_MAX_W = 760;

interface ExpandedCardProps {
  idea: Idea;
  teamColor: string;
  teamSlug?: string;
  trainingNotes: TrainingNote[];
  allIdeas?: Idea[];
  onClose: () => void;
  onTrain?: () => void;
  onUpdate?: () => void;
  onCoachOpenChange?: (open: boolean) => void;
  presentationMode?: boolean;
  teamName?: string;
  platformName?: string;
  onReassign?: (newTeamId: string) => void;
  teams?: { id: string; name: string; slug: string; color: string }[];
  onPromote?: () => void;
  onBench?: () => void;
  onDemote?: () => void;
  onNavigateToIdea?: (idea: Idea) => void;
  /** The idea's STABLE № (lib/idea-number) — assigned at creation
      within its team + category and never re-derived from the host's
      order. Carried on the spread's slug row and on the plate. */
  frameNo?: number;
  /** Set only when the collection the card was opened FROM shows more
      than one team (the shortlist views): the number then reads
      `TOUFFOU 03` rather than a bare `03` all three teams could claim. */
  teamTag?: string;
}

interface CardTheme {
  bg: string;
  text: string;
  labelColor: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  inputText: string;
  inputPlaceholder: string;
  headerBorder: string;
  noteBg: string;
  noteBorder: string;
  overlayBg: string;
}

// The expanded card is a printed paper card — white ground, ink text —
// so it reads the same held over the light board or the dark Stage.
function makeCardTheme(color: string): CardTheme {
  return {
    bg: "#FFFFFF",
    text: BRAND.colors.ink,
    labelColor: BRAND.colors.ink,
    inputBg: "rgba(35,31,32,0.02)",
    inputBorder: "rgba(35,31,32,0.2)",
    inputFocusBorder: color,
    inputText: BRAND.colors.ink,
    inputPlaceholder: "#8A8689",
    headerBorder: "rgba(35,31,32,0.12)",
    noteBg: "rgba(35,31,32,0.03)",
    noteBorder: "rgba(35,31,32,0.12)",
    overlayBg: "rgba(20,19,22,0.7)",
  };
}

const CARD_THEMES: Record<string, CardTheme> = Object.fromEntries(
  Object.values(GROUPS).map((g) => [g.slug, makeCardTheme(g.color)])
);

const DEFAULT_THEME: CardTheme = makeCardTheme(BRAND.colors.primary);

// The action grammar — quiet outlined buttons in the content column.
const ACTION_OUTLINE: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(35,31,32,0.3)",
  color: BRAND.colors.ink,
};
function outlineHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = "#002663";
  e.currentTarget.style.background = "rgba(0,38,99,0.06)";
}
function outlineRest(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = "rgba(0,38,99,0.35)";
  e.currentTarget.style.background = "transparent";
}

// The quiet line — everything the slab row doesn't carry sits on ONE
// secondary line at ONE scale: borderless text + mark, ink at half
// weight. A rack of mixed-width outlined boxes wrapping in a 380px
// column is what read as messy; a line of options doesn't.
const QUIET_CLASS =
  "flex items-center gap-1.5 h-7 font-bold text-[12px] tracking-[0.3px] whitespace-nowrap transition-colors";
const QUIET_INK = "rgba(35,31,32,0.55)";
const QUIET_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: QUIET_INK,
};
function quietHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = "#231F20";
}
function quietRest(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.color = QUIET_INK;
}

// On-print chrome — the chip family restored from the frontispiece.
// Compact (30px), because it sits ON a photograph.
//
// The ground is near-solid ink (0.92), not a scrim — Round 8's law:
// type never sits on visible print texture, and at 0.72 the halftone
// ran through the label on a busy frame. On a near-black print that
// ground reads as the print itself, so the WHITE HAIRLINE is what
// holds the chip's edge (0.38, up from 0.28 — at the lower value the
// chip dissolved on dark frames). One chip, legible on every frame
// the darkroom can return.
function ImageChip({ onClick, title, children }: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center font-bold text-[11px] tracking-[1.5px] uppercase px-3.5 cursor-pointer transition-colors whitespace-nowrap"
      style={{
        background: "rgba(10,10,12,0.92)",
        border: "1px solid rgba(255,255,255,0.38)",
        color: "rgba(255,255,255,0.92)",
        height: 30,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.8)"; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.38)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; }}
      title={title}
    >
      {children}
    </button>
  );
}

export default function ExpandedCard({ idea, teamColor, teamSlug, trainingNotes, allIdeas, onClose, onTrain, onUpdate, onCoachOpenChange, presentationMode, teamName, platformName, onReassign, teams, onPromote, onBench, onDemote, onNavigateToIdea, frameNo, teamTag }: ExpandedCardProps) {
  const reduceMotion = useReducedMotion();
  // ── Where focus lives while the card is open ───────────────
  // Focus enters the card itself — never a field, because the name
  // input clears an auto-generated name on focus, and an opening card
  // must not edit anything. On close it goes back to whatever raised
  // the card: the Stage card the room clicked, the board frame, the
  // shortlist entry. Without this, closing strands the keyboard at the
  // top of the document and the room loses its place on the wall.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, []);
  const [editingIdea, setEditingIdea] = useState<Idea>(idea);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReassignMenu, setShowReassignMenu] = useState(false);
  const [showPillarMenu, setShowPillarMenu] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const reassignRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showReassignMenu) return;
    const handler = (e: MouseEvent) => {
      if (reassignRef.current && !reassignRef.current.contains(e.target as Node)) {
        setShowReassignMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showReassignMenu]);

  const pillarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showPillarMenu) return;
    const handler = (e: MouseEvent) => {
      if (pillarRef.current && !pillarRef.current.contains(e.target as Node)) {
        setShowPillarMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPillarMenu]);

  // Sync internal state when navigating between ideas (prop changes).
  // A refreshed row for the SAME idea (realtime — a print landing) only
  // merges the print fields, so in-progress text edits survive the
  // develop beat.
  const lastSyncedId = useRef(idea.id);
  useEffect(() => {
    if (lastSyncedId.current !== idea.id) {
      lastSyncedId.current = idea.id;
      // Flush any pending edit of the PREVIOUS idea before syncing —
      // editingRef still holds that draft (with its own id).
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!savedRef.current) void persistRef.current();
      setSaveState("saved");
      setEditingIdea(idea);
      setNameEdited(false);
      lastSavedRef.current = snapshotOf(idea);
      seenAtRef.current = idea.updated_at ?? null;
    } else {
      setEditingIdea((prev) => ({
        ...prev,
        print_status: idea.print_status,
        print_options: idea.print_options,
        print_url: idea.print_url,
        print_source: idea.print_source,
        print_note: idea.print_note,
      }));
      // U7 — keep the precondition honest. A refetch of the SAME idea
      // whose text still matches what this card last wrote was a
      // non-text write (a print landing, a status change, a wave), and
      // the card must adopt its new `updated_at` or the next keystroke
      // would report a conflict that never happened. A refetch whose
      // text HAS moved is a genuine remote edit: leave `seenAt` alone
      // so the precondition catches it.
      const remoteText = snapshotOf(idea);
      const textUnmoved = AUTOSAVE_FIELDS.every((f) => remoteText[f] === lastSavedRef.current[f]);
      if (textUnmoved && idea.updated_at) seenAtRef.current = idea.updated_at;
    }
  }, [idea]);
  const isStartingLineup = editingIdea.status === "starting_lineup";
  const isTissue = idea.source === "tissue";
  const theme = (teamSlug && CARD_THEMES[teamSlug]) || DEFAULT_THEME;

  // ── Bring to the Stage + The Darkroom ──────────────────────
  // `presenting` is the team's own gate: only ideas they bring to the
  // Stage show in their Stage section. A presenting idea can commission
  // a Darkroom print (lib/darkroom.ts) — the develop runs on its own
  // clock; the reveal lands on the board and Stage via realtime.
  const isPresenting = !!editingIdea.presenting;
  const printStatus = editingIdea.print_status ?? (isInDarkroom(idea.id) ? "developing" : null);
  // U6 — a develop past its ceiling with no clock behind it. Judged
  // off the HOST's `updated_at` (the prop refreshes with every
  // realtime refetch; editingIdea's copy holds still while the card is
  // open) so a develop that lands or restarts elsewhere is seen here.
  const stalled = useStalledDevelop({
    id: idea.id,
    print_status: printStatus,
    updated_at: idea.updated_at ?? editingIdea.updated_at,
  });
  const [presentHover, setPresentHover] = useState(false);
  const hasPrintArt = !!editingIdea.print_url;
  // A stalled re-picture stops ghosting: nothing is coming to replace
  // the print, so the print is the card's standing truth again.
  const isRedeveloping = printStatus === "developing" && hasPrintArt && !stalled;
  // Live provenance: computed against the draft AS EDITED, so the mark
  // appears the moment the text meaningfully leaves the print behind.
  const stale = isPrintStale(editingIdea);
  // The photo box — clicking the print mounts it at room scale. The
  // spread's cover box and the photo box's print share `cardMorphId`
  // (portal morph — research rec 1): the print travels from the spread
  // to room scale and back.
  const [showPhotoBox, setShowPhotoBox] = useState(false);
  const cardMorphId = `print-card-${idea.id}`;
  // ── A note to the darkroom ─────────────────────────────────
  // Every commission goes through the note card first — the first
  // "Picture it", a "New sheet", a "Picture it again". The note is
  // optional and skipping is one click, so this costs nothing; what it
  // buys is the one moment where the team can say what they want
  // different before the 20–30s clock starts. Null = closed; the
  // boolean is the FIRST-TIME case (the primary reads "Develop").
  const [notingFirst, setNotingFirst] = useState<boolean | null>(null);

  // ── The contact sheet ──────────────────────────────────────
  // A commission develops THREE frames (print_options); the team
  // chooses the select. The sheet takes the picture region whenever a
  // developed sheet has no chosen frame yet, or when the team reopens
  // it on taste ("Choose another frame").
  const sheet = editingIdea.print_options ?? null;
  const hasSheet = !!sheet && sheet.length > 0;
  const sheetAwaiting = printStatus === "developed" && hasSheet && !editingIdea.print_url;
  const [reChooseOpen, setReChooseOpen] = useState(false);
  const sheetOpen = sheetAwaiting || (reChooseOpen && hasSheet);
  // The loupe — inspecting sheet frame i full-size before committing.
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  // The spread carries a picture region whenever there is something to
  // mount in it — a chosen print, or the sheet spread for choosing.
  //
  // ── THE FOCUS PLATE (U4 — presentation mode ONLY) ──────────
  // On the Stage the open card IS the room's current object, so it
  // always opens as a spread: an idea with no developed print mounts
  // the shared typographic plate in the picture region rather than
  // collapsing to a 760px column with no picture at all. Text-only
  // ideas stop arriving at the moment the room chooses looking like
  // unfinished image cards (R10), and nothing is fabricated — the plate
  // composes the idea's own name, number, category and team.
  // The Board is untouched: an unprinted idea there still opens as the
  // manuscript column, which is what a working surface wants.
  const showPlate = !!presentationMode && !hasPrintArt && !sheetOpen;
  const showPicture = hasPrintArt || sheetOpen || showPlate;

  // The host hides its idea prev/next chevrons (and arrow-key nav)
  // while a takeover holds the screen — the coach, the photo box, or
  // the loupe. Reset on unmount so a closed card never strands them.
  useEffect(() => {
    onCoachOpenChange?.(showCoach || showPhotoBox || inspectIndex != null || notingFirst != null);
    return () => onCoachOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoach, showPhotoBox, inspectIndex, notingFirst]);

  // ── The cover box — the print's true-16:9 frame in the region ──
  // The picture region's proportions follow the content column, so the
  // print COVER-FITS it: a measured 16:9 box centered on the region,
  // overflow clipped (the modest crop the amendment allows). The box —
  // not the region — is the portal-morph origin, so the travel to the
  // photo box stays a uniform scale of the full frame.
  const regionRef = useRef<HTMLDivElement>(null);
  const [regionBox, setRegionBox] = useState<{ w: number; h: number } | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = regionRef.current;
    if (!el) {
      setRegionBox(null);
      return;
    }
    const measure = () => {
      // offsetWidth/Height: layout size, unaffected by the card's
      // arrival scale transform.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setRegionBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPicture, sheetOpen]);
  const cover = regionBox
    ? (() => {
        const s = Math.max(regionBox.w / 16, regionBox.h / 9);
        const w = 16 * s;
        const h = 9 * s;
        return { w, h, left: (regionBox.w - w) / 2, top: (regionBox.h - h) / 2 };
      })()
    : null;

  // The focus plate's one title size — a step off the region's own
  // width, so the name reads from the back of the room at 1920×1080 and
  // still fits the card at 1280×720. This is the room's CURRENT OBJECT,
  // one headline on one card; the one-size-per-wall ruling governs the
  // field of cards, not the object the room has opened.
  const plateTitlePx = Math.max(30, Math.min(52, Math.round((regionBox?.w ?? 800) * 0.05)));

  // Width transitions arm AFTER first paint, so a print landing on an
  // open card morphs the spread wider instead of snapping — and the
  // arrival itself never animates from the wrong width.
  const [armed, setArmed] = useState(false);
  useEffect(() => { setArmed(true); }, []);

  const handleUseFrame = async (url: string) => {
    setInspectIndex(null);
    setReChooseOpen(false);
    if (url === editingIdea.print_url) return;
    // Local first so the region resolves this frame; the row write
    // carries it to every other surface. print_source stays untouched —
    // all three frames came from the same commissioned draft.
    const was = editingIdea.print_url ?? null;
    setEditingIdea((prev) => ({ ...prev, print_url: url }));
    if (!(await chooseFrame(idea.id, url))) {
      // Put the frame that IS hanging back on the card. A choice the
      // row never took must not go on looking chosen.
      setEditingIdea((prev) => ({ ...prev, print_url: was }));
      setPrintFailure("Not chosen · the sheet is still yours to pick from");
      return;
    }
    setPrintFailure(null);
    onUpdate?.();
  };

  // What the darkroom last refused, if anything — carried on the bar's
  // quiet line, in the same micro-register as every other true fact
  // about this card. Cleared by the next attempt that lands.
  const [printFailure, setPrintFailure] = useState<string | null>(null);
  // What the Stage last refused. The Present control is a gate, and a
  // gate that reports success it did not have is the failure Round 16
  // exists to prevent.
  const [presentFailed, setPresentFailed] = useState(false);

  const handleTogglePresent = async () => {
    const was = isPresenting;
    const next = !was;
    // Optimistic, then honest: the toggle moves at once because the
    // room is watching, and moves BACK if the row would not take it.
    setEditingIdea((prev) => ({ ...prev, presenting: next }));
    setPresentHover(false);
    const r = await write(
      "ideas.update:present",
      supabase
        .from("ideas")
        .update({ presenting: next, updated_at: new Date().toISOString() })
        .eq("id", idea.id)
    );
    if (!r.ok) {
      setEditingIdea((prev) => ({ ...prev, presenting: was }));
      setPresentFailed(true);
      return;
    }
    setPresentFailed(false);
    onUpdate?.();
  };

  const handlePictureIt = () => {
    // Developed is NOT a blocker — a stale print can be deliberately
    // re-pictured and a chosen one sent back for a new sheet; only a
    // develop already in flight is.
    if (printStatus === "developing") return;
    setNotingFirst(!hasPrintArt);
  };

  const handleCommission = async (note: string) => {
    setNotingFirst(null);
    if (printStatus === "developing") return;
    setReChooseOpen(false);
    const r = await commissionPrint(editingIdea, note);
    if (!r.ok) {
      // R7's whole point, said out loud on the card. The commission
      // writes the words FIRST and the picture request second, so a
      // darkroom that refuses the second one has already kept the
      // participant's paragraph — and the card says so, because
      // "nothing happened" and "your text is safe" are different facts
      // and the room needs the second one.
      setPrintFailure(
        r.stage === "print"
          ? "Not sent · your text is saved"
          : "Not sent · nothing was saved, try again"
      );
      // The card's darkroom state is unchanged: no stamp, no clock.
      return;
    }
    setPrintFailure(null);
    setEditingIdea((prev) => ({
      ...prev,
      print_status: "developing",
      print_source: printSourceOf(prev),
      // A commission with nothing to say clears the last one's note —
      // an old direction must never read as this print's provenance.
      print_note: note.trim() || null,
    }));
    onUpdate?.();
  };

  // U6 — one click brings a stranded develop back. The abandon is an
  // explicit write (print_status → null) and only then a clean
  // commission, re-sending the stranded commission's own note — the
  // same ask tried again. On failure the stamp is NOT cleared and the
  // bar's quiet line says so; recovery must never dress a refusal as a
  // fresh develop.
  const handleRetryDevelop = async () => {
    const r = await recoverStalledPrint(
      { ...editingIdea, updated_at: idea.updated_at ?? editingIdea.updated_at },
      editingIdea.print_note ?? null
    );
    if (!r.ok) {
      setPrintFailure(
        r.stage === "print"
          ? "Not sent · your text is saved"
          : "Not sent · nothing was saved, try again"
      );
      return;
    }
    setPrintFailure(null);
    setEditingIdea((prev) => ({
      ...prev,
      print_status: "developing",
      print_source: printSourceOf(prev),
      updated_at: new Date().toISOString(),
    }));
    onUpdate?.();
  };

  // The note, as a Courier slug — one formatter (lib/darkroom), so the
  // developing state, the sheet header and the print's provenance chip
  // never disagree. Long notes truncate on a word boundary.
  const printNote = noteSlug(editingIdea.print_note);

  // Detect auto-generated names (description copied as name from quick-add)
  // Use a ref so that once the user starts typing, we stop treating it as auto-named
  const [nameEdited, setNameEdited] = useState(false);
  // Only detect the truncated "..." pattern as auto-named, not exact matches
  const isAutoNamed = !nameEdited && editingIdea.description && (
    editingIdea.name === editingIdea.description.slice(0, 50).trim() + "..." ||
    editingIdea.name === editingIdea.description.slice(0, 60).trim() + "..."
  );

  // ── Auto-save — the manuscript persists as you type ────────
  // The CoachTakeover pattern: edits debounce-save (700ms) so nothing
  // is ever unsaved; click-out and Esc discard nothing. "Done" closes.
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saved = saveState === "saved";
  // "Nothing is pending" — so a failed or conflicted save still flushes
  // on unmount and on Done, which is how the participant retries
  // through the controls that already exist rather than a new button.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const editingRef = useRef(editingIdea);
  editingRef.current = editingIdea;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The last values this card knows are on the row, and the row's
  // `updated_at` as it was last seen. Together they are what makes the
  // save field-level and the precondition possible.
  const snapshotOf = (d: Idea): Record<AutosaveField, unknown> => ({
    name: d.name ?? null,
    description: d.description ?? null,
    bbei_connection: d.bbei_connection ?? null,
    key_partners: d.key_partners ?? null,
  });
  const lastSavedRef = useRef(snapshotOf(idea));
  const seenAtRef = useRef<string | null>(idea.updated_at ?? null);

  const persist = useCallback(async () => {
    const d = editingRef.current;

    // Only what changed. A save with nothing in it is not a save.
    const changed: Record<string, unknown> = {};
    const now = snapshotOf(d);
    for (const f of AUTOSAVE_FIELDS) {
      if (now[f] !== lastSavedRef.current[f]) changed[f] = now[f];
    }
    if (!Object.keys(changed).length) {
      setSaveState("saved");
      return;
    }

    const stamp = new Date().toISOString();
    let q = supabase
      .from("ideas")
      .update({ ...changed, updated_at: stamp })
      .eq("id", d.id);
    if (USE_UPDATED_AT_PRECONDITION && seenAtRef.current) {
      q = q.eq("updated_at", seenAtRef.current);
    }
    // `.select()` is what makes a matched-nothing update visible: a
    // bare update returns no rows to count.
    const r = await write("ideas.update:autosave", q.select("id"));

    if (!r.ok) {
      // The store refused it. The text stays in the fields — a capture
      // surface that discards what it could not save has destroyed the
      // work it existed to keep.
      setSaveState("failed");
      return;
    }

    if (USE_UPDATED_AT_PRECONDITION && seenAtRef.current && matchedNothing(r)) {
      // Somebody else wrote first. Report it, re-read where the row now
      // is so the NEXT save can win, and leave every keystroke where it
      // is. The participant chooses whether to write again.
      const { data: fresh } = await supabase
        .from("ideas")
        .select("updated_at")
        .eq("id", d.id)
        .maybeSingle();
      seenAtRef.current = (fresh as { updated_at?: string } | null)?.updated_at ?? null;
      setSaveState("conflict");
      onUpdate?.();
      return;
    }

    lastSavedRef.current = now;
    seenAtRef.current = stamp;
    setSaveState("saved");
    onUpdate?.();
  }, [onUpdate]);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const handleFieldChange = (field: string, value: string) => {
    setEditingIdea((prev) => ({ ...prev, [field]: value }));
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistRef.current(), 700);
  };

  // Close mid-debounce loses nothing: flush on unmount.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!savedRef.current) void persistRef.current();
  }, []);

  const handleDone = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!savedRef.current) void persist();
    savedRef.current = true;
    onClose();
  };

  // A kill that half-happened is worse than one that did not happen.
  // The children go before the row (training_notes.idea_id carries no
  // cascade, so the order is load-bearing), and the sequence now STOPS
  // at the first refusal instead of carrying on to strip an idea of its
  // votes and then leave it standing.
  const [deleteFailed, setDeleteFailed] = useState(false);
  const handleDelete = async () => {
    // A pending autosave must not resurrect the row post-delete.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    savedRef.current = true;
    setDeleteFailed(false);
    const votes = await write("votes.delete:kill-idea", supabase.from("votes").delete().eq("idea_id", idea.id));
    if (!votes.ok) return setDeleteFailed(true);
    const notes = await write("training_notes.delete:kill-idea", supabase.from("training_notes").delete().eq("idea_id", idea.id));
    if (!notes.ok) return setDeleteFailed(true);
    const killed = await write("ideas.delete:kill-idea", supabase.from("ideas").delete().eq("id", idea.id));
    if (!killed.ok) return setDeleteFailed(true);
    onUpdate?.();
    onClose();
  };

  const fieldStyle = {
    background: theme.inputBg,
    borderTop: `1px solid ${theme.inputBorder}`,
    borderRight: `1px solid ${theme.inputBorder}`,
    borderBottom: `1px solid ${theme.inputBorder}`,
    borderLeft: `1px solid ${theme.inputBorder}`,
    color: theme.inputText,
    borderRadius: 0,
  };

  // ── The darkroom actions, split by what they act on ────────
  // On the bar (an IDEA action, or a status): "Picture it" for an
  // unprinted idea — it has no print to anchor a chip to — and the
  // "In the darkroom…" slug while a develop runs. While the sheet is
  // spread in the region, the region IS the action (Keep lives in the
  // sheet's own header), so the bar holds no darkroom button.
  //
  // PRESENTATION MODE (user ruling, the darkroom note — amends Round 8
  // item 6's "nobody commissions a print in front of the room"): the
  // facilitator CAN operate. The Stage now carries the same commission
  // actions the board does, and they open the same note card. Cause on
  // record: the note is the moment the room says what it wants
  // different, and the room is on the Stage.
  const barDarkroom = sheetOpen ? null : stalled ? (
    // U6 — the stranded develop, on the bar: the quiet fact in the
    // flag register, and the retry as a real control beside it. No
    // spinner — nothing is working, and the mark must not say so.
    <>
      <button
        onClick={handleRetryDevelop}
        data-qa="retry-develop"
        className="flex items-center justify-center gap-2.5 h-12 px-6 font-bold text-[13px] tracking-[1px] transition-all duration-300 cursor-pointer shrink-0"
        style={ACTION_OUTLINE}
        onMouseEnter={outlineHover}
        onMouseLeave={outlineRest}
        title={V.retryHint}
      >
        <MarkGenerate size={18} />
        {V.retry}
      </button>
      <span data-qa="stalled-line" className={`${QUIET_CLASS} min-w-0`} style={{ ...QUIET_STYLE, color: "#8A8689" }}>
        {V.stalledLine}
      </span>
    </>
  ) : printStatus === "developing" ? (
    <span
      className={`${QUIET_CLASS} min-w-0`}
      style={{ ...QUIET_STYLE, color: "#8A8689" }}
    >
      <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-[rgba(35,31,32,0.15)] border-t-[rgba(35,31,32,0.45)] animate-spin" />
      {V.working}
      {/* The note rides the develop, so the wait states what was asked
          for. Only where there is no picture region to carry it — a
          printed card shows it on the print under the stamp instead. */}
      {!showPicture && printNote && (
        <span
          className="slug min-w-0 truncate ml-1"
          style={{ color: "#8A8689", fontSize: 10, textTransform: "none" }}
          title={editingIdea.print_note ?? undefined}
        >
          {printNote}
        </span>
      )}
    </span>
  ) : !hasPrintArt ? (
    <button
      onClick={handlePictureIt}
      className="flex items-center justify-center gap-2.5 h-12 px-6 font-bold text-[13px] tracking-[1px] transition-all duration-300 cursor-pointer shrink-0"
      style={ACTION_OUTLINE}
      onMouseEnter={outlineHover}
      onMouseLeave={outlineRest}
      title={V.actionHint}
    >
      <MarkGenerate size={18} />
      {V.action}
    </button>
  ) : null;

  // On the print (PICTURE actions): chips anchored fully inside the
  // picture region's bottom-right corner. They stop propagation so a
  // chip never opens the photo box. Hidden while the sheet is spread
  // (choosing IS the action then) and while a develop runs.
  //
  // On the Stage, "Choose another frame" stays (Round 8 item 6: frame
  // choosing is a room conversation — "maybe this other one's better"
  // said out loud IS the product), and since the darkroom-note ruling
  // the commissioning chips stay too: the facilitator can operate, and
  // "send it back, but warmer" is the same room conversation one beat
  // further on.
  const printChips =
    !sheetOpen && hasPrintArt && printStatus !== "developing" ? (
      hasSheet ? (
        <>
          <ImageChip
            onClick={(e) => { e.stopPropagation(); setReChooseOpen(true); }}
            title={V.reChooseHint}
          >
            {V.reChoose}
          </ImageChip>
          <ImageChip
            onClick={(e) => { e.stopPropagation(); handlePictureIt(); }}
            title={V.regenerateHint}
          >
            {V.regenerate}
          </ImageChip>
        </>
      ) : stale ? (
        <ImageChip
          onClick={(e) => { e.stopPropagation(); handlePictureIt(); }}
          title={V.regenerateStaleHint}
        >
          {V.regenerateStale}
        </ImageChip>
      ) : null
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
      transition={{ duration: reduceMotion ? 0 : DUR.cut, ease: EASE }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      style={{ background: theme.overlayBg }}
      onClick={onClose}
    >
      {/* The card arrives on the house grammar — decelerating EASE in,
          accelerating EASE_EXIT out. With reduced motion it simply is
          there: the travel was the event, and the event can be declined
          without losing anything the card says. */}
      <motion.div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={editingIdea.name || "Idea"}
        initial={reduceMotion ? false : { scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0, transition: { duration: DUR.cut } } : { scale: 0.95, y: 20, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
        transition={{ duration: reduceMotion ? 0 : DUR.beat, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="dove-modal-panel relative w-full max-h-[calc(100vh-80px)] flex flex-col overflow-hidden focus:outline-none"
        style={{
          background: theme.bg,
          color: theme.text,
          border: "1px solid rgba(35,31,32,0.18)",
          maxWidth: showPicture ? SPREAD_MAX_W : COLUMN_MAX_W,
          // A print landing on an open card morphs the spread wider —
          // one real-box move on the house ease.
          transition: armed ? `max-width ${MORPH}` : undefined,
        }}
      >
        {/* Team color edge — which wall this card belongs to */}
        <div className="h-[4px] shrink-0" style={{ background: teamColor }} />

        {/* ON THE STAGE, THE PICTURE SETS THE HEIGHT OF THE SPREAD.
            The Round 9 amendment lets the spread crop modestly and
            names the budget: at least 75% of the frame stays visible.
            Cover-fitting a 16:9 print into a region of width W holds
            that budget only while the region is no taller than 0.75W —
            so a long manuscript scrolls inside its own column instead
            of stretching the picture past it. A room-facing card
            cannot be allowed to eat a key visual to fit more copy.
            Guarded: the Board's spread is left exactly as it was. */}
        <div
          className="flex-1 min-h-0 flex items-stretch"
          // 0.74, not 0.75: the budget is a floor, and subpixel widths
          // must not be what decides whether the law holds.
          style={presentationMode && showPicture && regionBox ? { maxHeight: Math.floor(regionBox.w * 0.74) } : undefined}
        >
          {/* ── The content column — slug row / manuscript / actions ── */}
          <div
            className="flex flex-col min-h-0 min-w-0"
            style={{ width: showPicture ? "34%" : "100%", minWidth: showPicture ? 380 : undefined }}
          >
            {/* Slug row */}
            <div
              className="shrink-0 flex items-center gap-x-3 px-6 pt-4 pb-3 overflow-hidden whitespace-nowrap"
              style={{ borderBottom: `1px solid ${theme.headerBorder}` }}
            >
              {frameNo != null && (
                <span data-qa="idea-no" className="slug text-[12px]" style={{ color: "#8A8689" }}>
                  {qualifiedIdeaNo(frameNo, teamTag)}
                </span>
              )}
              <div className="relative" ref={pillarRef}>
                <button
                  className="font-bold text-[12px] tracking-[3px] uppercase px-2 py-1 cursor-pointer border-none"
                  style={{
                    color: PILLARS[editingIdea.category]?.color || "#8A8689",
                    background: `${PILLARS[editingIdea.category]?.color || "#8A8689"}15`,
                  }}
                  onClick={(e) => { e.stopPropagation(); setShowPillarMenu(!showPillarMenu); }}
                >
                  {PILLARS[editingIdea.category]?.label || editingIdea.category} ▾
                </button>
                {showPillarMenu && (
                  <div
                    className="absolute top-full left-0 mt-1 flex flex-col overflow-hidden z-50"
                    style={{ background: "#fff", border: "1px solid rgba(35,31,32,0.2)", boxShadow: "0 12px 32px rgba(35,31,32,0.18)", minWidth: "140px" }}
                  >
                    {PILLAR_LIST.filter((p) => p.slug !== editingIdea.category).map((p) => (
                      <button
                        key={p.slug}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setShowPillarMenu(false);
                          // The text goes first and on its own — moving
                          // an idea to another pillar must not be able
                          // to take its words with it if the move is
                          // refused (R7, the same rule as the
                          // commission).
                          if (!savedRef.current) await persist();
                          const moved = await write(
                            "ideas.update:pillar",
                            supabase.from("ideas").update({
                              category: p.slug,
                              updated_at: new Date().toISOString(),
                            }).eq("id", idea.id)
                          );
                          if (!moved.ok) {
                            // The card stays open on its old pillar and
                            // the slug says the move did not save. The
                            // menu is still there; picking again is the
                            // retry.
                            setSaveState("failed");
                            return;
                          }
                          onUpdate?.();
                          onClose();
                        }}
                        className="px-4 py-2.5 text-left text-[12px] font-bold tracking-[2px] uppercase cursor-pointer border-none transition-colors"
                        style={{ background: "transparent", color: "#8A7A62" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(35,31,32,0.06)"; e.currentTarget.style.color = "#231F20"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8A7A62"; }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isStartingLineup && (
                <span className="stamp" style={{ color: BRAND.colors.primary }}>
                  {STATUS_LABELS.starting_lineup}
                </span>
              )}
              {/* Process facts — quiet flags, not second stamps (stamp
                  discipline: one stamp per surface). The darkroom flag
                  replaces the Stage flag while a develop runs. On the
                  Stage the flag is dropped: the spread's column is a
                  third of the card there, and the bar's filled "On the
                  Stage" button already states it one row below. */}
              {printStatus === "developing" && !stalled ? (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(35,31,32,0.55)" }}
                >
                  <span
                    className="w-3 h-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(35,31,32,0.15)", borderTopColor: "rgba(35,31,32,0.45)" }}
                  />
                  {V.workingFlag}
                </span>
              ) : isPresenting && !presentationMode ? (
                <span
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(35,31,32,0.55)" }}
                >
                  <span className="text-[12px] leading-none">★</span>
                  Stage
                </span>
              ) : null}
              {/* The autosave slug rides the FOOT of the column beside
                  Done — a status, not a header control. Close lives on
                  the picture's top-right corner (or the card's, when
                  there is no picture). */}
              {!showPicture && (
                <button
                  onClick={onClose}
                  className="ml-auto text-2xl leading-none p-1.5 transition-opacity opacity-40 hover:opacity-100"
                  style={{ color: theme.text }}
                  aria-label="Close"
                >
                  ×
                </button>
              )}
            </div>

            {/* The manuscript — title + framework fields, scrolls if the
                column runs long; the bar below never leaves sight. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <div className="mb-3">
                <input
                  type="text"
                  value={isAutoNamed ? "" : editingIdea.name}
                  onChange={(e) => { setNameEdited(true); handleFieldChange("name", e.target.value); }}
                  // No focus handler: the field already RENDERS empty while the
                  // name is auto-generated, so the first keystroke arrives as the
                  // whole typed value. Blanking `editingIdea.name` on focus looked
                  // harmless ("no save scheduled") but the next edit to ANY field
                  // persists the whole record — so merely tabbing through the name
                  // and then touching the description erased the idea's name on
                  // every surface, the Stage included. The clear now happens only
                  // when the participant actually types.
                  // The spread's column is a third of the card, so a
                  // laptop-width Stage cut long names off mid-word: the
                  // title steps down to the serif floor (28px) below
                  // 1400, rather than clipping the idea's own name.
                  // Against the PLATE it steps down further: the plate
                  // is the display and this is the control that corrects
                  // it, so one name is never set twice at one weight.
                  className={`w-full bg-transparent font-display tracking-[1px] focus:outline-none pb-2 ${showPlate ? "text-[26px]" : showPicture ? (presentationMode ? "text-[34px] max-[1400px]:text-[28px]" : "text-[30px] max-[1400px]:text-[28px]") : (presentationMode ? "text-[42px]" : "text-[34px]")}`}
                  style={{
                    color: theme.text,
                    borderBottom: `1px solid ${theme.inputBorder}`,
                  }}
                  placeholder={presentationMode ? "" : "Give this idea a name..."}
                />
                {/* Linked ideas */}
                {editingIdea.link_group && allIdeas && (() => {
                  const linked = allIdeas.filter((i) => i.link_group === editingIdea.link_group && i.id !== editingIdea.id);
                  if (linked.length === 0) return null;
                  return (
                    <div className="flex items-center flex-wrap gap-2 my-3">
                      <span className="text-[13px] tracking-[1px]" style={{ color: "#8A8689" }}>Linked with:</span>
                      {linked.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => { if (onNavigateToIdea) onNavigateToIdea(l); }}
                          className={`text-[13px] px-2 py-0.5 rounded transition-colors border-none ${onNavigateToIdea ? "cursor-pointer" : "cursor-default"}`}
                          style={{ background: "rgba(35,31,32,0.05)", color: "#8A7A62" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(35,31,32,0.1)"; e.currentTarget.style.color = "#231F20"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(35,31,32,0.05)"; e.currentTarget.style.color = "#8A7A62"; }}
                        >
                          {l.name} <span style={{ color: "#8A8689" }}>({PILLARS[l.category]?.label})</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Framework fields — full-width stacked rows. Each is
                  label + field at its own natural height
                  (`field-sizing: content` grows the box with its text;
                  rows= is the floor where unsupported), and every field
                  gets the full measure.

                  ON THE STAGE THE THREE FIELDS ARE NOT PEERS (U4). The
                  room reads the idea; the connection and the partners
                  are what the team answers about it afterwards. So in
                  presentation mode the description takes the column's
                  reading size and the two supporting fields recede to a
                  quieter label and a smaller measure — a hierarchy, not
                  a removal: all three stay editable and keep the same
                  autosave. The Board leaves them peers, because a
                  working surface fills them in one pass. */}
              <div className="flex flex-col">
                <div style={fieldStyle}>
                  <label
                    className="font-bold text-[12px] tracking-[3px] uppercase block mb-2 pt-4 px-4"
                    style={{ color: theme.labelColor }}
                  >
                    Idea
                  </label>
                  <textarea
                    value={editingIdea.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder={presentationMode ? "" : "What's the idea? What does it look like in the world?"}
                    rows={3}
                    className={`w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none min-h-[96px] ${presentationMode ? "text-[24px]" : "text-[18px]"}`}
                    style={{ color: theme.inputText, fieldSizing: "content" } as React.CSSProperties}
                  />
                </div>
                <div style={{ ...fieldStyle, borderTop: "none" }}>
                  <label
                    className={`font-bold tracking-[2px] uppercase block mb-2 pt-4 px-4 ${presentationMode ? "text-[11px]" : "text-[12px]"}`}
                    style={{ color: presentationMode ? "rgba(35,31,32,0.5)" : theme.labelColor }}
                  >
                    {platformName ? `Connection to ${platformName}` : CONFIG_FIELDS[1].label}
                  </label>
                  <textarea
                    value={(editingIdea.bbei_connection as string) || ""}
                    onChange={(e) => handleFieldChange("bbei_connection", e.target.value)}
                    placeholder={presentationMode ? "" : CONFIG_FIELDS[1].prompt}
                    readOnly={isTissue}
                    rows={2}
                    className={`w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none ${presentationMode ? "text-[16px] min-h-[52px]" : "text-[18px] min-h-[64px]"}`}
                    style={{ color: theme.inputText, fieldSizing: "content" } as React.CSSProperties}
                  />
                </div>
                <div style={{ ...fieldStyle, borderTop: "none" }}>
                  <label
                    className={`font-bold tracking-[2px] uppercase block mb-2 pt-4 px-4 ${presentationMode ? "text-[11px]" : "text-[12px]"}`}
                    style={{ color: presentationMode ? "rgba(35,31,32,0.5)" : theme.labelColor }}
                  >
                    {CONFIG_FIELDS[2].label}
                  </label>
                  <textarea
                    value={(editingIdea.key_partners as string) || ""}
                    onChange={(e) => handleFieldChange("key_partners", e.target.value)}
                    placeholder={presentationMode ? "" : CONFIG_FIELDS[2].prompt}
                    readOnly={isTissue}
                    rows={2}
                    className={`w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none ${presentationMode ? "text-[16px] min-h-[52px]" : "text-[18px] min-h-[64px]"}`}
                    style={{ color: theme.inputText, fieldSizing: "content" } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── The picture region — the print LARGE, or the sheet ──
              Its 16:9 intrinsic height is the spread's floor; a longer
              content column stretches it, and the print cover-fits
              (the amendment's modest crop). The full frame is one
              click away in the photo box. */}
          {showPicture && (
            <div
              ref={regionRef}
              className={`relative flex-1 min-w-0 overflow-hidden ${!sheetOpen && hasPrintArt ? "cursor-zoom-in" : ""}`}
              style={{ borderLeft: `1px solid ${theme.headerBorder}`, aspectRatio: "16 / 9" }}
              onClick={(e) => {
                if (sheetOpen || !hasPrintArt) return;
                e.stopPropagation();
                setShowPhotoBox(true);
              }}
              title={!sheetOpen && hasPrintArt ? V.viewFull : undefined}
            >
              {/* Close — chrome on the picture's top-right corner, the
                  same chip family the darkroom actions use, so the slug
                  row keeps its one line for the idea's own facts. */}
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-3 right-3 z-20 flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  width: 30, height: 30,
                  background: "rgba(10,10,12,0.92)",
                  border: "1px solid rgba(255,255,255,0.38)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 17, lineHeight: 1,
                }}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
              {sheetOpen && hasSheet ? (
                <ContactSheet
                  frames={sheet!}
                  chosenUrl={editingIdea.print_url ?? null}
                  ideaName={editingIdea.name}
                  note={editingIdea.print_note ?? null}
                  onUse={handleUseFrame}
                  onInspect={(i) => setInspectIndex(i)}
                  onKeep={
                    reChooseOpen && editingIdea.print_url
                      ? () => setReChooseOpen(false)
                      : undefined
                  }
                />
              ) : hasPrintArt ? (
                <>
                  {/* The cover box — a measured true-16:9 frame centered
                      on the region; the portal-morph origin. */}
                  <motion.div
                    className="absolute"
                    style={{
                      width: cover ? cover.w : "100%",
                      height: cover ? cover.h : "100%",
                      left: cover ? cover.left : 0,
                      top: cover ? cover.top : 0,
                    }}
                    layoutId={cardMorphId}
                    layoutDependency={showPhotoBox}
                    transition={{ layout: { duration: DUR.cut, ease: EASE_EXIT } }}
                  >
                    {/* Re-picture: the old print ghosts down under the
                        stamp; the new one takes its place when the key
                        changes. The ghost is a STATE — this frame is
                        being replaced — and rides the house tokens. */}
                    <div
                      className="w-full h-full"
                      style={{
                        transition: `opacity ${DUR.beat}s ${E}, filter ${DUR.beat}s ${E}`,
                        ...(isRedeveloping ? { opacity: 0.35, filter: "grayscale(1)" } : null),
                      }}
                    >
                      <PrintReveal
                        key={editingIdea.print_url}
                        src={editingIdea.print_url!}
                        alt={`${V.artifact} — ${editingIdea.name}`}
                      />
                    </div>
                  </motion.div>
                  {/* The develop, over the ghost of the old print: the
                      stamp, and under it the note the team sent with
                      the commission — the wait states what was asked
                      for, so the room reads the ask, not just a clock. */}
                  {isRedeveloping && (
                    <div className="absolute left-1/2 top-1/2 z-[3] flex max-w-[80%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
                      <span
                        className="stamp whitespace-nowrap"
                        style={{ color: "#231F20", background: "rgba(255,255,255,0.9)", padding: "3px 8px", transform: "rotate(-1.4deg)" }}
                      >
                        {V.workingStamp}
                      </span>
                      {printNote && (
                        <span
                          className="slug max-w-full truncate text-center"
                          style={{ color: "#231F20", background: "rgba(255,255,255,0.96)", padding: "2px 7px", fontSize: 10, textTransform: "none" }}
                          title={editingIdea.print_note ?? undefined}
                        >
                          {printNote}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Provenance — quiet paper chips, stacked at the
                      print's bottom-left. The NOTE is what was asked
                      for; FROM AN EARLIER DRAFT is what the print no
                      longer matches. Solid ground: a busy print must
                      never tint a slug. */}
                  {(printNote || stale) && !isRedeveloping && (
                    <div className="absolute left-3 bottom-3 z-[3] flex max-w-[52%] flex-col items-start gap-1">
                      {printNote && (
                        <span
                          className="slug max-w-full truncate"
                          style={{ color: "#8A8689", fontSize: 10, background: "rgba(255,255,255,0.96)", padding: "2px 7px", textTransform: "none" }}
                          title={editingIdea.print_note ?? undefined}
                        >
                          {printNote}
                        </span>
                      )}
                      {stale && (
                        <span
                          className="slug"
                          style={{ color: "#8A8689", fontSize: 10, background: "rgba(255,255,255,0.96)", padding: "2px 7px" }}
                        >
                          {V.stale}
                        </span>
                      )}
                    </div>
                  )}
                  {/* The picture actions, ON the picture — anchored
                      fully inside the region's bottom-right corner
                      (12px inset), opposite the provenance slug. */}
                  {printChips && (
                    <div className="absolute bottom-3 right-3 z-[4] flex items-center justify-end gap-2">
                      {printChips}
                    </div>
                  )}
                </>
              ) : showPlate ? (
                // The plate takes the picture's place and does the
                // picture's job: the name, set at room scale, with the
                // idea's own frame numeral behind it. It carries NO
                // description — the manuscript beside it holds that in
                // full, and editable, so nothing is printed twice.
                <StageIdeaPlate
                  idea={editingIdea}
                  frameNo={frameNo}
                  teamTag={teamTag}
                  teamColor={teamColor}
                  teamName={teamName}
                  platform={platformName}
                  titlePx={plateTitlePx}
                  titleLines={3}
                  slugPx={13}
                  gutterRight={44}
                  ground="#131215"
                />
              ) : null}
            </div>
          )}
        </div>

        {/* ── The action bar — ONE row, the full width of the card ──
            Under BOTH columns, so every card in the system (printed,
            unprinted, on the board or on the Stage) carries the same
            action anatomy. The primary pair holds a fixed measure at
            the left margin, aligned to the manuscript — a slab as wide
            as the spread would be a billboard, not a button. The quiet
            line rides the SAME row instead of a second one, because
            the full measure has the room the 380px column never did,
            and Kill holds the far end. Nothing here acts on the
            picture; those actions are chips on the print itself. */}
        <div
          className="shrink-0 flex items-center flex-wrap gap-x-5 gap-y-2 px-6 py-3"
          style={{ borderTop: `1px solid ${theme.headerBorder}` }}
        >
          <div className="flex gap-2.5 shrink-0 items-center">
            <button
              onClick={handleDone}
              className="flex items-center justify-center h-12 px-10 font-bold text-[13px] tracking-[1px] cursor-pointer transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #002663 0%, #0A3478 100%)",
                color: "#2C2419",
                borderRadius: 999,
                boxShadow: "0 4px 16px rgba(0,38,99,0.25)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,38,99,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,38,99,0.25)"; }}
            >
              Done
            </button>
            {onTrain && (
              <button
                onClick={() => setShowCoach(true)}
                className="flex items-center justify-center gap-2.5 h-12 px-6 font-bold text-[13px] tracking-[1px] transition-all duration-300 cursor-pointer"
                style={ACTION_OUTLINE}
                onMouseEnter={outlineHover}
                onMouseLeave={outlineRest}
              >
                <MarkCoach size={18} />
                Coach this idea
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Bring to the Stage — the team's present gate. A peer of
                Coach and Picture it: these three are what you DO to an
                idea, so they carry one weight. Only Done (leave) and
                Kill (destroy) sit outside the set. When it's on, the
                button fills — the state reads without a stamp. */}
            <button
              onClick={handleTogglePresent}
              onMouseEnter={(e) => { setPresentHover(true); if (!isPresenting) outlineHover(e); }}
              onMouseLeave={(e) => { setPresentHover(false); if (!isPresenting) outlineRest(e); }}
              className="flex items-center justify-center gap-2 h-12 px-6 font-bold text-[13px] tracking-[1px] transition-all duration-300 cursor-pointer shrink-0"
              style={isPresenting
                ? { background: "rgba(35,31,32,0.06)", border: "1px solid #231F20", color: BRAND.colors.ink }
                : ACTION_OUTLINE}
              title={isPresenting ? "Take this idea off the Stage" : "Bring this idea to the Stage"}
            >
              <span className="text-[13px] leading-none">{isPresenting ? "★" : "☆"}</span>
              {isPresenting ? "On the Stage" : "Present this"}
            </button>

            {/* The gate did not move. The control is unchanged and still
                takes a click (a failed write may change what a surface
                says, never whether its controls exist) — this says only
                that the Stage has not got it. */}
            {presentFailed && (
              <span
                data-qa="present-failed"
                className="slug text-[11px] shrink-0 pointer-events-none"
                style={{ color: BRAND.colors.primary }}
              >
                Not sent to the Stage
              </span>
            )}

            {barDarkroom}

            {printFailure && (
              <span
                data-qa="print-failed"
                className="slug text-[11px] min-w-0 truncate pointer-events-none"
                style={{ color: BRAND.colors.primary }}
              >
                {printFailure}
              </span>
            )}

            {presentationMode && onPromote && onBench && (
              editingIdea.status === "starting_lineup" ? (
                <button
                  onClick={() => { if (onDemote) { onDemote(); } else { onBench(); } onClose(); }}
                  className={`${QUIET_CLASS} cursor-pointer`}
                  style={QUIET_STYLE}
                  onMouseEnter={quietHover}
                  onMouseLeave={quietRest}
                >
                  Remove from shortlist
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { onBench!(); onClose(); }}
                    className={`${QUIET_CLASS} cursor-pointer`}
                    style={QUIET_STYLE}
                    onMouseEnter={quietHover}
                    onMouseLeave={quietRest}
                  >
                    Set aside
                  </button>
                  <button
                    onClick={() => { onPromote!(); onClose(); }}
                    className={`${QUIET_CLASS} cursor-pointer`}
                    style={QUIET_STYLE}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {/* Red is the STATE, not the offer to enter it. The
                        mark stays red — a mark is what red is for — but
                        the word joins its siblings, so the only red
                        promising "this is the thing right now" on the
                        screen is the Kruger above and the frame the card
                        puts on once the shortlist actually holds it. */}
                    <span className="text-[13px] leading-none" style={{ color: BRAND.colors.primary }}>★</span>
                    Shortlist
                  </button>
                </>
              )
            )}

            {/* Which wall this idea belongs to — an IDEA action, so it
                rides the bar with the rest of them. It sat on the slug
                row until the spread cut that row to a third of the
                card's width and clipped the chip in half; the menu
                opens upward because the card clips its overflow. */}
            {presentationMode && onReassign && teams && (() => {
              const currentTeam = teams.find((t) => t.id === idea.team_id);
              const otherTeams = teams.filter((t) => t.id !== idea.team_id);
              if (otherTeams.length === 0) return null;
              return (
                <div className="relative shrink-0" ref={reassignRef}>
                  <button
                    className={`${QUIET_CLASS} cursor-pointer`}
                    // The open card is paper in both registers, so the
                    // team hue is TYPE here: paper-safe shade for the
                    // label, raw hue for the swatch beside it.
                    style={{ ...QUIET_STYLE, color: paperType(teamColor) }}
                    onClick={(e) => { e.stopPropagation(); setShowReassignMenu(!showReassignMenu); }}
                    title="Move this idea to another team"
                  >
                    <span className="w-2.5 h-2.5 shrink-0" style={{ background: teamColor }} />
                    {currentTeam?.name || "Move"} ▾
                  </button>
                  {showReassignMenu && (
                    <div
                      className="absolute bottom-full left-0 mb-2 flex flex-col overflow-hidden z-50"
                      style={{ background: "#fff", border: "1px solid rgba(35,31,32,0.2)", boxShadow: "0 12px 32px rgba(35,31,32,0.18)", minWidth: "160px" }}
                    >
                      {otherTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={(e) => { e.stopPropagation(); setShowReassignMenu(false); onReassign(t.id); }}
                          className="px-4 py-2.5 text-left text-[12px] font-bold tracking-[2px] uppercase cursor-pointer border-none transition-colors whitespace-nowrap"
                          style={{ background: "transparent", color: "#8A7A62" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = `${t.color}15`; e.currentTarget.style.color = "#231F20"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8A7A62"; }}
                        >
                          Move to {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* The autosave slug — a status, so it sits at the bar's right
              end beside Kill rather than splitting the action groups.
              `pointer-events-none` because a status must never eat a
              click: on the unprinted card the bar's natural width
              exceeds the 760px measure, the action group shrinks under
              it, and this span landed squarely on top of "Picture it". */}
          <div className="flex items-center gap-5 shrink-0 ml-auto">
          {/* The slug now has four truths, not two. A failed or
              conflicted save is the same KIND of fact as "Saved" — true
              data in the micro-register — so it lands in the same span,
              in red type, and then holds still. Retrying is the
              controls that are already here: type again, or press Done,
              and the flush fires the save a second time. */}
          <span
            data-qa="autosave-slug"
            data-state={saveState}
            className="slug text-[11px] transition-opacity duration-300 shrink-0 pointer-events-none"
            style={{
              color: saveState === "saved" || saveState === "saving" ? "#8A8689" : BRAND.colors.primary,
              opacity: saveState === "saved" ? 0.45 : 1,
            }}
          >
            {SAVE_SLUG[saveState]}
          </span>
          {deleteFailed && (
            <span
              data-qa="kill-failed"
              className="slug text-[11px] shrink-0 pointer-events-none"
              style={{ color: BRAND.colors.primary }}
            >
              Not killed · the idea is still on the board
            </span>
          )}

          {/* Kill — the far end of the bar, always right */}
          {showDeleteConfirm ? (
            <span className="ml-auto shrink-0 flex items-center gap-2">
              <span className="font-bold text-[12px] tracking-[0.3px]" style={{ color: BRAND.colors.primary }}>
                Delete?
              </span>
              <button
                onClick={handleDelete}
                className="px-2.5 py-1 font-bold text-[11px] tracking-[1px] cursor-pointer"
                style={{ background: BRAND.colors.primary, color: "#2C2419", border: "none" }}
              >
                Yes
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 font-bold text-[11px] tracking-[1px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid rgba(35,31,32,0.3)", color: theme.text }}
              >
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={`${QUIET_CLASS} shrink-0 cursor-pointer`}
              style={{ ...QUIET_STYLE, color: "rgba(35,31,32,0.4)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = BRAND.colors.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(35,31,32,0.4)"; }}
              aria-label="Delete idea"
              title="Delete"
            >
              <MarkKill size={16} />
              Kill
            </button>
          )}
          </div>
        </div>
      </motion.div>

      {/* The photo box — mounts the print above the card (z-10600) */}
      <AnimatePresence>
        {showPhotoBox && hasPrintArt && (
          <PrintLightbox
            src={editingIdea.print_url!}
            ideaName={editingIdea.name}
            teamName={teamName}
            frameNo={frameNo}
            morphId={cardMorphId}
            onClose={() => setShowPhotoBox(false)}
          />
        )}
      </AnimatePresence>

      {/* The loupe — the photo box in contact-sheet inspection mode:
          flip the three frames full-size, commit with "Use this frame" */}
      <AnimatePresence>
        {inspectIndex != null && hasSheet && (
          <PrintLightbox
            src={sheet![inspectIndex]}
            frames={sheet!}
            initialIndex={inspectIndex}
            ideaName={editingIdea.name}
            teamName={teamName}
            onUse={handleUseFrame}
            onClose={() => setInspectIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* The note to the darkroom — stands between every commission and
          the darkroom clock, on the board and on the Stage alike. */}
      <AnimatePresence>
        {notingFirst != null && (
          <DarkroomNote
            ideaName={editingIdea.name || "Untitled idea"}
            firstTime={notingFirst}
            onSend={handleCommission}
            onClose={() => setNotingFirst(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCoach && (
          <CoachTakeover
            idea={editingIdea}
            teamSlug={teamSlug}
            onClose={() => setShowCoach(false)}
            onCoached={async () => {
              if (editingIdea.status === "draft") {
                const r = await write(
                  "ideas.update:coached",
                  supabase
                    .from("ideas")
                    .update({ status: "coached", updated_at: new Date().toISOString() })
                    .eq("id", idea.id)
                );
                // The COACHED stamp only goes on if the row took it —
                // a stamp the record does not carry is the exact
                // disagreement U8 exists to end, and this card must not
                // manufacture one.
                if (!r.ok) return;
                setEditingIdea((prev) => ({ ...prev, status: "coached" }));
                onUpdate?.();
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
