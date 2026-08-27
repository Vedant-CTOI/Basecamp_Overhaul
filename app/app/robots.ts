import type { MetadataRoute } from "next";

// ============================================================
// ROBOTS — every deployment of this platform is a private room
// ============================================================
// Settled 2026-08-05 (user ruling): the showcase deployment stays
// publicly REACHABLE — anyone with the link walks straight in, no
// login, which is the point when the people you hand it to are not on
// the Vercel team — but it must not be DISCOVERABLE.
//
// This is the platform default rather than a one-off for the demo. A
// workshop URL carries a named client's ideas, their strategic
// context, and their people's half-finished thinking. It is meant to
// be handed out, not found.
//
// The pair matters: this file turns away crawlers that read robots.txt
// before fetching, and the `robots` metadata in app/layout.tsx covers
// the ones that fetch a page directly and only then look for a
// directive. Neither is access control — both are requests that only
// well-behaved crawlers honour. See the note in layout.tsx for what
// real gating would cost.
// ============================================================

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
