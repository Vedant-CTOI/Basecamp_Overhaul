"use client";

import { useEffect, useRef, useState } from "react";
import { type TeamMediaSlot } from "@/lib/config";

// Ink on light team colors (rose, chartreuse), white on dark (cobalt) —
// same luminance rule as the ticker chips.
function medallionText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 128 ? "#231F20" : "#FFFFFF";
}

// Mix a hex color toward black (amount < 0) or white (amount > 0).
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * k);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// The medallion hue field: the team color and its darker/lighter neighbors
// as slow drifting bodies — the stage-atmosphere vocabulary scoped to one
// 320px face. Index 0 is the ground fill; bodies draw from 1–4.
// Ink-text teams get a lighter band so the type keeps projector contrast.
function fieldPalette(hex: string, inkText: boolean): string[] {
  return inkText
    ? [shade(hex, 0.12), hex, shade(hex, 0.34), shade(hex, -0.18), shade(hex, 0.22)]
    : [shade(hex, -0.34), hex, shade(hex, -0.5), shade(hex, 0.2), shade(hex, -0.16)];
}

type FieldBody = {
  x: number;
  y: number;
  radius: number;
  stretchX: number;
  stretchY: number;
  phase: number;
  drift: number;
  color: number;
};

const FIELD_BODIES: FieldBody[] = [
  { x: 0.24, y: 0.26, radius: 0.5, stretchX: 1.3, stretchY: 0.85, phase: 0.4, drift: 0.8, color: 1 },
  { x: 0.78, y: 0.3, radius: 0.44, stretchX: 0.95, stretchY: 1.2, phase: 2.2, drift: 0.55, color: 2 },
  { x: 0.7, y: 0.76, radius: 0.54, stretchX: 1.25, stretchY: 0.8, phase: 3.9, drift: 0.65, color: 3 },
  { x: 0.26, y: 0.8, radius: 0.42, stretchX: 0.9, stretchY: 1.15, phase: 5.3, drift: 0.7, color: 2 },
  { x: 0.52, y: 0.48, radius: 0.4, stretchX: 1.45, stretchY: 0.7, phase: 1.6, drift: 0.5, color: 4 },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// Freeze-frame semantics, generative dialect: paint one static frame at
// rest, run the field while focused, and hold the exact frame where the
// motion stopped on blur. Time accumulates in a ref so refocusing resumes
// rather than restarts.
function GenerativeField({
  color,
  inkText,
  animate,
}: {
  color: string;
  inkText: boolean;
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const palette = fieldPalette(color, inkText);
    // Per-team offset so rest frames differ between medallions.
    const seed = (parseInt(color.slice(1), 16) % 89) / 7;
    if (timeRef.current < 0) timeRef.current = seed * 60000;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const t = timeRef.current * 0.00015;
      const edge = Math.min(width, height);
      context.fillStyle = palette[0];
      context.fillRect(0, 0, width, height);

      FIELD_BODIES.forEach((body) => {
        const orbit = t * body.drift + body.phase + seed;
        const x = body.x * width + Math.sin(orbit * 1.13) * edge * 0.1;
        const y = body.y * height + Math.cos(orbit * 0.87) * edge * 0.09;
        const radius = edge * body.radius;

        context.save();
        context.translate(x, y);
        context.rotate(Math.sin(orbit * 0.31) * 0.2);
        context.scale(body.stretchX, body.stretchY);

        const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, `${palette[body.color]}E0`);
        gradient.addColorStop(0.5, `${palette[body.color]}7D`);
        gradient.addColorStop(1, `${palette[body.color]}00`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });
    };

    const tick = (now: number) => {
      timeRef.current += now - last;
      last = now;
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(canvas);
    resize();
    draw();

    if (animate) {
      last = performance.now();
      frame = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [color, inkText, animate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ filter: "blur(22px) saturate(106%)", transform: "scale(1.14)" }}
      aria-hidden="true"
    />
  );
}

// The Sprite pattern: poster frame at rest, loop plays while focused,
// pause holds the frame on blur.
function VideoField({
  still,
  loop,
  animate,
  onFail,
}: {
  still: string;
  loop: string;
  animate: boolean;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (animate) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [animate]);

  return (
    <video
      ref={videoRef}
      src={loop}
      poster={still || undefined}
      muted
      loop
      playsInline
      preload="metadata"
      onError={onFail}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ filter: "grayscale(1) contrast(1.15)", opacity: 0.62 }}
    />
  );
}

interface TeamMedallionProps {
  name: string;
  color: string;
  platformName: string | null;
  media: TeamMediaSlot;
  isActive: boolean;
  launching: boolean;
  ctaLabel: string;
  fallbackTagline: string;
  showPlatformName: boolean;
  briefLine?: string | null;
  onLaunch: () => void;
  onFocusRequest: () => void;
}

