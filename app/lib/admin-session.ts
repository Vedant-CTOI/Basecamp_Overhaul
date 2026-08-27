// ============================================================
// THE FACILITATOR'S SESSION — one password, then out of the way
// ============================================================
// U5 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md,
// closing audit defects #3 and #5 (docs/backend-audit.md §6.4).
//
// What was wrong. `middleware.ts` held THREE separate faults:
//   1. `if (!adminPassword) return NextResponse.next()` — a deploy that
//      forgets one env var publishes the console to anyone with the URL.
//      Fail-OPEN on a missing secret is the cheapest possible way to
//      hand the room's screen to a stranger.
//   2. `adminAuth?.value === adminPassword` — the cookie WAS the
//      password, written by `document.cookie` on the login page, so the
//      secret was readable by any script on the origin, sent to every
//      path including static assets, and revocable only by changing the
//      env var (which logs out nothing, because nothing is stored).
//   3. `matcher: ["/admin/:path*"]` — the API surface was uncovered, so
//      `PUT /api/settings` could rewrite `workshop_state` and the
//      coaches' system prompts from a public URL, and the model routes
//      were unauthenticated calls that cost money on every request.
//
// What this is instead. A compact HMAC-signed token carrying ONLY an
// expiry, held in an httpOnly cookie. The password is compared once,
// server-side, at login and never leaves the server again. Nothing is
// stored anywhere: the token proves itself.
//
// BACKEND-AGNOSTIC BY CONSTRUCTION. There is no session table, no
// Supabase call, no Firebase call, no store of any kind in this file.
// The deployment store is still an open decision (Supabase vs Firebase)
// and this module does not care and must never learn: a stateless
// signed token works identically under either, and under neither.
//
// SESSION LIFETIME — read this before changing a number.
// A facilitator locked out mid-workshop is worse than the vulnerability
// this file closes. Three properties keep that from happening:
//   • TTL is 24h. A password entered at 08:00 on workshop day is good
//     until 08:00 the next day — longer than any room runs.
//   • It SLIDES. Every gated request made past the halfway mark
//     re-mints the cookie for a fresh 24h, so a console in active use
//     never expires under the facilitator's hands.
//   • It is STATELESS, so it is per-device and unlimited. The Stage
//     laptop, the console laptop and a phone can each hold their own
//     session at the same time, and recovery on any second device is
//     the same one password at /admin-login. Nothing to revoke, nothing
//     to sync, no "you are signed in elsewhere".
// The only revocation is rotating ADMIN_SESSION_SECRET, which ends every
// session everywhere at once — a deliberate, blunt, after-the-room tool.
//
// AND THE ROOM NEVER SEES ANY OF IT. No participant surface — the
// Board, quick-add, the ballot, the Stage's wall — is gated, calls a
// gated route, or can be redirected here. An expired facilitator
// session cannot stop a room from capturing ideas or casting votes.

// ── Names and durations ──────────────────────────────────────

/** The session cookie. Deliberately NOT `admin_auth` — the old name
 *  held the plaintext password, and a stale one must not be mistaken
 *  for a valid session by anything, ever. */
export const ADMIN_COOKIE = "basecamp_admin_session";

/** The old, unsafe cookie. Cleared on login so a browser that carries
 *  the password from a previous deploy stops sending it. */
export const LEGACY_ADMIN_COOKIE = "admin_auth";

const TOKEN_VERSION = "v1";

/** 24 hours. One workshop day plus the evening it runs into. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

/** Past the halfway mark a verified request re-mints the cookie, so an
 *  in-use console never expires mid-session. */
export const SESSION_REFRESH_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

// ── Configuration ────────────────────────────────────────────

export type AdminConfig = {
  password: string;
  secret: string;
  secretSource: "ADMIN_SESSION_SECRET" | "ADMIN_PASSWORD";
};

let loggedSecretSource = false;

/**
 * The deployment's admin configuration, or `null` when there is none.
 *
 * `null` is the FAIL-CLOSED signal and every caller must treat it as a
 * refusal, never as a bypass. That inversion is the whole of defect #5.
 *
 * NOTE for the deployment team: middleware runs on the edge runtime,
 * where Next inlines `process.env.*` at BUILD time. A platform that
 * supplies env only at runtime will compile a middleware that sees no
 * password and therefore denies the console — annoying, and the right
 * direction to fail in. Set both vars in the build environment.
 */
