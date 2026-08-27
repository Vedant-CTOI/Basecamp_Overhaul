# Coach modalities: how a machine's contribution becomes part of the room

Research brief, 2026-07-31. Answers the open question left in `voice-and-coach-modality.md`.

> **The question, verbatim (user):** "if we think this [streaming voice] is a logistical uphill battle, maybe we find other ways to make the coach's input dynamic and 'part of the experience' vs just a streaming line of a chat bubble? i wonder what other modalities people have experimented with."

The bar to beat is streaming TTS: ~1–2 dev-days, per-character runtime cost, one designated speaker device, an autoplay unlock gesture, and interruptible audio queueing. Everything below is measured against that.

---

## 0. The finding, up front

> **Reframing, 2026-07-31 (user ruling — this overrides the emphasis below and in §7).** The coach's
> content is usually **NEW MATERIAL**: "for the provocateur he's presenting new pushes, new things to
> think about, insights from yesterday you might've missed." It is *not*, in the common case, an
> annotation of the sentence the team just typed. So the operative question for this product is **how
> new material arrives with presence in a projected room** — where a group reads one screen together
> and cannot scroll back — not where a mark lands on the participant's words. That moves the arrival
> patterns (P1 The Plate, P2 The Develop, P8 The Dealt Card, P10 The Split-Flap) to the front, and
> demotes the annotation patterns (P3 The Marker, P4 The Margin Note, P5 The Struck Line) to a
> **SECONDARY mode**, for the minority case where a coach genuinely points at a phrase the team wrote.
> The evidence for anchoring in §4b still stands and is still worth building — it simply answers a
> different, rarer question than the one the coach is usually doing. Round 6 of `/card-lab`
> (`app/app/card-lab/arrival-round.tsx`, anchor `#arrival-round`) is the study built against this
> reframing: five arrivals, one variable. Findings in `docs/card-lab-arrival.png`.

Three independent literatures converge on the same answer, and it is not "add another output channel."

