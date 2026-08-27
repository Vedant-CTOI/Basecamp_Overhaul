/**
 * Clear proprietary workshop data from Supabase after engagement delivery.
 *
 * Wipes:
 *   - All ideas, training_notes, votes, pillar_visions, ticker_messages
 *   - Sensitive workshop_settings (strategic_playbook, insights, partnership_guardrails, overnight_report, team_vision_*)
 *   - Per-team creative_platform_name, creative_platform_brief, facilitator_notes
 *   - Per-pillar category_briefs content (keeps the 3 rows, blanks the text)
 *
 * Keeps:
 *   - The 3 teams (names/slugs/colors reset by the seed script)
 *   - workshop_settings structural keys (room_code, workshop_state, etc.)
 *   - The 3 category_briefs rows (content blanked)
 *   - The 3 pillar_visions rows (content blanked)
 *
 * Run: npx tsx scripts/clear-workshop-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(__dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  });
} catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NEVER_UUID = "00000000-0000-0000-0000-000000000000";

// Sensitive workshop_settings keys (remove these)
const SENSITIVE_SETTING_KEYS = [
  "strategic_playbook",
  "insights",
  "partnership_guardrails",
  "nba_rights", // pre-rename alias — old DBs may still carry it
  "fan_context",
  "overnight_report",
  "overnight_report_generated_at",
  "team_vision_group-1",
  "team_vision_group-2",
  "team_vision_group-3",
];

async function clear() {
  console.log(`Clearing workshop data from ${supabaseUrl}\n`);

  // 1. Delete dependent rows first (votes reference ideas)
  const { error: e1 } = await supabase.from("votes").delete().neq("id", NEVER_UUID);
  console.log(e1 ? `  ✗ votes: ${e1.message}` : "  ✓ votes cleared");

  const { error: e2 } = await supabase.from("training_notes").delete().neq("id", NEVER_UUID);
  console.log(e2 ? `  ✗ training_notes: ${e2.message}` : "  ✓ training_notes cleared");

  const { error: e3 } = await supabase.from("ideas").delete().neq("id", NEVER_UUID);
  console.log(e3 ? `  ✗ ideas: ${e3.message}` : "  ✓ ideas cleared");

  const { error: e4 } = await supabase.from("ticker_messages").delete().neq("id", NEVER_UUID);
  console.log(e4 ? `  ✗ ticker_messages: ${e4.message}` : "  ✓ ticker_messages cleared");

  // 2. Remove sensitive workshop_settings rows
  const { error: e5 } = await supabase.from("workshop_settings").delete().in("key", SENSITIVE_SETTING_KEYS);
  console.log(e5 ? `  ✗ sensitive settings: ${e5.message}` : `  ✓ ${SENSITIVE_SETTING_KEYS.length} sensitive setting keys removed`);

  // 3. Blank category_briefs content (keep 3 rows)
  const { error: e6 } = await supabase
    .from("category_briefs")
    .update({ brief_context: null, fan_context: null })
    .neq("category", "__never__");
  console.log(e6 ? `  ✗ category_briefs: ${e6.message}` : "  ✓ category_briefs content blanked");

  // 4. Blank pillar_visions content (keep 3 rows)
  const { error: e7 } = await supabase
    .from("pillar_visions")
    .update({ vision_text: null, ai_draft: null })
    .neq("category", "__never__");
  console.log(e7 ? `  ✗ pillar_visions: ${e7.message}` : "  ✓ pillar_visions content blanked");

  // 5. Wipe team-level creative platform + facilitator notes
  const { error: e8 } = await supabase
    .from("teams")
    .update({
      creative_platform_name: null,
      creative_platform_brief: null,
      facilitator_notes: null,
    })
    .neq("id", NEVER_UUID);
  console.log(e8 ? `  ✗ teams clear: ${e8.message}` : "  ✓ team creative platforms + facilitator notes cleared");

  // 6. Wipe coach_prompt_overrides (if any)
  const { error: e9 } = await supabase.from("coach_prompt_overrides").delete().neq("coach_type", "__never__");
  console.log(e9 ? `  ✗ coach_prompt_overrides: ${e9.message}` : "  ✓ coach_prompt_overrides cleared");

  // Verify counts
  console.log("\n─── Post-clear verification ───");
  const tables = ["ideas", "training_notes", "votes", "ticker_messages"];
  for (const t of tables) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count ?? "?"} rows`);
  }
  const { data: settings } = await supabase.from("workshop_settings").select("key");
  console.log(`  workshop_settings keys: ${(settings || []).map((s) => s.key).join(", ") || "(none)"}`);

  console.log("\nClear complete. Run seed-demo-data.ts next.\n");
}

clear().catch((err) => {
  console.error(err);
  process.exit(1);
});
