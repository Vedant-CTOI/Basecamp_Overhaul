"use client";

import { BRAND } from "@/lib/config";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Page error:", error.message, error.digest);
  return (
    <div
      className="flex items-center justify-center min-h-screen px-6"
      style={{ background: BRAND.colors.paper }}
    >
      <div className="text-center max-w-lg">
        <p className="font-display text-[36px] font-bold mb-3" style={{ color: BRAND.colors.ink }}>
          Just a moment
        </p>
        <p className="font-sans text-[16px] mb-8" style={{ color: `${BRAND.colors.ink}99` }}>
          This page needs a quick refresh.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3.5 font-sans font-[700] text-[13px] tracking-[2px] uppercase rounded cursor-pointer border-none"
            style={{ background: BRAND.colors.primary, color: "#fff" }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3.5 font-sans font-[700] text-[13px] tracking-[2px] uppercase rounded cursor-pointer"
            style={{ background: BRAND.colors.paper, color: BRAND.colors.ink, border: `1px solid ${BRAND.colors.ink}59` }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
