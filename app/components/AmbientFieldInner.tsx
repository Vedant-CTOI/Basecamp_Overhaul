"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { AmbientMode, AmbientPreset } from "./AmbientField";
import { BRAND } from "@/lib/config";

const AmbientShaderField = dynamic(() => import("./AmbientShaderField"), {
  ssr: false,
  loading: () => null,
});

type Body = {
  x: number;
  y: number;
  radius: number;
  stretchX: number;
  stretchY: number;
  phase: number;
  drift: number;
  color: number;
};

type FieldDefinition = {
  colors: string[];
  bodies: Body[];
};

// Broad, low-frequency bodies replace the former water-plane shader. Their
// movement is intentionally legible over tens of seconds: atmosphere rather
// than surface shimmer. Coordinates are normalized so the composition holds
// from phones to projection screens.
const FIELDS: Record<AmbientPreset, FieldDefinition> = {
  ember: {
    colors: [BRAND.colors.primary, BRAND.colors.pink, BRAND.colors.primaryDim, BRAND.colors.primaryBright, "#31232A"],
    bodies: [
      { x: 0.12, y: 0.18, radius: 0.36, stretchX: 1.35, stretchY: 0.8, phase: 0.2, drift: 0.76, color: 0 },
      { x: 0.81, y: 0.16, radius: 0.32, stretchX: 1.0, stretchY: 1.15, phase: 2.4, drift: 0.58, color: 1 },
      { x: 0.72, y: 0.72, radius: 0.44, stretchX: 1.25, stretchY: 0.72, phase: 4.1, drift: 0.48, color: 2 },
      { x: 0.2, y: 0.84, radius: 0.3, stretchX: 0.9, stretchY: 1.2, phase: 5.7, drift: 0.67, color: 3 },
      { x: 0.5, y: 0.46, radius: 0.3, stretchX: 1.55, stretchY: 0.62, phase: 1.4, drift: 0.42, color: 4 },
    ],
  },
  blush: {
    colors: [BRAND.colors.primary, "#F58E8F", "#D97A85", BRAND.colors.primaryDim, BRAND.colors.pink],
    bodies: [
      { x: 0.08, y: 0.2, radius: 0.4, stretchX: 1.2, stretchY: 0.78, phase: 0.4, drift: 0.66, color: 0 },
      { x: 0.82, y: 0.2, radius: 0.34, stretchX: 1.1, stretchY: 1.2, phase: 2.1, drift: 0.52, color: 4 },
      { x: 0.75, y: 0.76, radius: 0.42, stretchX: 1.3, stretchY: 0.7, phase: 4.6, drift: 0.45, color: 2 },
      { x: 0.19, y: 0.8, radius: 0.32, stretchX: 0.82, stretchY: 1.3, phase: 5.4, drift: 0.59, color: 1 },
      { x: 0.49, y: 0.48, radius: 0.32, stretchX: 1.5, stretchY: 0.6, phase: 1.2, drift: 0.36, color: 3 },
    ],
  },
};

function CanvasAmbientField({
  preset,
  opacity,
  className,
}: {
  preset: AmbientPreset;
  opacity: number;
  className: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const field = FIELDS[preset];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0 };
    const easedPointer = { x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
      pointer.y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      easedPointer.x += (pointer.x - easedPointer.x) * 0.025;
      easedPointer.y += (pointer.y - easedPointer.y) * 0.025;

      const shortestEdge = Math.min(width, height);
      const movementTime = reducedMotion ? 0 : time * 0.000045;

      field.bodies.forEach((body, index) => {
        const orbit = movementTime * body.drift + body.phase;
        const x =
          body.x * width +
          Math.sin(orbit * 1.13) * shortestEdge * 0.08 +
          easedPointer.x * shortestEdge * (index % 2 === 0 ? 0.035 : -0.025);
        const y =
          body.y * height +
          Math.cos(orbit * 0.87) * shortestEdge * 0.07 +
          easedPointer.y * shortestEdge * (index % 2 === 0 ? 0.028 : -0.02);
        const radius = shortestEdge * body.radius;

        context.save();
        context.translate(x, y);
        context.rotate(Math.sin(orbit * 0.31) * 0.18);
        context.scale(body.stretchX, body.stretchY);

        const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, `${field.colors[body.color]}D9`);
        gradient.addColorStop(0.42, `${field.colors[body.color]}8C`);
        gradient.addColorStop(1, `${field.colors[body.color]}00`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw();
    });
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    resize();
    draw();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [preset]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: "blur(18px) saturate(108%)", transform: "scale(1.04)" }}
      />
    </div>
  );
}

export default function AmbientFieldInner({
  preset,
  mode,
  opacity,
  className,
}: {
  preset: AmbientPreset;
  mode: AmbientMode;
  opacity: number;
  className: string;
}) {
  if (mode !== "canvas") {
    return (
      <AmbientShaderField
        mode={mode}
        preset={preset}
        opacity={opacity}
        className={className}
      />
    );
  }

  return (
    <CanvasAmbientField
      preset={preset}
      opacity={opacity}
      className={className}
    />
  );
}
