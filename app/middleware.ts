import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  adminConfig,
  apiGate,
  mintSessionToken,
  sessionSetCookie,
  shouldRefresh,
  verifySessionToken,
} from "@/lib/admin-session";

// ============================================================
// THE GATE — U5, and it FAILS CLOSED
// ============================================================
// Before this pass the first branch of this file read
// `if (!adminPassword) return NextResponse.next()`, so a deploy that
// forgot one env var served the console to anybody with the URL, and
// the cookie it compared was the plaintext password itself. Both are
// inverted here: no password means no entry, and the cookie is a signed
// token that proves an expiry and nothing else.
//
// The matcher covers the /admin pages AND the mutating API surface. The
// route handlers verify independently — see the note on GATED_ROUTES in
// lib/admin-session.ts for why that redundancy is deliberate.
//
// NOT COVERED, ON PURPOSE: every room-facing surface. The Board,
// quick-add, /vote, the Stage and the Newsroom are never matched, never
// redirected and never asked for a password. The room does not
// authenticate.

function loginRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin-login", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // An open API path leaves through the front door with no crypto and
  // no env read — the room's capture and ballot paths pay nothing here.
  if (isApi && apiGate(pathname, request.method) === "open") {
    return NextResponse.next();
  }

  const config = adminConfig();

  // FAIL CLOSED. No password configured → no admin surface exists.
  // The redirect goes to a page that SAYS the console is not configured
  // rather than to a login form that cannot possibly succeed.
  if (!config) {
    if (isApi) {
      return NextResponse.json(
        {
          error: "Admin console is not configured",
          detail: "ADMIN_PASSWORD is not set on this deployment, so no admin session can be issued or verified.",
        },
        { status: 503 }
      );
    }
    return loginRedirect(request, { unconfigured: "1" });
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const verdict = await verifySessionToken(token, config.secret);

  if (verdict.status !== "valid") {
    if (isApi) {
      return NextResponse.json(
        {
          error: "Admin session required",
          detail:
            verdict.status === "expired"
              ? "The facilitator session has expired. Sign in again at /admin-login."
              : "Sign in at /admin-login to obtain a session.",
          reason: verdict.status,
        },
        { status: 401 }
      );
    }
    // `expired=1` and `error=1` are different facts and the login page
    // says different things about them. A wrong password is reported by
    // the login route; this branch only ever means a session that was
    // present and did not verify, or none at all.
    return loginRedirect(request, verdict.status === "absent" ? {} : { expired: "1" });
  }

  const response = NextResponse.next();

  // The session SLIDES: past its halfway mark, any verified request
  // pushes it out another full day. A console in use through a workshop
  // never expires under the facilitator's hands, which is the failure
  // mode that would actually hurt a live room.
  if (shouldRefresh(verdict.expiresAt)) {
    const fresh = await mintSessionToken(config.secret);
    response.headers.append("Set-Cookie", sessionSetCookie(request, fresh, SESSION_TTL_SECONDS));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/settings",
    "/api/settings/:path*",
    "/api/ticker",
    "/api/phase",
    "/api/merge",
    "/api/report",
    "/api/breaking-news",
    "/api/ideas/:path*",
    // PATCH /api/teams/<slug> is gated (the console's team edits); GET
    // passes straight through apiGate's "open" fast path above.
    "/api/teams/:path*",
  ],
};
