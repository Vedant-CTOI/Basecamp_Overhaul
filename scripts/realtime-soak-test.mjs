/**
 * Realtime Soak Test — Sprite x NBA Workshop
 *
 * Simulates 25 persistent WebSocket connections to Supabase Realtime,
 * each subscribing to the same tables a real workshop participant would.
 * Runs for a configurable duration while periodically creating ideas
 * and casting votes to generate Realtime traffic.
 *
 * This tests what the Playwright test doesn't: sustained concurrent
 * WebSocket connections under realistic workshop activity.
 *
 * Usage:
 *   node scripts/realtime-soak-test.mjs [DURATION_MINUTES]
 *
 * Default: 5 minutes
 * Example: node scripts/realtime-soak-test.mjs 10
 *
 * Reads credentials from app/.env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Read env
const env = readFileSync("app/.env.local", "utf8");
const vars = {};
env.split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length) vars[k.trim()] = v.join("=").trim();
});

const SUPABASE_URL = vars["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY = vars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const NUM_CLIENTS = 30;
const DURATION_MIN = parseInt(process.argv[2] || "5", 10);
const DURATION_MS = DURATION_MIN * 60 * 1000;

console.log(`\n=== REALTIME SOAK TEST ===`);
console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`Clients: ${NUM_CLIENTS}`);
console.log(`Duration: ${DURATION_MIN} minutes`);
console.log();

// Metrics
const metrics = {
  clientsConnected: 0,
  clientsFailed: 0,
  eventsReceived: 0,
  ideasCreated: 0,
  votesCast: 0,
  errors: [],
  channelErrors: 0,
  channelTimeouts: 0,
  reconnections: 0,
};

// Track all clients for cleanup
const clients = [];
const channels = [];

// Get team IDs for creating ideas
const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);
const { data: teams } = await adminClient.from("teams").select("id");
const teamIds = teams?.map((t) => t.id) || [];
const pillars = ["commercial", "mass_media", "live_xp"];

if (teamIds.length === 0) {
  console.log("ERROR: No teams found in database");
  process.exit(1);
}

// Create N Supabase clients, each with their own Realtime connection
console.log(`Connecting ${NUM_CLIENTS} clients...\n`);

for (let i = 0; i < NUM_CLIENTS; i++) {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });

  clients.push(client);

  // Subscribe to the same tables a real workshop participant would
  const channel = client
    .channel(`soak-test-${i}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ideas" },
      () => {
        metrics.eventsReceived++;
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "workshop_settings" },
      () => {
        metrics.eventsReceived++;
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes" },
      () => {
        metrics.eventsReceived++;
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        metrics.clientsConnected++;
        if (metrics.clientsConnected === NUM_CLIENTS) {
          console.log(`All ${NUM_CLIENTS} clients connected.\n`);
        }
      }
      if (status === "CHANNEL_ERROR") {
        metrics.channelErrors++;
        metrics.errors.push(`Client ${i}: CHANNEL_ERROR`);
      }
      if (status === "TIMED_OUT") {
        metrics.channelTimeouts++;
        metrics.errors.push(`Client ${i}: TIMED_OUT`);
      }
    });

  channels.push(channel);

  // Stagger connections to avoid thundering herd
  await new Promise((r) => setTimeout(r, 200));
}

// Wait for all connections to establish
await new Promise((r) => setTimeout(r, 3000));
console.log(`Connected: ${metrics.clientsConnected}/${NUM_CLIENTS}`);

if (metrics.clientsConnected < NUM_CLIENTS) {
  console.log(
    `WARNING: Only ${metrics.clientsConnected} connected. ${NUM_CLIENTS - metrics.clientsConnected} failed.`
  );
  metrics.clientsFailed = NUM_CLIENTS - metrics.clientsConnected;
}

// Generate realistic workshop activity for the duration
console.log(`\nGenerating workshop activity for ${DURATION_MIN} minutes...\n`);
const startTime = Date.now();
let activityInterval;
let statusInterval;

// Create ideas and cast votes periodically (simulates workshop activity)
activityInterval = setInterval(async () => {
  if (Date.now() - startTime > DURATION_MS) return;

  // Create an idea (happens ~every 10 seconds in a real workshop)
  const teamId = teamIds[Math.floor(Math.random() * teamIds.length)];
  const pillar = pillars[Math.floor(Math.random() * pillars.length)];
  const { error: ideaErr } = await adminClient.from("ideas").insert({
    team_id: teamId,
    category: pillar,
    name: `Soak Test ${Date.now()}`,
    description: "Automated soak test idea",
    status: "draft",
    source: "team",
  });

  if (ideaErr) {
    metrics.errors.push(`Idea insert: ${ideaErr.message}`);
  } else {
    metrics.ideasCreated++;
  }

  // Cast a vote (every other cycle)
  if (metrics.ideasCreated % 2 === 0) {
    const { data: randomIdea } = await adminClient
      .from("ideas")
      .select("id, category")
      .like("name", "Soak Test%")
      .limit(1)
      .single();

    if (randomIdea) {
      const voterId = `soak-voter-${Date.now()}`;
      const { error: voteErr } = await adminClient.rpc("cast_vote", {
        p_idea_id: randomIdea.id,
        p_category: randomIdea.category,
        p_voter_id: voterId,
      });
      if (!voteErr) metrics.votesCast++;
    }
  }
}, 10000); // Every 10 seconds

// Print status every 30 seconds
statusInterval = setInterval(() => {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const remaining = Math.max(0, DURATION_MIN * 60 - elapsed);
  console.log(
    `  [${elapsed}s] Connected: ${metrics.clientsConnected} | Events: ${metrics.eventsReceived} | Ideas: ${metrics.ideasCreated} | Votes: ${metrics.votesCast} | Errors: ${metrics.channelErrors + metrics.channelTimeouts} | Remaining: ${remaining}s`
  );
}, 30000);

// Wait for the test duration
await new Promise((r) => setTimeout(r, DURATION_MS));

// Stop activity
clearInterval(activityInterval);
clearInterval(statusInterval);

// Check final connection state
let finalConnected = 0;
for (let i = 0; i < NUM_CLIENTS; i++) {
  // Check if channel is still subscribed
  const state = channels[i].state;
  if (state === "joined") finalConnected++;
}

// Cleanup: remove channels and close clients
console.log("\nCleaning up...");
for (const channel of channels) {
  await clients[0].removeChannel(channel).catch(() => {});
}
for (const client of clients) {
  client.realtime.disconnect();
}

// Cleanup test data
const { error: cleanupErr } = await adminClient
  .from("ideas")
  .delete()
  .like("name", "Soak Test%");
await adminClient.from("votes").delete().like("voter_id", "soak-voter%");
console.log("Test data cleaned up.");

// Print results
console.log(`\n=== SOAK TEST RESULTS ===\n`);
console.log(`Duration: ${DURATION_MIN} minutes`);
console.log(`Clients: ${NUM_CLIENTS}`);
console.log(`Initial connections: ${metrics.clientsConnected}/${NUM_CLIENTS}`);
console.log(`Final connections: ${finalConnected}/${NUM_CLIENTS}`);
console.log(`Connection drops: ${metrics.clientsConnected - finalConnected}`);
console.log(`Channel errors: ${metrics.channelErrors}`);
console.log(`Channel timeouts: ${metrics.channelTimeouts}`);
console.log(`Total events received: ${metrics.eventsReceived}`);
console.log(`Ideas created: ${metrics.ideasCreated}`);
console.log(`Votes cast: ${metrics.votesCast}`);

if (metrics.errors.length > 0) {
  console.log(`\nErrors (${metrics.errors.length}):`);
  metrics.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
  if (metrics.errors.length > 20)
    console.log(`  ... and ${metrics.errors.length - 20} more`);
}

// Verdict
const connectionDrops = metrics.clientsConnected - finalConnected;
if (
  metrics.channelErrors === 0 &&
  metrics.channelTimeouts === 0 &&
  connectionDrops === 0
) {
  console.log(`\n✓ SOAK TEST PASSED — ${NUM_CLIENTS} connections stable for ${DURATION_MIN} minutes`);
  process.exit(0);
} else if (connectionDrops <= 2 && metrics.channelErrors <= 3) {
  console.log(`\n⚠ SOAK TEST PASSED WITH WARNINGS — minor connection issues`);
  process.exit(0);
} else {
  console.log(`\n✗ SOAK TEST FAILED — significant connection instability`);
  process.exit(1);
}