1. **The chat bubble's failure in a room is not that it's silent — it's that it's ADDRESSED.** A reply beside the idea is a private exchange the room is permitted to watch. Voice does not fix this; a synthesized voice is still addressed to whoever asked. The fix is to change *what the coach acts on*, not *how loud it is*.
2. **The strongest single move is to put the coach's contribution ON the team's own artifact** — the manuscript, the card, the board — rather than beside it. The group-AI literature is unanimous here (`group-ai-interaction-research.md` §3 Pattern 1, Pattern 6; the CHI 2024 brainwriting result; Miro's own Sidekick findings). Our left pane is already a live manuscript. The coach currently writes *next to* it. Nothing in the codebase stops it writing *on* it.
3. **Non-verbal signal is enormously cheaper per unit of presence than speech, and it is the only channel that is natively broadcast.** A sound addresses nobody and everybody; it layers under human conversation instead of occupying the conversational floor. But you get roughly *one* earned sound per session before meaning decays (Dingler et al. 2008; alarm-fatigue literature). Spend it.

The rest of this brief is the prior art, then twelve named patterns with verdicts, then the ranked five.

---

## 1. Family A — Ambient / peripheral / calm computing

### The mechanic
Bind a data stream to a continuous, low-resolution physical quality — motion, brightness, rate, position, sound density — rather than to a symbol that must be read. The channel is always on and never addresses anyone. You don't check it; you notice it changed.

Mark Weiser & John Seely Brown, *The Coming Age of Calm Technology* (Xerox PARC, 1995–96; in *Beyond Calculation*, Springer):

> "We use 'periphery' to name what we are attuned to without attending to explicitly."
> "Calm technology engages both the center and the periphery of our attention, and in fact moves back and forth between the two."
> "Things in the periphery are attuned to by the large portion of our brains devoted to peripheral (sensory) processing. Thus the periphery is informing without overburdening."

Their diagnosis of why screen-based monitors fail is the sentence that matters most for us: their symbols "require interpretation and attention, and do not peripheralize well." **A number is a task. A whirl is a texture.**

### Why it works
Channel separation, not volume reduction. Peripheral sensory processing runs in parallel and is cheap; symbolic interpretation is serial and expensive. Interruption research shows *resumption lag* is incurred even for interruptions merely perceived and not acted on (Ohly & Bastin, *J. Occupational Health* 2023) — so a peripheral signal that never crosses into the center costs near zero, while a notification costs a resumption lag whether or not anyone acts.

The most useful design tool in this literature is **Matthews, Dey, Mankoff, Carter & Rattenbury's Peripheral Display Toolkit** (UIST 2004), which defines five **notification levels**: *ignore → change-blind → make-aware → interrupt → demand-attention*. It converts "ambient vs. alert" into a five-position dial you assign per event type. "Change-blind" — the display changes but you won't catch it unless you look — is the level almost nobody designs for deliberately, and it is the correct level for most machine output.

Pousman & Stasko's *Taxonomy of Ambient Information Systems* (AVI 2006) adds four design dimensions — information capacity, notification level, representational fidelity, aesthetic emphasis — and five gating criteria: the information is important but **not critical**; it can move periphery↔focus and back; it has a tangible or environmental representation; updates are **subtle**; and it is aesthetically appropriate to the room.

### Named examples
| Thing | Who / when | Mechanic |
|---|---|---|
| **Dangling String / "Live Wire"** | Natalie Jeremijenko, artist-in-residence, Xerox PARC, ~1995 | 8-ft plastic spaghetti on a ceiling motor wired to the Ethernet cable; one packet = one twitch. Busy network → mad whirl and a characteristic noise; quiet → a twitch every few seconds. Hung in an unused hallway corner. Within a day people "commented upon it like the weather." |
| **ambientROOM** | Ishii, Wisneski, Brave, Dahley, Gorbet, Ullmer, Yarin — MIT Tangible Media, CHI 1998 | Whole-room ambient media: light, shadow, sound, airflow, water ripples on the ceiling as background bits. Part of Tangible Bits. |
| **Informative Art** | Lars Erik Holmquist & Tobias Skog, Viktoria Institute, ~2000–03 | A live Mondrian: rectangle color and size encode bus departure times, weather, email volume. Deployed publicly to ~300 users. Borrows an art style so the display is legitimate wall decor when nobody is reading it. |
| **Ambient Orb / Umbrella** | Ambient Devices (David Rose et al.), MIT Media Lab spinout, 2001; Orb 2002 | Frosted glass ball, one variable mapped to a color spectrum, showing *trend* not value. Umbrella handle glows when rain is forecast. |
| **Enchanted Objects** | David Rose, 2014 | The thesis: embed information in ordinary objects rather than a glass rectangle. |
| **Calm Technology, 8 principles** | Amber Case, O'Reilly 2015 | 1. Require the smallest possible amount of attention. 2. Inform and create calm. 3. Make use of the periphery. 4. Amplify the best of technology and the best of humanity. **5. Communicate without speaking.** 6. Still work when it fails. 7. The minimum tech needed. 8. Respect social norms. |
| **Calm Tech Certified™** | Calm Tech Institute, founded May 2024; first class Jan 2025 | An 81-point standard across Attention, Periphery, Durability, Light, Sound, Materials. Requires all but the most crucial notifications **off by default**. |
| **Ambient display heuristics** | Mankoff, Dey, Hsieh, Kientz, Lederer, Ames — CHI 2003 | Purpose-built heuristics beat Nielsen's on ambient displays; 3–5 evaluators found 40–60% of known issues. Adds criteria Nielsen has no slot for: aesthetics, ambiguity, information decay. |
| **LangChain "ambient agents"** | Jan 2025 | Agents triggered by ambient signals rather than a chat turn — but they still shipped an **Agent Inbox** with *notify / question / review* states. Pure ambience wasn't sufficient. |

### What fails
- **Habituation — the wallpaper effect.** The dominant failure. A signal that never varies in *kind* becomes furniture within hours (see also *The Novelty Effect in Large Display Deployments*, EUSSET). Mitigation: **reserve amplitude** — run the ambient element at ≤20% of its expressive range 95% of the time so the 100% moment still lands.
- **Ambiguity.** Gaver, Beaver & Benford, *Ambiguity as a Resource for Design* (CHI 2003) argues ambiguity forces interpretation and personal engagement — genuinely useful in a *room*, where resolving it aloud together is participation. But only for low-stakes states. Ambiguity attached to a consequential state ("did our vote register?") is just a bug.
- **No scrollback.** Peripheral encoding has no history. Nobody can answer "what was it 30 seconds ago?" Every ambient channel needs a paired center-of-attention surface where the record lives — which is exactly the shape LangChain arrived at.
- **Infrastructure mortality.** Ambient Devices stopped transmitting in 2019; Brookstone's licensed units were bricked in 2018. Calm Tech principle #6 exists because of this. Our version: a venue network that flakes.
- **Accessibility.** Colour-only or motion-only encoding fails WCAG 1.4.1 (Use of Color) and 1.3.3 (Sensory Characteristics), and motion signals need `prefers-reduced-motion`.
- **The killer, for us.** *A projected main screen has no periphery — it IS the room's center.* True ambient signal has to live somewhere else: a second screen, participants' phones, or an edge of the projected frame that never carries content.

---

## 2. Family B — Co-located group AI (CSCW/CHI + products)

Full prior brief: `Projects/_research/ai-architecture/group-ai-interaction-research.md` (Mar 2026, ten papers, ten patterns). Its headline conclusion stands and is the spine of this document:

> "AI works best in groups when it contributes to a shared artifact (canvas, board, sticky notes) rather than conducting a conversation. When AI is conversational, it tends to dominate, and groups disengage."

### What that brief already established (cited, not repeated)
- **Reactive beats proactive.** 72% of participants preferred an @-mentioned agent over one that decided when to speak; proactive agents were read as "dominating the conversation" (Muller, Liao et al., IBM Research, IUI 2025). The facilitator needs a *throttle*, not an on/off switch. → §3 Pattern 1 of that brief.
- **Prominence cuts both ways.** Visible AI presence raises engagement but pressures teams toward unnecessary reliance; teams unanimously wanted agents in a **"subordinate role"** (CSCW/PACM HCI, Apr 2025). One participant: *"I want a tool that's clever, but I also enjoy finding the answer and feeling clever."*
- **AI as canvas contributor** reduces production deficits and expands the solution space (AI-Augmented Brainwriting, Shaer et al., CHI 2024; AIBA, ECIS 2025).
- **Pattern 6, AI Annotation on Existing Work**, and **Pattern 8, Dynamic Blocks (not Chat Bubbles)**, are the two patterns from that brief this document builds on most directly.
- **Pattern 7, Pre-Computed AI Drops**, is the cheapest presence mechanic in the whole literature — it eliminates the "watching someone type to an AI" dead time entirely.

### What's new since March 2026
- **Miro Canvas 26** (San Francisco, 19 May 2026) turned the canvas into a shared workspace where teams, third-party agents, internal **Sidekicks**, and automated **Flows** work side by side; Sidekicks understand "sticky notes, diagrams, documents, images, tables, and the spatial relationships between all of it." Shared AI Workspaces beta on Enterprise, GA expected Q3 2026, priced in AI compute minutes per agent. AI Workflows launched Jan 2026 at $20/member/month on Business.
- **Sidekick "AI Teammate" personas** — The Challenger, The Synthesizer, The Optimist, The Historian — are pitched as canvas participants that "offer voices often missing in the room." Voltage Control's facilitator write-up reports the finding that matters: **"participants started talking to each other more — not less — because they had a shared reference point to react to,"** and reframes AI error as useful ("it surfaces gaps and preferences fast"). Caveat noted honestly: the piece is aspirational and documents no interaction protocol or failure modes; treat the observation as a hypothesis, not a result.
- **MultiColleagues** (Quan, Albassam, Wu, Ding & Chin, 2025) — multi-agent system where agents converse *with each other*; 20-participant within-subjects study found stronger perceived **social presence** and higher-rated quality, novelty and elaboration versus a single agent. Relevant to us because we already have four coaches and currently run them strictly one-at-a-time.
- **"It makes you think": Provocations Help Restore Critical Thinking to AI-Assisted Knowledge Work** (Drosos, Sarkar, Xu & Toronto, 2025). Provocations = brief two-sentence textual prompts that critique the AI's own suggestion, delivered *concurrently with* the suggestion in a coloured box on the card. Qualitatively they triggered critical thinking at every Bloom level. **But**: no significant quantitative gain in shortlist diversity; provocations paradoxically correlated with *lower* reported belief that the AI could be wrong; users under time pressure dismissed them; and repeated provocations risk **warning fatigue**. This is the most important cautionary citation in the brief for us, because "provocation over evaluation" is one of our stated design principles.
- **I-Card** (CHI 2025) — a generative-AI-backed design method card deck: an Info Card collects project context, a Method Card gives personalised guidance, a Solution Card gives concrete examples. Proof that "AI output as a dealt card" is now a studied form, not just a workshop craft trick.
- **From Paper to Card** (Shin, Wang & Hsieh, CHI 2024) — LLM extracts design implications from papers, a text-to-image model illustrates them, output is a **card**. 21 designers found the implications "more inspiring and generative" as cards than as the original text. The same content, re-formatted as an object, was rated more useful.

### The mechanic that matters most here
**The seat-at-the-table framing is doing less work than the artifact framing.** Across Miro, brainwriting, IBIS agents, and the canvas studies, what produces group engagement is not that the AI has a persona or a voice — it's that its contribution lands **on a thing the group is already looking at, in a form they can accept, reject, or argue with.** Personas make output *interpretable* ("The Challenger says this is a safe bet" beats "AI suggests"); they do not by themselves make it *present*.

### What fails
- **Proactive agents get read as domineering** and get switched off.
- **Overreliance and prominence** — the more visible the agent, the more the team defers. Keep implied competence below actual competence.
- **Only 19.6% of facilitators use AI *during* facilitation** (SessionLab, State of Facilitation 2025) versus 85.8% for prep. The working target is **70% human conversation / 30% tech**, and "shiny-tool overload" is a named trap.
- **Warning/provocation fatigue** (Drosos et al.) — the fifth provocation of the day is furniture.
- Products in this space are **mostly remote-first**. Miro, Mural, FigJam and Stormboard all assume everyone has a laptop and a cursor. None of them solve "a room of thirty people looking at one projected screen." That gap is where this product lives.

---

## 3. Family C — Physical / tangible output

### The mechanic
Three distinct mechanics get bundled under "tangible." They fail differently, so keep them apart.

- **C1 · The print event.** A machine produces a physical thing *while the room watches*. The output is slow, audible and singular. The value is not the content — it's that the content arrived as an object with a birth moment. Nobody photographs a chat response; everybody photographs a thing coming out of a printer.
- **C2 · The blind draw.** A finite deck, one card at a time, drawn without choosing. You cannot browse, cannot compare, cannot get a second one. Oblique Strategies' whole power is **the refusal of a list**.
- **C3 · The token.** A physical object carrying a right — to speak, to vote, to hold the floor. It externalises a social rule so the facilitator doesn't have to enforce it out loud.

### Why it works
- **An object is scarce and indivisible.** Text in a pane is infinitely reproducible and therefore worth nothing to hold. A card can only be in one person's hand, which is what makes passing it a social act.
- **Slowness buys attention.** An AxiDraw "moves at about the speed of a human hand." That pacing is the feature. A thing that takes ninety seconds to appear gets ninety seconds of collective looking.
- **Interpretation, not instruction.** Eno's own framing in the 2001 edition: the cards "can be used as a pack, or by drawing a single card from the shuffled pack when a dilemma occurs in a working situation. **In this case the card is trusted even if its appropriateness is quite unclear.**" That sentence is the cleanest statement of provocation-over-evaluation anyone has written.
- **Instructions-as-artwork has a serious lineage.** Sol LeWitt's wall drawings (1968–2007) separate concept, instruction and execution; what trades hands is the certificate and the instructions, not the drawing. The strongest available frame for "the machine writes the instruction, the room executes it."
- **Simultaneous reveal defeats anchoring.** Planning poker's single design move — everyone commits privately, all flip at once — is a deliberate counter to anchoring, inherited from Delphi. Sequential reveal lets the senior voice set the number.

### Named examples
| Thing | Who / when | Detail |
|---|---|---|
| **Oblique Strategies** | Brian Eno & Peter Schmidt, first published **1975**, subtitled *Over One Hundred Worthwhile Dilemmas* | 7×9cm cards in a black box; 113 cards in the 500-copy first edition, 103 in the current fifth. Prehistory: Schmidt's *The Thoughts Behind the Thoughts* (1970, 55 letterpress sentences) and Eno's handwritten bamboo cards (1974), merged when they found they'd independently built the same system. Used by Eno on Bowie's *Low*, *"Heroes"* and *Lodger*; later by Coldplay and LCD Soundsystem. |
| **IDEO Method Cards** | IDEO, 2003 | 51 cards in four suits — **Learn / Look / Ask / Try**. Each card is one method plus a short story of when IDEO used it. Their own framing: "It's not a 'how to' guide — it's a design tool." |
| **Creative Whack Pack** | Roger von Oech | 64 cards in four suits — Explorer / Artist / Judge / Warrior, the four roles of the creative process. Also shipped as an iOS app, which is itself a datapoint on digitising a deck. |
| **Thinkpak** | Michael Michalko, Ten Speed Press | SCAMPER as a deck. |
| **I-Card** | CHI 2025 | A generative-AI design method deck: Info Card collects context → Method Card gives personalised guidance → Solution Card gives worked examples. Proof the form is now studied, not just craft. |
| **From Paper to Card** | Shin, Wang & Hsieh, CHI 2024 | LLM extracts design implications from papers, a text-to-image model illustrates them, output is a card. 21 designers rated the implications "more inspiring and generative" as cards than as the original prose. **The same content, re-formatted as an object, was rated more useful.** |
| **Little Printer** | BERG London, 2012 | Cloud-connected receipt printer. BERG closed Sept 2014 and every printer worldwide bricked when the servers went dark. Revived 2019 by **Nord Projects** on the community-built open-source *Sirius* backend; printing is literally `curl https://device.li/<key>`. |
| **tinyprinter.club** | ongoing community | The practical build path today: a Paperang P1 (or any ESC/POS thermal printer) + Raspberry Pi + `sirius-client`. Dithered 1-bit images. |
| **Poem/1** | Matt Webb (ex-BERG), Kickstarter early 2024, $150, 844 backers | An e-paper clock that writes **a new poem every minute** with an LLM. Webb's framing: "ambient computing and what happens when our technology is around us, in our space, instead of demanding attention in our pockets." **The closest existing answer to this brief's question, built by the person who made Little Printer.** |
| **Paper Signals / Little Signals** | Google Creative Lab (2017, with Isaac Blankensmith / Smooth Technology) and Google Seed Studio + Map Project Office (April 2022) | Voice-controlled papercraft on servos; then six ambient notification objects (Air, Button, Movement, Rhythm, Shadow, Tap). *Not* Nord Projects — worth getting right if we cite them. |
| **AxiDraw V3** | Evil Mad Scientist | Gallery-grade pen plotters are explicitly marketed on being quiet enough for exhibition spaces — drawing-as-performance is a recognised category. |
| **reacTable** | Jordà, Kaltenbrunner, Geiger, Alonso; premiered in concert 2005 | Translucent round table; physical pucks placed, turned and connected as modular-synth blocks, designed for *multiple simultaneous performers*. |
| **Siftables / Sifteo Cubes** | Merrill, Kalanithi & Maes, MIT Media Lab → CHI '12 | 1.5" wireless blocks with colour screens, aware of motion and of each other. **Commercially dead** — the post-mortem is the warning. |
| **Talking stick / talking circle** | First Nations and Native American practice | Only the token-holder speaks, and the *speaker* — not the leader — chooses who's next, distributing responsibility for participation. HCI descendant: *The Walking Talking Stick* (CHI 2023), a physical highlight button in walking meetings that improved both turn-taking and note quality. |
| **Tangible Bits** | Ishii & Ullmer, CHI '97 | The founding paper, ~5,000 citations. Proposes both foreground *grasp-and-manipulate* bits and background *ambient* bits. |

### What fails
- **Somebody has to own the box.** Transport it, power it, load paper, babysit the Bluetooth pairing, re-pair it when it drops. In a client workshop that person is not facilitating. Budget a body.
- **Bluetooth ESC/POS in a room with sixty phones and a hotel AP is unreliable.** The dependable topology is printer → USB → one laptop → the app, which makes the printer *stationary* and changes the choreography.
- **Throughput is the killer.** A receipt printer does tens of mm/sec; an AxiDraw is minutes per drawing. Neither can be a per-idea output. Both work only as a **one-per-block ritual**.
- **The artifact degrades.** Thermal output is not archival — the US National Archives notes it "may begin to deteriorate in as few as six months," attacked by heat, light, friction, markers and some plastic folders. If a printed thing is a client deliverable it must be digitised in parallel: the paper is the *moment*, not the record. Also specify BPA-free stock when sixty people handle paper all day.
- **Content freeze.** A printed deck cannot change after the run, and good stock has 3–6 week lead times. **AI-generated content committed to print is the worst of both worlds** — you pay for print rigidity and lose the responsiveness that justified the AI.
- **Token-passing has an irreducible trade.** It equalises conversation time and destroys spontaneous back-and-forth. You choose it per activity; you cannot design it away.
- **Objects on tables compete with the facilitator.** Anything on the table when you want eyes forward is attention theft.
- **Novelty decay measured at 1–3 weeks of repeated exposure.** This cuts *in our favour* for a one-day workshop and *against* us for a platform feature. A printer is a craft moment deployed once per engagement, not a recurring line item.

---

## 4. Family D — Typographic / editorial motion, and the editor's hand

This is the richest family for us, because it is the one our design world is already written in — and because it contains the only *empirical* evidence in this brief that marking up the artifact beats replying beside it.

### 4a. The critique of streaming (the thing we're currently doing)

**The mechanic.** Reveal tokens as the model emits them. The load-bearing metric is Time To First Token — 200–500ms with streaming versus 5–30s without. Two of the three usually-cited benefits (reduce *perceived* latency, demonstrate system activity, enable early termination) are about perception, not information. It is a progress bar made of content.

**Three findings that matter for a projected room:**

1. **Streaming outruns reading.** *Streaming, Fast and Slow: Cognitive Load-Aware Streaming for Efficient LLM Serving* (Hu et al., UIST 2025) establishes the mismatch: adult reading runs ~200–250 wpm ≈ 40–50 tok/s, while production LLMs stream at 50–100+ tok/s. Their conclusion is blunt — "streaming content faster than users can read appears unnecessary" — and their proposal is to *slow the stream down* based on inferred cognitive load. That is an admission that uniform token streaming optimises for the server, not the reader.
2. **Moving text costs comprehension, and a room can't regress.** The strongest evidence isn't from LLM UX at all — it's RSVP. Static text beats serially-presented text on comprehension, and the speed/comprehension trade bites around 250 wpm; Benedetto et al. (*Computers in Human Behavior*, 2015) found Spritz-style presentation "impairs literal comprehension and increases visual fatigue," because it eliminates the saccades and regressions readers *use* to integrate meaning. **A room reading a projected screen together has no ability to regress.** They cannot re-read line 2 while line 8 lands. Streaming punishes group reading harder than solo reading.
3. **The typewriter is already a costume.** Vercel AI SDK v5's `smoothStream` and every hand-rolled equivalent deliberately decouple network streaming from *visual* streaming — chunks arrive as fast as the network allows, then a client buffer meters them out at ~5ms/char. Our own `streamReply()` does exactly this at 18ms/word over pre-written text. We are not showing the room a window into a machine; we are showing them an animation. That's fine — but it means the animation is a *design choice with no truth obligation*, and can be replaced by any other arrival.

**Also:** WCAG 2.2.2 (Pause, Stop, Hide, Level A) covers content that auto-updates for more than five seconds. A thirty-second stream is squarely in scope, and `prefers-reduced-motion` is a sufficient technique for 2.3.3, *not* for 2.2.2 — an on-screen control is likely required, not just a media query.

**What the industry did instead.** OpenAI shipped **Canvas** (Oct 2024) as a side surface where the model edits "like a copy editor or code reviewer," then **removed it (May 2026)** in favour of inline **writing blocks** living in the thread — you edit the block, the model updates the block, conversation flows around it. That is the industry walking from *AI replies beside your text* → *AI operates on a persistent artifact* → *the artifact is the primary object*. Claude Artifacts is the same move.

Vitaly Friedman's *Design Patterns For AI Interfaces* (Smashing, July 2025) organises the space as Input / Output / Refinement / Actions / Integration, and his Output principle is explicitly anti-prose: render results as style lenses, maps, structured formats and forced rankings rather than paragraphs. His Refinement principle is the one we want: **let users highlight specific output sections for targeted refinement.** His integration stance — "be AI-second," enhance the existing mental model rather than forcing an AI-first paradigm — is the brief-level version of this document's thesis. Amelia Wattenberger's *Why Chatbots Are Not the Future of Interfaces* (2023) is the canonical short form: "Good tools make it clear how they should be used. And more importantly, how they should **not** be used."

### 4b. The editor's hand — annotation in place

**The evidence, and it is unusually strong.**

**AnchoredAI** (Lou, Crowley, Dodson & Yoon, 2025). 22 participants, within-subjects, essay revision: **anchored AI comments vs. chat-based LLM**.
- Chat made people paste **199.1 words per action**; anchored, **35.2** (t(21)=7.29, p<.001).
- Chat rewrote **22.5%** of the document; anchored, **6.8%** (p=.001).
- Agency, 5-point: *"I am the main contributor"* **4.0 anchored vs 2.3 chat** (p<.001); *"I was in control"* 4.1 vs 3.5 (p=.016); *"would put my name on it as reviewer"* 4.0 vs 3.0 (p<.001).
- **Anchoring cost more effort, and that was the point.** NASA-TLX mental demand 80.7 vs 51.8; effort 73.0 vs 41.4 (both p<.001). A participant: *"For Chat… I kind of just copy-pasted the whole revised essay. For Anchored… I had to actually think about changes I wanted to apply."*
- Mechanism worth stealing: the **Anchoring Context Window** — when a target span isn't unique, expand word → sentence → paragraph → section until the anchor disambiguates, then re-prompt with the expanded window; plus update-aware retrieval so a comment survives the text being edited underneath it.
- Stated open failure mode: untested at comment density — "excessive comments create visual clutter," and fine-grained spans were sometimes *too* fine.

**InkSync** (*Beyond the Chat: Executable and Verifiable Text-Editing with LLMs*, Laban et al., Salesforce Research, 2023) — executable edits directly in the document, with a three-stage safeguard: **Warn** (flag edits introducing new information), **Verify** (external check), **Audit** (post-hoc traceability of every auto-generated span). Two studies: more accurate, faster, better UX than chat.

**The counterweight, and it is serious.** Agarwal, Naaman & Vashistha, *AI Suggestions Homogenize Writing Toward Western Styles and Diminish Cultural Nuances* (CHI 2025). 118 participants, India and US, culturally grounded tasks with and without inline suggestions. AI use **increased both within-culture and cross-culture similarity** and pushed Indian participants toward Western style, changing "not just what is written but how." In a workshop whose entire value proposition is divergent ideas from a diverse room, an inline suggester is a homogenising pressure. This is the strongest argument for keeping the coach's marks **interrogative** (a question in the margin) rather than **substitutive** (a suggested rewrite).

### 4c. The mark systems themselves

**Proofreader's marks (BS 5261, first published 1976; revised BS 5261-2:2005).** A closed vocabulary of ~40 marks, each written **twice**: an in-text mark showing *where*, and a marginal mark showing *what*. The redundancy is the design — the margin carries the instruction so the text stays readable. The standard's own spec is remarkable: marks must be "clear, memorable, quick and easy to reproduce, using **no words, abbreviations or contractions** as marginal marks" — deliberately language-independent. That is an icon-system brief written in 1976, and it ports straight to SVG.

**Colour is already semantic.** Blue checking pencils sold in the US from the 1800s; Eberhard Faber two-colour pencils by 1873; by 1888 "blue pencil" was already a synonym for *edit* or *censor*. The classic pencil is Prussian blue / vermilion. **Non-photo blue** survives in comics because ortho film and scanners drop cyan — the mark is *present but non-reproducing*, which is a gorgeous model for a provisional machine layer. **"Stet"** — Latin *let it stand* — is the reject gesture, and it is marked **in the opposite colour to the mark it cancels**: a two-colour system in which *rejection is itself a visible mark* rather than an erasure. That is the best available analogue for "reject the machine's push and leave the trace." **Redline vs blackline** in legal practice gives you the other axis: red = provisional/in-progress, black = settled/of-record — two rendering modes of the same change.

**Marginalia as a form.** H.J. Jackson's *Marginalia: Readers Writing in Books* (Yale, 2001), a study of thousands of annotated books across three centuries, argues marginalia "reveals the intensity of emotion that characterizes the process of reading," and that readers talk in margins "not only to authors, but also to friends, lovers, and future generations." The margin is a register where you may be provisional, unfinished and emotional. **A reply is a claim; a marginal note is a reaction.** Named cases: Fermat, c.1637, in his Bachet Diophantus — the claim plus *"I have discovered a truly marvelous proof of this, which this margin is too narrow to contain"*, the most famous demonstration that the constraint of the margin is part of the meaning; David Foster Wallace's 300+ annotated books at the Harry Ransom Center; Nabokov's marked-up teaching copy of *Mansfield Park* and his annotated *Eugene Onegin*.

The design translation: **marginalia is the only annotation form where the machine's contribution is visibly subordinate in the layout hierarchy** — smaller, offset, in a different hand. That subordination is what buys it the right to be provocative. A margin is a provocation-shaped container. (Fermat is also the warning: marginalia written for the writer is cryptic to everyone else, and ours must be legible to strangers on first read.)

**Track Changes.** Gets right: the change is **on** the artifact, is **attributable**, and has a **pending** state — accept or reject, nothing committed until a human acts. That triad (on / attributed / pending) is the whole pattern, and every modern AI editor copied it. Gets wrong, from working editors: pages "become cluttered with strikethroughs, insertions, and comments" and **the markup itself hides new errors**; Google Docs is the worse offender because it has no equivalent of Word's **Simple Markup** toggle, so there's no clean read; performance degrades with many suggestions. Standard professional practice — *always read a clean copy after accepting* — is an admission of the failure. **Implication for a projected screen: you cannot show "All Markup."** Design for Simple Markup by default: a change bar or a single struck token saying *something happened here*, with the full mark revealed on demand.

**Modern in-place AI editing.**
| Product | Mechanic | Note |
|---|---|---|
| **GitHub Copilot** | **Ghost text** — ephemeral inline completion right of the cursor, Tab accepts / Esc dismisses. Copilot Edits shows inline diffs with per-hunk accept/reject | Ghost text is the lightest-weight pending state ever shipped: no chrome, no container, just a lower-opacity continuation of your own sentence |
| **Cursor** | Inline diff + accept/reject per block; **modifies existing text**, which is the substantive difference from Copilot | The Track Changes triad rebuilt for speed |
| **Notion AI** | Writes directly on the page; highlight → Edit with AI → accept / discard / **try again** | "Try again" is a third state Track Changes never had |
| **Grammarly** | **Underline + card**: colour-coded underline (red correctness, blue clarity, green engagement), hover → suggestion → accept or dismiss | The underline is the *locator*, the card is the *marginal mark*. BS 5261's two-part grammar rebuilt in HTML |

**The Grammarly failure mode is the most useful sentence in this section**, and it's from their own engineering team: *"users were less likely to accept these suggestions, [so] the team wasn't sure when it made sense to show them."* And the redeeming observation: users often **rewrite the sentence themselves** after seeing a suggestion, "but the suggestion still helps because it makes them pause and re-read something they would've otherwise skimmed past." **That is a machine contribution succeeding by being rejected** — which, for a provocation-not-evaluation product, is the target behaviour, not the failure case.

**Social annotation** is the group version, and its history is a graveyard: Mosaic shipped group annotations in 1993 and cut them because the server infrastructure wouldn't scale; Hypothes.is documented 50+ failed annotation projects (ThirdVoice, uTok, Google Sidewiki); Genius shipped genius.it as an annotation layer over any URL in 2015. The survivors — Hypothes.is, Perusall — are scoped to **a bounded group with a reason to read together**. Cui et al. (*BJET* 2024) report 91% completion of pre-class social-annotation activities across weeks 2–12, and instructors consistently report **quieter students participate more in annotation than in live discussion**. The transferable lesson: annotation-as-group-activity works when the group is bounded, co-present in purpose, and reading the same artifact on a deadline — which describes a workshop room exactly, and describes the open web not at all.

### 4d. Typographic motion as event

The unifying idea: **motion should mark the moment of arrival, then stop.** Every durable tradition here animates the *transition* and leaves a *static artifact*. That is precisely the opposite of streaming, which animates the content itself for its whole duration. It is also exactly our own law — *motion is an event, never a texture*.

- **Kinetic typography.** Saul Bass invented the form (*Vertigo*, *North by Northwest*). **Kyle Cooper's *Se7en* (1995)** is the hinge: the type was **scratched by hand onto the film stock with a needle**, communicating the killer's psychology before the character exists. The academic backing is Lee, Forlizzi & Hudson (CMU) — *Using Kinetic Typography to Convey Emotion in Text-Based Interpersonal Communication* (DIS 2006) and *The Kinetic Typography Engine* (UIST 2002): **how text moves is itself a channel of meaning, separate from what it says.** Failure mode: gimmick decay is severe and fast — *Se7en* "inspired countless knock-offs and was co-opted by the horror genre as a house style."
- **Split-flap / Solari.** Every character position cycles *through the alphabet* to reach its target; the board is never blank and never "loading." Solari di Udine, clockmakers since 1725; postwar, Remigio Solari with designer **Gino Valle**; **Compasso d'Oro 1956**; first sign sold to Liège station the same year; in the MoMA collection. **Why it solves our exact tension:** it gives duration and drama **without unreadable intermediate states that anyone is expected to read.** Nobody reads the intermediate flaps — they visibly announce themselves as machinery. Streaming's cardinal sin is that its intermediate states *look like readable text and aren't*. And the settle is a hard stop: the artifact is then static and fully legible for as long as the room needs. Cheap in CSS/JS (`react-split-flap-display`, `clip-path` + keyframe scrubbing). Constraint: a monospaced grid forces terse copy — arguably a feature, since it caps the machine's contribution length.
- **The wire bell hierarchy** — the most directly stealable thing in the whole survey, and native to our register. AP/UPI teletypes rang a bell count that told the newsroom how much to care *before anyone read a word*: **3 = Advisory**, **4 = Urgent**, **5 = Bulletin**, **10 (UPI) / 12 (AP) = Flash**. Five bells "would bring anyone not working on a deadline story to their feet and headed to the teletype room." A graded arrival vocabulary where the *manner* of arrival encodes the *weight* of the contribution. This is also the mechanism that prevents gimmick decay: a dramatic arrival stays meaningful only if most arrivals aren't dramatic.
- **Stop press / the fudge box.** British papers left a **deliberately blank box** in the layout for late news, filled by a mechanical "fudge" that clamped fresh Linotype slugs in after the run started. The lesson: **reserve the space in advance.** That is the anti-layout-shift pattern, invented in hot metal, and layout shift is the single worst offence on a shared screen where sixty people are tracking one line.
- **The ticker / zipper.** The Motograph News Bulletin, One Times Square, November 1928 — 388 ft × 5 ft, 14,800+ bulbs, headlines within a minute; ran to 1961. The TV crawl became universal on 11 September 2001. **Warning, and it applies to our wire directly:** a ticker is ambient, low-status and ignorable — the right form for background state, the wrong form for a contribution you want the room to reckon with.
- **The spike.** A literal metal spindle on the sub-editor's desk; rejected copy was impaled on it. Still a live verb ("the story was spiked") long after the object vanished. A rejection gesture with physical finality **and a visible pile of what was killed.**
- **The rubber stamp — and why to be careful.** Rubber stamps date to the 1870s; used on bureaucratic papers from ~1881 to show an office had seen and approved a document; the verb "to rubber-stamp" — approve routinely, without review — by 1889. **The failure mode is baked into the semiotics.** "Rubber stamp" *means* approval without judgment. If the machine stamps a human's idea, we inherit both "the AI is judging" and "the judgment is mechanical and worthless" — a double loss against our own principle that AI never scores or judges. Use the stamp's *form* (opaque, angled, over the text, instantaneous) only where the *content* is a provocation, not a verdict. A stamp that asks a question is a very different object from one that says APPROVED.
- **Strikethrough — the strongest single mark in this survey.** Cross the word out; leave it legible; both the word and its negation are present. Pedigree: *sous rature*, Heidegger's device extended by Derrida in *Of Grammatology* (1967) — a term "inadequate yet necessary." Eye magazine's feature *Strikethrough* traces the design lineage: Iranian banknotes (1979) overprinted over the Shah's portrait, the face still visible; Rodchenko hand-inking purged leaders out of *Ten Years of Uzbekistan*, the bodies still visible; Karel Martens' overprint; Leo Fitzmaurice's term **"visible absence."** It is the only mark here that is simultaneously (a) applied **to** the participant's own words, (b) **non-destructive** — the original stays readable so the room can still see what was said, (c) **legible at projection distance** — a horizontal rule through a word survives distance far better than an underline, a caret or a marginal glyph, (d) carrying a two-century semiotic charge the room reads without instruction, and (e) one line of CSS. Failure mode: it reads as *deletion* and therefore *judgment* unless the surrounding grammar reframes it — mitigated by the stet-style opposite-colour reversal, or by the non-photo-blue logic of a mark that is visibly provisional.

---

## 5. Family E — Spatial / projection / room-scale

### The mechanic
- **E1 · The board everyone looks up at.** One shared surface changes state, and the change is legible from across the room and animated or audible enough to summon attention without a verbal cue. Split-flaps clack; the needle moves; the jumbotron cues with a song.
- **E2 · Phone as private input, screen as public payoff.** Personal devices carry secret or individual information; the shared display is the only place the collective result exists.
- **E3 · Projection as environment.** Output stops being *on a rectangle* and becomes *on the room*. Ownership shifts from "the presenter's slide" to "the space we're standing in."
- **E4 · The reveal.** Blackout, hold, then light. Time-based staging that makes a shared object *arrive* rather than merely appear.

### Why it works
- **A shared surface measurably changes group behaviour.** With a shared display, participants sat closer together, showed more on-task communication and less leaning/reaching, and felt more efficient (Inkpen et al., HCII 2005). In a wall-display + mobile study, pairs looked at the *same* device ~76% of the time; the remaining ~24% is your realistic budget for phones (arXiv 1904.13364).
- **Simultaneity is the point.** A shared screen creates a moment where the whole room's attention is provably in one place at one time. Nothing in a message pane can do that.
- **The blackout is physiologically real.** Theatre practice: a fade to black at the top of a show produces an audible, collective intake of breath; a sudden wash "pulls every eye in the room without anyone realizing they were guided." Museum lighting does the same in space — accent light makes the object the centre and lets the periphery recede.
- **"Relational" beats "interactive."** Lozano-Hemmer coined **Relational Architecture** deliberately: *"'relational' meant something more lateral and networked, about establishing relationships, whereas interactivity seemed one-way."* That is our v2 interaction thesis with a twenty-five-year-old citation.
- **Motion reads as meaning whether you intend it or not.** The NYT election needle jittered *deliberately* — random movement within the 25th–75th percentile of simulated outcomes, encoding uncertainty, because a static value would have implied false certainty. Readers experienced it as dread. Any live-moving aggregate on a shared screen will be read as a verdict about whose idea is winning, however it's labelled.

### Named examples
| System | Who / when | Detail |
|---|---|---|
| **Colab / Cognoter** | Xerox PARC, 1987 | Purpose-built meeting room for face-to-face collaborative problem solving. Cognoter built shared mind maps: each person added nodes from their own PC to a public display, simultaneously, with a per-node edit lock. |
| **Liveboard** | Elrod et al., CHI '92 | Large pen-sensitive projection display, ~1M pixels, accurate cordless pen. Explicitly for "group meetings, presentations and remote collaboration." |
| **i-LAND / Roomware** | Streitz et al., CHI '99, GMD-IPSI | **DynaWall** (4.5m × 1.1m interactive wall, designed to replace walls of taped-up paper in project rooms), **InteracTable**, **CommChairs** (mobile chairs with built-in slates). Furniture built with Wilkhahn. |
| **LuminAR** | Linder, Kubat & Maes, MIT Media Lab, ~2010–12 | Projector + camera + computer in a **light-bulb form factor**, plus a robotic-arm lamp — redefining the desk lamp as a digital information device. |
| **IllumiRoom / RoomAlive** | Microsoft Research, 2013 / UIST 2014 | RoomAlive's building block is a **procam** (wide-FOV projector + Kinect + PC); each unit self-calibrates and self-localises, and multiple units build a unified room model with no user intervention. |
| **Lightform** | commercial, ~2018 | LF1 camera/computer bolted to any projector — the productised version. |
| **Relational Architecture** | Rafael Lozano-Hemmer | *Vectorial Elevation* (1999–2000): web participants aimed searchlights over the Zócalo. *Body Movies* (2001): projected portraits revealed only inside passers-by' shadows. |
| **teamLab Borderless** | Tokyo 2018 → Azabudai Hills 2024 | Artworks flow between rooms, respond to visitors, merge with each other. 2.3M visitors in year one. |
| **Studio Drift, *Shylight*** | Gordijn & Nauta; Rijksmuseum permanent collection | Silk "flowers" that unfurl and withdraw, based on nyctinasty. **Five years of R&D.** Stated goal: "to find life, emotion and personality in dead material," and to make viewers "slow down, look up." |
| **Solari split-flap** | see §4d | The defining property for a room: when multiple rows move at once you get a distinctive visual **and acoustic** cascade. |
| **The swingometer** | David Butler for the BBC, 1955 ("a speedometer type device"); Peter Snow 1969–2005 | The election-desk ancestor of our Big Board. |
| **Kiss cam** | California ballparks, early 1980s | Invented specifically to fill gaps in play using the then-new giant screens. The crowd is *cued* — a known song or an announcer — then collectively holds its breath. The 2025 Coldplay incident is the modern cautionary tale about non-consensual big-screen exposure. |
| **Jackbox Games** | the canonical second-screen implementation | Players go to a URL and type a **short room code shown on the main screen**. No app, no peripherals. The mechanic that matters: the game sends each phone **unique information only that player can see** — "You can't do that on the PlayStation controller, because you can't assign player roles like that." Founder Harry Gottlieb's **Jack Principles**: maintain pacing (limit choices, one task at a time, players always know what's next); create the illusion of awareness; maintain it. |
| **Kahoot vs Mentimeter** | | Kahoot is speed + leaderboard; Mentimeter deliberately has **no leaderboard and no speed emphasis** — "it's about participation and insight." For ideation, Kahoot's model is wrong and Mentimeter's default is right. |

