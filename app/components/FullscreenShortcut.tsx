"use client";

import { useEffect } from "react";

export default function FullscreenShortcut() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
        const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
        if (document.fullscreenElement || doc.webkitFullscreenElement) {
          if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
          else document.exitFullscreen();
        } else {
          if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else el.requestFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}
