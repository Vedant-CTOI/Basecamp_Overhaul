"use client";

// The photo box — a Darkroom print mounted at room scale. Full
// theater dim (0.97 — the inspection room is darker than the page
// that launched it), the print as large as the viewport allows
// inside a hairline frame, a lot-card label beneath: the idea name
// in Ogilvy Serif (the surface's ONE serif moment — ≥28px, dark
// register, sanctioned) over a Courier slug of true data.
//
// PORTAL MORPH (research rec 1, pattern P5): the print TRAVELS.
// When the host passes `morphId`, this img and the origin box (mat,
// frontispiece, or poster — same id on a motion.div there) are the
// same shared element: on mount the bounds morph from the origin
// rect to room scale on the house EASE over DUR.beat — the travel
// IS the entrance, no y-rise — and on close the print returns along
// the same path on EASE_EXIT/DUR.cut. All prints are 16:9 and this
// box is 16:9, so the projection scale is uniform — the one case
// where transform-scaling a cover image is safe (the contact-sheet
// stretch rule bites only when aspects differ). The dim still cuts
// in under the morph; the label settles at BEAT.hero.
//
// CONTACT-SHEET INSPECTION: opened from an unchosen sheet (pass
// `frames` + `onUse`), the box becomes the loupe — ‹ › paddles and
// ←/→ keys flip between the three frames full-size, the slug reads
// FRAME 1 OF 3, and "Use this frame" commits the select from the
// label band. The paddles are structural grid columns BESIDE the
// frame (chrome lives on the dim, never the artwork — P10); they
// can never overlap the print at any viewport. The loupe keeps the
// fade+rise entrance — only the mounted print travels (rec 1).
// Render inside <AnimatePresence> so the exit beat plays.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IMAGE_VOCAB as V } from "@/lib/config";
import { BEAT, EASE, EASE_EXIT, DUR } from "@/lib/motion";

export default function PrintLightbox({
  src,
  ideaName,
  teamName,
  frameNo,
  onClose,
  frames,
  initialIndex = 0,
  onUse,
  morphId,
}: {
  src: string;
  ideaName: string;
  teamName?: string;
  /** The card's frame number, when the entry point knows it. */
  frameNo?: number;
  onClose: () => void;
  /** Contact-sheet inspection: the sheet's frames, flippable ‹ ›. */
  frames?: string[];
  initialIndex?: number;
  /** Commit the shown frame as the select (inspection mode only). */
  onUse?: (url: string) => void;
  /** Shared-element id for the portal morph — the origin box (mat /
      frontispiece / poster) carries the same layoutId. Omit for the
      loupe: candidates flip, only the mounted print travels. */
  morphId?: string;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const inspecting = !!frames && frames.length > 0;
  const activeSrc = inspecting ? frames![idx] : src;
  const morphing = !!morphId && !inspecting;

  // The exit morph accelerates (EASE_EXIT/DUR.cut) while the arrival
  // decelerated (EASE/DUR.beat). The component stays mounted through
  // AnimatePresence's exit, so flipping this before onClose() hands
  // the departing layout animation the exit tokens.
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    setClosing(true);
    onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        // The box owns the arrows while mounted: flip frames when
        // inspecting; otherwise hold still — the host underneath must
        // never navigate ideas (and unmount the box) behind the dim.
        e.stopPropagation();
        e.preventDefault();
        if (inspecting) {
          const n = frames!.length;
          setIdx((i) => (e.key === "ArrowRight" ? (i + 1) % n : (i - 1 + n) % n));
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, inspecting, frames]);

  // The lot-card slug — true data only; the idea name lives in the
  // serif line above, not here.
  const slugLine = [
    frameNo != null && !inspecting ? `№ ${String(frameNo).padStart(2, "0")}` : null,
    teamName ?? null,
    inspecting ? `${V.item.toUpperCase()} ${idx + 1} OF ${frames!.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The print's size budget: as wide as the dim allows, height-capped
  // so the label band always fits below (name + slug + Use). When the
  // loupe's paddles hold their columns, the frame concedes their width.
  const frameWidth = inspecting
    ? "min(92vw - 152px, calc((100vh - 264px) * (16 / 9)))"
    : "min(92vw, calc((100vh - 216px) * (16 / 9)))";

  const paddleStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.55)",
    fontSize: 44,
    lineHeight: 1,
    padding: "18px 14px",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
      transition={{ duration: DUR.cut, ease: EASE }}
      className="fixed inset-0 z-[10600] flex flex-col items-center justify-center gap-5 px-6 py-10 cursor-zoom-out"
      style={{ background: "rgba(10,10,12,0.97)" }}
      onClick={(e) => {
        e.stopPropagation();
        requestClose();
      }}
    >
      {/* The chrome row — [paddle] [print] [paddle]. The paddles are
          columns beside the frame, structurally off the print at
          every viewport (P10), not absolute overlays on the screen. */}
      <div className="flex items-center justify-center max-w-full">
        {inspecting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + frames!.length) % frames!.length);
            }}
            className="transition-colors hover:text-white"
            style={paddleStyle}
            aria-label={V.prevItem}
            title={`${V.prevItem} (←)`}
          >
            ‹
          </button>
        )}
        {morphing ? (
          <motion.img
            layoutId={morphId}
            src={activeSrc}
            alt={`${V.artifact} — ${ideaName}`}
            transition={{
              layout: closing
                ? { duration: DUR.cut, ease: EASE_EXIT }
                : { duration: DUR.beat, ease: EASE },
            }}
            className="object-contain"
            style={{
              // The FULL frame, per the format law — prints are 16:9
              // (scripts/generate-prints.py, 1600×900), so sizing off
              // the aspect keeps the hairline hugging the image.
              width: frameWidth,
              height: "auto",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
            draggable={false}
          />
        ) : (
          <motion.img
            src={activeSrc}
            alt={inspecting ? `${V.item} ${idx + 1} — ${ideaName}` : `${V.artifact} — ${ideaName}`}
            initial={{ opacity: 0, y: 28, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
            transition={{ duration: DUR.beat, ease: EASE }}
            className="object-contain"
            style={{
              width: frameWidth,
              height: "auto",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
            draggable={false}
          />
        )}
        {inspecting && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % frames!.length);
            }}
            className="transition-colors hover:text-white"
            style={paddleStyle}
            aria-label={V.nextItem}
            title={`${V.nextItem} (→)`}
          >
            ›
          </button>
        )}
      </div>

      {/* The lot-card label — museum grammar (research rec 2): the
          idea name set in serif (this surface's one serif moment),
          the slug in Courier beneath, the commit action in the band.
          All off the image, on the dim. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: DUR.cut, ease: EASE_EXIT } }}
        transition={{ duration: DUR.cut, ease: EASE, delay: BEAT.hero }}
        className="flex flex-col items-center gap-1.5 text-center max-w-[84vw]"
      >
        <h2
          className="font-display text-white text-[30px] leading-[1.15] tracking-[0.5px]"
          style={{ textWrap: "balance" }}
        >
          {ideaName}
        </h2>
        {slugLine && (
          <p className="slug" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            {slugLine}
          </p>
        )}
        {inspecting && onUse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUse(frames![idx]);
            }}
            className="mt-2 flex items-center justify-center h-12 font-bold text-[13px] tracking-[1px] px-8 cursor-pointer transition-opacity hover:opacity-85"
            style={{ background: "#FFFFFF", color: "#231F20", border: "none" }}
            title={V.useItemHint}
          >
            {V.useItem}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