### What fails
- **Brightness is the number one killer.** A hotel ballroom with houselights up eats a 5,000-lumen projector, and you often can't dim the room because people need to write.
- **Scalers destroy typography.** Venue AV takes your HDMI, rescales it, and 14px labels become mush from row four. Design for 1080p, enormous type, extreme contrast, and test from the back of the actual room.
- **Who owns the screen.** In a real client workshop the main screen is running the agenda deck from the AV booth. Getting the app up means a laptop switch — a 30–60 second dead moment *every time* — or a second dedicated screen, which splits attention. Decide at intake, not on the day.
- **Geometry.** Projection-on-architecture reads as magic in a dark, oriented space; in a daylit ballroom of round tables, half the room has its back to the wall.
- **Mapped projection needs the actual room.** RoomAlive-class calibration is a half-day on site. Never promise it without a site visit.
- **The network fights you.** Venue guest wifi caps device counts, throttles, and blocks WebSockets. Everything phone→screen must degrade to polling, and a travel router + local server is the contingency that makes the room work with zero internet.
- **Room codes must be short and unambiguous** and readable from the back (avoid 0/O and 1/I/l). Jackbox uses four letters for exactly this reason.
- **Phones are the mechanism by which a room goes heads-down.** Jackbox's discipline is that the phone is a *low-information input* and the payoff lives **only** on the shared screen — the joke is never on your phone. Break that rule and you've built a message pane with extra steps.
- **Never put an identifiable individual on the big screen without explicit opt-in.**
- **Novelty decay again.** A projected wow moment used four times in one day is a wow, a shrug, a wait and an eye-roll. Budget one or two room-scale peaks per day, never a continuous mode.

