/**
 * Clear all demo data from Supabase (ideas, notes, ticker, settings)
 * Does NOT delete teams.
 *
 * Run: npm run seed:clear
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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clear() {
  console.log("Clearing all workshop data (keeping teams)...\n");

  await supabase.from("votes").delete().neq("idea_id", "00000000-0000-0000-0000-000000000000");
  console.log("✓ votes cleared");

  await supabase.from("training_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✓ training_notes cleared");

  await supabase.from("ideas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✓ ideas cleared");

  await supabase.from("ticker_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✓ ticker_messages cleared");

  await supabase.from("workshop_settings").delete().neq("key", "__never__");
  console.log("✓ workshop_settings cleared");

  await supabase.from("teams").update({ brief_context: null, portfolio_thread: null, portfolio_coach_response: null }).neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✓ team briefs/threads/coach responses cleared");

  console.log("\nAll data cleared. Teams still exist.");
}

clear().catch(console.error);
