import { useEffect, useLayoutEffect } from "react";

// SSR-safe alias for useLayoutEffect.
// On the server, useLayoutEffect emits a dev warning ("does nothing on the server")
// because effects don't run during SSR. This alias falls back to useEffect on the
// server to silence the warning, while preserving the synchronous-before-paint
// behavior of useLayoutEffect on the client.
//
// Pattern from Dan Abramov's gist; used by Radix, Floating UI, Framer Motion, etc.
// https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