export function adminConfig(): AdminConfig | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;

  const dedicated = process.env.ADMIN_SESSION_SECRET;
  const secretSource = dedicated ? "ADMIN_SESSION_SECRET" : "ADMIN_PASSWORD";

  if (!loggedSecretSource) {
    loggedSecretSource = true;
    // Which key signs the session is an operational fact worth one line
    // in the log. The value itself is never printed.
    console.log(
      secretSource === "ADMIN_SESSION_SECRET"
        ? "[admin-session] signing sessions with ADMIN_SESSION_SECRET"
        : "[admin-session] ADMIN_SESSION_SECRET is unset — signing sessions with ADMIN_PASSWORD. Rotating the password will end every open session."
    );
  }

  return { password, secret: dedicated || password, secretSource };
}

// ── The token ────────────────────────────────────────────────
// Shape: `v1.<expiryEpochSeconds>.<base64url HMAC-SHA256>`
// The signature covers `v1.<expiryEpochSeconds>`. The token carries no
// identity, no role and no claim beyond "a correct password was entered
// and this is how long that is good for" — there is exactly one
// facilitator credential, so there is nothing else true to put in it.

const encoder = new TextEncoder();

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Web Crypto, so this same module runs unchanged in edge middleware,
 *  in Node route handlers, and in the edge `/api/coach` runtime. */
