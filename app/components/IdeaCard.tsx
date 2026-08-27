"use client";

import { motion } from "framer-motion";
import { Idea } from "@/lib/types";
import { STATUS_LABELS, BRAND, IMAGE_VOCAB as V } from "@/lib/config";
import PrintReveal from "@/components/PrintReveal";
import { isPrintStale, noteSlug, useStalledDevelop } from "@/lib/darkroom";
import { ideaNo, unnamedIdeaLabel } from "@/lib/idea-number";
import { DUR, EASE, EASE_EXIT, STAGGER_DENSE } from "@/lib/motion";

const E = `cubic-bezier(${EASE.join(",")})`;

interface IdeaCardProps {
  idea: Idea;
  onClick: () => void;
  /** Render position — the arrival stagger only, never identity. */
  index: number;
  /**
   * THE STABLE № (lib/idea-number). Assigned at creation within the
   * idea's team + category, so re-sorting the wall never renumbers it.
   * The Board is a single-team surface, so it prints bare: `№ 03`.
   */
  frameNo: number;
  voteCount?: number;
  showVotes?: boolean;
  /** For the photo-box caption; optional so existing hosts keep working. */
  teamName?: string;
}

export default function IdeaCard({ idea, onClick, index, frameNo, voteCount = 0, showVotes = false, teamName }: IdeaCardProps) {
  const isShortlisted = idea.status === "starting_lineup";
  const isCoached = idea.status === "coached";
  const isSetAside = idea.status === "bench";
  const isStarter = idea.source === "tissue";
  const isScouted = idea.source === "ai_scouted";
  const isQuickAdd = idea.source === "quick_toss";
  const isPresenting = !!idea.presenting;
  const isDeveloping = idea.print_status === "developing";
  // U6 — a develop that outlived its ceiling has no clock behind it
  // (a refresh killed the timer, or the finish write failed). The
  // working flag would be a lie: nothing is working. It becomes the
  // quiet DIDN'T FINISH fact in the same flag register, and the open
  // card carries the one-click retry.
  const stalled = useStalledDevelop(idea);
  // Layout follows the print's PRESENCE, not its status: during a
  // re-picture (developing with a print still attached) the frame keeps
  // its proof-print anatomy and the old print ghosts down while the
  // darkroom flag runs, instead of the card collapsing to the unprinted
  // height. A STALLED re-picture stops ghosting — the old print is the
  // card's standing truth again, not a picture about to be replaced.
  const hasPrintArt = !!idea.print_url;
  const isRedeveloping = isDeveloping && hasPrintArt && !stalled;
  // A developed CONTACT SHEET with no chosen frame yet — the board card
  // ghosts the three frames and the bottom row carries a SHEET READY
  // flag so the team knows to open the idea and choose. The mat keeps
  // proof-print anatomy.
  const sheetReady =
    idea.print_status === "developed" && !!idea.print_options?.length && !idea.print_url;
  const hasMatArt = hasPrintArt || sheetReady;
  // The print came from an earlier draft of this idea (lib/darkroom).
  const stale = isPrintStale(idea);
  // The note the commission carried, as its slug — provenance on the
  // board too, at a short truncation: a card frame is not a header.
  const printNote = noteSlug(idea.print_note, 34);

  // The photo box — clicking the mat mounts the print at room scale.
  // The mat keeps a stable layoutId so a print landing/changing in
  // session animates in place. The photo box is reached from inside the
  // open card — clicking the mat opens the IDEA (the card), not a viewer.
  // (was: the mat and the box's print share `morphId` — the
  // print travels from the mat to room scale and back; research rec 1).
  // Scoped `board-` so an open ExpandedCard's frontispiece (same idea,
  // its own `card-` id) never contends for the shared element.
  const morphId = `print-board-${idea.id}`;


  // Detect auto-generated names — only the truncated "..." pattern, not exact matches
  // (users can type a name that happens to match the description)
  const isAutoNamed = idea.description && (
    idea.name === idea.description.slice(0, 50).trim() + "..."
  );

  // ONE stamp max — statuses outrank sources, so a coached scouted idea
  // wears COACHED only. Process facts (Stage, Darkroom, sheet ready) are
  // quiet right-aligned flags in the same bottom row, never second stamps.
  const stamp = isShortlisted
    ? { label: STATUS_LABELS.starting_lineup, color: BRAND.colors.primary }
    : isSetAside
    ? { label: STATUS_LABELS.bench, color: "#8A8689" }
    : isCoached
    ? { label: STATUS_LABELS.coached, color: "#231F20" }
    : isScouted
    ? { label: "Scouted", color: "#24298F" }
    : isStarter
    ? { label: "Starter", color: "#231F20" }
    : isQuickAdd
    ? { label: "Quick Add", color: "#231F20" }
    : null;

  // The transient image-process facts replace the Stage flag while
  // active; the votes counter always keeps the right edge. The two
  // slugs are keys, not copy — the labels come from IMAGE_VOCAB
  // (Round 11: "Darkroom / Sheet ready" is the editorial skin).
  const transientFlag = stalled ? "stalled" : isDeveloping ? "darkroom" : sheetReady ? "sheet" : null;
  const hasBottomRow =
    !!stamp || !!transientFlag || isPresenting || (showVotes && voteCount > 0);

  // CONTENT HEIGHT (masonry board): printed cards grow to the full
  // frame + caption; text cards sit at natural height over a floor —
  // the fixed 240 died with the strict row grid (rows no longer
  // stretch to the tallest neighbor). pb-12 reserves the pinned
  // bottom row on both.
  return (
    <motion.div
      animate={{ opacity: isSetAside ? 0.55 : 1 }}
      exit={{ opacity: 0 }}
      transition={{
        type: "tween",
        duration: DUR.cut,
        delay: index * STAGGER_DENSE,
      }}
      onClick={onClick}
      whileHover={isSetAside ? undefined : { y: -4 }}
      className={`idea-card relative cursor-pointer bg-white ${hasMatArt ? "" : "min-h-[180px]"} pb-12 p-5`}
      style={{
        // The select IS the frame: a shortlisted card's own border turns
        // navy and thickens — the same signal on every card, printed or
        // not. Hover adds lift + gold hairline (CSS class below).
        border: isShortlisted
          ? `2px solid ${BRAND.colors.primary}`
          : "1px solid rgba(35,31,32,0.24)",
        borderRadius: 12,
      }}
    >

      {/* Frame number — on the mat, plain paper (no chip needed: the
          proof print never runs underneath it).
          USER RULING 2026-08-03 ("let's make the numbers a bit smaller"):
          one step down, 21/12 → 18/11. The № is the idea's identity, not
          its headline — at 21px it sat within 3px of the 22px title and
          the two competed at a squint. 18px still calls from the back of
          a room and is now unmistakably subordinate. */}
      <span data-qa="idea-no" className="absolute top-3.5 right-5 flex items-baseline gap-1">
        <span className="slug" style={{ color: "#8A8689", fontSize: 11 }}>№</span>
        <span className="font-bold text-[18px] leading-none tabular" style={{ color: "#231F20" }}>
          {ideaNo(frameNo)}
        </span>
      </span>

      {/* The caption zone — anchored under the mat wherever the 16:9
          frame puts it, so the select mark rides the text, not a fixed
          offset. */}
      <div className="relative">
        {/* Name — on a printed frame it reads as the caption line under
            the mat (one line, contact-sheet grammar) */}
        <div className="relative">
          {/* THE PICTURE PAYS FOR THE TYPE (settled 2026-08-06, user
              ruling: "if we have an image, it's okay if it's a little
              bit smaller; cards without an image, the text should be
              readable on a screen at the front of the room").
              A printed card spends its height on a 16:9 frame and the
              picture carries the idea across the room, so its caption
              can sit at reading size. A TEXT-ONLY card has no picture
              doing that work — the words ARE the artifact, and they
              were running at the same size while the card sat at half
              the height (measured: 485×207 against a printed card's
              485×414). The board is a room-facing surface in breakouts,
              so the unprinted card now takes the space it already had. */}
          <h3
            className={`font-bold ${hasMatArt ? "text-[22px]" : "text-[27px]"} leading-[1.22] line-clamp-2 pr-14`}
            style={{ color: "#231F20", opacity: (!idea.name || isAutoNamed) ? 0.45 : 1 }}
          >
            {/* The fallback name follows the STABLE identity, not the
                render position: idea 04 is "Idea D" whatever the wall is
                sorted by, and coaching a neighbour no longer renames it. */}
            {(!idea.name || isAutoNamed) ? unnamedIdeaLabel(frameNo) : idea.name}
          </h3>
          {/* On a printed frame the select UNDERLINES the title instead
              of circling it: the text zone is wide and short, so an
              ellipse stretches into a squashed oval that clips the card
              edges — and the prints carry circular strokes of their own.
              Same grease pencil, no collision. */}

        </div>

        {/* Description — tighter clamp when the print holds the mat */}
        {idea.description && (
          <p
            className={`leading-[1.5] ${hasMatArt ? "text-[16px] line-clamp-2 mt-1.5" : "text-[19px] line-clamp-4 mt-3"}`}
            style={{ color: "#3a3739" }}
          >
            {idea.description}
          </p>
        )}

      </div>

      {/* The developed print — proof-print anatomy (card-lab round 1,
          candidate B): the print sits on the card's paper mat inside the
          frame, the title reads as its caption line beneath, and the №
          is the frame number it already is. The print simply appears —
          whether it landed this session or mounted with the card — so
          there is no arrival to tune. Clicking the mat opens the photo
          box (room scale), not the card.

          FORMAT LAW (Round 9): the mat is a true 16:9 box at the card's
          full inner width — the FULL cinematic frame, never a cropped
          strip. The printed card's height grows to fit (the unprinted
          text card keeps its fixed 240). */}
      {hasPrintArt && (
        <motion.div
          className="relative mt-3 w-full overflow-hidden"
          style={{ aspectRatio: "16 / 9", border: "1px solid rgba(35,31,32,0.12)" }}
          // The portal morph's origin box. layoutDependency confines
          // framer's layout measurement to the photo box opening and
          // closing — board reflows (filters, new frames) still CUT,
          // per the motion law. When this box runs the return leg it
          // departs on the exit tokens.
          layoutId={morphId}
          transition={{ layout: { duration: DUR.cut, ease: EASE_EXIT } }}
        >
          {/* During a re-picture the old print stays but ghosts down
              (the bottom row carries the darkroom flag); the key change
              swaps the new print in over it. The ghost is a STATE — it
              says this frame is being replaced — and rides the house
              tokens. */}
          <div
            className="w-full h-full"
            style={{
              transition: `opacity ${DUR.beat}s ${E}, filter ${DUR.beat}s ${E}`,
              ...(isRedeveloping ? { opacity: 0.35, filter: "grayscale(1)" } : null),
            }}
          >
            <PrintReveal
              key={idea.print_url}
              src={idea.print_url!}
              alt={`${V.artifact} — ${idea.name}`}
            />
          </div>
          {/* Provenance — quiet paper chips, same treatment as the №
              chip once used on prints. The NOTE is what the team asked
              the darkroom for; FROM AN EARLIER DRAFT is what the print
              no longer matches (developed prints only, never fresh
              ones). */}
          {(printNote || stale) && (
            <div className="absolute left-2 bottom-2 flex max-w-[calc(100%-16px)] flex-col items-start gap-1">
              {printNote && (
                <span
                  className="slug max-w-full truncate"
                  style={{ color: "#8A8689", fontSize: 9, background: "rgba(255,255,255,0.9)", padding: "2px 7px", textTransform: "none" }}
                  title={idea.print_note ?? undefined}
                >
                  {printNote}
                </span>
              )}
              {stale && (
                <span
                  className="slug"
                  style={{ color: "#8A8689", fontSize: 9, background: "rgba(255,255,255,0.9)", padding: "2px 7px" }}
                >
                  {V.stale}
                </span>
              )}
            </div>
          )}
        </motion.div>
      )}
      {/* The darkroom ghost — a developed sheet awaiting its choice.
          The three frames sit washed on the mat and the bottom row
          carries the SHEET READY flag; clicking anywhere opens the
          idea, where the sheet spreads for choosing. No photo box from
          here — nothing is chosen yet. Each ghost frame is a FULL 16:9
          thumbnail (format law) — a filmstrip of whole frames, not
          three cropped slivers. */}
      {sheetReady && (
        <div className="relative mt-3 flex w-full gap-[2px]" style={{ opacity: 0.35, filter: "grayscale(1)" }}>
          {idea.print_options!.map((u, fi) => (
            <img
              key={u}
              src={u}
              alt={`${V.item} ${fi + 1} — ${idea.name}`}
              className="w-1/3 h-auto"
              style={{ aspectRatio: "16 / 9", border: "1px solid rgba(35,31,32,0.12)" }}
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* Bottom row — pinned to the frame's bottom edge. ONE stamp on
          the left; the process facts read as quiet flags on the right
          (no border, no rotation — flags, not second stamps). */}
      <div className="absolute left-5 right-5 bottom-4">
        {hasBottomRow && (
          <div className="flex gap-2 items-center">
            {stamp && (
              <span className="stamp" style={{ color: stamp.color }}>{stamp.label}</span>
            )}
            <span className="ml-auto flex items-center gap-3">
              {transientFlag ? (
                <span
                  data-qa={transientFlag === "stalled" ? "stalled-flag" : undefined}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(35,31,32,0.55)" }}
                >
                  {/* The stalled flag carries NO mark at all — a spinner
                      says work is happening and a dot says something is
                      ready; neither is true. The words are the fact. */}
                  {transientFlag === "darkroom" ? (
                    <span
                      className="w-3 h-3 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(35,31,32,0.15)", borderTopColor: "rgba(35,31,32,0.45)" }}
                    />
                  ) : transientFlag === "sheet" ? (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
                  ) : null}
                  {transientFlag === "darkroom" ? V.workingFlag : transientFlag === "sheet" ? V.readyFlag : V.stalledFlag}
                </span>
              ) : isPresenting ? (
                /* The Stage flag is a DECISION, not a process fact, so it
                   reads at a heavier ink than the transient flags above
                   it (0.78 vs 0.55 — 7.97:1 vs 3.72:1 on the card's white,
                   where 10px type needs 4.5:1). User ruling 2026-08-07:
                   "the gray 'on stage' star is pretty dim on the board
                   cards." It stays borderless and stays on the right, so
                   the anatomy holds — ONE stamp on the left, flags on the
                   right — but a team's choice to bring an idea to the room
                   no longer whispers at the same volume as a spinner. Not
                   red: the Board is not the Stage, a team can mark several
                   ideas, and a shortlisted card already carries the red
                   border (Round 15 item 6 — exactly one Kruger, and it is
                   the focus position chip). */
                <span
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(35,31,32,0.78)" }}
                >
                  <span className="text-[12px] leading-none">★</span>
                  Stage
                </span>
              ) : null}
              {showVotes && voteCount > 0 && (
                <span className="flex items-baseline gap-1">
                  <span className="font-display text-[18px] leading-none tabular" style={{ color: BRAND.colors.primary }}>
                    {voteCount}
                  </span>
                  <span className="text-[11px]" style={{ color: "#4a4749" }}>
                    {voteCount === 1 ? "vote" : "votes"}
                  </span>
                </span>
              )}
            </span>
          </div>
        )}
      </div>

    </motion.div>
  );
}
