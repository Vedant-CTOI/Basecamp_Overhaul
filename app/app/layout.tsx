import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Courier_Prime, Fraunces, Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import LiveTicker from "@/components/LiveTicker";
import FullscreenShortcut from "@/components/FullscreenShortcut";
import { BRAND, withAlpha } from "@/lib/config";
import "./globals.css";

// ── The config→CSS bridge ──────────────────────────────────────
// One inline style block carries BRAND.colors into the document as
// `--brand-*` custom properties; globals.css's @theme tokens reference
// these instead of baking their own hex. lib/config.ts stays the single
// definition site for the platform's palette — one edit re-voices every
// surface, CSS included. Server-rendered, so the properties exist
// before first paint.
const BRAND_TOKENS = `:root{
  --brand-primary:${BRAND.colors.primary};
  --brand-primary-bright:${BRAND.colors.primaryBright};
  --brand-primary-dim:${BRAND.colors.primaryDim};
  --brand-ink:${BRAND.colors.ink};
  --brand-paper:${BRAND.colors.paper};
  --brand-paper-dim:${BRAND.colors.paperDim};
  --brand-pink:${BRAND.colors.pink};
  --brand-blue:${BRAND.colors.blue};
  --brand-surface-0:${BRAND.colors.surface0};
  --brand-surface-1:${BRAND.colors.surface1};
  --brand-surface-2:${BRAND.colors.surface2};
  --brand-surface-3:${BRAND.colors.surface3};
  --brand-primary-a16:${withAlpha(BRAND.colors.primary, 0.16)};
  --brand-primary-a20:${withAlpha(BRAND.colors.primary, 0.2)};
  --brand-primary-a24:${withAlpha(BRAND.colors.primary, 0.24)};
  --brand-primary-a50:${withAlpha(BRAND.colors.primary, 0.5)};
}`;

// The real Ogilvy faces (2018 Collins recut of Baskerville), served from
// /public/fonts. Serif carries display + editorial + big numerals; Sans
// carries UI and body. Courier Prime is the copy-deck voice only.
// Dove edition display face: Fraunces — warm editorial serif carrying
// the Real Beauty voice (replaces the Ogilvy Baskerville recut).
const ogilvySerif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ogilvy-serif",
  display: "swap",
});

// Dove edition body face: Poppins — geometric humanist sans, closest
// free stand-in for dove.com's FF Mark Pro.
const ogilvySans = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ogilvy-sans",
  display: "swap",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "Basecamp · Dove Real Intelligence — Co-Creation Workshop Platform",
  description:
    "Dove's co-creation workshop platform. Championing authentic self-expression in a synthetic world — real beauty is not generated.",

  // NOINDEX IS THE PLATFORM DEFAULT, not a temporary measure for one
  // demo (settled 2026-08-05, user ruling: this deployment stays
  // publicly reachable, but must not be discoverable).
  //
  // Every deployment of this platform is a private room — a named
  // client's ideas, their strategic context, and their people's
  // unfinished thinking. A workshop URL is meant to be HANDED OUT, not
  // found. So the honest default is reachable-by-link and invisible to
  // search. Paired with app/robots.ts, which disallows crawlers at the
  // site level; this tag covers the crawler that fetches a page
  // directly without reading robots.txt first.
  //
  // KNOW WHAT THIS IS AND IS NOT. It is not access control. It is a
  // request that well-behaved crawlers honour, and nothing else — the
  // deployment itself stays public, because Vercel's Standard
  // Protection exempts production domains. Closing that gap needs
  // either the "All Deployments" scope (free, but every viewer then
  // needs Vercel team access) or the Advanced Deployment Protection
  // add-on for a password ($150/mo, 30-day minimum). An engagement
  // that needs real gating does it there, not here.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

/**
 * `interactive-widget=resizes-content` is here for ONE surface and one
 * failure: the phone's ADD IDEA, which the on-screen keyboard used to
 * cover the moment the textarea autofocused. It tells the browser to
 * shrink the LAYOUT viewport when the keyboard opens, so a bottom-
 * anchored control lands above the keyboard with no JavaScript at all.
 *
 * Chrome on Android honours it today; Safari does not, which is why
 * quick-add ALSO reads `visualViewport` (see `useKeyboardInset` there).
 * The two do not double-count: where the layout viewport shrinks,
 * `window.innerHeight` shrinks with it and the measured inset is zero.
 *
 * `viewport-fit` is deliberately left at its default. Every
 * `env(safe-area-inset-*)` in the build is written as a `max()` guard,
 * and without `cover` the layout viewport already sits inside the
 * notch and the home indicator — the browser does the clearing, the
 * insets read 0, and the guards are the floor. Switching to `cover`
 * would hand that job to nine surfaces at once, and this pass has no
 * device to verify it on.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${ogilvySerif.variable} ${ogilvySans.variable} ${courierPrime.variable} antialiased`}
      >
        <style>{BRAND_TOKENS}</style>
        <div className="relative min-h-screen">{children}</div>
        <LiveTicker />
        <FullscreenShortcut />
        <Analytics />
      </body>
    </html>
  );
}
