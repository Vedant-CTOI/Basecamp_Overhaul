// Basecamp Workshop — Data Backup
//
// Pulls every table from Supabase and writes:
//   docs/engagement/workshop-archive-<date>.json
//   docs/engagement/workshop-archive-<date>-ideas.csv
//
// Read-only. Uses SERVICE_ROLE key from app/.env.local so RLS can't hide rows.
//
// Usage:  node scripts/export-data.js        (from app/)
//
// Bespoke layer: STATUS_LABEL / PILLAR_LABEL / WAVE_LABEL below are
// engagement-specific. Update per engagement to match your category slugs
// and wave conventions.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const outDir = path.resolve(__dirname, "../../docs/engagement");
const dateStamp = new Date().toISOString().slice(0, 10);

async function fetchTable(name) {
  const { data, error } = await supabase.from(name).select("*");
  if (error) {
    console.error(`  ERROR fetching ${name}:`, error.message);
    return [];
  }
  console.log(`  ${name}: ${data.length} rows`);
  return data;
}

function escapeCsv(val) {
  if (val == null) return "";
  const str = String(val).replace(/"/g, '""');
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str}"`
    : str;
}

async function main() {
  console.log(`Source: ${SUPABASE_URL}`);
  console.log(`Out:    ${outDir}\n`);
  console.log("Exporting workshop data...\n");

  const tableNames = [
    "teams",
    "ideas",
    "training_notes",
    "votes",
    "ticker_messages",
    "workshop_settings",
    "coach_prompt_overrides",
    "category_briefs",
    "pillar_visions",
  ];

  const rows = await Promise.all(tableNames.map(fetchTable));
  const data = Object.fromEntries(tableNames.map((n, i) => [n, rows[i]]));

  const archive = {
    exported_at: new Date().toISOString(),
    source_url: SUPABASE_URL,
    ...data,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `workshop-archive-${dateStamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(archive, null, 2));
  console.log(`\nJSON archive: ${jsonPath}`);

  // Ideas CSV — human-readable, sorted, with coaching counts
  const teamById = {};
  data.teams.forEach((t) => {
    teamById[t.id] = {
      name: t.display_name || t.name,
      platform: t.creative_platform_name || "",
    };
  });

  // Count coaching sessions per idea
  const coachingCount = {};
  data.training_notes.forEach((n) => {
    if (n.idea_id) coachingCount[n.idea_id] = (coachingCount[n.idea_id] || 0) + 1;
  });

  const STATUS_LABEL = {
    starting_lineup: "Starting Lineup",
    coached: "Coached",
    draft: "Draft",
    bench: "Bench",
  };
  const STATUS_ORDER = { starting_lineup: 0, coached: 1, draft: 2, bench: 3 };
  // Bespoke layer: align these with your engagement's category slugs.
  const PILLAR_LABEL = {
    category_1: "Category 1",
    category_2: "Category 2",
    category_3: "Category 3",
  };
  const PILLAR_ORDER = { category_1: 0, category_2: 1, category_3: 2 };
  const SOURCE_LABEL = {
    team: "Team",
    quick_toss: "Quick Add",
    tissue: "Tissue",
    ai_scouted: "AI Scouted",
  };
  const WAVE_LABEL = { wave_1: "Wave 1", wave_2: "Wave 2" };

  // Clean trailing "..." truncation artifact in idea names for readability
  const cleanName = (n) => String(n || "").replace(/([A-Za-z0-9,;:!?)])\s+\w{1,6}\.{3}$/, "$1").replace(/\.{3,}$/, "").trim();

  // Sort: starting_lineup → coached → draft → bench, then by pillar, platform, name
  const sortedIdeas = [...data.ideas].sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    const pa = PILLAR_ORDER[a.category] ?? 99;
    const pb = PILLAR_ORDER[b.category] ?? 99;
    if (pa !== pb) return pa - pb;
    const plA = teamById[a.team_id]?.platform || "";
    const plB = teamById[b.team_id]?.platform || "";
    if (plA !== plB) return plA.localeCompare(plB);
    return cleanName(a.name).localeCompare(cleanName(b.name));
  });

  const csvHeaders = [
    "Status",
    "Category",
    "Creative Platform",
    "Idea Name",
    "Description",
    "Strategic Connection",
    "Key Partners",
    "Coaching Sessions",
    "Source",
    "Wave",
    "Date Created",
  ];
  const csvRows = sortedIdeas.map((idea) => {
    const team = teamById[idea.team_id] || {};
    return [
      STATUS_LABEL[idea.status] || idea.status,
      PILLAR_LABEL[idea.category] || idea.category,
      team.platform || "",
      cleanName(idea.name),
      idea.description || "",
      idea.bbei_connection || "",
      idea.key_partners || "",
      coachingCount[idea.id] || 0,
      SOURCE_LABEL[idea.source] || idea.source,
      WAVE_LABEL[idea.wave] || "",
      idea.created_at ? idea.created_at.slice(0, 10) : "",
    ].map(escapeCsv).join(",");
  });
  const csv = [csvHeaders.join(","), ...csvRows].join("\n") + "\n";

  const csvPath = path.join(outDir, `workshop-archive-${dateStamp}-ideas.csv`);
  fs.writeFileSync(csvPath, csv);
  console.log(`Ideas CSV:    ${csvPath}`);

  console.log("\nDone.");
}

main().then(() => process.exit(0));