---

## 6. Family F — Non-verbal signal: sound, light, motion as the coach's voice

### The mechanic
Two rival grammars, published side by side in *Human-Computer Interaction* vol. 4 (1989). The distinction is load-bearing.

**Earcons** — Blattner, Sumikawa & Greenberg, *Earcons and Icons: Their Structure and Common Design Principles*. **Abstract, musical, learned.** Short rhythmic/pitch motifs built compositionally: a base motif for "file," a transform for "delete," so "delete file" is derivable. Scales to a vocabulary; costs a teaching burden per symbol.

**Auditory icons** — Bill Gaver, *The SonicFinder: An Interface That Uses Auditory Icons*. **Everyday sounds mapped by analogy to everyday events.** Gaver's argument rests on *everyday listening* vs. *musical listening*: when you hear a sound in the world you don't hear pitch and timbre, you hear **what happened** — a heavy thing dropped on wood, a hollow container filling. Nothing to learn; the mapping is physics you already own. **Parameterized auditory icons** are the important extension: don't play a fixed clip, modulate one sound continuously by data.

### Why it works
**ARKola** (Gaver, Smith & O'Shea, CHI 1991) is the canonical shared-space result. A simulated cola bottling plant: 9 machines, two teams who could each only see part of the plant, up to 14 concurrent auditory icons — the nut dispenser made wooden impacts, the heater whooshed, the capper clanked. Rhythm encoded machine *rate*; **absence of sound encoded breakdown**. Two findings, both about rooms:

- **Sound made collaboration happen.** Hearing events in parts of the plant they couldn't see prompted operators to coordinate. Audio was a shared substrate the visual displays could not provide. This is the strongest empirical case in the literature for sound as the right channel for a *group*: it is inherently broadcast, undirected and simultaneous. Nobody has to be looking.
- **It also broke.** Too many concurrent sounds produced confusion and left some processes entirely unattended. The same paper is the best argument for and the best warning against sonic ambience.

**Learnability, quantified.** Dingler, Lindsay & Walker (ICAD 2008) compared auditory icons, earcons, spearcons (speech compressed past intelligibility) and plain speech: **spearcons were as learnable as speech; earcons were dramatically harder.** Auditory icons landed between. Practical rule: **under ~5 distinct events, auditory icons or one abstract chime are fine. An abstract sonic vocabulary larger than that will not be learned inside a one-day workshop.**

**Semantic-free utterance.** Yilmazyildiz, Read, Belpaeme & Verhelst, *Review of Semantic-Free Utterances in Social Human-Robot Interaction* (IJHCI 32(1), 2016). SFUs = vocalizations with no semantic content and no language dependency, in four types: Gibberish Speech, Non-Linguistic Utterances, Musical Utterances, Paralinguistic Utterances. The survey's key claim: listeners show **categorical perception at the level of inferred affective meaning** when hearing robot-like sounds — people reliably sort machine noises into emotional categories even though the noises mean nothing. Every cited exemplar is fiction (R2-D2, WALL-E, the Minions, The Sims), which is itself the finding: the proof-of-concept medium is entertainment, not products.

Why non-verbal beats speech *for a room specifically*:
- **No turn-taking cost.** Speech occupies the conversational floor and forces the room to stop talking. A chime layers under human speech.
- **No addressee problem.** Synthesized speech implicitly addresses *someone*. A sound addresses the room.
- **Density.** Eno's Windows 95 brief specified **3.25 seconds**. Most UI confirmations are under 500ms. A sentence is 4–8 seconds. Information per second is far higher.
- **No uncanny valley of competence.** Speech makes an implicit claim to understanding. A tone claims only that something happened.

### Named examples
**Sonic branding / sound as confirmation of a real event**
- **Brian Eno, Windows 95 startup (1995).** The brief: "inspiring, universal, optimistic, futuristic, sentimental, emotional… and it must be 3¼ seconds long." Inducted into the US National Recording Registry. Takeaway: an extreme duration constraint plus a list of emotional adjectives is a *complete* creative brief for this medium.
- **Jim Reekes, Mac startup chime (1991, Korg Wavestation).** Its actual job was reassurance after a successful power-on self-test — a *diagnostic* experienced as a greeting. Reekes on its removal: *"it's like sitting down at a restaurant and there's no one there to greet you."* That is the model: a sound that reports a real machine event and is received as personality.
- **Apple Pay confirmation** — a two-tone chime designed in lockstep with the checkmark animation and the haptic. Apple's WWDC19 "Designing Audio-Haptic Experiences" is the canonical reference on co-designing sound + motion as one event.

**Non-verbal character expression**
- **Kismet** — Cynthia Breazeal, MIT Media Lab, late 1990s. 15-DoF face; ears perk or fold; brows furrow; four lip actuators; a **proto-language of babble** via DECtalk varying pitch, timing and articulation to carry affect. Expressiveness came from a handful of continuously-variable parameters, not a library of canned states.
- **R2-D2 and WALL-E — Ben Burtt.** R2 was an ARP 2600 plus Burtt's own voice; Burtt wrote **actual English lines**, then performed them through synth filters — which is why the beeps have credible prosody. Method worth stealing wholesale: *write the sentence, then destroy it into sound.* The prosody survives; the words don't.
- **Anki Cozmo/Vector** — emotion engine authored by Carlos Baena, a ten-year Pixar animator (WALL-E, Finding Nemo), animating in Maya. Designed to **react to its own failure**: losing a game is a performance opportunity. The most transferable idea in the family — *the system's failure states are its best characterization opportunity.*

**Light and motion as state**
- **Theatre house lights.** The dim is the canonical room-scale attention transition, usually cross-faded against stage lights coming up. Zero explanation required, universally understood, works on a whole room at once. Free to borrow.
- **Status LED grammar.** A real, if degraded, shared language: green = ready, blue = working, red = error, amber = warning. **Breathing** (slow sine fade) = a persistent transitional state; **blinking** (hard on/off) = attention needed. The breathing/blinking distinction is the cheapest high-value item in this family — one CSS keyframe each.

**Ritual sound objects**
- The **expo bell at the pass**, rung when a dish is up and ready to leave the kitchen. The **gavel**, which "calls for attention or punctuates rulings and proclamations." The **temple bell**, which marks "the difference between mundane reality and ritual space and time." Common structure: **one strike, non-repeating, marks a discrete completed event, publicly witnessed, performed by an authority.** No ritual sound loops. No ritual sound is ambiguous about *whether* it happened.
- **The wire-service bell code** — and this one is native to our register. On AP/UPI teletypes: **3 bells = advisory**, **4 = urgent**, **5 = BULLETIN**, **10 (UPI) / 12 (AP) = FLASH**. Five bells "would bring anyone not working on a deadline story to their feet and headed to the teletype room." A graded, countable, non-verbal intensity scale that an entire newsroom learned and obeyed — the exact thing an Ogilvy-register product could inherit for coach intensity, and it is one audio file plus a repeat count.

### What fails
1. **Alarm fatigue — the fully documented worst case.** In clinical settings 72–99% of alarms are false; one annotated study found 88.8% of arrhythmia alarms false (AHRQ, *Making Healthcare Safer III*). Staff turn down, ignore or deactivate them; an FDA database analysis attributed 566 deaths (2005–2008) to missed alarms. **The law: a sound's meaning is destroyed by its false-positive rate, not by its design.** A perfect chime fired on a meaningless event is worse than no chime.
2. **Cacophony under concurrency.** ARKola's own negative result. With N participants acting at once, per-user event sounds collide. **Debounce and aggregate**, or make per-user events silent and sound only the aggregate.
3. **"What did that beep mean?"** Earcons are much harder to learn than speech (Dingler et al.). In a one-day workshop you get **one** sound with earned meaning, maybe two.
4. **Novelty decay into annoyance.** Visual ambience decays into invisibility; sound decays into *irritation* — you can't look away from it. Charming at 9am, hostile at 4pm. Budget frequency, not just volume.
5. **Room logistics.** Laptop speakers don't reach a room; venue AV routing is the most common failure point; browser autoplay policies block audio until a user gesture (the facilitator's first click); ambient room noise sets a floor that tasteful quiet design falls below. Sound also can't be aimed — everyone gets it or nobody does.
6. **Social-norm violation** (Calm Tech principle 8). A sound is a public act. Fired while a client executive is speaking, it reads as the vendor's software interrupting.
7. **Accessibility.** Sound-only excludes deaf and hard-of-hearing participants; light-only excludes blind and low-vision participants (WCAG 1.3.3, 1.4.1). **Rule: every event gets a sound AND a visible state change AND a persistent text trace.** The redundancy is also the "I missed it" answer.
8. **The anthropomorphism trap.** Jibo — $73M raised, shipped 2017 at $899, servers off March 2019 with a farewell dance — had *excellent* non-verbal expression and died anyway, because expressiveness raised a competence expectation the product couldn't meet while a cheaper Echo did more. Anki ceased operations April 2019 despite Pixar-grade animation. **Charm is not a value proposition, and charm that overpromises is a liability.**

