"use client";

// ============================================================
// The DoveMark — the engagement's animated brand motif
// ============================================================
// A gold dove in flight, drawn as SVG with three motion layers:
//   1. Wing-beat: two path states cross-faded on a loop.
//   2. Glow: a soft radial bloom behind the bird.
//   3. Drift: a slow float (translate + rotate) over ~9s.
//
// `reduced` (prefers-reduced-motion) freezes to a single static wing
// state with no drift — the mark still reads, nothing moves.
// Sizes itself from its container; pass px via the size prop.

export default function DoveMark({
  size = 64,
  color = "#DABF80",
  glow = true,
  className = "",
}: {
  size?: number;
  color?: string;
  glow?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size * 0.72 }}
    >
      {glow && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: size * 1.7,
            height: size * 1.7,
            background: `radial-gradient(circle, ${color}33 0%, transparent 68%)`,
          }}
        />
      )}
      <svg
        viewBox="0 0 100 72"
        className="relative w-full h-full overflow-visible dove-mark-drift"
      >
        {/* Wing up (state A) */}
        <g className="dove-wing-a">
          <path
            d="M8 44 C20 26 36 16 54 15 L62 4 L66 18 C82 20 92 28 96 38 L78 34 C74 46 62 54 48 55 L58 68 L40 60 L24 63 L30 52 C21 51 13 48 8 44 Z"
            fill={color}
          />
        </g>
        {/* Wing down (state B) — same bird, wings swept */}
        <g className="dove-wing-b" opacity={0}>
          <path
            d="M10 40 C24 34 42 32 56 30 L64 22 L66 32 C80 34 90 38 95 44 L76 45 C70 54 58 59 46 58 L54 67 L38 61 L22 60 L29 53 C21 50 14 46 10 40 Z"
            fill={color}
          />
        </g>
        {/* Eye */}
        <circle cx="58" cy="26" r="1.6" fill="#0A1220" />
      </svg>
    </span>
  );
}
