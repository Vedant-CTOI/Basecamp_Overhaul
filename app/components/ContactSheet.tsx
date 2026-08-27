"use client";

// THE CONTACT SHEET — one commission returns three frames on a sheet;
// the team chooses the select. Since the spread (the one-state open
// card), this component renders the CHOOSING state only, filling the
// spread's picture region: three full-frame 16:9 thumbnails arranged
// 2 + 1 on paper, with slug chips, the quiet hover "Use" quick-pick,
// and click-to-inspect in the loupe (the photo box's inspection mode,
// where the select can also be committed). Choosing is instant taste —
// only "New sheet" returns to the darkroom clock.
//
// FORMAT LAW (Round 9): sheet frames are never cropped. Frame size is
// measured against the region so every thumbnail is a true 16:9 box —
// width- or height-limited, whichever bites first.
//
// VOCABULARY (Round 11): every label here reads from IMAGE_VOCAB
// (lib/config) — "contact sheet / frame" is the editorial skin, the
// base register says "options / option". Comments below keep the
// editorial words because they describe THIS build.

import { useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import PrintReveal from "@/components/PrintReveal";
import { noteSlug } from "@/lib/darkroom";
import { IMAGE_VOCAB as V } from "@/lib/config";

const PAD = 24;
const GAP = 14;
const HEADER_H = 44;
/** The header grows by one line when the commission carried a note —
    the sheet states what was asked for, above the frames it answered
    with. Measured, not guessed: the frame sizing reads this value. */
const NOTE_ROW_H = 22;

export default function ContactSheet({
  frames,
  chosenUrl,
  ideaName,
  note,
  onUse,
  onInspect,
  onKeep,
}: {
  /** The sheet — three frame urls from one commission. */
  frames: string[];
  /** The current select (null while the sheet awaits its first choice). */
  chosenUrl: string | null;
  ideaName: string;
  /** The note this commission carried, if any — printed as a Courier
      slug in the sheet's header (the showcase cannot change the art,
      so the ask stays legible beside what came back). */
  note?: string | null;
  /** Commit a frame as the select (quick-pick or from the photo box). */
  onUse: (url: string) => void;
  /** Open frame i full-size in the photo box for inspection. */
  onInspect: (index: number) => void;
  /** "Keep this frame" in the sheet header — offered when the sheet
      was reopened on taste over a chosen print. */
  onKeep?: () => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // The sheet's header states the ask, at a wider truncation than the
  // on-print chips get — it has the full width of the region.
  const slug = noteSlug(note, 96);
  const headerH = HEADER_H + (slug ? NOTE_ROW_H : 0);

  // Frame sizing — measured against the region so the 2+1 arrangement
  // always fits without cropping a thumbnail.
  const rootRef = useRef<HTMLDivElement>(null);
  const [frameW, setFrameW] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const availW = el.offsetWidth - PAD * 2;
      const availH = el.offsetHeight - headerH - PAD - GAP;
      const w = Math.max(
        160,
        Math.min((availW - GAP) / 2, ((availH - GAP) / 2) * (16 / 9))
      );
      setFrameW((prev) => (prev != null && Math.abs(prev - w) < 0.5 ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerH]);

  const frameStyle = frameW != null ? { width: frameW, height: frameW * (9 / 16) } : undefined;

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col" style={{ background: "#FFFFFF" }}>
      {/* The sheet's production header. Its right end clears the close
          chip the picture region pins at top-right (30px wide, 12px
          inset) — at a flat px-6 the "Choose the frame" line ran
          underneath the chip. When the commission carried a note, a
          second row prints it in ink: the sheet says what was asked
          for directly above the frames that answered. */}
      <div className="shrink-0 flex flex-col justify-center pl-6 pr-[54px]" style={{ height: headerH }}>
        <div className="flex items-center justify-between gap-4">
          <span className="slug" style={{ color: "#8A8689" }}>
            {V.setHeader}
          </span>
          {onKeep && chosenUrl ? (
            <button
              onClick={(e) => { e.stopPropagation(); onKeep(); }}
              className="font-bold text-[11px] tracking-[1px] uppercase cursor-pointer transition-colors shrink-0"
              style={{ background: "transparent", color: "#231F20", border: "1px solid rgba(35,31,32,0.4)", padding: "3px 10px" }}
              title={V.keepHint}
            >
              {V.keep}
            </button>
          ) : (
            <span className="slug shrink-0" style={{ color: "#8A8689" }}>
              {chosenUrl ? V.chooseAnotherPrompt : V.choosePrompt}
            </span>
          )}
        </div>
        {slug && (
          <span
            className="slug truncate"
            style={{ color: "#231F20", fontSize: 11, textTransform: "none", lineHeight: `${NOTE_ROW_H}px` }}
            title={note ?? undefined}
          >
            {slug}
          </span>
        )}
      </div>

      {/* The frames — 2 + 1, centered on the paper */}
      <div
        className="flex-1 min-h-0 flex flex-col items-center justify-center"
        style={{ padding: `0 ${PAD}px ${PAD}px`, gap: GAP }}
      >
        {[frames.slice(0, 2), frames.slice(2)].map((row, r) => (
          <div key={r} className="flex justify-center" style={{ gap: GAP }}>
            {row.map((url, ri) => {
              const i = r * 2 + ri;
              const isChosen = url === chosenUrl;
              const hot = hovered === i;
              return (
                <div
                  key={url}
                  className="relative overflow-hidden cursor-zoom-in shrink-0"
                  style={{
                    ...frameStyle,
                    // The board card's own hover values: 0.24 → 0.55.
                    border: `1px solid ${hot || isChosen ? "rgba(35,31,32,0.55)" : "rgba(35,31,32,0.24)"}`,
                    transition: "border-color 0.2s ease, filter 0.2s ease",
                    filter: hot ? "brightness(1.05)" : "none",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(i);
                  }}
                  title={V.inspectHint}
                >
                  <PrintReveal
                    key={url}
                    src={url}
                    alt={`${V.item} ${i + 1} — ${ideaName}`}
                  />

                  {/* Frame slug — contact-sheet grammar */}
                  <span
                    className="slug absolute left-2 bottom-2 pointer-events-none"
                    style={{
                      color: "#8A8689",
                      fontSize: 9,
                      background: "rgba(255,255,255,0.92)",
                      padding: "2px 7px",
                    }}
                  >
                    {V.item} {i + 1}
                    {isChosen ? ` · ${V.current}` : ""}
                  </span>

                  {/* Quick pick — the quiet Use for teams that can
                      already tell from the sheet; inspection is one
                      click away. */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUse(url);
                    }}
                    className="absolute right-2 bottom-2 font-bold text-[11px] tracking-[1px] uppercase cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.94)",
                      color: "#231F20",
                      border: "1px solid rgba(35,31,32,0.4)",
                      padding: "3px 10px",
                      opacity: hot ? 1 : 0,
                      pointerEvents: hot ? "auto" : "none",
                      transition: "opacity 0.15s ease",
                    }}
                    title={V.useHint}
                  >
                    {V.use}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
