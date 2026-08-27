"use client";

// ── A NOTE TO THE DARKROOM ───────────────────────────────────
// The small paper card that stands between a commission and the
// darkroom clock. Every commission — the first "Picture it", a "New
// sheet", a "Picture it again" — passes through here, and every one
// of them can pass through in a single click: the note is OPTIONAL,
// always, and the quiet action exists to say so out loud.
//
// The register is the product's, not a dialog's: theater dim, paper
// ground, ink type, a Courier slug of true data (the idea this is a
// note about), one serif line, one field. No radius, no springs on
// paper (Round 8 item 4) — it arrives on the house EASE/DUR.beat and
// leaves on EASE_EXIT/DUR.cut, like every other paper surface.
//
// The placeholder does real work: three CONCRETE notes in this
// world, so a team that has never written one can see the shape of
// the thing (a direction, not a prompt) without a paragraph of help.
//
// KEYBOARD (the zero-friction path is the point):
//   Esc              close, commission nothing
//   Cmd/Ctrl+Enter   send, note and all
//   Enter (empty)    just develop — the field never blocks the door
//   Enter (typed)    a newline; a note is allowed to be two lines
//   Enter on the primary button   send (native)
//
// Mounts inside the open card above the photo box (z-10700) and
// works identically in presentation mode — the facilitator operates
// the same instrument the team does.
//
// VOCABULARY (Round 11): every label reads from IMAGE_VOCAB
// (lib/config). "A note to the darkroom" is the editorial skin; the
// base register calls the same card "Add direction".

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { IMAGE_VOCAB as V } from "@/lib/config";
import { EASE, EASE_EXIT, DUR } from "@/lib/motion";

/** Concrete, in-world examples — the shape of a note, not a prompt.
    Vocabulary, so they travel with the skin (IMAGE_VOCAB). */
const PLACEHOLDER = V.notePlaceholder.join("\n");

const INK = "#231F20";
const QUIET_INK = "rgba(35,31,32,0.55)";

export default function DarkroomNote({
  ideaName,
  /** True for an idea's FIRST commission — the primary reads
      IMAGE_VOCAB.noteSendFirst rather than noteSendAgain, because
      nothing has come back yet. */
  firstTime,
  onSend,
  onClose,
}: {
  ideaName: string;
  firstTime: boolean;
  /** Commission with this note; "" means no note. */
  onSend: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes. Captured and stopped so the open card underneath never
  // also takes the key and closes behind the dim.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  const send = (withNote: string) => onSend(withNote.trim());

  const handleFieldKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send(note);
      return;
    }
    // Enter on an empty field is the skip: the note is never required,
    // so the field must not be a door you have to open to get through.
    if (e.key === "Enter" && !e.shiftKey && !note.trim()) {
      e.preventDefault();
      send("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
      transition={{ duration: DUR.cut, ease: EASE }}
      className="fixed inset-0 z-[10700] flex items-center justify-center p-6"
      style={{ background: "rgba(10,10,12,0.72)" }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
        transition={{ duration: DUR.beat, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full px-8 pt-7 pb-7"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(35,31,32,0.25)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          maxWidth: 480,
        }}
      >
        {/* The slug row — the eyebrow, and the true data it acts on.
            Same anatomy as the open card's own slug row (eyebrow at the
            system's 12px/3px over a hairline), so this reads as a card
            torn from the same pad rather than as a dialog. */}
        <div
          className="flex items-baseline justify-between gap-4 pb-3 mb-4"
          style={{ borderBottom: "1px solid rgba(35,31,32,0.12)" }}
        >
          <span
            className="font-bold text-[12px] tracking-[3px] uppercase shrink-0"
            style={{ color: INK }}
          >
            {V.noteTitle}
          </span>
          <span
            className="slug min-w-0 truncate text-right"
            style={{ color: "#8A8689", fontSize: 10, textTransform: "none" }}
            title={ideaName}
          >
            {ideaName}
          </span>
        </div>

        <h2
          className="font-display text-[30px] leading-[1.15] mb-2"
          style={{ color: INK }}
        >
          {V.noteHeadline}
        </h2>
        <p className="text-[15px] leading-[1.55] mb-5" style={{ color: "#4a4749" }}>
          {V.noteSupport}
        </p>

        <textarea
          ref={fieldRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleFieldKey}
          placeholder={PLACEHOLDER}
          rows={3}
          autoFocus
          className="w-full px-4 py-3.5 text-[16px] leading-[1.55] focus:outline-none resize-none transition-colors"
          style={{
            background: "rgba(35,31,32,0.02)",
            border: "1px solid rgba(35,31,32,0.2)",
            color: INK,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(35,31,32,0.45)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(35,31,32,0.2)"; }}
        />

        {/* Actions — the slab sends whatever is in the field; the quiet
            line skips the note entirely. One click either way. */}
        <div className="flex items-center gap-5 mt-5">
          <button
            onClick={() => send(note)}
            className="flex items-center justify-center h-12 px-10 font-bold text-[13px] tracking-[1px] transition-opacity cursor-pointer shrink-0 hover:opacity-85"
            style={{ background: INK, color: "#fff", border: "none" }}
            title={V.noteSendHint}
          >
            {firstTime ? V.noteSendFirst : V.noteSendAgain}
          </button>
          <button
            onClick={() => send("")}
            className="font-bold text-[12px] tracking-[0.3px] transition-colors cursor-pointer"
            style={{ background: "transparent", border: "none", padding: 0, color: QUIET_INK }}
            onMouseEnter={(e) => { e.currentTarget.style.color = INK; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = QUIET_INK; }}
            title={V.noteSkipHint}
          >
            {V.noteSkip}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
