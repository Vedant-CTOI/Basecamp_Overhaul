/**
 * Seed Supabase with neutral demo data for the productized fork.
 *
 * The data here exists for one purpose: smoke-testing a fresh deploy and
 * giving a sales/scoping demo a populated workshop to walk through. It is
 * NOT intended for client-facing workshops — every engagement gets its own
 * teams, categories, ideas, briefs, and prompts.
 *
 * Replace the TEAMS, IDEAS, COACHING_NOTES, and SETTINGS arrays per
 * engagement, or wire a config-driven seed script that reads from a
 * structured intake form.
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { GROUP_LIST } from "../lib/config";

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

// ═══════════════════════════════════════════════════════════════
// TEAMS — DERIVED from lib/config.ts GROUPS (D-7: config is the single
// source of team identity; this seed can no longer drift from it).
// Only the creative platform name/brief are local: they are engagement
// CONTENT, loaded via the admin console or replaced per engagement.
// ═══════════════════════════════════════════════════════════════

const DEMO_PLATFORM_BRIEF =
  "[Demo creative platform — replace per engagement. The platform brief should articulate the team's overarching creative territory in 2-3 sentences. Coaches reference this when sharpening ideas against the platform.]";

const TEAMS = GROUP_LIST.map((g, i) => ({
  slug: g.slug,
  name: g.name,
  display_name: g.name,
  color: g.color,
  assigned_pillars: [...g.defaultPillars] as string[],
  creative_platform_name: `Demo Platform ${String.fromCharCode(65 + i)}`,
  creative_platform_brief: DEMO_PLATFORM_BRIEF,
}));

// ═══════════════════════════════════════════════════════════════
// DEMO IDEAS — neutral structural descriptions across all status buckets
//
// 36 total: 3 teams × 3 categories × 4 ideas (one per status). Enough to
// populate the funnel views (Floor / Coached / Starting Lineup / Bench)
// for a smoke test.
//
// Idea names and descriptions are deliberately generic. They describe the
// SHAPE of an idea (what kind of activation, what mechanic) rather than
// any specific real-world execution. Replace per engagement.
// ═══════════════════════════════════════════════════════════════

interface SeedIdea {
  team_slug: string;
  category: "category_1" | "category_2" | "category_3";
  name: string;
  description: string;
  status: "draft" | "coached" | "starting_lineup" | "bench";
  bbei_connection?: string;
  key_partners?: string;
  source?: "team" | "quick_toss" | "tissue" | "ai_scouted";
}

const buildIdea = (
  team: string,
  cat: "category_1" | "category_2" | "category_3",
  status: "draft" | "coached" | "starting_lineup" | "bench",
  shape: string,
  description: string,
  extras: Partial<Pick<SeedIdea, "bbei_connection" | "key_partners">> = {},
): SeedIdea => ({
  team_slug: team,
  category: cat,
  status,
  name: `${shape} (${status})`,
  description,
  ...extras,
});

const IDEAS: SeedIdea[] = [
  // ─── group-1 — Demo Platform A ───
  buildIdea("group-1", "category_1", "starting_lineup",
    "Limited-Edition Drop",
    "A scarcity-driven product release tied to a cultural moment. The drop is announced 48 hours ahead, sold direct-to-consumer, capped at 5,000 units. The mechanic is the marketing.",
    { bbei_connection: "[Demo: how this idea connects to the team's creative platform]", key_partners: "Direct-to-consumer fulfillment partner" },
  ),
  buildIdea("group-1", "category_1", "coached",
    "Connected Packaging",
    "Each unit ships with a unique code. Scanning unlocks personalized content tied to the buyer's location and the time of purchase. The package becomes a key, not just a container.",
  ),
  buildIdea("group-1", "category_1", "draft",
    "Subscription Bundle",
    "Monthly subscription delivering product plus exclusive digital content and surprise add-ons tied to category-relevant cultural moments.",
  ),
  buildIdea("group-1", "category_1", "bench",
    "Retail Theater Display",
    "In-store display that rotates weekly based on a real-time data signal (weather, sports score, social trend). Banner graphics refresh via digital shelf tags.",
  ),

  buildIdea("group-1", "category_2", "starting_lineup",
    "Community Pop-Up",
    "Pop-up event series that travels to three cities, featuring local creators, food, music, and a hands-on brand experience. Each city has its own creative team behind it.",
    { bbei_connection: "[Demo: connection to platform]", key_partners: "Local creative collectives, venue operators" },
  ),
  buildIdea("group-1", "category_2", "coached",
    "Pre-Event Lounge",
    "Branded lounge experience the night before a major event. Limited entry via social contest. Includes a creator-led activation, food and drink, and an early product reveal.",
  ),
  buildIdea("group-1", "category_2", "draft",
    "Interactive Activation",
    "Physical installation that responds to participant input (gesture, voice, or smartphone). Output displays on a public-facing screen and is shareable as a personal artifact.",
  ),
  buildIdea("group-1", "category_2", "bench",
    "Roving Brand Ambassadors",
    "Mobile teams distributing free product samples at relevant cultural events. Triggered by social contest entries or geofenced check-ins.",
  ),

  buildIdea("group-1", "category_3", "starting_lineup",
    "Documentary Series",
    "Multi-episode series following a small cast through a defined window of time tied to a category-relevant journey. Episodes drop weekly, building serialized momentum.",
    { bbei_connection: "[Demo: connection to platform]", key_partners: "Streaming platform, production company" },
  ),
  buildIdea("group-1", "category_3", "coached",
    "Weekly Recap Show",
    "90-second social recap hosted by a rotating cast of creators. Posts every Friday at noon across major platforms. Each week features a different rising voice.",
  ),
  buildIdea("group-1", "category_3", "draft",
    "POV Livestream",
    "First-person POV livestreams shot by a rotating cast member each week. Viewers see the unfiltered behind-the-scenes ritual leading up to a moment.",
  ),
  buildIdea("group-1", "category_3", "bench",
    "Statistical Storytelling",
    "Campaign that breaks down the math behind a single iconic moment using motion graphics. Each spot focuses on one moment, one number, one insight.",
  ),

  // ─── group-2 — Demo Platform B ───
  buildIdea("group-2", "category_1", "starting_lineup",
    "Collectible Series",
    "Quarterly collectible product designed in partnership with a rising visual artist. Each drop is 10,000 units, announced 48 hours before release, sold direct-to-consumer.",
    { bbei_connection: "[Demo: connection to platform]" },
  ),
  buildIdea("group-2", "category_1", "coached",
    "Outcome-Linked Pack",
    "Multi-unit pack that unlocks a digital experience the night a specific cultural outcome occurs. Pack hits the market the morning after, tying retail to emotion.",
    { key_partners: "Streaming partner, content producer" },
  ),
  buildIdea("group-2", "category_1", "draft",
    "Event-Linked Bundle",
    "Limited-edition bundle sold only during specific event windows. Each bundle is themed to a defined moment within the event.",
  ),
  buildIdea("group-2", "category_1", "bench",
    "Real-Time Shelf Refresh",
    "Retail display whose content updates in response to a real-time signal. Banner graphics refresh over-the-air via digital tags.",
  ),

  buildIdea("group-2", "category_2", "starting_lineup",
    "Traveling Activation",
    "Pop-up experience that travels city-to-city during a major cultural cycle. Each stop features local creators, skill-based competitions, and shareable photo moments.",
  ),
  buildIdea("group-2", "category_2", "coached",
    "Post-Event Celebration",
    "Branded rooftop or lounge experience opens to qualifying attendees after a major event. Free product, DJ set, and exclusive content drop.",
  ),
  buildIdea("group-2", "category_2", "draft",
    "Plaza Activation",
    "Pre-event plaza activation featuring food vendors, DJ sets, and photo ops. Opens three hours before the event and continues into the post-event window.",
  ),
  buildIdea("group-2", "category_2", "bench",
    "Skill Court Installation",
    "Portable installation that pops up in cities hosting major events. Participants engage in a skill challenge tracked in real time and projected to a public scoreboard.",
  ),

  buildIdea("group-2", "category_3", "starting_lineup",
    "Highlight Show",
    "Saturday morning highlight show mixing the week's most replayed moments with original content drops. Hosted by a rising creator, cut by a rising editor.",
    { bbei_connection: "[Demo: connection to platform]", key_partners: "Streaming platform, independent label" },
  ),
  buildIdea("group-2", "category_3", "starting_lineup",
    "Style & Culture Series",
    "Content series covering the off-stage style and cultural taste of cast members. Each episode features one cast member breaking down their look piece by piece.",
  ),
  buildIdea("group-2", "category_3", "coached",
    "Tentpole Countdown",
    "24-hour countdown content series leading up to a major tentpole event. Mini-episodes release every hour for the full day, building anticipation across platforms.",
  ),
  buildIdea("group-2", "category_3", "draft",
    "Mentor-Mentee Podcast",
    "Podcast series where veterans interview the people they've mentored. Two chairs, a coffee table, an unstructured conversation. Drops monthly.",
  ),

  // ─── group-3 — Demo Platform C ───
  buildIdea("group-3", "category_1", "starting_lineup",
    "Group-Activation Bundle",
    "Multi-unit pack that comes with multiple digital tickets to share. The purchase itself sets up a group moment: buy a pack, invite peers, everyone gets in.",
    { bbei_connection: "[Demo: connection to platform]" },
  ),
  buildIdea("group-3", "category_1", "coached",
    "Group-Reward Tokens",
    "Collectible tokens hidden in packs. Individual tokens are cool; the real rewards unlock when a group of friends combines their tokens in-app to claim an experience together.",
  ),
  buildIdea("group-3", "category_1", "draft",
    "Send-A-Friend Promo",
    "Buy-a-product-for-a-friend campaign at point-of-sale: for every product purchased, the customer can send a free voucher to any contact via text.",
    { key_partners: "POS partners, telco SMS gateway" },
  ),
  buildIdea("group-3", "category_1", "bench",
    "Moment-Triggered Drop",
    "Limited packaging that drops on the day of a specific cultural moment, featuring imagery tied to that moment. Sold only in markets directly affected by the moment.",
  ),

  buildIdea("group-3", "category_2", "starting_lineup",
    "Pairs Activation",
    "Interactive activation where pairs of attendees compete together at a station for a shared prize. The mechanic forces coordination — neither participant can win alone.",
  ),
  buildIdea("group-3", "category_2", "coached",
    "Community Open Run",
    "Monthly community gatherings in branded public spaces, sponsored by the brand. Local talent and rising amateurs participate alongside fans.",
  ),
  buildIdea("group-3", "category_2", "draft",
    "Group Suite Experience",
    "Exclusive group experience won through social competitions. Attendees nominate their crew and submit a video explaining why they deserve a night out together.",
  ),

  buildIdea("group-3", "category_3", "starting_lineup",
    "Setup Series",
    "Weekly content series where one cast member deliberately sets up another for their breakout moment. Episodes follow the playmaker's perspective, not the finisher's.",
    { bbei_connection: "[Demo: connection to platform]" },
  ),
  buildIdea("group-3", "category_3", "coached",
    "Connection Reel",
    "Short-form social series showing off-screen friendships and collaborations between cast members. Each episode closes with a shared moment.",
  ),
  buildIdea("group-3", "category_3", "draft",
    "Unsung Profile",
    "Short-form documentary series profiling the people who make others around them better. The connectors, the assist leaders, the supporting cast.",
  ),
];

// ═══════════════════════════════════════════════════════════════
// COACHING NOTES — small set; demonstrates each coach type in action
// ═══════════════════════════════════════════════════════════════

interface SeedCoachingNote {
  idea_name: string;
  coach_type: "provocateur" | "sharpener" | "fan_lens" | "rights_advisor";
  user_prompt: string | null;
  ai_response: string;
}

const COACHING_NOTES: SeedCoachingNote[] = [
  {
    idea_name: "Documentary Series (starting_lineup)",
    coach_type: "provocateur",
    user_prompt: null,
    ai_response:
      "[Demo coaching response from the Provocateur. Real coaching responses push the idea bigger, force a structural twist, and treat the current concept as a starting point rather than a finished thing. Replace per engagement after running real prompts against the engagement's strategic context.]",
  },
  {
    idea_name: "Documentary Series (starting_lineup)",
    coach_type: "sharpener",
    user_prompt: "can you make this sharper on the strategic alignment",
    ai_response:
      "[Demo coaching response from the Sharpener. Real coaching responses anchor the idea against the brief, reference specific evaluation lenses, and call out where the concept lands strongest within the platform's strategic territory.]",
  },
  {
    idea_name: "Highlight Show (starting_lineup)",
    coach_type: "fan_lens",
    user_prompt: null,
    ai_response:
      "[Demo coaching response from the Audience Lens. Real coaching responses cite specific audience behaviors and data points from the engagement context, treating the audience as evidence rather than abstraction.]",
  },
  {
    idea_name: "Collectible Series (starting_lineup)",
    coach_type: "rights_advisor",
    user_prompt: null,
    ai_response:
      "[Demo coaching response from the Guidelines Advisor. Real responses check the idea against partnership guardrails, flag approval-cycle concerns, and stay focused on guardrails — not creative critique.]",
  },
];

// ═══════════════════════════════════════════════════════════════
// TICKER MESSAGES — demo
// ═══════════════════════════════════════════════════════════════

const TICKER_MESSAGES = [
  { message: "Workshop platform ready for ideation. Teams, check your boards.", style: "standard", reporter: null },
  { message: "AI coaches are live. Coaching room is open for sessions.", style: "standard", reporter: null },
];

// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER SETTINGS — clearly marked, replace per engagement
// ═══════════════════════════════════════════════════════════════

const PLACEHOLDER_SETTINGS = [
  {
    key: "strategic_playbook",
    value:
      "[PLACEHOLDER — Replace with the engagement's strategic playbook. This feeds into every AI coaching interaction.]\n\nInclude: brand platform / creative territory, evaluation lenses (the criteria ideas should meet), partnership imperatives, tone of voice notes, and any strategic principles the coaches should enforce.",
  },
  {
    key: "insights",
    value:
      "[PLACEHOLDER — Replace with workshop insights, stimuli, and provocations from earlier sessions or research. This feeds into every AI coaching interaction.]\n\nInclude: observations, data points, and framing that ideation should build from. Keep it focused — the coaches reference this as context, not narrate it back.",
  },
  {
    key: "partnership_guardrails", // canonical key (D-11); readers also alias the pre-rename `nba_rights` for old DBs
    value:
      "[PLACEHOLDER — Replace with partnership rights and guardrails context. Used by the Guidelines Advisor coach.]\n\nInclude: territory terms, marks usage rules, asset allowances, talent likeness provisions, approval windows, exclusivity provisions. Keep it directive — the Guidelines Advisor checks ideas against this list.",
  },
];

const CATEGORY_BRIEFS = [
  {
    category: "category_1" as const,
    brief_context:
      "[PLACEHOLDER — Category 1 brief content. 500-1,000 words. Cover the strategic priorities, channel architecture, and creative direction for this category. The Sharpener coach references this when coaching ideas in this category.]",
    fan_context:
      "[PLACEHOLDER — Category 1 audience context. Quantitative points the Audience Lens coach should use when sharpening ideas in this category.]",
  },
  {
    category: "category_2" as const,
    brief_context:
      "[PLACEHOLDER — Category 2 brief content. 500-1,000 words. Cover the strategic priorities, channel architecture, and creative direction for this category.]",
    fan_context:
      "[PLACEHOLDER — Category 2 audience context. Quantitative points the Audience Lens coach should use when sharpening ideas in this category.]",
  },
  {
    category: "category_3" as const,
    brief_context:
      "[PLACEHOLDER — Category 3 brief content. 500-1,000 words. Cover the strategic priorities, channel architecture, and creative direction for this category.]",
    fan_context:
      "[PLACEHOLDER — Category 3 audience context. Quantitative points the Audience Lens coach should use when sharpening ideas in this category.]",
  },
];

// ═══════════════════════════════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════════════════════════════

async function seed() {
  console.log(`Seeding demo data into ${supabaseUrl}\n`);

  // 1. Upsert teams
  console.log("─── Teams ───");
  for (const team of TEAMS) {
    const { error } = await supabase.from("teams").upsert(team, { onConflict: "slug" }).select();
    console.log(error ? `  ✗ ${team.slug}: ${error.message}` : `  ✓ ${team.name} (${team.creative_platform_name})`);
  }

  // 2. Fetch team IDs
  const { data: teamRows } = await supabase.from("teams").select("id, slug");
  if (!teamRows) {
    console.error("Failed to fetch team IDs");
    process.exit(1);
  }
  const teamIdBySlug = Object.fromEntries(teamRows.map((t) => [t.slug, t.id]));

  // 3. Insert ideas
  console.log("\n─── Ideas ───");
  const ideaPayloads = IDEAS.map((idea) => ({
    team_id: teamIdBySlug[idea.team_slug],
    category: idea.category,
    name: idea.name,
    description: idea.description,
    status: idea.status,
    bbei_connection: idea.bbei_connection || null,
    key_partners: idea.key_partners || null,
    source: idea.source || "team",
  }));
  const { data: insertedIdeas, error: ideaErr } = await supabase.from("ideas").insert(ideaPayloads).select("id, name");
  if (ideaErr) {
    console.error(`  ✗ ideas insert failed: ${ideaErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${insertedIdeas?.length || 0} ideas inserted`);
  const ideaIdByName = Object.fromEntries((insertedIdeas || []).map((i) => [i.name, i.id]));

  // 4. Insert coaching notes
  console.log("\n─── Coaching notes ───");
  const notePayloads = COACHING_NOTES.map((note) => ({
    idea_id: ideaIdByName[note.idea_name] || null,
    coach_type: note.coach_type,
    user_prompt: note.user_prompt,
    ai_response: note.ai_response,
  })).filter((n) => n.idea_id);
  const { error: noteErr } = await supabase.from("training_notes").insert(notePayloads);
  console.log(noteErr ? `  ✗ ${noteErr.message}` : `  ✓ ${notePayloads.length} coaching notes inserted`);

  // 5. Ticker messages
  console.log("\n─── Ticker messages ───");
  const { error: tickerErr } = await supabase.from("ticker_messages").insert(TICKER_MESSAGES);
  console.log(tickerErr ? `  ✗ ${tickerErr.message}` : `  ✓ ${TICKER_MESSAGES.length} ticker messages inserted`);

  // 6. Workshop settings
  console.log("\n─── Workshop settings ───");
  for (const s of PLACEHOLDER_SETTINGS) {
    const { error } = await supabase.from("workshop_settings").upsert(s, { onConflict: "key" });
    console.log(error ? `  ✗ ${s.key}: ${error.message}` : `  ✓ ${s.key} (placeholder)`);
  }

  // 7. Category briefs
  console.log("\n─── Category briefs ───");
  for (const cb of CATEGORY_BRIEFS) {
    const { error } = await supabase.from("category_briefs").upsert(cb, { onConflict: "category" });
    console.log(error ? `  ✗ ${cb.category}: ${error.message}` : `  ✓ ${cb.category} (placeholder)`);
  }

  // Verify
  console.log("\n─── Verification ───");
  const { count: ideaCount } = await supabase.from("ideas").select("*", { count: "exact", head: true });
  const { count: noteVerify } = await supabase.from("training_notes").select("*", { count: "exact", head: true });
  const { count: tickerCount } = await supabase.from("ticker_messages").select("*", { count: "exact", head: true });
  console.log(`  ideas: ${ideaCount}`);
  console.log(`  training_notes: ${noteVerify}`);
  console.log(`  ticker_messages: ${tickerCount}`);
  console.log(`  teams: ${TEAMS.length} (${TEAMS.map((t) => t.name).join(" / ")} — from lib/config.ts GROUPS, with placeholder creative platforms)`);

  console.log("\nSeed complete. Demo data ready.\n");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
