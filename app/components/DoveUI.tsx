"use client";

// ============================================================
// DOVE UI KIT — the engagement's interactive vocabulary
// ============================================================
// A single source for the new button/tab/chip language so every
// surface wears the same micro-interactions. Built on the brand
// tokens (navy #002663, mid-blue #366AA5, gold #B78938/#DABF80,
// ink #303334) with one motion feel: quick, confident, softly
// springy — never bouncy.
//
//   <DoveButton>       primary / ghost / gold variants, magnetic
//                      hover (1px lift + glow), press-squash
//   <DoveTabs>         pill rail with a sliding gold underline
//                      (layoutId spring) and count bubbles that
//                      pop on change
//   <DoveChip>         status chips with a live pulse dot option
//
// All honor prefers-reduced-motion (transitions collapse to color).

import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type ReactNode, type CSSProperties } from "react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function useMotionOk(): boolean {
  return !useReducedMotion();
}

// ── Button ──────────────────────────────────────────────────────

type Variant = "primary" | "ghost" | "gold" | "danger";

const VARIANTS: Record<Variant, { base: CSSProperties; hover: CSSProperties }> = {
  primary: {
    base: { background: "#002663", color: "#FFFFFF", border: "1.5px solid #002663" },
    hover: { background: "#0A3478", boxShadow: "0 6px 22px rgba(0,38,99,0.35)" },
  },
  ghost: {
    base: { background: "transparent", color: "#002663", border: "1.5px solid rgba(0,38,99,0.35)" },
    hover: { background: "rgba(0,38,99,0.06)", border: "1.5px solid #002663" },
  },
  gold: {
    base: { background: "#B78938", color: "#FFFFFF", border: "1.5px solid #B78938" },
    hover: { background: "#96702E", boxShadow: "0 6px 22px rgba(183,137,56,0.4)" },
  },
  danger: {
    base: { background: "transparent", color: "#8E2740", border: "1.5px solid rgba(142,39,64,0.4)" },
    hover: { background: "rgba(142,39,64,0.08)", border: "1.5px solid #8E2740" },
  },
};

export function DoveButton({
  children, onClick, variant = "primary", size = "md", disabled, className = "", style, type,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  const motionOk = useMotionOk();
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const v = VARIANTS[variant];
  const pad = size === "sm" ? "6px 16px" : size === "lg" ? "14px 34px" : "10px 24px";

  return (
    <motion.button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`font-bold uppercase cursor-pointer select-none disabled:cursor-not-allowed ${className}`}
      style={{
        ...v.base,
        ...(hover && !disabled ? v.hover : {}),
        ...(press && !disabled && motionOk ? { transform: "scale(0.97)" } : {}),
        letterSpacing: "1.5px",
        fontSize: size === "sm" ? 11 : size === "lg" ? 14 : 12,
        padding: pad,
        borderRadius: 999,
        transition: motionOk ? "all 0.22s cubic-bezier(0.22,1,0.36,1)" : "none",
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      whileTap={motionOk ? { scale: 0.97 } : undefined}
    >
      {children}
    </motion.button>
  );
}

// ── Tabs ────────────────────────────────────────────────────────

export function DoveTabs<T extends string>({
  items, active, onChange, accent = "#002663", dark = false,
}: {
  items: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
  accent?: string;
  dark?: boolean;
}) {
  const motionOk = useMotionOk();
  const railRef = useRef<HTMLDivElement>(null);
  const idleText = dark ? "rgba(255,255,255,0.55)" : "#8A8689";
  const activeText = dark ? "#FFFFFF" : "#002663";

  return (
    <div ref={railRef} className="flex items-center gap-1" role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className="relative px-5 py-2.5 rounded-full cursor-pointer border-none bg-transparent"
            style={{ color: isActive ? (dark ? "#0A1220" : "#FFFFFF") : idleText }}
          >
            {/* The sliding pill: one layoutId animates between tabs */}
            {isActive && (
              <motion.span
                layoutId={motionOk ? "dove-tab-pill" : undefined}
                className="absolute inset-0 rounded-full"
                style={{ background: isActive ? accent : "transparent" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-2 text-[12px] font-bold uppercase tracking-[1.5px]">
              {item.label}
              {item.count != null && item.count > 0 && (
                <motion.span
                  key={item.count}
                  initial={motionOk ? { scale: 0.4 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  className="inline-grid place-items-center min-w-[20px] h-[20px] px-1 rounded-full text-[10px] font-extrabold"
                  style={{
                    background: isActive ? (dark ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.22)") : (dark ? "rgba(255,255,255,0.12)" : "rgba(0,38,99,0.08)"),
                    color: isActive ? (dark ? "#fff" : "#fff") : idleText,
                  }}
                >
                  {item.count}
                </motion.span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Chip ────────────────────────────────────────────────────────

export function DoveChip({
  children, color = "#002663", pulse = false, dark = false,
}: {
  children: ReactNode;
  color?: string;
  pulse?: boolean;
  dark?: boolean;
}) {
  const motionOk = useReducedMotion() === false;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10px] font-extrabold uppercase tracking-[1.2px]"
      style={
        dark
          ? { background: "rgba(255,255,255,0.1)", color }
          : { background: `${color}14`, color }
      }
    >
      {pulse && motionOk && (
        <motion.span
          className="block w-[6px] h-[6px] rounded-full"
          style={{ background: color }}
          animate={{ opacity: [1, 0.35, 1], scale: [1, 0.82, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {pulse && !motionOk && (
        <span className="block w-[6px] h-[6px] rounded-full" style={{ background: color }} />
      )}
      {children}
    </span>
  );
}
