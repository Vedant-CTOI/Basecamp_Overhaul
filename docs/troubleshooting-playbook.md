# Troubleshooting Playbook — Live Workshop
*Print this page. Keep it at the facilitator's station.*

This is a generic facilitator-facing runbook. Customize the **Pre-Workshop Checklist** at the bottom per engagement (specifically the "Loaded?" labels — they reflect that engagement's content).

---

## 🔴 PAGE NOT LOADING / WHITE SCREEN
**What happened:** Browser can't reach the app.
**Fix:** Refresh the page (Cmd+R). If still broken: check WiFi connection. Try a different browser. Clear cache (Cmd+Shift+R).
**Escalate if:** Multiple browsers fail → message support channel. Likely a deployment issue.

## 🔴 SCREEN FROZEN / NOT UPDATING
**What happened:** Ideas aren't appearing, votes aren't counting, nothing changes.
**Fix:** Hard refresh (Cmd+Shift+R). Check the bottom ticker — if it's scrolling, the connection is alive.
**If ticker is frozen too:** WiFi dropped. Reconnect WiFi. A red "Reconnecting..." bar should appear briefly, then clear.
**Escalate if:** Hard refresh doesn't fix it → message support channel.

## 🟡 COACH NOT RESPONDING
**What happened:** Team clicks a coach in the Coaching room, nothing happens or error message appears.
**Fix:** Wait 10 seconds, try again. Coaches use Gemini AI — occasional slow responses are normal (10-15 seconds).
**If it keeps failing:** The Gemini API may be temporarily down.
**Backup:** Skip coaching for now. Teams can continue editing their ideas manually. Facilitators can give verbal feedback. Coaching is optional — the workshop works without it.

## 🟡 VOTING WON'T OPEN
**What happened:** Facilitator clicks "Open Voting" but nothing happens.
**Fix:** Check the Stage control strip at the bottom — does it say "VOTING OPEN"? If yes, voting is open — participants should see it on their screens.
**If participants don't see it:** Their pages may need a refresh. Ask them to refresh (Cmd+R).

## 🟡 ACCIDENTALLY CLOSED VOTING
**What happened:** Facilitator closed voting too early.
**Fix:** Just reopen it — click "Open Voting" again on the control strip. Existing votes are preserved.

## 🟡 ACCIDENTALLY BENCHED / REMOVED AN IDEA
**What happened:** Facilitator removed an idea from the Starting Lineup by mistake.
**Fix:** Go to the Starting Lineup view → expand "The Bench" at the bottom → find the idea → un-bench it.
**If it was demoted (not benched):** The idea is back in the results list — re-promote it.

## 🟡 IDEAS DISAPPEARED
**What happened:** Ideas that were visible are gone.
**Fix:** Check which category tab is active — ideas only show for the selected category. Check if they were benched (expand "The Bench" section). Check if the view switched (are you on Presenting vs Results vs Lineup?).

## 🟢 BREAKING NEWS NOT SHOWING
**What happened:** Facilitator triggered breaking news (Ctrl+Cmd+Shift+B or admin SEND NOW) but no toast appeared.
**Fix:** The shortcut only works on facilitator pages (Stage, Admin, Big Board). The toast appears for 5 seconds — you may have missed it. Try again.
**If from admin SEND NOW:** The AI needs a few seconds to generate the news. Check if "GENERATING..." appeared.

## 🟢 TICKER NOT SCROLLING
**What happened:** The bottom ticker bar is frozen.
**Fix:** Navigate away from the page and back — the ticker restarts when the page re-renders.
**Note:** The ticker is hidden on Stage (by design — it's visual noise on the projector).

## 🟢 PPTX EXPORT FAILS
**What happened:** Download PPTX button shows an error.
**Fix:** Check that there are ideas in the Starting Lineup (the button shows the count). If zero ideas → promote some first.
**If there are ideas but it still fails:** Check browser console for errors. Try refreshing the admin page first.

## 🟢 SLOW PERFORMANCE
**What happened:** Pages take a long time to load, interactions feel laggy.
**Fix:** This is usually WiFi congestion in the venue. Check that you're on a stable connection. Close unnecessary browser tabs.
**Note:** Stage is the heaviest page — it loads all ideas + realtime subscriptions. If it's slow, other pages (team pages, voting) should still be fast.

---

## PRE-WORKSHOP CHECKLIST

Go to Admin → Setup tab. The readiness check should show all green:
- ✓ Room code set
- ✓ Teams exist (3 teams)
- ✓ Strategic playbook loaded
- ✓ Category briefs loaded (one per category)
- ✓ Audience data loaded
- ✓ Partnership guardrails loaded
- ✓ Ideas seeded (if running a demo or starting from prior content)
- ✓ AI (Gemini) responding

**Also verify:**
- [ ] Projector connects and fonts are readable
- [ ] WiFi is stable on the projector laptop
- [ ] Support channel with on-call engineer is set up and tested
- [ ] This playbook is printed and at the facilitator's station
