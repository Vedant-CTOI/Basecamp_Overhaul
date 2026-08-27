"use client";

import { motion } from "framer-motion";

interface CoachResponseProps {
  text: string;
  isStreaming: boolean;
  coachColor: string;
  coachEmoji: string;
  coachName: string;
}

export default function CoachResponse({
  text,
  isStreaming,
  coachColor,
  coachEmoji,
  coachName,
}: CoachResponseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-6"
    >
      {/* Coach header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
          style={{
            background: `linear-gradient(135deg, ${coachColor}18 0%, ${coachColor}08 100%)`,
            borderColor: coachColor + "25",
          }}
        >
          {coachEmoji}
        </div>
        <div>
          <span className="font-bold text-[14px] tracking-[2px] uppercase">{coachName}</span>
          {isStreaming && (
            <span className="ml-2 text-xs text-muted font-medium">speaking...</span>
          )}
        </div>
      </div>

      {/* Response text */}
      <div>
        {text ? (
          <div className="whitespace-pre-wrap text-base leading-[1.75] text-foreground/85">
            {text}
            {isStreaming && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-[3px] h-5 ml-1 align-middle rounded-full"
                style={{ backgroundColor: coachColor }}
              />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 py-2">
            {[0, 0.15, 0.3].map((delay, i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, delay }}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: coachColor }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
