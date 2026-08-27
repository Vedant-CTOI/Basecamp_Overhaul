# Backend Testing Guide — Basecamp Workshop Platform

A living document of load tests, stress tests, resilience tests, and monitoring for live workshop deployments. Born from the first two Basecamp deployments (Coke March 2026, Sprite × NBA April 2026) after a 20-minute database outage during the first deployment surfaced a stack of structural fixes worth keeping for every future engagement.

The result data below references the original deployments — keep them as **benchmarks** for what known-good performance looks like at workshop scale (~25 concurrent participants, Small Supabase compute).

---

## Tests We Run

### 1. k6 REST API Load Test

**What it tests:** Database query performance under concurrent REST traffic. Simulates 25 VUs across three phases: ideation burst, voting burst, and mixed activity.

**Script:** `scripts/load-test.js`

**Run:**
```bash
k6 run -e SUPABASE_KEY="your_key" scripts/load-test.js
```

**Thresholds:**
| Metric | Target |
|---|---|
| All requests p95 | < 2000ms |
| Idea creation p95 | < 1000ms |
| Idea fetch p95 | < 500ms |
| Vote casting p95 | < 1000ms |
| Vote count fetch p95 | < 500ms |
| Settings fetch p95 | < 300ms |
| Error rate | < 5% |

**Benchmark (Sprite × NBA pre-deployment, Small compute, April 2026):**
- All thresholds passed
- p95 across all requests: 60ms
- Error rate: 0.00%
- 3,425 checks, 100% passed

**What it doesn't test:** WebSocket connections, Realtime event delivery, client-side rendering.

---

### 2. Playwright Voting Stress Test

**What it tests:** Concurrent voting with real browser instances, real WebSocket connections, and real Supabase Realtime subscriptions. Each browser gets a unique voter ID and casts 3 votes.

**Script:** `scripts/voting-stress-test.mjs`

**Prerequisites:**
```bash
npm install playwright
npx playwright install chromium
```

**Run:**
```bash
node scripts/voting-stress-test.mjs https://your-app.vercel.app
```

**Before running:** Open admin page and set a pillar to voting mode with ideas in it.

**Benchmark (Sprite × NBA pre-deployment, 20 voters, April 2026):**
- 20/20 voters connected
- 60/60 votes cast, 0 failed
- 0 connection issues
- 20ms avg vote click timing

**What it doesn't test:** Sustained connections over time (each voter connects, votes, disconnects within ~30s).

---

### 3. Supabase Realtime Soak Test

**What it tests:** Persistent WebSocket connections under sustained activity. Simulates N clients each subscribing to ideas, votes, and workshop_settings for a configurable duration. Periodically creates ideas and casts votes to generate Realtime traffic.

**Script:** `app/scripts/realtime-soak-test.mjs`

**Run:**
```bash
cd app && node scripts/realtime-soak-test.mjs [DURATION_MINUTES]
```

**Benchmark (Sprite × NBA pre-deployment, 30 clients, 5 minutes, April 2026):**
- 30/30 initial connections, 30/30 final connections
- 0 connection drops, 0 channel errors, 0 timeouts
- 1,290 Realtime events delivered
- Clean Supabase logs (no UnableToCheckProcessesOnRemoteNode errors)

---

### 4. Code Verification Suite

**What it tests:** All stability/performance fixes are structurally present in the codebase. Checks for indexes, error handling, debouncing, subscription scoping, vote guards, etc.

**Run:** Inline Node.js script (see conversation history or create as a standalone file)

**Current checks:** 56 items covering all 10 performance fixes + Tier 1 resilience + Fran's structural changes.

---

### 5. Data Integrity Tests

**What it tests:** Database schema, constraints, RPC functions, and seed data are correct.

**Run:** Inline Node.js script against live Supabase.

**Current checks:** 13 items including team count, pillar slugs, CHECK constraints, cast_vote RPC, and insert/reject validation.

---

### 6. Chaos Tests

**What it tests:** Error handling under adversarial conditions — bad URLs, invalid keys, SQL injection, oversized payloads, rapid-fire requests, concurrent writes, vote limit enforcement.

**Run:** Inline Node.js script against live Supabase (10 tests).

**Benchmark (Sprite × NBA pre-deployment, April 2026):**
- 10/10 passed
- Bad Supabase URL: returns error gracefully (42ms)
- Invalid API key: returns auth error
- SQL injection: safely handled (parameterized queries)
- 100KB payload: accepted
- 100 rapid sequential reads: 0 errors, 45ms avg
- 10 concurrent inserts: 0 errors, 113ms total
- Vote on nonexistent idea: FK constraint catches it
- Double vote: returns false (not error)
- 4th vote over limit: returns false (limit enforced)

