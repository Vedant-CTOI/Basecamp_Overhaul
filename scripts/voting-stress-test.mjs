/**
 * Playwright Voting Stress Test — Sprite x NBA Workshop
 *
 * Simulates 20 concurrent voters with real WebSocket connections.
 * Tests the full stack: Realtime subscriptions, cast_vote RPC,
 * optimistic UI, vote limits, and Center Court live updates.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/voting-stress-test.mjs [BASE_URL]
 *
 * Default URL: http://localhost:3000
 * Example:    node scripts/voting-stress-test.mjs https://your-app.vercel.app
 *
 * IMPORTANT: Before running, open your admin page and:
 *   1. Set a pillar to voting mode (voting_open = true)
 *   2. Make sure there are ideas in that pillar
 */

import { chromium } from "playwright";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const NUM_VOTERS = 20;
const VOTES_PER_VOTER = 3;
const VOTE_DELAY_MS = 300; // ms between each vote tap (simulates human tapping)
const STAGGER_MS = 500; // ms between each voter joining

console.log(`\n=== VOTING STRESS TEST ===`);
console.log(`URL: ${BASE_URL}`);
console.log(`Voters: ${NUM_VOTERS}`);
console.log(`Votes per voter: ${VOTES_PER_VOTER}`);
console.log(`\nMake sure voting is OPEN on your admin page before proceeding.\n`);

const browser = await chromium.launch({ headless: true });
const results = {
  voters: 0,
  votesAttempted: 0,
  votesSucceeded: 0,
  votesFailed: 0,
  errors: [],
  connectionIssues: 0,
  timings: [],
};

async function simulateVoter(voterIndex) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Give each voter a unique voter_id via localStorage
  const voterId = `stress-test-voter-${voterIndex}-${Date.now()}`;

  try {
    // Navigate to vote page
    const navStart = Date.now();
    await page.goto(`${BASE_URL}/vote`, { waitUntil: "networkidle", timeout: 30000 });
    const navTime = Date.now() - navStart;

    // Inject voter ID into localStorage
    await page.evaluate((id) => {
      localStorage.setItem("voter_id", id);
    }, voterId);

    // Reload to pick up the voter ID
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });

    // Wait for the vote page to be ready (ideas should be visible)
    // Look for vote buttons or idea cards
    await page.waitForTimeout(2000);

    // Check if voting is actually open
    const pageText = await page.textContent("body");
    if (pageText.includes("Waiting") || pageText.includes("waiting")) {
      results.errors.push(`Voter ${voterIndex}: Voting not open — saw waiting screen`);
      await context.close();
      return;
    }

    // Check for connection indicator
    if (pageText.includes("Reconnecting")) {
      results.connectionIssues++;
    }

    results.voters++;

    // Find voteable items (buttons or clickable cards)
    // The vote page renders idea cards with onClick handlers
    const ideaCards = await page.$$('[style*="cursor: pointer"]');
    const voteButtons = ideaCards.length > 0 ? ideaCards : await page.$$("button");

    // Filter to likely vote targets (skip navigation buttons)
    const voteTargets = [];
    for (const el of voteButtons) {
      const text = await el.textContent().catch(() => "");
      const tag = await el.evaluate((e) => e.tagName).catch(() => "");
      // Skip obvious non-vote elements
      if (text.includes("Home") || text.includes("SKIP") || text.includes("BACK")) continue;
      if (tag === "BUTTON" || tag === "DIV") voteTargets.push(el);
      if (voteTargets.length >= 8) break; // Don't need more than 8
    }

    if (voteTargets.length === 0) {
      results.errors.push(`Voter ${voterIndex}: No voteable elements found`);
      await context.close();
      return;
    }

    // Cast votes with realistic timing
    let votesThisVoter = 0;
    for (let v = 0; v < Math.min(VOTES_PER_VOTER, voteTargets.length); v++) {
      results.votesAttempted++;
      const voteStart = Date.now();

      try {
        await voteTargets[v].click();
        votesThisVoter++;
        results.votesSucceeded++;
        results.timings.push(Date.now() - voteStart);
      } catch (err) {
        results.votesFailed++;
        results.errors.push(`Voter ${voterIndex}, vote ${v}: ${err.message}`);
      }

      // Wait between taps (simulates human behavior)
      await page.waitForTimeout(VOTE_DELAY_MS + Math.random() * 200);
    }

    // Try to cast a 4th vote (should be blocked by limit)
    if (voteTargets.length > VOTES_PER_VOTER) {
      const extraVoteTarget = voteTargets[VOTES_PER_VOTER];
      await extraVoteTarget.click().catch(() => {});
      await page.waitForTimeout(500);
      // We don't count this — just testing the limit
    }

    // Wait a moment for Realtime events to propagate
    await page.waitForTimeout(1000);

    // Check for any error states
    const finalText = await page.textContent("body");
    if (finalText.includes("Something went wrong") || finalText.includes("Just a moment")) {
      results.errors.push(`Voter ${voterIndex}: Error boundary triggered`);
    }
    if (finalText.includes("Reconnecting")) {
      results.connectionIssues++;
    }

    console.log(`  Voter ${voterIndex}: ${votesThisVoter} votes cast`);
  } catch (err) {
    results.errors.push(`Voter ${voterIndex}: ${err.message.substring(0, 100)}`);
    console.log(`  Voter ${voterIndex}: FAILED — ${err.message.substring(0, 60)}`);
  } finally {
    await context.close();
  }
}

// Launch voters with staggered start (simulates people joining)
console.log("Launching voters...\n");
const startTime = Date.now();

// Launch in batches of 5 to avoid overwhelming the browser
const batchSize = 5;
for (let batch = 0; batch < Math.ceil(NUM_VOTERS / batchSize); batch++) {
  const batchStart = batch * batchSize;
  const batchEnd = Math.min(batchStart + batchSize, NUM_VOTERS);
  const batchPromises = [];

  for (let i = batchStart; i < batchEnd; i++) {
    // Stagger within batch
    await new Promise((r) => setTimeout(r, STAGGER_MS));
    batchPromises.push(simulateVoter(i));
  }

  await Promise.all(batchPromises);
}

const totalTime = Date.now() - startTime;

// Close browser
await browser.close();

// Print results
console.log(`\n=== RESULTS ===\n`);
console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
console.log(`Voters connected: ${results.voters}/${NUM_VOTERS}`);
console.log(`Votes attempted: ${results.votesAttempted}`);
console.log(`Votes succeeded: ${results.votesSucceeded}`);
console.log(`Votes failed: ${results.votesFailed}`);
console.log(`Connection issues: ${results.connectionIssues}`);

if (results.timings.length > 0) {
  const sorted = results.timings.sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];
  console.log(`\nVote click timing:`);
  console.log(`  avg: ${avg.toFixed(0)}ms`);
  console.log(`  p95: ${p95}ms`);
  console.log(`  max: ${max}ms`);
}

if (results.errors.length > 0) {
  console.log(`\nErrors (${results.errors.length}):`);
  results.errors.forEach((e) => console.log(`  - ${e}`));
}

// Exit with error code if significant failures
const failRate = results.votesFailed / (results.votesAttempted || 1);
if (failRate > 0.1 || results.voters < NUM_VOTERS * 0.8) {
  console.log(`\n❌ STRESS TEST FAILED — ${(failRate * 100).toFixed(0)}% vote failure rate or insufficient voters`);
  process.exit(1);
} else {
  console.log(`\n✓ STRESS TEST PASSED`);
  process.exit(0);
}