---

## 7. Twelve patterns, with verdicts

Each is named, mapped to this codebase, and judged against the laws in `ogilvy-showcase-direction.md`. Cost estimates are for a competent front-end dev, measured against the streaming-TTS baseline of **1–2 days plus per-character runtime cost**.

---

### P1 · THE PLATE — kill the typewriter, land the reply composed
**Mechanic.** The coach's reply does not type. The layout **reserves its slot in advance** (the stop-press fudge box), holds a composing beat, then the whole page **arrives once** on `EASE`/`DUR.beat`, static and fully legible from that instant.

**Why.** Every argument for token streaming is an argument about one person waiting alone at a laptop. Hu et al. (UIST 2025) show streams outrun reading; the RSVP literature shows static text beats serial presentation on comprehension; **a room reading a projected wall cannot regress or re-read**. And our stream is already a costume — `streamReply()` walks pre-written `SHOWCASE_COACH_REPLIES` at 18ms/word. There is no truth being served by the animation. Reserving the slot also kills layout shift, the single worst offence on a shared screen.

**In our terms.** `CoachTakeover.tsx`: delete the word-walk loop in `streamReply()`; keep the 850ms gather (the three dots already read as "the coach is thinking"); render the finished `TypedPage` with the house arrival. The reserved slot is a min-height on the incoming page so nothing below it jumps. Esc-to-fast-forward becomes unnecessary and its `fastRef` machinery goes away.

**Verdict: ADOPT.** ~Half a day, removes code, and it is the one change that is unambiguously *more* on-brand — "state changes cut or swap once."

---

### P2 · THE DEVELOP — the reply arrives the way a print does
**Mechanic.** The plate doesn't fade in; it **develops**. Density gathers in grayscale first, then ink floods — the two-beat chemistry we already ship for Darkroom prints.

**Why.** It gives the arrival duration and materiality without animating the text itself, and it binds the coach to the house's existing metaphor instead of importing a new one. Round 8 item 3 already codifies the physics: "a develop is two beats, not a fade… never run a slow reveal on `EASE` by itself."

**In our terms.** `PrintReveal.tsx` is the reference implementation — `GHOST → DENSE → INK` over `DUR.settle` with `times: [0, 0.62, 1]`. Lift the same keyframe shape onto the coach page's `filter`/`opacity`. No new dependency, no new curve.

**Verdict: ADOPT.** ~2 hours. Pair with P1 — the plate is *what* arrives, the develop is *how*.

> **SUPERSEDED 2026-08-07 — do not build this.** The user removed the develop-in from the print system entirely (direction doc, Round 8 item 3, amended): "it doesn't feel necessary and would just be another thing that needs to configure for other clients/themes." `PrintReveal.tsx` is now a plain `<img>`, so the reference implementation this recommendation lifts from no longer exists. The plate (P1) stands on its own — copy arrives at full ink, in one beat, which is what `CoachTakeover` already does. This study is kept as the record of how that was decided.

---

### P3 · THE MARKER ON YOUR OWN WORDS
**Mechanic.** When the coach pushes on a specific phrase, the **china-marker draws around that phrase in the participant's own manuscript** — not in the reply panel. The coach's first act is to touch the team's artifact.

**Why.** This is the cheapest possible instance of the strongest finding in the brief: the group-AI literature is unanimous that AI contributions land when they're **on** the shared artifact (Pattern 1 and Pattern 6 in `group-ai-interaction-research.md`; the CHI 2024 brainwriting result; Miro's own Sidekick observation that a shared reference point *increases* human-to-human talk). And we already own the mark: it is the product's declared signature gesture, drawn in ~300ms on a real action.

**In our terms.** `ChinaMark.tsx` variants `underline` and `circle`, on the light register, obeying the Round 6 wax rule (`mix-blend-multiply`, 0.55–0.65, stroke ≤2.5) so the type stays the most readable thing on the page. Requires the coach reply to carry an anchor span — one extra field in the reply schema. For showcase mode, hand-author the anchors in `showcase-data.ts`.

**Verdict: ADOPT.** ~Half a day. Highest ratio of "the coach is in the room" per line of code in this document.

---

### P4 · THE MARGIN NOTE — the coach writes in the gutter, not the panel
**Mechanic.** The coach's contribution is **anchored marginalia**: a short note in the manuscript's right gutter, tied to the span it reacts to, set smaller and in the coach's colour — visibly subordinate to the participant's own words.

**Why.** This is the only pattern here with hard experimental backing. **AnchoredAI** (Lou, Crowley, Dodson & Yoon, 2025): anchored comments vs. chat, same model, same task — pasting dropped from 199.1 to 35.2 words per action; the share of the document rewritten by AI dropped from 22.5% to 6.8%; and agency rose sharply — *"I am the main contributor"* **4.0 anchored vs 2.3 chat**. Anchoring cost *more* mental effort (TLX 80.7 vs 51.8) and participants named that as the benefit. Separately, marginalia is the one annotation form whose layout hierarchy makes the machine visibly secondary, which is exactly what earns it the right to provoke. BS 5261's 1976 spec gives us the grammar for free: **an in-text locator plus a marginal instruction**, so the running text stays clean.