---

### 7. Memory Leak Analysis

**What it tests:** Static code analysis for subscription cleanup, interval cleanup, and event listener cleanup across all pages with Realtime connections.

**Benchmark (Sprite × NBA pre-deployment, April 2026):**
- 10/10 passed
- All 6 Realtime subscriptions have `removeChannel` cleanup
- All `setInterval` calls have matching `clearInterval`
- All `addEventListener` calls have matching `removeEventListener`

---

### 8. Manual Resilience Tests

**WiFi Drop + Reconnect (Chrome DevTools offline toggle):**
- Result: **PASSED** — dropped WiFi mid-vote, reconnected seamlessly, correct vote counts after recovery. All refetches returned 200 under 200ms.

**iPhone Safari Background Tab:**
- Result: **PASSED** — backgrounded Safari for 60 seconds, returned to app. Red "Reconnecting..." bar appeared briefly, then auto-reconnected. Voting worked normally after recovery.

---

## Tests We Should Run (prioritized)

### ~~Priority 1: Network Resilience (WiFi drop + reconnect)~~ DONE
**Time:** 30 min | **ROI:** Very high

The test most likely to find a real bug. Workshop WiFi drops are near-certain.

**Manual approach:**
1. Open the app in Chrome
2. Open DevTools → Network tab
3. Start a voting round
4. Toggle the "Offline" checkbox on for 10 seconds, then back off
5. Verify:
   - Does the UI show a reconnecting state?
   - After reconnect, do vote counts reconcile?
   - Are any votes lost?
   - Does the WebSocket re-establish automatically?

**Deeper approach (Network Link Conditioner on macOS):**
- Install from Xcode Additional Tools
- System Preferences → Network Link Conditioner
- Profiles: "100% Loss" for 10 seconds, then switch to "Wi-Fi"
- This affects ALL traffic including WebSocket connections (more realistic than Chrome throttling)

### Priority 2: State Reconciliation After Reconnection
**Time:** 30 min | **ROI:** Very high

The specific scenario most likely to produce a visible bug:
1. User A submits a vote
2. User A's WiFi drops for 15 seconds
3. During those 15 seconds, Users B and C vote
4. User A reconnects
5. Does User A see all three votes?

**Key insight:** Supabase Postgres Changes does NOT replay missed events. The client only gets events from the moment it resubscribes. If the app depends on catching every event, it needs a reconciliation mechanism (re-fetch on reconnection). Our 60-second reconciliation on Center Court partially addresses this, but the vote page has no reconciliation.

### ~~Priority 3: Manual Chaos Tests~~ DONE (automated — see Test 6 above)
**Time:** 30 min | **ROI:** High

Five quick tests, 5 minutes each:
1. **Simulate Supabase outage:** Change `NEXT_PUBLIC_SUPABASE_URL` to a nonexistent URL. Does the app show an error or crash?
2. **Simulate Vercel cold start:** Deploy to preview URL, wait 10 min, hit with 30 requests. Measure first response time.
3. **30-tab connection test:** Open 30 tabs simultaneously. Watch Supabase connection count.
4. **Kill and reopen:** Force-close the tab mid-session. Reopen. Is the user's session intact?
5. **API rate limit test:** Hit a single endpoint 100 times/second with k6 for 10 seconds.

### ~~Priority 4: Browser Memory Leak Check~~ DONE (static analysis — see Test 7 above)
**Time:** 30 min | **ROI:** Medium-high

Prevents the app from degrading over a 2-hour session:
1. Open app in Chrome → DevTools → Performance Monitor
2. Note starting: JS Heap Size, DOM Nodes, Event Listeners
3. Simulate a workshop session (submit ideas, coach, vote)
4. Leave tab open 30 minutes with WebSocket active
5. Check metrics again — look for steady climb without drops

**Specific test:** Navigate between pages 20 times. If each navigation creates a new Realtime subscription without cleanup, you'll have 20 active listeners (the most common React + Supabase memory leak).

### ~~Priority 5: Pre-Event Monitoring Setup~~ DONE
**Time:** 15 min | **ROI:** Very high (zero-effort insurance)

Have these open on a facilitator laptop during the workshop:
1. **Supabase Dashboard → Reports → Realtime** — connected clients, message throughput
2. **Supabase Dashboard → Reports → Database** — active connections, query execution time
3. **Vercel Dashboard** — function invocations, errors, cold starts
4. **The app itself** — logged in as a test user to spot issues in real time

### ~~Priority 6: iPhone Safari Smoke Test~~ DONE (see Test 8 above)
**Time:** 15 min | **ROI:** Medium

