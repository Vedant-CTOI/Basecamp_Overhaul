"use client";

import { useEffect, useState } from "react";
import OrbitalEntry from "@/components/OrbitalEntry";
import type { AmbientMode } from "@/components/AmbientField";

type ReviewMode = Exclude<AmbientMode, "canvas">;

const OPTIONS: {
  mode: ReviewMode;
  name: string;
  note: string;
  key: string;
}[] = [
  {
    mode: "darkroom",
    name: "Darkroom",
    note: "A lit black stage; one ember through smoke",
    key: "1",
  },
  {
    mode: "ink-wash",
    name: "Ink Wash",
    note: "Developer fluid curling in the tray",
    key: "2",
  },
  {
    mode: "house-type",
    name: "House Type",
    note: "The serif itself, drifting at depth",
    key: "3",
  },
  {
    mode: "color-bends",
    name: "Living Ink",
    note: "Broad, cinematic ribbons",
    key: "4",
  },
  {
    mode: "metaballs",
    name: "Metaballs",
    note: "Lava-lamp convergence",
    key: "5",
  },
  {
    mode: "ferrofluid",
    name: "Ferrofluid",
    note: "Volatile magnetic contours",
    key: "6",
  },
];

export default function AtmosphereLabPage() {
  const [mode, setMode] = useState<ReviewMode>("darkroom");
  const [roomCode, setRoomCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const option = OPTIONS.find((item) => item.key === event.key);
      if (option) {
        event.preventDefault();
        setMode(option.mode);
        window.requestAnimationFrame(() => {
          document
            .querySelector<HTMLButtonElement>(
              `[data-atmosphere="${option.mode}"]`,
            )
            ?.focus();
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="relative h-screen overflow-hidden bg-[#0D0C0D]">
      <OrbitalEntry
        roomCode={roomCode}
        onRoomCodeChange={(value) => {
          setRoomCode(value.toUpperCase());
          setCodeError(false);
        }}
        onEnter={() => setCodeError(true)}
        codeError={codeError}
        unlocking={false}
        atmosphereMode={mode}
      />

      <aside className="fixed left-4 right-4 top-[72px] z-50 border border-white/20 bg-black/55 p-1.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-auto sm:left-6 sm:right-auto sm:top-1/2 sm:w-[226px] sm:-translate-y-1/2">
        <div className="flex items-center justify-between px-3 py-2 sm:block sm:pb-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-white/52">
            Atmosphere Lab
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-white/36">
            Keys 1–6
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-1">
          {OPTIONS.map((option) => {
            const selected = mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                data-atmosphere={option.mode}
                onClick={() => setMode(option.mode)}
                aria-pressed={selected}
                className="group flex min-w-0 items-center gap-3 border px-2.5 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#F5BAC5] sm:px-3"
                style={{
                  borderColor: selected
                    ? "rgba(235,63,67,0.86)"
                    : "rgba(255,255,255,0.08)",
                  background: selected
                    ? "rgba(235,63,67,0.16)"
                    : "rgba(255,255,255,0.025)",
                }}
              >
                <span
                  className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold sm:flex"
                  style={{
                    borderColor: selected
                      ? "rgba(235,63,67,0.82)"
                      : "rgba(255,255,255,0.18)",
                    color: selected ? "#F5BAC5" : "rgba(255,255,255,0.42)",
                  }}
                >
                  {option.key}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white sm:text-[10px]">
                    {option.name}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[9px] text-white/46 sm:block">
                    {option.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