async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Length-independent comparison. Both arguments here are always
 *  base64url digests of the same length, so this never leaks a prefix. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function mintSessionToken(
  secret: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload = `${TOKEN_VERSION}.${nowSeconds + ttlSeconds}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

export type SessionVerdict =
  | { status: "valid"; expiresAt: number }
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "expired"; expiresAt: number };

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<SessionVerdict> {
  if (!token) return { status: "absent" };

  const parts = token.split(".");
  if (parts.length !== 3) return { status: "invalid" };
  const [version, expRaw, signature] = parts;
  if (version !== TOKEN_VERSION) return { status: "invalid" };

  const expiresAt = Number(expRaw);
  if (!Number.isInteger(expiresAt)) return { status: "invalid" };

  // Signature FIRST, expiry second. An unsigned token is not an expired
  // session, and reporting it as one would tell a prober that their
  // forgery was well-formed.
  const expected = await hmac(`${version}.${expRaw}`, secret);
  if (!timingSafeEqual(signature, expected)) return { status: "invalid" };

  if (expiresAt <= nowSeconds) return { status: "expired", expiresAt };
  return { status: "valid", expiresAt };
}

/** True when a valid session is past its halfway mark and should be
 *  re-minted on this response. This is what stops a working day from
 *  ending in a login screen. */
export function shouldRefresh(
  expiresAt: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  return expiresAt - nowSeconds < SESSION_REFRESH_AFTER_SECONDS;
}

// ── The cookie ───────────────────────────────────────────────

/** Read one cookie out of a raw `Cookie:` header. Route handlers get a
 *  plain `Request`, which has no cookie jar. */
export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * `Secure` is set on HTTPS and omitted on plain-HTTP localhost.
 *
 * Not a compromise on the live posture — every real deployment is
 * HTTPS and gets the flag. Chrome treats `http://localhost` as a
 * trustworthy origin and would keep a Secure cookie, but Safari and the
 * headless review harness are less forgiving, and a facilitator who
 * cannot log in on the dev host will reach for a worse workaround than
 * this line.
 */
function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionSetCookie(req: Request, token: string, maxAge: number = SESSION_TTL_SECONDS): string {
  const flags = [
    `${ADMIN_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(req)) flags.push("Secure");
  return flags.join("; ");
}

/** Expire the pre-U5 cookie that held the plaintext password. */
export function legacyCookieClear(): string {
  return `${LEGACY_ADMIN_COOKIE}=; Path=/; Max-Age=0`;
}

// ── The password check ───────────────────────────────────────

/**
 * Compare the submitted password to the configured one in constant
 * time, by comparing HMACs rather than the strings — so neither the
 * length nor any prefix of the real password is observable from timing.
 */
export async function passwordMatches(submitted: string, config: AdminConfig): Promise<boolean> {
  const [a, b] = await Promise.all([
    hmac(submitted, config.secret),
    hmac(config.password, config.secret),
  ]);
  return timingSafeEqual(a, b);
}

// ── Which routes are gated ───────────────────────────────────
//
// ONE enumerated list, read by the middleware and by the route handlers
// themselves. The routes check too, and that redundancy is deliberate:
// a matcher cannot tell POST from GET on the same path, and a matcher
// edited in six months must not silently un-gate a handler.
//
// REQUIRE THE SESSION — everything that changes the room's state or
// spends money on a model call.
// STAYS OPEN, DELIBERATELY — the room's own paths. `POST /api/ideas`
// (capture), `POST/DELETE /api/votes` (the ballot), every GET a room
// surface reads, and `POST /api/coach`. The coach is a participant tool
// in the Coaching Room; gating it would put a login in front of a
// table of participants. It therefore REMAINS AN UNAUTHENTICATED MODEL
// CALL ON A PUBLIC URL, protected only by the prompt's own input caps
// (2000/5000 chars, last 10 turns). That is a stated, accepted exposure
// — see the accepted-exposures list in the deployment runbook — not an
// oversight.

type GatedRoute = { match: (pathname: string) => boolean; methods: readonly string[] };

const exact = (p: string) => (pathname: string) => pathname === p;

const GATED_ROUTES: readonly GatedRoute[] = [
  { match: exact("/api/settings"), methods: ["PUT"] },
  { match: exact("/api/settings/briefs"), methods: ["PUT"] },
  { match: exact("/api/settings/coach-prompts"), methods: ["PUT"] },
  // PATCH is the console's wire toggle, added by the service-role
  // rewire — the console stopped writing ticker rows from the browser.
  { match: exact("/api/ticker"), methods: ["POST", "PATCH", "DELETE"] },
  // GET is gated here as well as POST: `/api/phase` reads and writes the
  // same operator state, and nothing the room renders calls it — the
  // room's surfaces read `workshop_state` through the store directly.
  { match: exact("/api/phase"), methods: ["GET", "POST"] },
  { match: exact("/api/merge"), methods: ["POST"] },
  { match: exact("/api/report"), methods: ["POST"] },
  { match: exact("/api/breaking-news"), methods: ["POST"] },
  // `/api/scout` is NOT here on purpose: it is pitched from the team
  // Board, so gating it degraded a participant feature to canned pitches
  // with no explanation. Same posture as `/api/coach` — see that route.
  // `/api/ideas/<id>` — PATCH and DELETE only. GET stays open, and
  // `/api/ideas` itself (POST, capture) is open at every method.
  { match: (p) => /^\/api\/ideas\/[^/]+$/.test(p), methods: ["PATCH", "DELETE"] },
  // `/api/teams/<slug>` — PATCH only (the console's team edits, routed
  // through the API by the service-role rewire). GET stays open: every
  // room surface resolves teams.
  { match: (p) => /^\/api\/teams\/[^/]+$/.test(p), methods: ["PATCH"] },
];

export type RouteGate = "open" | "admin";

export function apiGate(pathname: string, method: string): RouteGate {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const verb = method.toUpperCase();
  for (const route of GATED_ROUTES) {
    if (route.match(path) && route.methods.includes(verb)) return "admin";
  }
  return "open";
}

// ── The refusals ─────────────────────────────────────────────

/** 503, not 401: nothing the caller can send would help. The console is
 *  not configured on this deployment. */
export function unconfiguredResponse(): Response {
  return Response.json(
    {
      error: "Admin console is not configured",
      detail: "ADMIN_PASSWORD is not set on this deployment, so no admin session can be issued or verified.",
    },
    { status: 503 }
  );
}

export function unauthorizedResponse(reason: SessionVerdict["status"]): Response {
  return Response.json(
    {
      error: "Admin session required",
      detail:
        reason === "expired"
          ? "The facilitator session has expired. Sign in again at /admin-login."
          : "Sign in at /admin-login to obtain a session.",
      reason,
    },
    { status: 401 }
  );
}

/**
 * The one line every gated route handler runs first:
 *
 *     const denied = await requireAdmin(req);
 *     if (denied) return denied;
 *
 * Returns a refusal Response, or `null` when the caller may proceed.
 */
export async function requireAdmin(req: Request): Promise<Response | null> {
  const config = adminConfig();
  if (!config) return unconfiguredResponse();

  const token = readCookie(req.headers.get("cookie"), ADMIN_COOKIE);
  const verdict = await verifySessionToken(token, config.secret);
  if (verdict.status === "valid") return null;
  return unauthorizedResponse(verdict.status);
}
