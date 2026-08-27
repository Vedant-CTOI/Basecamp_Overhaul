/**
 * k6 Load Test — Basecamp Workshop Platform
 *
 * Simulates 25 concurrent workshop participants doing:
 * - Creating ideas (ideation burst)
 * - Fetching ideas by team (team page loads)
 * - Fetching ideas by pillar (vote page loads)
 * - Casting votes (voting burst)
 * - Fetching vote counts (center court)
 * - Fetching workshop state (phone polling)
 *
 * Run: k6 run scripts/load-test.js
 *
 * Reads env vars from app/.env.local automatically.
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ── Config ──
// Set these via env vars: k6 run -e SUPABASE_URL=... -e SUPABASE_KEY=... scripts/load-test.js
const SUPABASE_URL = __ENV.SUPABASE_URL || "";
const SUPABASE_KEY = __ENV.SUPABASE_KEY || "";

if (!SUPABASE_URL) {
  throw new Error("Set SUPABASE_URL env var: k6 run -e SUPABASE_URL=https://your-project.supabase.co -e SUPABASE_KEY=your_key scripts/load-test.js");
}
if (!SUPABASE_KEY) {
  throw new Error("Set SUPABASE_KEY env var: k6 run -e SUPABASE_URL=... -e SUPABASE_KEY=your_key scripts/load-test.js");
}

const REST_URL = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const readHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// ── Custom metrics ──
const ideaCreateDuration = new Trend("idea_create_duration", true);
const ideaFetchDuration = new Trend("idea_fetch_duration", true);
const voteCastDuration = new Trend("vote_cast_duration", true);
const voteFetchDuration = new Trend("vote_fetch_duration", true);
const settingsFetchDuration = new Trend("settings_fetch_duration", true);
const errorRate = new Rate("errors");
const dbErrors = new Counter("db_errors");

// ── Test scenarios ──
const PILLARS = ["commercial", "mass_media", "live_xp"];
const TEAM_SLUGS = ["group-1", "group-2", "group-3"];

export const options = {
  scenarios: {
    // Phase 1: Ideation burst (everyone creating ideas)
    ideation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 25 },  // Ramp up to 25 users
        { duration: "60s", target: 25 },  // Sustain for 1 min
        { duration: "5s", target: 0 },    // Ramp down
      ],
      exec: "ideationBurst",
      startTime: "0s",
    },
    // Phase 2: Voting burst (everyone voting at once)
    voting: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 25 },
        { duration: "90s", target: 25 },  // Sustain for 1.5 min
        { duration: "5s", target: 0 },
      ],
      exec: "votingBurst",
      startTime: "80s",  // Start after ideation
    },
    // Phase 3: Mixed load (coaching + viewing + voting)
    mixed: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s", target: 20 },
        { duration: "60s", target: 20 },
        { duration: "5s", target: 0 },
      ],
      exec: "mixedWorkshopActivity",
      startTime: "180s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],     // 95% of requests under 2s
    idea_create_duration: ["p(95)<1000"],   // Idea creation under 1s
    idea_fetch_duration: ["p(95)<500"],     // Idea fetches under 500ms
    vote_cast_duration: ["p(95)<1000"],     // Vote casting under 1s
    vote_fetch_duration: ["p(95)<500"],     // Vote count fetches under 500ms
    settings_fetch_duration: ["p(95)<300"], // Settings fetches under 300ms
    errors: ["rate<0.05"],                  // Less than 5% error rate
  },
};

// ── Helpers ──

function fetchTeams() {
  const res = http.get(`${REST_URL}/teams?select=id,slug&order=name`, { headers: readHeaders });
  if (res.status !== 200) {
    dbErrors.add(1);
    return [];
  }
  return JSON.parse(res.body);
}

let _teams = null;
function getTeams() {
  if (!_teams) _teams = fetchTeams();
  return _teams;
}

function createIdea(teamId, pillar) {
  const payload = JSON.stringify({
    team_id: teamId,
    category: pillar,
    name: `Load Test Idea ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: "Automated load test idea — safe to delete after test",
    status: "draft",
    source: "team",
  });

  const res = http.post(`${REST_URL}/ideas`, payload, { headers });
  ideaCreateDuration.add(res.timings.duration);
  const ok = check(res, { "idea created": (r) => r.status === 201 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }

  if (res.status === 201) {
    return JSON.parse(res.body)[0];
  }
  return null;
}

function fetchIdeasByTeam(teamId) {
  const res = http.get(
    `${REST_URL}/ideas?team_id=eq.${teamId}&order=created_at.desc`,
    { headers: readHeaders }
  );
  ideaFetchDuration.add(res.timings.duration);
  const ok = check(res, { "ideas fetched": (r) => r.status === 200 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }
  return res.status === 200 ? JSON.parse(res.body) : [];
}

function fetchIdeasByPillar(pillar) {
  const res = http.get(
    `${REST_URL}/ideas?category=eq.${pillar}&status=neq.bench&order=created_at.desc`,
    { headers: readHeaders }
  );
  ideaFetchDuration.add(res.timings.duration);
  const ok = check(res, { "pillar ideas fetched": (r) => r.status === 200 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }
  return res.status === 200 ? JSON.parse(res.body) : [];
}

function castVote(ideaId, pillar, voterId) {
  const res = http.post(
    `${REST_URL}/rpc/cast_vote`,
    JSON.stringify({ p_idea_id: ideaId, p_category: pillar, p_voter_id: voterId }),
    { headers }
  );
  voteCastDuration.add(res.timings.duration);
  const ok = check(res, { "vote cast": (r) => r.status === 200 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }
  return res.status === 200;
}

function fetchVoteCounts(pillar) {
  const res = http.get(
    `${REST_URL}/votes?category=eq.${pillar}&select=idea_id,voter_id`,
    { headers: readHeaders }
  );
  voteFetchDuration.add(res.timings.duration);
  const ok = check(res, { "vote counts fetched": (r) => r.status === 200 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }
}

function fetchWorkshopState() {
  const res = http.get(
    `${REST_URL}/workshop_settings?key=eq.workshop_state&select=value`,
    { headers: readHeaders }
  );
  settingsFetchDuration.add(res.timings.duration);
  const ok = check(res, { "workshop state fetched": (r) => r.status === 200 });
  if (!ok) { errorRate.add(1); dbErrors.add(1); }
  else { errorRate.add(0); }
}

function fetchTrainingNotes() {
  const res = http.get(
    `${REST_URL}/training_notes?select=id&limit=1`,
    { headers: readHeaders, tags: { name: "training_notes_count" } }
  );
  check(res, { "training notes accessible": (r) => r.status === 200 });
}

// ── Scenarios ──

export function ideationBurst() {
  const teams = getTeams();
  if (!teams.length) return;

  const team = randomItem(teams);
  const pillar = randomItem(PILLARS);

  group("ideation", () => {
    // Simulate: participant opens team page, sees ideas, creates one
    fetchIdeasByTeam(team.id);
    sleep(1 + Math.random() * 2); // Think time: 1-3s

    createIdea(team.id, pillar);
    sleep(0.5 + Math.random()); // Brief pause

    // Another participant loads the page (sees the new idea)
    fetchIdeasByTeam(team.id);
    fetchWorkshopState();
  });

  sleep(2 + Math.random() * 3); // Wait 2-5s before next iteration
}

export function votingBurst() {
  const teams = getTeams();
  if (!teams.length) return;

  const pillar = randomItem(PILLARS);
  const voterId = `k6-voter-${__VU}-${__ITER}`;

  group("voting", () => {
    // Simulate: participant opens vote page, sees ideas, votes 3 times
    fetchWorkshopState();
    const ideas = fetchIdeasByPillar(pillar);
    sleep(0.5 + Math.random());

    // Cast up to 3 votes (the max per pillar)
    const votableIdeas = ideas.slice(0, Math.min(ideas.length, 5));
    let votesCast = 0;
    for (const idea of votableIdeas) {
      if (votesCast >= 3) break;
      castVote(idea.id, pillar, voterId);
      votesCast++;
      sleep(0.3 + Math.random() * 0.7); // Quick taps: 0.3-1s apart
    }

    // Center Court fetches vote counts (simulates projector)
    fetchVoteCounts(pillar);
  });

  sleep(3 + Math.random() * 5); // Wait 3-8s before next round
}

export function mixedWorkshopActivity() {
  const teams = getTeams();
  if (!teams.length) return;

  const team = randomItem(teams);
  const pillar = randomItem(PILLARS);

  group("mixed", () => {
    // Random mix of activities
    const action = Math.random();

    if (action < 0.3) {
      // 30%: Create an idea
      createIdea(team.id, pillar);
    } else if (action < 0.5) {
      // 20%: Fetch team ideas (team page view)
      fetchIdeasByTeam(team.id);
    } else if (action < 0.7) {
      // 20%: Fetch pillar ideas + vote counts (center court / vote page)
      fetchIdeasByPillar(pillar);
      fetchVoteCounts(pillar);
    } else if (action < 0.85) {
      // 15%: Workshop state check (all phones do this)
      fetchWorkshopState();
    } else {
      // 15%: Training notes check (around the league)
      fetchTrainingNotes();
      fetchIdeasByPillar(pillar);
    }
  });

  sleep(1 + Math.random() * 3);
}

// ── Cleanup ──

export function teardown() {
  // Clean up all load test ideas
  const res = http.get(
    `${REST_URL}/ideas?name=like.Load Test Idea*&select=id`,
    { headers: readHeaders }
  );

  if (res.status === 200) {
    const ideas = JSON.parse(res.body);
    if (ideas.length > 0) {
      // Delete votes first (cascade should handle, but be safe)
      for (const idea of ideas) {
        http.del(`${REST_URL}/votes?idea_id=eq.${idea.id}`, null, { headers });
      }
      // Delete ideas
      http.del(`${REST_URL}/ideas?name=like.Load Test Idea*`, null, { headers });
      console.log(`Cleaned up ${ideas.length} load test ideas`);
    }
  }
}