**In our terms.** The left pane of `CoachTakeover` is a manuscript of `<textarea>`s, which cannot host inline spans — so this needs a **marked read-mode**: when a coach note is live, swap the textarea for rendered text with the anchor span marked, and drop back to edit on click. Reserve a ~180px gutter at the 580px measure. Steal AnchoredAI's **Anchoring Context Window** (expand word → sentence → paragraph until the anchor is unique) if anchors ever come from a live model.

**Verdict: ADOPT — and this is the strategic one.** 1–2 days, i.e. the same cost as streaming TTS, for a change that alters what the coach *is* rather than how loud it is.

---

### P5 · THE STRUCK LINE AND THE STET
**Mechanic.** The coach strikes through a phrase in the participant's own text and puts its push in the margin. The participant can **stet** it — reject the strike, in the opposite colour, leaving a visible trace of the disagreement.

**Why.** Strikethrough is the strongest single mark in the survey: applied *to* the participant's words, non-destructive (the original stays readable so the room can still see what was said), legible at projection distance where a caret or a marginal glyph is not, carrying two centuries of semiotic charge (*sous rature*; the Iranian banknotes of 1979 overprinted over the Shah, face still visible; Rodchenko inking out purged leaders, bodies still visible), and one line of CSS. And the stet is the historically correct reject gesture: it is **marked in the opposite colour to the mark it cancels**, so rejecting the machine is itself a visible editorial act rather than an erasure.

**The trap.** Two independent findings say do not make this substitutive. Agarwal, Naaman & Vashistha (CHI 2025) show inline AI suggestions **homogenise writing toward Western styles** — poison for a room whose value is divergence. And Grammarly's own engineers report users frequently **rewrite the sentence themselves after seeing a suggestion**, and that this still helps "because it makes them pause and re-read something they would've otherwise skimmed past." A machine contribution succeeding by being rejected is precisely the target behaviour for *provocation over evaluation*.

**In our terms.** Strike = a 2px rule at the coach's colour on the marked span, on the light register only. Stet = the china-marker in red drawn back over the strike, plus a `STET` slug in Courier. So the interaction is: coach strikes → participant either rewrites (the point) or stets (the trace).

**Verdict: ADAPT.** Ship the strike as **interrogative** — it marks *where the coach is pushing*, and the margin says why. Never ship a suggested replacement string.

---

### P6 · THE BELL — one graded, non-speech sound
**Mechanic.** A single struck sound marks a coach's arrival. Intensity is carried by **repeat count**, on the wire-service grammar: **3 = advisory, 4 = urgent, 5 = bulletin, 10/12 = flash**. Nothing is spoken.

**Why.** Sound is the only natively **broadcast** channel we have: it addresses nobody and everybody, layers under human conversation instead of occupying the conversational floor, and carries no addressee — which is the specific thing that makes a synthesized voice still feel like someone else's private exchange. ARKola (Gaver, Smith & O'Shea, CHI 1991) is the empirical case: operators who could only see part of a plant **coordinated because of what they heard**, and audio was the shared substrate the visual displays could not provide. Eno's Windows 95 brief was 3.25 seconds; a sentence is 4–8. And the bell code is native to our register — a graded non-verbal intensity scale an entire newsroom learned and obeyed.

**The hard budget.** Alarm fatigue is the governing law: a sound's meaning is destroyed by its false-positive rate, not by its design. Dingler et al. (ICAD 2008) show abstract sonic vocabularies larger than ~5 items will not be learned in one day. **You get one earned sound per session, maybe two.** So the bell fires for the *arrival of a coach into a room-facing moment*, not for every reply.

**In our terms.** One mp3, one `<audio>` (we already keep one in `CoachTakeover`), a repeat count, and the same one-time autoplay unlock on the facilitator's first gesture that the TTS plan needed — except here it costs nothing per character at runtime. **Non-negotiable pairing:** every bell also gets a visible state change and a persistent text trace on the wire (WCAG 1.3.3 / 1.4.1, and it doubles as the "I missed it" answer).

**Verdict: ADOPT.** ~2 hours. This is the direct, honest substitute for voice, and it is roughly 1% of the cost.

---

### P7 · THE BOARD REACTS — the coach is present to the whole room
**Mechanic.** Coaching registers on the Big Board and the wire while it happens, so the coach is a fact the room can see even when one team is at one laptop.

**Why.** Weiser's argument only holds on a surface that is *not* where attention already is — and the Big Board is exactly that when the Stage holds the room. This is the one honest place for ambient coach presence. Pousman & Stasko's gate is satisfied: important but not critical, subtle updates, aesthetically native to the surface.

**In our terms.** ~90% already built. `app/big-board/page.tsx` already emits a `COACHED` wire event and carries a **Coached** counter with serif numerals. Add: the coach's own colour and monogram on the wire event (`The Provocateur pushed "…"`), and let the Coached numeral **tick** rather than swap (numbers tick — counting is information). Assign the notification level explicitly, per Matthews et al. (UIST 2004): this is **change-blind**, not *interrupt*.

**Verdict: ADOPT.** ~Half a day, and it uses machinery that already ships.

---

### P8 · THE DEALT CARD — one provocation, no list
**Mechanic.** The coach's provocation arrives as a **single card, dealt face-down and flipped**. No list of options, no "regenerate," no next-card button.

**Why.** This is Oblique Strategies' entire mechanic and it is the refusal of a list. Eno's own 2001 instruction: draw one card "when a dilemma occurs in a working situation. **In this case the card is trusted even if its appropriateness is quite unclear.**" That sentence is the cleanest statement anyone has written of *provocation over evaluation* — which is one of our declared principles. Empirically, the form travels: *From Paper to Card* (Shin, Wang & Hsieh, CHI 2024) found 21 designers rated the **same content** "more inspiring and generative" as cards than as prose; I-Card (CHI 2025) formalises a generative-AI method deck. And it is a one-line design constraint: **six AI suggestions in a column IS a message pane.**

**In our terms.** We already have the card grammar — frame number, slug line, stamps, the china-marker, `PrintReveal`. A coach provocation rendered in that grammar is a Basecamp object, not a chat message.

**Verdict: ADOPT.** ~Half a day inside the takeover; a day to make it a Stage object. Prototype it in `/card-lab`.

---

### P9 · THE HOUSE LIGHTS
**Mechanic.** Before a coach moment, the surrounding surface **recedes** — the board dims to a scrim over ~800ms, the object sits under light, and the room comes back after.

**Why.** Theatre's fade-to-black reliably produces an audible, collective intake of breath, and a sudden wash "pulls every eye in the room without anyone realizing they were guided." Museum accent lighting does the same in space. It costs nothing and requires no explanation.

**In our terms.** We already do a version of this — `CoachTakeover` mounts a `rgba(16,15,17,0.96)` scrim, glides the manuscript to the desk and draws the red rule down the seam. The work is to **name it as a primitive** in `lib/motion.ts` and reuse it for the Stage's coach moment, rather than leaving it as one component's bespoke arrival.

**Verdict: ADOPT.** ~2 hours to extract. Already the settled reference for the whole house motion grammar.

---

### P10 · THE SPLIT-FLAP FLASH — the coach's line lands on the Stage
**Mechanic.** One room-facing coach line arrives on the Stage as a **split-flap settle**: every character position cycles through the alphabet to its target, clacks, and stops.

**Why.** It solves our exact tension — duration and drama **without unreadable intermediate states anyone is expected to read.** Nobody reads the intermediate flaps; they visibly announce themselves as machinery. Streaming's cardinal sin is that its intermediate states look like readable text and aren't. And the settle is a hard stop: fully legible for as long as the room needs. Solari has the pedigree (Gino Valle, Compasso d'Oro 1956, MoMA collection) and the acoustic cascade is half the effect.

**The costs.** It is a third moving element on a surface whose law says **nothing moves while type is being read on stage**, and gimmick decay is fast. The monospaced grid also caps the line at ~30 characters — arguably a feature, since it forces the coach's room-facing contribution to be a *line*, not a paragraph.

**In our terms.** `clip-path` + keyframe scrubbing, or `react-split-flap-display`. Set in Ogilvy Sans Bold caps (no serif at that treatment; no coloured display type on dark, per Round 7 item 5). Fire it **once per session**, as a declared peak alongside the results reveal and the winner moment.

**Verdict: ADAPT — Stage only, once per session, budgeted as a peak.** ~1 day. If it can't be held to once, reject it.

---

### P11 · THE ROOM ANSWERS — phone as private input, Stage as public payoff
**Mechanic.** The coach asks **the room** a question. Everyone answers on their phone. The Stage shows only the aggregate — the answer exists nowhere else.

**Why.** This is the Jackbox mechanic, and it is the only pattern here that makes the coach's contribution *collectively owned* rather than watched. The discipline that makes it work: the phone is a **low-information input** and the payoff lives **only on the shared screen** — the joke is never on your phone. Break that and you have built a message pane with extra steps. It also answers the strongest objection in §9: if the room can participate in what the coach responds to, the exchange becomes a group artifact rather than a solo activity. Supporting evidence sits in `group-ai-interaction-research.md` Patterns 2, 3 and 10 (AI responds to aggregated group input, not one person's prompt), and in the shared-display literature (participants sat closer, more on-task communication).

**In our terms.** We already have room codes, a paper-register phone ballot, and a Stage with a control strip and a ballots-in counter. The build is a new phase in the workshop state machine plus a coach-prompt payload. Use Mentimeter's default, not Kahoot's — **no leaderboard, no speed pressure**; ranking is the opposite of provocation.

**Verdict: ADAPT.** 2–3 days, the most expensive thing on the list — but it is the only pattern that changes who the coach is talking to.

---

### P12 · THE PRINTED PROVOCATION — an object that leaves the room
**Mechanic.** A thermal printer in the room prints the coach's provocation, or the shortlist, as a physical thing people pocket.

**Why it's tempting.** There is genuinely no software substitute for an artifact leaving the room. Little Printer (BERG, 2012), its 2019 Nord Projects revival on the open-source *Sirius* backend, tinyprinter.club's Paperang + Raspberry Pi build, and Matt Webb's **Poem/1** (2024 — an e-paper clock writing a new LLM poem every minute) are the lineage, and Webb's framing is our question verbatim: "ambient computing and what happens when our technology is around us, in our space."

**Why it fails our bar.** Somebody must own the box — transport, power, paper, Bluetooth pairing — and in a client workshop that person is not facilitating. Throughput is tens of mm/sec, so it can never be a per-idea output. Thermal output is **not archival** (the US National Archives: deterioration "in as few as six months," attacked by heat, light, friction, markers and some plastic folders), so everything must be digitised in parallel. And the moment a mechanic needs a thing in a case, the delivery cost per engagement changes tier — which breaks the entire premise of this brief, which was to find something *cheaper* than streaming TTS.

**Verdict: REJECT as baseline; ADOPT as a per-engagement craft moment.** One printer, one ritual, at the close — the room's shortlist, printed once. Under $200 plus one owner, inside the novelty window for a single day. It belongs in the intake form under craft moments, not in the platform.

---

### Also rejected, and why

