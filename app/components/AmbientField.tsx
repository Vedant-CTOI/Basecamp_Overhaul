"use client";

import dynamic from "next/dynamic";

// Lazy shell — the WebGL runtime loads only on surfaces that ask for one of
// the shader atmospheres. The quieter canvas field remains the default for
// the rest of the product.
const Inner = dynamic(() => import("./AmbientFieldInner"), {
  ssr: false,
  loading: () => null,
});

export type AmbientPreset = "ember" | "blush";
export type AmbientMode =
  | "canvas"
  | "color-bends"
  | "metaballs"
  | "ferrofluid"
  | "darkroom"
  | "ink-wash"
  | "house-type";

export default function AmbientField({
  preset = "ember",
  mode = "canvas",
  opacity = 1,
  className = "",
}: {
  preset?: AmbientPreset;
  mode?: AmbientMode;
  opacity?: number;
  className?: string;
}) {
  return (
    <Inner
      preset={preset}
      mode={mode}
      opacity={opacity}
      className={className}
    />
  );
}
