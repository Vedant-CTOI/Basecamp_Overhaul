# Craft Moments

*The last 20% — ergonomic details and theatrical beats that turn a functional platform into a memorable experience.*

---

## Why This Matters

A feature-complete workshop platform without craft moments feels like software. With them, it feels like an event. The premium in the $75K-$150K tier lives here, not in the mechanics.

Clients won't articulate this in the intake. They'll say "make it feel special" or "we want it to be memorable." Your job is to translate that into specific craft moments and budget explicit time to build them.

---

## Craft Moments Aren't Random — They Serve Functions

Across every workshop build, the memorable moments cluster into the same five types. The imagery changes; the emotional function doesn't.

| Moment Type | Function | Coke Example | Sprite Example |
|---|---|---|---|
| **Opening ceremony** | Transitions the room from "ordinary day" to "we're in a thing together" | Olympic rings orbit in 3D; click your team, the ring swallows the screen | Room code unlock → AE dunk video plays over hero → panels slide in |
| **Phase transition** | Signals forward motion — "we're moving together" | Podium reveal animation | Interstitial flash ("VOTING IS OPEN — COMMERCIAL") |
| **Peak drama** | "This matters, pay attention" — anchors the room on a specific moment | Vote results sort animation (ideas reorder live) | Team platform crystallizes on team select panel |
| **Ambient energy** | "The room is alive" — fills dead air, creates atmosphere | Live activity ticker | Breaking news Shams/Woj-style tweets |
| **Closing recognition** | "We did something real" — gives meaning to the day's work | Synthesis report generation | Starting Lineup ceremony |

Once you see the functions, the patterns become reusable even though the execution stays bespoke.

---

## Design Principles

Short style guide that prevents bad versions of good ideas:

1. **Theatrics at the seams, efficiency at the surfaces** — ceremony is for transitions between phases, not for idea cards. Working surfaces stay fast and plain.
2. **Every moment has a "tell" before the payoff** — the video doesn't just play, the input glows first. The interstitial doesn't just appear, the button darkens for 100ms first. Anticipation sells the payoff.
3. **Domain-native metaphors only** — basketball workshop uses basketball imagery, music workshop uses music, fashion uses fashion. Don't mix. Don't borrow from a different world's vocabulary.
4. **Easing matters more than duration** — a 400ms `cubic-bezier(0.34, 1.56, 0.64, 1)` spring beats a 300ms linear every time. Custom easing is where craft lives.
5. **Projector test is pass/fail** — if it doesn't land on a 4K projector from the back of the room, it's not done. Laptop-only validation is insufficient.
6. **Nothing "just" happens** — every moment is sequenced: tell → reveal → settle. If it's instant, it's not a moment.
7. **Facilitator controls reveals** — peak drama is manually triggered, not automatic. The room should be watching when the thing happens.
8. **Silence beats clutter** — if a moment needs music or sound to land, the moment isn't designed right yet.

---

## What's Reusable vs Bespoke

**Reusable (the skeleton):**
- The moment taxonomy (opening / transition / peak / ambient / closing)
- Motion primitives: staggered entrance, interstitial flash, particle reveal, ticker crawl, 3D camera push
- The facilitator-controlled reveal pattern
- Projector-first rendering discipline
- Ambient layer architecture (ticker + activity feed + breaking news)
- Easing curves and timing vocabulary

**Bespoke (the costume):**
- The domain metaphor (basketball dunks, Olympic rings, music notes, runway walk)
- Specific imagery, video assets, and typography
- Exact copy and voice
- Peak moment staging (podium vs lineup vs relay handoff vs runway reveal)

The taxonomy is reusable. The texture is bespoke.

---

## How to Budget for It

The biggest mistake: treating craft moments as "polish we'll add at the end." Polish-at-the-end always gets cut when the timeline slips.

**Instead: reserve 3 days explicitly for craft moments**, scheduled like any other work:
- Days 1-2: platform config + data model
- Days 3-4: AI personas + strategic content
- **Days 5-7: craft moments (opening ceremony, peak beats, closing recognition)**
- Days 8-9: projector testing + facilitator rehearsal
- Day 10: buffer

If the moments don't get 3 days, you're quoting the wrong price.

---

## Intake Question That Captures This

Beyond the standard intake, ask the client:

> *"What are the 3-5 moments you want people to remember from this workshop? Describe the feeling, not the mechanic."*

Their answers become the brief for the craft layer. Even if they only manage generic answers ("we want it to feel big," "we want the teams to feel proud"), you've surfaced the emotional beats that need engineering.

---

## Example: Translating "Make It Feel Special" into Concrete Moments

| Client says | What to build |
|---|---|
| "It should feel like an event, not a meeting" | Opening ceremony with dramatic unlock — ticket/code/threshold metaphor |
| "Teams should feel competitive but collaborative" | Ambient layer that celebrates cross-team activity ("Team A just scouted 3 ideas — Team B is on fire") |
| "The creative platforms are the heart of the day" | Peak moment when a team's creative platform is "locked in" — visual ceremony, platform name crystallizes |
| "The output has to feel tangible, not a deck" | Closing recognition moment — Starting Lineup reveal with each idea elevated physically on screen |
| "It should feel like basketball / fashion / music / [domain]" | Every transition animation uses the domain's motion vocabulary (dunks, runway walks, drum fills, etc.) |

---

## The Real Point

These moments are where your fee comes from. The platform is the license; the moments are the experience. A good intake form surfaces them. A good build reserves time for them. A good delivery tests them on the real hardware in the real room before the real day.
