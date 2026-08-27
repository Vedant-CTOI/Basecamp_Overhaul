// ============================================================
// THE SERVER'S OWN CLIENT — service role, never the browser's
// ============================================================
// Follow-up to U1: `app/supabase/policies.sql` restricts writes on
// `workshop_settings`, `category_briefs`, `coach_prompt_overrides`,
// `teams` and `ticker_messages` (insert-narrowed / delete) to the
// service role — there is no policy that can admit the admin's browser
// and refuse the room's phones, because both present the same anon JWT.
// So every session-gated API route that writes a restricted table
// reaches Postgres through THIS module instead of the shared anon
// client.
//
// Resolution, in order:
//   1. `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` set →
//      a dedicated service-role client (BYPASSRLS in Supabase's role
//      model). REQUIRED on any deployment where policies.sql has been
//      applied — the README says so.
//   2. Otherwise → the shared client from `lib/supabase`. In showcase
//      mode that is the in-memory shim (RLS does not exist, everything
//      works); on a live deploy missing the service key it is the anon
//      client, whose restricted writes now FAIL LOUDLY through
//      `lib/db.ts` instead of silently succeeding against an unpoliced
//      database. Failing is correct: the fix is the env var, not a
//      wider policy.
//
// BACKEND-AGNOSTIC BY THE SAME RULE AS lib/db.ts: callers hold a
// client whose builders settle to `{ data, error }`. Swap the store and
// the discipline is unchanged.
//
// THE KEY MUST NEVER REACH THE BROWSER. Three fences:
//   · this module throws at import time in any browser context;
//   · the key is read from `SUPABASE_SERVICE_ROLE_KEY` (no
//     `NEXT_PUBLIC_` prefix), which Next.js never inlines client-side;
//   · `scripts/check-write-errors.mjs` fails the build if any client
//     component — or anything under `components/` — imports this file.
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase-server was imported in the browser. It exists to hold the service-role key; route the mutation through an API route instead."
  );
}

let _service: SupabaseClient | null = null;
let _loggedFallback = false;

/** True when this deployment can actually exercise the service role.
    Routes do not branch on this — the fallback client fails loudly on
    restricted writes, which is the correct signal — but the deployment
    verification reads it to report the resolved mode. */
export function hasServiceRole(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The client a session-gated route writes restricted tables with.
 * Service role when configured; the shared client (showcase shim, or a
 * loudly-failing anon client) when not.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    if (!_service) {
      _service = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return _service;
  }
  if (url && !serviceKey && !_loggedFallback) {
    _loggedFallback = true;
    console.warn(
      "[supabase-server] SUPABASE_SERVICE_ROLE_KEY is not set — admin routes are writing with the ANON key. Once policies.sql is applied these writes FAIL. Set the service key (app/supabase/README.md, Required environment)."
    );
  }
  return getSupabase();
}
