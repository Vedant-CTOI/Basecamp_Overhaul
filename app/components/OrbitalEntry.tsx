"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import AmbientField from "@/components/AmbientField";
import type { AmbientMode } from "@/components/AmbientField";
import { BRAND, ENTRY_CONFIG } from "@/lib/config";
import { EASE, EASE_EXIT } from "@/lib/motion";
import DoveMark from "@/components/DoveMark";

type OrbitalEntryProps = {
  roomCode: string;
  onRoomCodeChange: (value: string) => void;
  onEnter: () => void;
  codeError: boolean;
  unlocking: boolean;
  atmosphereMode?: AmbientMode;
};

// ── The scrim dial ──────────────────────────────────────────────
// Photo-mode scrim presets, selected by ENTRY_CONFIG.backdrop.scrim.
// Every engagement's photo differs, so the treatment is a config dial,
// not a baked constant: 'standard' is the default, 'light' one step
// brighter for photos graded dark at the source, 'deep' the heavy
// original for bright or busy frames. `dim` is the uniform wash;
// `vignette` the radial stops at 0% / 42% / 100%.
//
// THE LAW IS FIXED REGARDLESS OF DIAL: orbit ring, core type, and
// coupon must hold ≥4.5:1 in their worst regions. The dial moves the
// GLOBAL wash only — the text-local grounds below (the ring's annulus
// scrim, the core's own radial, the coupon helper's halo) are the
// component's fixed protection and do not move with it. VERIFICATION:
// any new photo+dial pairing is proven by rendering the entry with the
// backdrop swapped for a pure-white frame (the torture test) and
// measuring the type's worst regions — not by eyeballing the photo.
const BACKDROP_SCRIMS = {
  light: { dim: 0.24, vignette: [0.06, 0.26, 0.72] },
  standard: { dim: 0.35, vignette: [0.12, 0.34, 0.78] },
  deep: { dim: 0.5, vignette: [0.2, 0.44, 0.84] },
} as const;

export type BackdropScrim = keyof typeof BACKDROP_SCRIMS;

function scrimBackground({ dim, vignette }: { dim: number; vignette: readonly [number, number, number] | readonly number[] }): string {
  const ink = (a: number) => `rgba(13,12,13,${a})`;
  return `linear-gradient(${ink(dim)}, ${ink(dim)}), radial-gradient(circle at 50% 47%, ${ink(vignette[0])} 0%, ${ink(vignette[1])} 42%, ${ink(vignette[2])} 100%)`;
}

function OrbitType({
  pathId,
  radius,
  copy,
  className,
  fillOpacity = 0.74,
}: {
  pathId: string;
  radius: number;
  copy: string;
  className: string;
  /** Photo mode runs the ring hotter (0.88): measured over a pure-white
      worst-case backdrop, 0.74 glyphs land under the 4.5:1 projector bar. */
  fillOpacity?: number;
}) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full overflow-visible ${className}`}
      viewBox="0 0 760 760"
      aria-hidden="true"
    >
      <defs>
        <path
          id={pathId}
          d={`M 380,380 m -${radius},0 a ${radius},${radius} 0 1,1 ${
            radius * 2
          },0 a ${radius},${radius} 0 1,1 -${radius * 2},0`}
        />
      </defs>
      <text
        fill={`rgba(44,36,25,${fillOpacity})`}
        fontSize={radius > 300 ? 12 : 10.5}
        fontWeight="700"
        letterSpacing={radius > 300 ? 3.4 : 2.7}
      >
        {/* textLength pins the repeated copy to the exact circumference so
            the ring closes without a seam at 12 o'clock */}
        <textPath
          href={`#${pathId}`}
          startOffset="0%"
          textLength={Math.round(2 * Math.PI * radius)}
          lengthAdjust="spacing"
        >
          {copy.repeat(3)}
        </textPath>
      </text>
    </svg>
  );
}

