"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND, PAGE_NAMES, withAlpha } from "@/lib/config";

// The door takes the console's register, and the console moved to the
// theater dark on 2026-08-05 (user ruling). A door in a different
// register from the room behind it is a white flash on the way in — and
// the body ground under this whole app is already the stage dark, so
// the light card was the thing that had to be painted over. It is still
// NOT the old ceremony: no red primary, no takeover. Same tokens as the
// console, one card, quiet.
const PAPER = BRAND.colors.paper;      // the slab's ground
const INK = BRAND.colors.ink;          // type ON the slab
const RED = BRAND.colors.primary;      // the alarm's edge, never its words
const STAGE = BRAND.colors.surface0;   // page ground
const PANEL = BRAND.colors.surface1;   // the card
const TYPE = "#FFFFFF";
const QUIET = "#A8A5A6";
const HAIRLINE = "rgba(255,255,255,0.14)";
const FIELD_EDGE = "rgba(255,255,255,0.38)";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";
  const wrongPassword = searchParams.get("error") === "1";
  // Two standings the gate can bounce back with that are NOT a wrong
  // password, and must not be reported as one. `expired` is a session
  // that ran out or did not verify; `unconfigured` is a deployment with
  // no ADMIN_PASSWORD at all, where no password would work.
  const sessionExpired = searchParams.get("expired") === "1";
  const unconfigured = searchParams.get("unconfigured") === "1";
  const [password, setPassword] = useState("");
  // The gate is server-side: the ONLY signal a password was wrong is the
  // ?error=1 the login route bounces back with. Seeding a state from it
  // once meant a second wrong attempt showed nothing — the query flipped
  // but the state had already been cleared by typing, and the route never
  // remounted on a client-side push to the same page. So the message is
  // read from the URL every render and only DISMISSED by typing, with the
  // dismissal lifted the moment another attempt is sent.
  //
  // U5 note: the form now posts natively to /api/admin-login, which
  // means every attempt is a full navigation and this page remounts
  // with a fresh query — the second-attempt case is fixed at the
  // transport as well as here. The dismissal is kept because it is the
  // behaviour that was reasoned for, and typing is still the moment the
  // message has done its job.
  const [dismissed, setDismissed] = useState(false);
  const error = wrongPassword && !dismissed;
  const expired = sessionExpired && !dismissed && !error;

  return (
    <div className="w-full max-w-sm p-8" style={{ background: PANEL, border: `1px solid ${HAIRLINE}`, colorScheme: "dark" }}>
      <img src="/logos/dove-logo-white.svg" alt={BRAND.subtitle} className="h-[20px] mb-6" />
      <h1 className="font-display text-[28px] mb-2" style={{ color: TYPE }}>
        {PAGE_NAMES.admin}
      </h1>

      {unconfigured ? (
        <>
          <p className="text-[13px] mb-4" style={{ color: QUIET }}>
            This console is not configured, so it cannot be opened. Nothing in the room is affected — the
            board, the ballot and the wall all run without it.
          </p>
          <p className="text-[13px]" style={{ color: QUIET }}>
            Set <span style={{ color: TYPE }}>ADMIN_PASSWORD</span> on the deployment and rebuild.
          </p>
        </>
      ) : (
        <>
          <p className="text-[13px] mb-8" style={{ color: QUIET }}>
            Pre-session setup for {BRAND.name}. Enter the facilitator password.
          </p>

          <form method="post" action="/api/admin-login">
            <input type="hidden" name="redirect" value={redirect} />
            {error && (
              <p
                className="text-[13px] mb-4 px-3 py-2"
                style={{
                  color: TYPE,
                  border: `1px solid ${RED}`,
                  borderLeft: `3px solid ${RED}`,
                  background: withAlpha(RED, 0.14),
                }}
              >
                Wrong password. Try again.
              </p>
            )}
            {expired && (
              <p className="text-[13px] mb-4" style={{ color: QUIET }}>
                That session has ended. Enter the password again — the room carried on without it.
              </p>
            )}
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setDismissed(true); }}
              placeholder="Facilitator password"
              className="w-full px-4 py-3 text-[16px] mb-4 focus:outline-none console-field transition-all"
              style={{
                background: STAGE,
                border: error ? `1px solid ${RED}` : `1px solid ${FIELD_EDGE}`,
                color: TYPE,
              }}
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 font-bold text-[12px] tracking-[1.5px] uppercase transition-opacity cursor-pointer"
              style={{ background: PAPER, color: INK, border: "none" }}
            >
              Enter
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: STAGE, colorScheme: "dark" }}
    >
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
