"use client";

import { motion } from "framer-motion";
import { Coach } from "@/lib/types";

interface CoachTileProps {
  coach: Coach;
  selected: boolean;
  onClick: () => void;
  index: number;
}

export default function CoachTile({ coach, selected, onClick, index }: CoachTileProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 35 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.06, type: "spring", stiffness: 200, damping: 22 }}
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        relative glass-card rounded-2xl p-6 text-left overflow-hidden group transition-all duration-300
        ${selected ? "!border-2 ring-1" : "hover:!border-border-light"}
      `}
      style={{
        borderColor: selected ? coach.color : undefined,
        boxShadow: selected ? `0 0 0 1px ${coach.color}40` : undefined,
      }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at top left, ${coach.color}12 0%, transparent 60%)`,
        }}
      />

      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 relative border"
        style={{
          background: `linear-gradient(135deg, ${coach.color}18 0%, ${coach.color}08 100%)`,
          borderColor: coach.color + "25",
        }}
      >
        {coach.emoji}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent" />
      </div>

      <h4 className="font-display font-[900] text-[20px] tracking-[2px] uppercase mb-1">{coach.name}</h4>
      <p
        className="font-display font-[800] text-[10px] tracking-[2px] uppercase mb-3"
        style={{ color: coach.color }}
      >
        {coach.title}
      </p>
      <p className="text-sm text-muted-light leading-relaxed">{coach.description}</p>

      {/* Selection indicator */}
      {selected && (
        <motion.div
          layoutId="coach-select-ring"
          className="absolute top-4 right-4 w-3 h-3 rounded-full"
          style={{
            backgroundColor: coach.color,
            boxShadow: `0 0 10px ${coach.color}80`,
          }}
        />
      )}

      {/* Bottom color bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
        style={{ backgroundColor: coach.color }}
      />
    </motion.button>
  );
}
