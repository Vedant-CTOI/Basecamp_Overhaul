"use client";

// ============================================================
// OVERHAUL UI — "Soft Maximalism" kit
// ============================================================
// The v2 interactive language. Neumorphic surfaces on cream,
// oversized serif headlines, liquid hover states. Deliberately
// unlike v1: no flat navy pills, no hard borders, no dark
// grounds. Depth comes from light, not borders.
//
//   <SoftButton>    neumorphic raised → presses INTO the surface
//   <SoftTabs>      segmented neumorphic control w/ sliding knob
//   <SoftCard>      raised card that blooms on hover
//   <SoftInput>     inset field, focus = glow ring
// ============================================================

import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode, type CSSProperties } from "react";

export const FLUID = [0.65, 0, 0.35, 1] as const;

type BtnVariant = "primary" | "gold" | "quiet";

export function SoftButton({
  children, onClick, variant = "primary", disabled, className = "", style, full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  full?: boolean;
}) {
  const reduced = !!useReducedMotion();
  const palette: Record<BtnVariant, { idle: CSSProperties; activeBg: string }> = {
    primary: { idle: { color: "#002663", fontWeight: 800 }, activeBg: "linear-gradient(135deg,#002663,#0A3478)" },
    gold: { idle: { color: "#8A6423", fontWeight: 800 }, activeBg: "linear-gradient(135deg,#B78938,#DABF80)" },
    quiet: { idle: { color: "#6B5D4A", fontWeight: 700 }, activeBg: "#E4DCCF" },
  };
  const pal = palette[variant];

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`soft-btn ${full ? "w-full" : ""} ${className}`}
      style={{
        ...pal.idle,
        ...style,
      }}
      whileHover={reduced || disabled ? undefined : { y: -2 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = pal.activeBg;
        if (variant !== "quiet") e.currentTarget.style.color = "#fff";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(166,146,116,0.4)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "";
        e.currentTarget.style.color = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {children}
    </motion.button>
  );
}

export function SoftTabs<T extends string>({
  items, active, onChange,
}: {
  items: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  const reduced = !!useReducedMotion();
  return (
    <div className="soft-tabs" role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`soft-tab ${isActive ? "is-active" : ""}`}
          >
            {isActive && (
              <motion.span
                layoutId={reduced ? undefined : "soft-tab-knob"}
                className="soft-tab-knob"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {item.label}
              {item.count != null && item.count > 0 && (
                <span className="soft-count">{item.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SoftCard({
  children, className = "", style, onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const reduced = !!useReducedMotion();
  return (
    <motion.div
      onClick={onClick}
      className={`soft-card ${className}`}
      style={style}
      whileHover={reduced ? undefined : { y: -5 }}
      transition={{ duration: 0.3, ease: FLUID }}
    >
      {children}
    </motion.div>
  );
}

export function LiquidBlob({ color, size = 400, style }: { color: string; size?: number; style?: CSSProperties }) {
  const reduced = !!useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="absolute rounded-full pointer-events-none liquid-blob"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 35%, ${color}, transparent 70%)`, filter: "blur(60px)", opacity: 0.5, ...style }}
      animate={reduced ? undefined : { x: [0, 30, -20, 0], y: [0, -25, 15, 0], scale: [1, 1.08, 0.95, 1] }}
      transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