export default function OrbitalEntry({
  roomCode,
  onRoomCodeChange,
  onEnter,
  codeError,
  unlocking,
  atmosphereMode = ENTRY_CONFIG.atmosphere.mode,
}: OrbitalEntryProps) {
  const outerPathId = `orbital-outer-${useId().replace(/:/g, "")}`;
  const hasCode = roomCode.trim().length > 0;

  // ── The hero slot ─────────────────────────────────────────────
  // The biggest type on the entry is the ENGAGEMENT'S — heroTitle names
  // the workshop; the platform recedes to the header credit. When the
  // hero IS the workshop's name, the core's sub-line and the header's
  // echo would read the same words twice, so both yield to it. Long
  // names step the scale down so the title still sits inside the core
  // rather than bleeding through the orbit ring.
  // (typed `string`: the config's literal types would otherwise make the
  // echo comparison a compile error whenever the two slots differ)
  const heroTitle: string = ENTRY_CONFIG.heroTitle;
  const heroEchoesWorkshop: boolean =
    (ENTRY_CONFIG.workshopTitle as string) === heroTitle;
  // The far corner is engagement META, never an orphaned token: the
  // workshop title when the hero doesn't already carry it; the client's
  // name when it does — so the hero's echo suppression never strands a
  // lone year in the corner.
  const cornerLine: string = heroEchoesWorkshop
    ? ENTRY_CONFIG.clientName
    : ENTRY_CONFIG.workshopTitle;
  const heroScale =
    heroTitle.length <= 12
      ? "text-[clamp(36px,12.6cqw,92px)] leading-[0.92]"
      : heroTitle.length <= 22
        ? "text-[clamp(28px,8.4cqw,61px)] leading-[1.0]"
        : "text-[clamp(24px,6.4cqw,47px)] leading-[1.04]";
  // The hero's face is a slot too (ENTRY_CONFIG.displayFont): the
  // engagement's own display family, with an optional drop-in woff2
  // under public/fonts/. The @font-face is injected here — scoped to
  // this component's render — and ONLY the hero line wears the family;
  // every other line keeps the platform's faces. null = default face.
  const heroFont = ENTRY_CONFIG.displayFont;

  // The backdrop slot (ENTRY_CONFIG.backdrop): a full-bleed photo beneath
  // the core. Degrades like every other slot — a missing or broken file
  // flips this state and the generative AmbientField renders instead, so
  // the page never breaks on an absent asset.
  const [backdropFailed, setBackdropFailed] = useState(false);
  const backdropSrc = ENTRY_CONFIG.backdrop?.src;
  const hasBackdrop = Boolean(backdropSrc) && !backdropFailed;
  const backdropScrim =
    BACKDROP_SCRIMS[ENTRY_CONFIG.backdrop?.scrim ?? "standard"];

  return (
    <motion.section
      key="hero"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overhaul-page relative min-h-screen overflow-hidden text-[#2C2419]"
    >
      {hasBackdrop ? (
        // Photo mode: the shader field is OFF (photo + shader compete = mud).
        // A plain <img> so a 404 reaches onError directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdropSrc}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setBackdropFailed(true)}
          className="absolute inset-0 z-0 h-full w-full select-none object-cover"
        />
      ) : (
        <AmbientField
          preset="ember"
          mode={atmosphereMode}
          opacity={0.96}
          className="z-0"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          // Photo mode carries a scrim — a uniform dim plus a vignette,
          // both set by the BACKDROP_SCRIMS dial — kept light enough that
          // the photo reads as a place; the type's contrast floor is held
          // by the text-local grounds (ring annulus, core radial, helper
          // halo), verified over a pure-white worst case. Generative mode
          // keeps the original vignette untouched.
          background: hasBackdrop
            ? scrimBackground(backdropScrim)
            : "radial-gradient(circle at 50% 47%, rgba(243,238,231,0) 0%, rgba(243,238,231,0.15) 55%, rgba(237,230,220,0.5) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(107,93,74,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(107,93,74,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 47%, transparent 12%, black 78%)",
        }}
      />

      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: unlocking ? 0 : 1 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 py-5 sm:px-8 sm:py-7 lg:px-11"
      >
        {/* The platform credit is the platform's — wordmark + maker,
            constant across engagements. The client is never this line's
            author; its identity lives in the core lockup and the hero. */}
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[15px] sm:text-[16px]">
            {ENTRY_CONFIG.platformLabel}
          </span>
          {ENTRY_CONFIG.platformAttribution && (
            <span className="hidden text-[12px] font-medium tracking-[0.03em] text-[#6B5D4A] sm:inline">
              {ENTRY_CONFIG.platformAttribution}
            </span>
          )}
        </div>
        <div className="text-right text-[11px] font-medium tracking-[0.03em] leading-[1.6] text-[#6B5D4A] sm:text-[12px]">
          {cornerLine && <div>{cornerLine}</div>}
          <div className="text-[#A79780]">
            {[ENTRY_CONFIG.location, ENTRY_CONFIG.date].filter(Boolean).join(" · ")}
          </div>
        </div>
      </motion.header>

      {/* The portal: entering the code flies you INTO the core — the stage
          zooms until the core's interior swallows the viewport, orbit type
          and rings streaming past the edges. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={
          unlocking
            ? { opacity: 1, scale: 7.5 }
            : { opacity: 1, scale: 1 }
        }
        transition={
          unlocking
            ? { duration: 1.05, ease: EASE_EXIT }
            : { duration: 1.1, delay: 0.1, ease: EASE }
        }
        className="orbital-core-stage absolute left-1/2 z-10 aspect-square -translate-x-1/2 -translate-y-1/2"
        style={{
          top: "41.5%",
          width: "min(92vw, calc(100svh - 260px), 660px)",
          containerType: "inline-size",
        }}
      >
        {hasBackdrop && (
          // The ring's own ground: a soft annulus beneath the orbit type's
          // band (text runs ~85–92% of the stage half-width). The global
          // scrim is now light enough that a bright photo region under the
          // ring would sink the type below 4.5:1 — this local scrim holds
          // the floor without re-darkening the whole frame, and reads as
          // the core's penumbra. Must paint BENEATH the ring text.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle closest-side, rgba(13,12,13,0) 70%, rgba(13,12,13,0.34) 83%, rgba(13,12,13,0.34) 94%, rgba(13,12,13,0) 100%)",
            }}
          />
        )}
        <div className="absolute inset-[1%] rounded-full border border-[#A79780]/30" />
        <div className="absolute inset-[3%] rounded-full border border-[#A79780]/20" />

        <OrbitType
          pathId={outerPathId}
          radius={336}
          copy={ENTRY_CONFIG.orbit.outer}
          className="orbital-rotate"
          fillOpacity={hasBackdrop ? 0.88 : 0.74}
        />

        <div
          className="absolute inset-[9%] flex flex-col items-center justify-center overflow-hidden rounded-full border border-[#A79780]/30 px-[10%] text-center shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
          style={{
            background: unlocking
              ? "radial-gradient(circle at 50% 42%, #FBF8F3, #F3EEE7 72%)"
              : "radial-gradient(circle at 50% 42%, rgba(251,248,243,0.94), rgba(237,230,220,0.9) 72%)",
            backdropFilter: unlocking ? "none" : "blur(22px)",
            WebkitBackdropFilter: unlocking ? "none" : "blur(22px)",
            transition: "background 0.5s ease",
          }}
        >
          <motion.div
            animate={{ opacity: unlocking ? 0 : 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center"
          >
          {/* The brand mark in motion: a gold dove beats its wings above
              the lockup — the engagement's living signature. */}
          <div className="mb-[1%] flex items-center justify-center">
            <DoveMark size={54} className="drop-shadow-[0_0_18px_rgba(218,191,128,0.35)]" />
          </div>
          <Image
            src={ENTRY_CONFIG.clientLogo.src}
            alt={ENTRY_CONFIG.clientLogo.alt}
            width={112}
            height={44}
            priority
            className="mb-[3%] h-auto w-[clamp(62px,15cqw,108px)]"
          />
          <div className="mb-[1.5%] text-[clamp(11px,2cqw,14px)] font-medium tracking-[0.05em] text-[#6B5D4A]">
            {ENTRY_CONFIG.kicker}
          </div>
          {heroFont?.src && (
            <style>{`@font-face{font-family:${JSON.stringify(heroFont.family)};src:url(${JSON.stringify(heroFont.src)}) format("woff2");font-display:swap;}`}</style>
          )}
          <h1
            className={`font-display ${heroScale} tracking-[-0.03em] [text-wrap:balance]`}
            style={
              heroFont
                ? { fontFamily: `${JSON.stringify(heroFont.family)}, ${BRAND.fonts.display}` }
                : undefined
            }
          >
            {heroTitle}
          </h1>
          <div className="my-[3%] h-px w-[clamp(52px,7cqw,92px)]" style={{ background: BRAND.colors.primary }} />
          {!heroEchoesWorkshop && (
            <p className="max-w-[440px] font-display text-[clamp(17px,4.1cqw,30px)] leading-[1.1] tracking-[-0.015em] text-[#2C2419]">
              {ENTRY_CONFIG.workshopTitle}
            </p>
          )}
          <p className="mt-[3%] max-w-[380px] text-[clamp(12px,2.2cqw,15px)] font-medium leading-[1.5] text-[#6B5D4A]">
            {ENTRY_CONFIG.tagline}
          </p>
          {/* The Honest Feed — the theme rendered as instrument. A ticker of
              small squares drifts left forever: navy squares are real
              photography, outlined ones are synthetic. The meter under it
              counts what today's room is here to change. */}
          <div className="mt-[4%] w-full max-w-[300px] px-[8%]" aria-hidden="true">
            <div className="relative h-[14px] overflow-hidden rounded-sm" style={{ maskImage: "linear-gradient(90deg, transparent, black 18%, black 82%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 18%, black 82%, transparent)" }}>
              <div className="honest-feed-strip absolute inset-0 flex items-center gap-[6px]">
                {Array.from({ length: 26 }).map((_, i) => {
                  const synthetic = [2, 7, 11, 16, 21].includes(i);
                  return (
                    <span
                      key={i}
                      className="block h-[8px] w-[8px] shrink-0 rounded-[1px]"
                      style={synthetic
                        ? { border: "1px solid rgba(107,93,74,0.5)", background: "transparent" }
                        : { background: "#366AA5", opacity: 0.85 }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="mt-[6px] flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em]">
              <span style={{ color: "#8FB3D9" }}>Real</span>
              <span className="text-[#A79780]">vs</span>
              <span style={{ color: "#6B5D4A" }}>Synthetic</span>
            </div>
          </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={unlocking ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        transition={
          unlocking
            ? { duration: 0.25 }
            : { duration: 0.65, delay: 0.75, ease: EASE }
        }
        className="absolute bottom-[58px] left-1/2 z-20 w-[calc(100%-40px)] max-w-[620px] -translate-x-1/2 sm:bottom-[66px]"
      >
        <div
          className={`relative mb-2.5 text-center text-[11px] font-medium tracking-[0.03em] sm:text-[12px] ${
            "text-[#6B5D4A]"
          }`}
        >
          {hasBackdrop && (
            // The helper line sits on bare photo (the coupon's dark ground
            // starts below it) — this feathered pool is its text-local
            // scrim under the lighter global wash, the same soft-gradient
            // mechanism as the ring's annulus. A text-shadow halo alone
            // measured 2.6:1 over the pure-white torture frame; with the
            // pool the line holds the 4.5:1 law.
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-10 -inset-y-3.5"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(13,12,13,0.6) 0%, rgba(13,12,13,0.44) 58%, rgba(13,12,13,0) 92%)",
              }}
            />
          )}
          <span
            className="relative"
            style={
              hasBackdrop
                ? { textShadow: "0 1px 2px rgba(13,12,13,0.85), 0 0 8px rgba(13,12,13,0.6)" }
                : undefined
            }
          >
            Enter the room — your facilitator holds the code
          </span>
        </div>
        <motion.div
          animate={
            codeError
              ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
              : { x: 0 }
          }
          transition={{ duration: codeError ? 0.5 : 0.15 }}
          className="flex border border-[#A79780]/40 bg-[#FBF8F3] p-1.5 shadow-[var(--neo-raised-sm)]"
          style={{
            boxShadow: codeError ? `inset 0 0 0 1px ${BRAND.colors.primary}` : undefined,
          }}
        >
          <input
            type="text"
            value={roomCode}
            onChange={(event) => onRoomCodeChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onEnter()}
            placeholder="ROOM CODE"
            aria-label="Room code"
            className="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-[12px] font-bold uppercase tracking-[0.34em] text-[#2C2419] outline-none placeholder:text-[#A79780] sm:px-6 sm:text-[13px]"
            autoFocus
          />
          <button
            onClick={onEnter}
            disabled={!hasCode}
            className="min-w-[108px] border-none px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] transition-[background,color,transform] duration-200 enabled:cursor-pointer enabled:hover:-translate-y-px disabled:cursor-not-allowed sm:min-w-[132px]"
            style={
              hasCode
                ? { background: BRAND.colors.primary, color: "#fff", border: "2px solid transparent" }
                : {
                    background: "transparent",
                    color: "#6B5D4A",
                    border: "2px solid rgba(167,151,128,0.5)",
                  }
            }
          >
            Enter
          </button>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
