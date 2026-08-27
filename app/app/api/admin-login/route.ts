import {
  adminConfig,
  legacyCookieClear,
  mintSessionToken,
  passwordMatches,
  sessionSetCookie,
  unconfiguredResponse,
} from "@/lib/admin-session";

// ============================================================
// POST /api/admin-login — the only place the password is read
// ============================================================
// U5. The login page used to do `document.cookie = "admin_auth=" +
// password`, which made the secret readable by any script on the origin
// and sent it to every path on the site including static assets. The
// password now travels exactly once, in this request body, is compared
// server-side, and is never written anywhere the browser can read.
//
// TWO TRANSPORTS, ONE PATH:
//   • A native form post (the login page) gets a 303 back to where the
//     facilitator was heading, or back to the login with ?error=1. The
//     full navigation is also what fixes the old second-wrong-attempt
//     bug — the page remounts and re-reads the query every time, so the
//     message cannot be left stale by client state.
//   • A JSON post gets JSON. Used by the review harness and by anyone
//     verifying the deployment with curl.
//
// The route is deliberately outside the middleware matcher: it is how
// you get a session, so it cannot require one.

/** Only ever bounce back inside this app. Rejects absolute URLs,
 *  protocol-relative `//evil.example`, and backslash smuggling. */
function safeRedirect(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/admin";
  if (!raw.startsWith("/")) return "/admin";
  if (raw.startsWith("//") || raw.includes("\\")) return "/admin";
  return raw;
}

function loginPageUrl(req: Request, params: Record<string, string>): string {
  const url = new URL("/admin-login", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export async function POST(req: Request) {
  const wantsJson = (req.headers.get("content-type") || "").includes("application/json");

  let password = "";
  let redirectTo = "/admin";
  try {
    if (wantsJson) {
      const body = await req.json();
      password = typeof body?.password === "string" ? body.password : "";
      redirectTo = safeRedirect(body?.redirect);
    } else {
      const form = await req.formData();
      const submitted = form.get("password");
      password = typeof submitted === "string" ? submitted : "";
      redirectTo = safeRedirect(form.get("redirect"));
    }
  } catch {
    return wantsJson
      ? Response.json({ error: "Malformed login request" }, { status: 400 })
      : Response.redirect(loginPageUrl(req, { error: "1" }), 303);
  }

  const config = adminConfig();

  // FAIL CLOSED — the same posture as the middleware. With no password
  // configured there is no session to issue, and saying so is better
  // than a form that silently never works.
  if (!config) {
    return wantsJson
      ? unconfiguredResponse()
      : Response.redirect(loginPageUrl(req, { unconfigured: "1" }), 303);
  }

  if (!password.trim() || !(await passwordMatches(password.trim(), config))) {
    // No cookie is set on a refusal, so a wrong attempt leaves the
    // browser exactly as it was.
    return wantsJson
      ? Response.json({ error: "Wrong password" }, { status: 401 })
      : Response.redirect(loginPageUrl(req, { error: "1", redirect: redirectTo }), 303);
  }

  const token = await mintSessionToken(config.secret);
  const headers = new Headers();
  headers.append("Set-Cookie", sessionSetCookie(req, token));
  // Any browser still carrying the pre-U5 plaintext-password cookie
  // stops sending it from here on.
  headers.append("Set-Cookie", legacyCookieClear());

  if (wantsJson) {
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ ok: true, redirect: redirectTo }), { status: 200, headers });
  }

  headers.set("Location", redirectTo);
  return new Response(null, { status: 303, headers });
}