Safari aggressively suspends WebSocket connections when a tab goes to background. Test:
1. Open vote page on iPhone Safari
2. Switch to another app for 60 seconds
3. Switch back — does the Realtime connection recover?
4. Is the voting state correct?

Also test: Xcode Simulator runs iOS Safari with realistic WebSocket behavior if you don't have a physical iPhone handy.

### Priority 7: Message Throughput Test
**Time:** 1 hour | **ROI:** Medium

Extend k6 with WebSocket module to measure message delivery latency:
```javascript
import ws from 'k6/ws';
// Open 30 WebSocket connections to Supabase Realtime
// Measure round-trip latency for broadcast events
// Verify 0% message loss
```

Or use Artillery with its native WebSocket engine.

### Priority 8: pgbench Database Ceiling
**Time:** 10 min | **ROI:** Medium

Raw database throughput independent of API layer:
```bash
pgbench -c 30 -j 4 -T 60 "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
```

---

## What We Learned

### Root Cause of Coke Workshop Outage (March 25, 2026)
- **Zero database indexes** → every query was a full table scan
- **Unscoped Realtime refetches** → every INSERT triggered 30+ clients to refetch entire tables
- **REST polling fallback activated during Realtime failure** → compounded the connection exhaustion
- **FOR UPDATE lock contention** on unindexed votes table during voting burst
- **Single-threaded Realtime CDC** → every change event checked against 30+ subscribers sequentially

### Fixes Applied (verified working)
1. 7 database indexes on hot query paths
2. Debounced Realtime callbacks (500ms-1.5s depending on page)
3. Replaced 8-second polling fallback with 60-second reconciliation
4. Narrowed SELECT columns on LiveTicker
5. Split Around the League refetch into separate concerns
6. Added phase change retry + error banner on Center Court
7. Added connection indicator on Center Court
8. Vote race condition guard (per-idea isMutating ref)
9. Scoped Realtime subscriptions to specific events (UPDATE)
10. Error handling on all AI streaming routes + insert paths
11. API key validation on all 6 AI routes
12. Global error boundary
13. Upgraded from Micro to Small compute (60 → 90 max connections)

### Supabase Tier Recommendations
| Workshop Size | Compute Tier | Max Connections | Monthly Cost |
|---|---|---|---|
| 10-15 people | Micro | 60 | Included with Pro |
| 20-30 people | Small | 90 | ~$15/mo |
| 30-50 people | Medium | 120 | ~$50/mo |
| 50+ people | Large | 160 | ~$110/mo |

### Connection Budget (Small compute, 30 users)
| Component | Connections |
|---|---|
| PostgREST (REST queries) | ~15 (from pool) |
| Realtime CDC | ~20 (reserved) |
| Other roles | ~5 |
| Application headroom | ~50 |
| **Total available** | **90** |

Peak observed: 57/90 during 30-client soak test (63% utilization).

### Key Supabase Realtime Limits (Pro)
| Resource | Limit |
|---|---|
| Concurrent connections | 500 |
| Messages/second | 500 |
| Channel joins/second | 500 |
| Presence events/second | 50 |

### Rules from the Postmortem
1. **Never use both REST polling AND Realtime for the same data.** The polling fallback was the accelerant.
2. **Index every column you filter or join on.** Full table scans under concurrent load cascade.
3. **Debounce all Realtime callbacks.** A single INSERT should not trigger 30 full-table refetches.
4. **Keep the Supabase Realtime Report open during the workshop.** It's free and shows problems before users notice.

---

## Monitoring During Live Workshop

### Dashboard Tabs to Keep Open
1. Supabase → Reports → Realtime (connected clients, message throughput)
2. Supabase → Reports → Database (connections, query time)
3. Supabase → Logs → Realtime (watch for UnableToCheckProcessesOnRemoteNode)
4. Vercel → Deployments → Functions (invocations, errors)

### Alert Thresholds (watch manually)
| Metric | Warning | Critical |
|---|---|---|
| Database connections | > 60 | > 80 |
| Realtime connected clients | > 40 | > 60 |
| Query execution time (p95) | > 500ms | > 2000ms |
| Realtime message latency | > 1s | > 5s |

### Emergency Playbook
1. **Database connections exhausted →** Upgrade compute tier (Settings → Compute, takes minutes)
2. **Realtime down →** Instruct participants to refresh phones
3. **Voting stuck →** Use admin page to manually set workshop_state
4. **AI coaches not responding →** Check Gemini API key, check Vercel function logs
5. **Check active connections:** `SELECT count(*) FROM pg_stat_activity;` in SQL editor