export default function TeamMedallion({
  name,
  color,
  platformName,
  media,
  isActive,
  launching,
  ctaLabel,
  fallbackTagline,
  showPlatformName,
  briefLine,
  onLaunch,
  onFocusRequest,
}: TeamMedallionProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const animate = isActive && !reducedMotion;
  const initial = ((showPlatformName && platformName) || name).trim().charAt(0);

  // Degrade gracefully when a media slot ships without its asset.
  const kind =
    media.kind === "video" && media.loop && !videoFailed
      ? "video"
      : media.kind !== "generative" && media.still && !videoFailed
        ? "image"
        : "generative";

  // Media faces always set white type on a darkened tint — footage behind
  // ink text never reads. Generative faces keep the luminance rule.
  const textColor = kind === "generative" ? medallionText(color) : "#FFFFFF";
  const inkText = textColor !== "#FFFFFF";

  const backfaceHidden = {
    backfaceVisibility: "hidden" as const,
    WebkitBackfaceVisibility: "hidden" as const,
  };

  // In-medallion type texture: a huge cropped serif italic initial from the
  // platform name (the identity IS the letterforms). Generative mode only —
  // shipped art carries its own face.
  const typeTexture = kind === "generative" && (
    <div
      aria-hidden="true"
      className="absolute font-display italic pointer-events-none select-none"
      style={{
        left: "56%",
        top: "46%",
        transform: "translate(-50%, -50%)",
        fontSize: 300,
        lineHeight: 1,
        color: textColor,
        opacity: 0.09,
      }}
    >
      {initial}
    </div>
  );

  // Print materiality, in the face's own text color.
  const halftone = (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle, ${inkText ? "rgba(35,31,32,0.05)" : "rgba(255,255,255,0.04)"} 1px, transparent 1px)`,
        backgroundSize: "4px 4px",
      }}
    />
  );

  return (
    <>

      {/* Painted glow + team-color ring — Coke's device, attached to the coin
          so both travel with the drum. Painted (not box-shadow): shadows lose
          their border-radius on 3D-composited layers and bleed square. */}
      {isActive && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: "-52px",
            background: `radial-gradient(circle, ${color}40 30%, ${color}1A 55%, transparent 72%)`,
            ...backfaceHidden,
          }}
        />
      )}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: "-9px",
          border: `2.5px solid ${color}`,
          opacity: isActive ? 0.95 : 0.4,
          transition: "opacity 0.5s ease",
          ...backfaceHidden,
        }}
      />

      {/* Medallion face — layered: media, contrast scrim, type texture, halftone, text.
          clip-path, not border-radius: Chrome skips radius clipping on
          3D-composited layers inside the drum's preserve-3d transform. */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: color,
          clipPath: "circle(50% at 50% 50%)",
          boxShadow: `inset 0 0 0 1px ${isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"}`,
          transition: "box-shadow 0.5s ease, filter 0.7s ease",
          filter: isActive ? "brightness(1)" : "brightness(0.62) saturate(0.85)",
          ...backfaceHidden,
        }}
      >
        {kind === "generative" && (
          <GenerativeField color={color} inkText={inkText} animate={animate} />
        )}
        {kind === "image" && (
          <img
            src={media.still}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: animate ? "scale(1.03)" : "scale(1)",
              transition: "transform 0.7s ease",
            }}
          />
        )}
        {kind === "video" && (
          <>
            <VideoField still={media.still} loop={media.loop} animate={animate} onFail={() => setVideoFailed(true)} />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: color, mixBlendMode: "color", opacity: 0.85 }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: color, opacity: 0.3 }}
            />
          </>
        )}

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              kind !== "generative"
                ? "radial-gradient(circle at 50% 55%, rgba(0,0,0,0.62), rgba(0,0,0,0.12) 76%)"
                : inkText
                  ? "radial-gradient(circle at 50% 52%, rgba(255,255,255,0.3), rgba(255,255,255,0) 74%)"
                  : "radial-gradient(circle at 50% 52%, rgba(0,0,0,0.34), rgba(0,0,0,0) 74%)",
          }}
        />
        {typeTexture}
        {halftone}

        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-9"
          style={{ color: textColor, textShadow: kind !== "generative" ? "0 1px 3px rgba(0,0,0,0.55), 0 2px 18px rgba(0,0,0,0.6)" : undefined }}
        >
          <div className="text-[11px] font-bold tracking-[0.32em] uppercase mb-1.5" style={{ opacity: 0.82 }}>
            Team
          </div>
          <div className="font-display text-[44px] leading-[1.05]">{name}</div>
          <div
            className="font-display italic text-[20px] leading-[1.4] mt-3"
            style={{ opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease", minHeight: 46 }}
          >
            {(showPlatformName && platformName) || fallbackTagline}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isActive) {
                onFocusRequest();
                return;
              }
              if (!launching) onLaunch();
            }}
            disabled={launching}
            className="font-bold text-[13px] tracking-[1px] px-6 py-[10px] rounded-full mt-6 cursor-pointer transition-colors duration-300 disabled:cursor-default"
            style={{ border: `2px solid ${textColor}`, color: textColor, background: "transparent" }}
            onMouseEnter={(e) => {
              if (!launching && isActive) {
                e.currentTarget.style.background = color;
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.color = medallionText(color);
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = textColor;
              e.currentTarget.style.color = textColor;
            }}
          >
            {ctaLabel}&nbsp;&rarr;
          </button>
        </div>
      </div>

      {/* Medallion back — the same composed face without the text stack, so
          the drum never shows a dead disc (backface-hidden keeps type from
          mirroring; this face is its own element, so it reads correctly) */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: color,
          clipPath: "circle(50% at 50% 50%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)",
          filter: "brightness(0.55) saturate(0.85)",
          transform: "rotateY(180deg)",
          ...backfaceHidden,
        }}
      >
        {kind !== "generative" && media.still ? (
          <>
            <img
              src={media.still}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "grayscale(1) contrast(1.15)", opacity: 0.62 }}
            />
            <div className="absolute inset-0 pointer-events-none" style={{ background: color, mixBlendMode: "color", opacity: 0.85 }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: color, opacity: 0.32 }} />
          </>
        ) : (
          <GenerativeField color={color} inkText={inkText} animate={false} />
        )}
        {typeTexture}
        {halftone}
      </div>
    </>
  );
}