- **The stamp as the coach's verdict — REJECT.** The form is ours already (opaque, angled, over the text, instantaneous) but the semiotics are poisonous: "rubber stamp" has meant *approval without judgment* since 1889. A machine stamping a human's idea inherits both "the AI is judging" and "the judgment is mechanical." That is a double loss against our own principle that AI never scores or judges. A stamp that asks a question (`AND THEN WHAT?`) is a different object and would be allowed; `APPROVED` never is.
- **Ambient coach texture on the Stage — REJECT.** A projected main screen **has no periphery — it IS the room's centre.** Calling a moving element there "calm technology" is a category error, and it collides directly with our own law: nothing moves while type is being read on stage. Ambient coach presence belongs on the Big Board and the wire (P7), not the Stage.
- **The ticker as the coach's home — REJECT.** The wire is ambient, low-status and ignorable by design; that is the right form for background state and the wrong form for a contribution we want the room to reckon with. The coach may *cross* the wire (P7). It may not *live* there.
- **Streaming TTS as baseline — unchanged.** Keep pre-rendered audio for scripted moments; make runtime TTS a per-engagement toggle, as `voice-and-coach-modality.md` already recommends.

---

## 8. The ranked five — impact on "the coach feels present" ÷ build cost

| # | Pattern | Cost | Why it ranks here |
|---|---|---|---|
| **1** | **The Plate + The Develop** (P1 + P2) | **~half a day, and it deletes code** | Changes every single coach interaction in the product. The typewriter is already fake, actively harms group reading, trips WCAG 2.2.2, and contradicts our own "motion is an event" law. Replacing it with a reserved slot, a composing beat and a two-beat develop makes the reply *arrive* instead of *dribble* — and reuses `PrintReveal`'s chemistry so it reads as native rather than new. |
| **2** | **The Marker on Your Own Words** (P3) | **~half a day** | The first moment the coach touches the team's artifact instead of talking beside it. Uses a shipped component (`ChinaMark`) doing exactly what the direction doc says it's for — a hand-weight red stroke drawn when a real action happens. Nothing else in this brief buys as much presence for as little. |
| **3** | **The Bell** (P6) | **~2 hours** | The only natively broadcast channel available, and the honest cheap answer to "we wanted voice." Non-verbal sound addresses the room rather than a person, layers under human talk, costs nothing at runtime, and the wire-service bell code (3/4/5/10) is native to this edition's register. Hard budget: one or two firings per session, always paired with a visible state and a wire trace. |
| **4** | **The Margin Note + the Struck Line** (P4 + P5) | **1–2 days — the same as streaming TTS** | The strategic one, and the only pattern with experimental evidence: anchored comments beat chat on agency **4.0 vs 2.3**, cut AI rewriting of the document from 22.5% to 6.8%, and cost more mental effort *on purpose*. This is what "the coach writes ON the idea" actually means in build terms. Ship the strike interrogative, never substitutive — CHI 2025's homogenisation finding is the guardrail. |
| **5** | **The Board Reacts** (P7) | **~half a day on top of existing wire events** | The only *honest* ambient pattern for this product: the Big Board is a surface that isn't where the room's attention already is, so calm-technology logic actually applies. Makes the coach a fact the whole room can see while one team is at one laptop. Explicitly assign it the **change-blind** notification level — it must never interrupt. |

**Just outside:** the Dealt Card (P8) is a half-day and would rank third on impact alone, but it overlaps P1/P2 — the plate *is* the card if we render it in card grammar. Do them together and the ratio improves further. The Room Answers (P11) is the highest-ceiling pattern in the document and the only one that changes who the coach addresses; it is out of the top five purely on cost (2–3 days), and it is the right thing to scope for a live engagement rather than the showcase.

### What goes in `/card-lab`

`app/app/card-lab/page.tsx` is already the house's deciding room — four candidate treatments, real showcase rows, "DO NOT SHIP" at the top. Two option studies belong there, built the same way:

1. **The arrival study — BUILT, Round 6, `#arrival-round`.** Five candidates for how NEW MATERIAL lands, side by side, each replayable, with a play-all: **(A) today's typewriter** as the control, **(B) the plate** (reserved slot, one arrival on `EASE`/`DUR.beat`), **(C) the develop** (plate + `PrintReveal`'s `GHOST → DENSE → INK` over `DUR.settle`), **(D) the split-flap settle** in 3–4 chunks, **(E) the dealt card** (P8's arrival in the same register). Judged at projector distance and at 1280×720 — the whole point is a room reading together. **Result: C wins (as B+C — the plate is what arrives, the develop is how); E second and reserved for the once-a-session provocation card; B third, correct but too quiet alone; D fourth, a Stage peak only, since it costs the paragraph and decays fastest; A last on every criterion.** Comparison sheet: `docs/card-lab-arrival.png`. This settles recommendation 1 and confirms P10 does not earn a default slot.
2. **The margin-density study.** The same manuscript at three mark densities — one anchored note, three, and seven — plus the struck-line + stet treatment. AnchoredAI's own stated open failure mode is that it was never tested at density ("excessive comments create visual clutter"), and Track Changes' documented failure is precisely that markup hides what's under it. This is the study that tells us whether P4 ships as **Simple Markup by default** (a change bar plus one visible mark, full notes on demand) or as an always-on gutter.

The Dealt Card (P8) can ride along in study 1 as a fifth candidate, since it is a rendering of the same arrival in card grammar.

---

## 9. Contrary cases — where this whole direction fails

Written as the case *against* the recommendations above, so we can see it coming.

**1. A projected main screen has no periphery.** This is the deepest objection. Weiser's entire argument depends on a channel that is *not* where attention already is. The Stage IS the room's center of attention. Anything we put on it is by definition focal, not ambient — so "ambient coach presence on the projection" is a category error dressed as calm technology. The honest version: ambient signal in this product can only live on surfaces that are *not* the thing the room is looking at (the wire at the bottom of a working surface, a team's own laptop, the Big Board while the Stage holds the room). Everything else is theatre, and should be budgeted as theatre — a peak, not a texture.

**2. Attention theft: the coach competes with the humans.** Our own laws already say it — "nothing moves while type is being read on stage." Every mechanic here (a stamp landing, a bell, a mark drawing itself) is a bid for the room's attention, made by software, during a conversation between people. SessionLab's 2025 data says only 19.6% of facilitators use AI *during* facilitation and the working ratio is 70% human conversation to 30% tech. A coach that becomes more present becomes, at some threshold, the thing that stopped the room from talking. The failure is silent: nobody complains, the session just gets thinner.

**3. Novelty decay is fast, and it is faster for the good ideas.** The large-display novelty literature (EUSSET) and the ambient-display evaluation literature (Mankoff et al., CHI 2003) both find the same shape: an initial engagement surge, then stabilization at a much lower level, with short trials systematically overstating long-term value. In a one-day workshop we are *always* inside the novelty window — which sounds like good news and is actually a trap, because it means **we will never see the decay in a client session and will therefore over-invest in mechanics that would not survive a second deployment.** The mitigation is to design mechanics that are cheap enough to be disposable, or that are load-bearing (they carry information) rather than decorative.

**4. Provocation fatigue is empirically real.** Drosos, Sarkar, Xu & Toronto (2025) found provocations triggered critical thinking qualitatively but produced **no significant quantitative gain in outcome diversity**, and — the uncomfortable one — correlated with *lower* reported belief that the AI could be wrong. Users under time pressure dismissed them outright. A workshop is a time-pressured environment by design. Making the coach more present, more often, is the exact intervention this paper says decays.

**5. Alarm fatigue sets a hard budget on sound.** 72–99% of clinical alarms are false; the documented human response is to disable them. The transferable law is that **meaning is destroyed by false-positive rate, not by design quality.** If the bell fires on every coach reply, it is furniture by 11am. One or two sounds per session, tied to genuinely rare events, is the whole budget.

**6. Room logistics kill hardware.** Any pattern that requires a thermal printer, an e-ink card, a second projector or a physical token requires: someone to carry it, someone to set it up in a room they have not seen, a power outlet where the table is, a network that a corporate guest wifi will actually permit, and a spare when it jams. The Coke and Sprite deployments both ran on a projector and phones. The moment a mechanic needs a *thing in a case*, the delivery cost per engagement changes tier, and it stops being cheaper than streaming TTS — which was the whole point of this brief.

**7. The margin can be worse than the reply.** Marginalia, redlines and inline suggestions all clutter. Track Changes is the canonical case: a document with fifty pending suggestions is less readable than the original, and "suggestion fatigue" is a well-known failure. Our left pane is a *live manuscript the participant is editing*. Writing the coach into it risks making the participant's own draft unreadable at the exact moment they are trying to rewrite it — and unlike a chat bubble, a bad mark cannot be scrolled past.

**8. Ambiguity is participation only when stakes are low.** Gaver, Beaver & Benford's argument works for a wall piece and does not work for a state a client is paying to trust. "What is the coach doing?" is a delightful question at 10am on a low-stakes idea, and a credibility problem when a CMO asks it during the vote.

**9. Anthropomorphic charm overpromises.** Jibo and Anki both had best-in-class non-verbal expression and both died. Expression raises the competence expectation. A coach with a bell, a stamp and a hand that draws on your page implies a colleague. If the text underneath is a generic LLM reply, the gap is now *more* visible than it was in a chat bubble, not less.

**10. What would invalidate the recommendations.** If a facilitator can reliably make the room participate in a live projected exchange — everyone contributing via phones to what the coach responds to — then the conversational format becomes a group artifact and the "get off the chat bubble" premise weakens considerably. That is a real possibility and the Jackbox-shaped patterns below are the hedge against it.

---

## 10. Sources

### Internal
- `docs/ogilvy-showcase-direction.md` — the design contract these verdicts are judged against
- `docs/voice-and-coach-modality.md` — the streaming-TTS assessment this brief answers
- `app/components/CoachTakeover.tsx`, `ChinaMark.tsx`, `PrintReveal.tsx`, `Marks.tsx`, `LiveTicker.tsx`; `app/lib/motion.ts`; `app/app/big-board/page.tsx`; `app/app/card-lab/page.tsx`
- `Projects/_research/ai-architecture/group-ai-interaction-research.md` — ten papers, ten patterns, Mar 2026

### Ambient / calm computing
- Weiser & Brown, *The Coming Age of Calm Technology* (Xerox PARC 1995–96; in *Beyond Calculation*, Springer) — https://calmtech.com/papers/coming-age-calm-technology
- Matthews, Dey, Mankoff, Carter & Rattenbury, *A Toolkit for Managing User Attention in Peripheral Displays*, UIST 2004 — https://dl.acm.org/doi/10.1145/1029632.1029676
- Pousman & Stasko, *A Taxonomy of Ambient Information Systems*, AVI 2006 — https://faculty.cc.gatech.edu/~stasko/papers/avi06.pdf
- Mankoff, Dey, Hsieh, Kientz, Lederer & Ames, *Heuristic Evaluation of Ambient Displays*, CHI 2003 — https://dl.acm.org/doi/10.1145/642611.642642
- Gaver, Beaver & Benford, *Ambiguity as a Resource for Design*, CHI 2003 — https://dl.acm.org/doi/10.1145/642611.642653
- Ishii, Wisneski, Brave, Dahley, Gorbet, Ullmer & Yarin, *ambientROOM*, CHI 1998 — https://tangible.media.mit.edu/project/ambientroom
- Skog, Ljungblad & Holmquist, *Between Aesthetics and Utility: Designing Ambient Information Visualizations*, InfoVis 2003 — https://courses.ischool.berkeley.edu/i247/f05/readings/Skog_Ambient_InfoVis03.pdf
- Amber Case, *Calm Technology* principles — https://www.calmtech.institute/calm-tech-principles · Calm Tech Certified — https://www.calmtech.institute/
- Ambient Devices — https://en.wikipedia.org/wiki/Ambient_Devices · David Rose, *Enchanted Objects* — https://enchantedobjects.com/about
- *The Novelty Effect in Large Display Deployments* (EUSSET) — https://dl.eusset.eu/items/134bfb9e-105e-43da-a39f-05b734402e65 · Novelty effect overview — https://en.wikipedia.org/wiki/Novelty_effect
- Ohly & Bastin, *Effects of task interruptions*, J. Occupational Health 2023 — https://pmc.ncbi.nlm.nih.gov/articles/PMC10244611/
- LangChain, *Introducing Ambient Agents* (Jan 2025) — https://www.langchain.com/blog/introducing-ambient-agents · Agent Inbox — https://github.com/langchain-ai/agent-inbox
- Humane Ai Pin shutdown — https://www.axios.com/2025/02/18/humane-ai-pin-shut-down-hp

### Co-located group AI
- Muller, Liao et al. (IBM Research), *Controlling AI Agent Participation in Group Conversations*, IUI 2025 — https://dl.acm.org/doi/full/10.1145/3708359.3712089
- *Exploring Collaborative GenAI Agents in Synchronous Group Settings*, CSCW/PACM HCI 2025 — https://dl.acm.org/doi/10.1145/3757595
- *Exploring the Impact of Proactive Generative AI Agent Roles in Time-Sensitive Collaborative Problem-Solving*, CHI 2026 — https://dl.acm.org/doi/10.1145/3772318.3791592
- Shaer et al., *AI-Augmented Brainwriting*, CHI 2024 — https://dl.acm.org/doi/10.1145/3613904.3642414
- Quan, Albassam, Wu, Ding & Chin, *Towards AI as Colleagues: MultiColleagues*, 2025 — https://arxiv.org/abs/2510.23904
- Drosos, Sarkar, Xu & Toronto, *"It makes you think": Provocations Help Restore Critical Thinking to AI-Assisted Knowledge Work*, 2025 — https://arxiv.org/html/2501.17247v1
- *I-Card: A Generative AI-Supported Intelligent Design Method Card Deck*, CHI 2025 — https://dl.acm.org/doi/10.1145/3706598.3713934
- Shin, Wang & Hsieh, *From Paper to Card: Transforming Design Implications with Generative AI*, CHI 2024 — https://arxiv.org/pdf/2403.08137
- Voltage Control, *AI Teaming Comes Alive on the Miro Canvas* — https://voltagecontrol.com/blog/ai-teaming-comes-alive-on-the-miro-canvas/
- Miro Canvas 26 / Shared AI Workspaces (May 2026) — https://thenextweb.com/news/miro-ai-workspace-team-collaboration
- SessionLab, *State of Facilitation 2025* — https://www.sessionlab.com/state-of-facilitation/2025-report/
- NN/g, *Facilitating AI Workshops* — https://www.nngroup.com/articles/facilitating-ai-workshops/

### Tangible / printed provocation
- Oblique Strategies — https://en.wikipedia.org/wiki/Oblique_Strategies · https://enoshop.co.uk/products/oblique-strategies
- IDEO Method Cards — https://www.ideo.com/journal/method-cards
- Little Printer / BERG closure — https://www.dezeen.com/2014/09/09/little-printer-design-company-berg-to-close/ · Nord Projects revival — https://nordprojects.co/projects/littleprinters/ · tinyprinter.club — https://tinyprinter.club/
- Matt Webb, *Poem/1* — https://www.kickstarter.com/projects/genmon/poem-1-the-ai-poetry-clock · https://www.fastcompany.com/91015583/this-whimsical-clock-is-the-playful-gadget-ai-needs-right-now
- Google *Paper Signals* (2017) — https://experiments.withgoogle.com/paper-signals · *Little Signals* (2022) — https://littlesignals.withgoogle.com/
- Ishii & Ullmer, *Tangible Bits*, CHI '97 — https://dl.acm.org/doi/10.1145/258549.258715
- Jordà et al., *reacTable* — https://www.upf.edu/web/mtg/reactable · Merrill, Kalanithi & Maes, *Siftables* — https://dl.acm.org/doi/10.1145/2212776.2212374 · Sifteo post-mortem — https://www.technodabbler.com/sifteo-cubes-success-or-failure/
- Sol LeWitt wall drawings — https://listart.mit.edu/art-artists/wall-drawing-254-1975
- AxiDraw — https://axidraw.com/
- *The Walking Talking Stick*, CHI 2023 — https://dl.acm.org/doi/10.1145/3544548.3580986
- Planning poker / Delphi anchoring — https://en.wikipedia.org/wiki/Planning_poker
- Thermal paper permanence — https://www.pospaper.com/blogs/news/does-thermal-paper-fade

### Typographic arrival, annotation, the editor's hand
- Hu et al., *Streaming, Fast and Slow: Cognitive Load-Aware Streaming for Efficient LLM Serving*, UIST 2025 — https://arxiv.org/abs/2504.17999
- Benedetto et al., RSVP / Spritz comprehension, *Computers in Human Behavior* 2015 — https://www.sciencedirect.com/science/article/abs/pii/S0747563214007663
- Lou, Crowley, Dodson & Yoon, *AnchoredAI*, 2025 — https://arxiv.org/abs/2509.16128
- Laban et al., *Beyond the Chat: Executable and Verifiable Text-Editing with LLMs* (InkSync), 2023 — https://arxiv.org/abs/2309.15337
- Agarwal, Naaman & Vashistha, *AI Suggestions Homogenize Writing Toward Western Styles*, CHI 2025 — https://dl.acm.org/doi/10.1145/3706598.3713564
- Vitaly Friedman, *Design Patterns For AI Interfaces*, Smashing, Jul 2025 — https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/
- Amelia Wattenberger, *Why Chatbots Are Not the Future* — https://wattenberger.com/thoughts/boo-chatbots/
- OpenAI, *Introducing canvas* (Oct 2024) — https://openai.com/index/introducing-canvas/
- Grammarly Engineering on suggestion acceptance — https://www.grammarly.com/blog/engineering/accepting-multiple-suggestions/
- BS 5261-2:2005, proof-correction marks — https://committee.iso.org/sites/tc130/home/resources/articles/content-left-area/previous-articles/proof-reading-symbols.html
- Blue pencil (editing) — https://en.wikipedia.org/wiki/Blue_pencil_(editing) · Redline vs blackline — https://www.concord.app/blog/redline-vs-blackline
- H.J. Jackson, *Marginalia: Readers Writing in Books* (Yale, 2001) — https://yalebooks.yale.edu/book/9780300097207/marginalia/
- Fermat's margin — https://msuprovenance.wordpress.com/2013/10/29/the-marginal-note-that-sparked-one-of-maths-greatest-mysteries/
- Track Changes failure modes — https://sophiemichals.medium.com/editing-tip-always-read-a-clean-copy-after-tracking-changes-a79f9fa1b21d · https://carolinavonkampen.com/editing-in-google-docs/
- Hypothes.is on the annotation graveyard — https://www.technologyreview.com/2015/01/19/169606/is-genius-smarter-than-past-attempts-to-annotate-the-web/ · Cui et al., *BJET* 2024 (Perusall) — https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13403
- Eye magazine, *Strikethrough* — https://eyemagazine.com/feature/article/strikethrough · *Sous rature* — https://en.wikipedia.org/wiki/Sous_rature
- Lee, Forlizzi & Hudson, *Using Kinetic Typography to Convey Emotion*, DIS 2006 — http://www.cs.cmu.edu/~joonhwan/documents/p41-lee.pdf
- Kyle Cooper, *Se7en* titles — https://www.artofthetitle.com/title/se7en/
- WCAG 2.2.2 vs `prefers-reduced-motion` — https://hidde.blog/meeting-2-22-pause-stop-hide-with-prefers-reduced-motion/

### Spatial / projection / shared display
- Elrod et al., *Liveboard*, CHI '92 — https://dl.acm.org/doi/pdf/10.1145/142750.143052
- Streitz et al., *i-LAND / Roomware*, CHI '99 — https://dl.acm.org/doi/pdf/10.1145/302979.303010
- Jones et al., *RoomAlive*, UIST 2014 — https://www.hbenko.com/publications/2014/RoomAlive_UIST2014.pdf · IllumiRoom — https://www.microsoft.com/en-us/research/project/illumiroom-peripheral-projected-illusions-for-interactive-experiences/
- Linder, Kubat & Maes, *LuminAR* — https://spectrum.ieee.org/mit-luminar-robot-lamp
- Lozano-Hemmer, *Relational Architecture* — https://digicult.it/design/rafael-lozano-hemmer-relational-architecture/
- teamLab Borderless — https://www.theartnewspaper.com/2024/05/09/in-tokyo-teamlabs-giant-new-immersive-space · Studio Drift, *Shylight* — https://studiodrift.com/work/shylight/
- Solari di Udine / split-flap — https://en.wikipedia.org/wiki/Split-flap_display · https://www.solari.it/en/history/ · MoMA — https://www.moma.org/collection/works/91954
- The swingometer (David Butler archive) — https://www.nuffield.ox.ac.uk/people/sites/the-david-butler-archive/psephology/swingometer-and-swing/ · NYT needle — https://www.fastcompany.com/90459366/the-most-hated-data-visualization-in-politics-is-back-to-spike-your-blood-pressure
- Jackbox design principles — https://www.builtinchicago.org/articles/jackbox-games-design-party-pack
- Inkpen et al., display factors in co-located collaboration, HCII 2005 — https://web.cs.dal.ca/~hawkey/HCII2005_Inkpen.pdf
- Theatrical blackout — https://cherwell.org/2019/03/19/fade-to-black-a-history-of-the-theatrical-blackout/
- react-split-flap-display — https://github.com/robonyong/react-split-flap-display

### Non-verbal signal
- Gaver, Smith & O'Shea, *Effective Sounds in Complex Systems: The ARKola Simulation*, CHI 1991 — https://www.academia.edu/868866/Effective_sounds_in_complex_systems_The_ARKola_simulation
- Gaver, *The SonicFinder / Auditory Icons* — https://www.billbuxton.com/AudioUI06icons.pdf
- Blattner, Sumikawa & Greenberg, *Earcons and Icons* — see *The Sonification Handbook* ch. 14 — https://sonification.de/handbook/download/TheSonificationHandbook-chapter14.pdf
- Dingler, Lindsay & Walker, *Learnability of Sound Cues*, ICAD 2008 — https://www.icad.org/Proceedings/2008/DinglerLindsay2008.pdf
- Yilmazyildiz, Read, Belpaeme & Verhelst, *Review of Semantic-Free Utterances in Social HRI*, IJHCI 32(1), 2016 — https://www.tandfonline.com/doi/abs/10.1080/10447318.2015.1093856
- Wire-service bell codes — https://jacklimpert.com/2016/04/flash-bulletin-when-ten-bells-or-five-bells-really-meant-something/ · https://www.radioworld.com/columns-and-views/roots-of-radio/clackclackclackclackclack
- Brian Eno, Windows 95 startup sound — https://www.mentalfloss.com/article/50824/creating-windows-95-startup-sound
- Jim Reekes, Mac startup chime — https://reekes.net/sosumi-story-mac-startup-sound/
- Apple, *Designing Audio-Haptic Experiences*, WWDC19 — https://developer.apple.com/videos/play/wwdc2019/810/
- Breazeal, *Kismet* — https://robotsguide.com/robots/kismet
- Ben Burtt on R2-D2 — https://www.synthtopia.com/content/2008/07/07/r2-d2-sound-design-secrets/
- Alarm fatigue — AHRQ, *Making Healthcare Safer III* — https://www.ncbi.nlm.nih.gov/books/NBK555522/ · https://www.apsf.org/article/alarm-fatigue-and-patient-safety/
- Jibo's shutdown — https://techcrunch.com/2019/03/04/the-lonely-death-of-jibo-the-social-robot/ · IEEE Spectrum on Anki/Jibo/Kuri — https://spectrum.ieee.org/anki-jibo-and-kuri-what-we-can-learn-from-social-robotics-failures
- Stop press / fudge box — https://en.wikipedia.org/wiki/Stop_press · The spike — https://en.wikipedia.org/wiki/Spike_(journalism)
