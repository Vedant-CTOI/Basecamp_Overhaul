# Research: How the Best Products Mount a Hero Image

**The problem studied:** a hero image paired with a title + supporting text + actions — making the image feel like the epic embodiment of a thing while its information stays readable — plus the motion of entering and leaving image-first views.

**Our system under review:** the print pipeline — proof-print mat on idea cards (16:9 print on white card, title as caption beneath, `IdeaCard.tsx`) → full-bleed poster with content-height ink panel (`ExpandedCard.tsx`) → room-scale photo box (`PrintLightbox.tsx`) → contact sheet of 3 (`ContactSheet.tsx`). Laws in force: never crop a print (Round 9), ink panel solid at 0.94 (Round 8), motion is an event (Round 4), red discipline, serif law, portal zoom as the only travel metaphor.

Researched 2026-07-30. Sources at the end; per-reference citations inline.

---

## Part 1 — The survey (18 references, 5 families)

### Family A — Auction and collection detail pages

**1. Sotheby's (Pentagram identity + Your Majesty digital catalog).**
The Your Majesty case study frames the online catalog as "A Gallery of Stories" — a stroll through a gallery where each scroll is a window into a theme and its lots. Two principles quoted: *property-informed design* (the lot's subject matter dictates the surrounding style — the chrome adapts to the artwork, not vice versa) and *shortening the digital gap* — "elevating the experience through tangibility and a sense of physicality." Composition: artwork on a vast neutral field, caption block (artist / title / estimate) set small and beside or below, never on the image. Bid actions live in a separate persistent rail, never on the artwork. Monumentality comes from the ratio of image to everything else: the lot photo can be 80% of the viewport while its label is a business card.

**2. Sotheby's eCatalogue (Ekta Daryanani UX case study).**
The lot detail view has three explicit states: standard lot view → zoomed detail → 360° rotation. The immersive states are *earned* — you enter them from the composed page; they are not the default. Editorial context (slideshows, artist info, press) surrounds the lot rather than crowding the image.

**3. Christie's (Actum Digital replatform).**
The redesign goal was to "direct clients to explore more lots" through enhanced photography and immersive content — the image is the engagement engine; the page exists to serve it. The lot detail screen carries provenance and condition (the trust layer) below the image, and the mobile app was redesigned around the same lot-first hierarchy.

**4. Rijksmuseum (Fabrique / Q42).**
The canonical image-first museum site. Full-screen images across the entire site; the design ensures "the correct crop and size image regardless of screen size." The payoff interaction: "zoom in so far that you can see the crackle in the paint" — depth of detail as the reward for attention. On the collection object page (SK-C-5, The Night Watch): artwork first on a clean field, title + attribution immediately following, description and structured metadata *below*, a single explicit "Download image" action, related stories as a separate tile band. No text ever overlays the painting.

**5. MoMA collection object page (U. Oregon comparative analysis).**
Object on a white/neutral field, tombstone metadata (title, artist, date, medium, dimensions) in a fixed structured order beside/below. Participation buttons (save, share) are deliberately "smaller, less noticeable… institutionalized" — the actions defer to the object. The tombstone order is itself a designed artifact: every object gets the identical label grammar, which is what makes the collection read as a collection.

**6. The Leiden Collection deep-zoom viewer (Cuberis, OpenSeadragon).**
Deep zoom integrates into the catalog page — you "dive into the visual details." Two modes: a mouse-driven *curtain* revealing x-ray/infrared layers under the visible paint, and side-by-side comparison of a focus area. Museum deep-zoom viewers conventionally sit on a near-black ground (#111 in the reference implementation) with controls pushed to edges. The lesson: the zoom view is a different *room*, darker and quieter than the page that launched it.

### Family B — Editorial and photography

**7. Magnum Photos contact sheets (theory-and-practice pages).**
The alternating pairing: the iconic final photograph shown full-width, then its contact sheet beside/below it — the single and the field it was chosen from, always in dialogue. Edit marks (grease pencil) "come in, layered and superimposed" on the sheet — the mark of choice is part of the artifact. Captions are structured slugs: photographer, subject, location, date — a fixed grammar beneath, never on the image. This is already our vocabulary (china-marker, slug line); the survey confirms the *pairing* itself is a pattern: showing the select next to its alternatives is what makes the select feel chosen.

**8. NYT visual features / The Pudding.**
Scrollytelling essays are "sparse on words," full-bleed imagery carrying narrative with text arriving in measured beats between or over images. Relevant here mostly as a boundary: this grammar depends on scroll-triggered motion, which our motion law forbids ("nothing fades up on scroll"). What transfers is the *ratio*: when the image is the argument, body text shrinks to captions.

**9. Text-over-image engineering (Smashing Magazine, Ahmad Shadeed, NN/g).**
The concrete scrim mechanics, when text must sit on an image: a bottom-anchored gradient of ~40% black fading to transparent; *eased* gradients (8–16 stops) to kill the visible hard edge of a linear gradient; the gradient must extend well past the text's box (min-height + flex-end, or 60px+ padding-top) because it must survive the *worst-case* image; belt-and-suspenders text-shadow (`0 2px 3px rgba(0,0,0,0.3)`) so text survives even if the image fails to load. Test: put a solid color behind the text — if readable there, the gradient works universally. NN/g's stricter position: when scrims can't guarantee contrast, move the text *off* the image entirely.

### Family C — Film and entertainment detail views

**10. Letterboxd film page.** (The strongest single reference for image-into-dark-ground.)
Backdrop spans full width at ~400px height at page top; a gradient fades it downward into the page: `linear-gradient(to bottom, transparent 0%, rgba(20,24,28,0.4) 50%, #14181c 100%)` — ending in the *exact* body background color (#14181c). The film header (poster thumb, title, metadata) overlaps the gradient zone with ~−120px negative margin, so the info sits in the already-darkened band — readable without a boxed scrim. The stated effect: "the image naturally dissolves into the page rather than being cut off." Poster lives in its own 230px grid column beside the metadata — image zone and information zone are distinct even while the backdrop is atmospheric. The backdrop is chooseable (Patron feature) — the community *curates* the hero, which tells you the hero is understood as identity, not decoration.

**11. A24 film pages (a24films.com, GrandArmy identity).**
Hero still dominates (served up to 3840×2160); title + year *below* the hero, not on it — clear hierarchy with almost no chrome. Actions ("Get Tickets," "Watch Now" platform links) grouped in their own sections below. A24's per-film custom logo animations (Hereditary, Midsommar) show the inverse move: when type must live with the image, it becomes *part of the artwork* — art-directed per film, never a generic overlay.

**12. Apple TV key art (official artwork spec).**
16:9 hero at 1920×1080 minimum, 3840×2160 preferred. "Title treatment must be included, but no extraneous text is allowed" — the title is *inside* the art, everything else stays off it. The hard law: "Artwork should not be upscaled or cropped to fit required dimensions" — a platform-level never-crop rule, validating ours. Layered LSR images (parallax on focus) create depth: "the focused item is the closest thing to the user." Detail pages scrim the lower region of the hero and set metadata there — the scrim is engineered once, platform-wide.

**13. IMDb title page redesign (2023→). Contrary case, detailed in Part 4.**
Hero section: black background, 1/6 poster + 3/6 trailer + 2/6 metadata. Community reception "mostly negative": oversized elements, information scattered, the utility (cast, ratings, facts) pushed apart by the imagery. The lesson: making media monumental *at the cost of* the information's density reads as loss, not drama — the image must never tax the reference use of the page.

### Family D — Product and portfolio heroes

**14. Apple product pages.**
Edge-to-edge product tiles, alternating light/dark canvases, each roughly one viewport: hero headline centered, one-line tagline, two tiny pill CTAs, one crisp product render. "Nothing competes with the product… no borders, no gradients, no decorative frames, no shadows on headlines." Monumentality mechanics: (1) isolation — one object per viewport on a flat field; (2) scale — the render is enormous relative to the text; (3) chrome suppression — CTAs are typographically minimal; (4) text and image *alternate* vertically rather than overlap. Scroll-driven product animation is their signature but is off-limits under our motion law.

**15. Cosmos / Savee / Are.na image detail.**
The moodboard tools converge on the same detail view: image large on a flat near-white or near-black field, metadata and actions in a quiet side rail or below, "distraction-free… no ads or likes… calm space." Savee in particular: full-bleed image, actions as small monochrome icons that appear on hover, title/source in small type below. The pattern: *the connect/save action is the only emphasized thing, and it is still quiet.*

**16. Motion.dev lightbox + View Transitions API (the motion reference).**
The canonical entry motion for image-first views is the **shared-element / container transform**: the thumbnail and the full view are the *same element*, morphed. "When an object persists across a cut, it communicates continuity — the viewer understands they are looking at the same thing rather than a replacement." Mechanics: tag both states (View Transitions `view-transition-name`, or Framer Motion `layoutId`), animate transform + opacity on the bounds, keep the named element small (the image, not the whole section), let backdrop and caption arrive *after* the morph. Material Design's container-transform guidance matches: the container's bounds animate while outgoing content fades out and incoming content fades in slightly behind the bounds change.

### Family E — Print-shop and poster commerce

**17. Framebridge / Level Frames.**
The product IS the mounting. Upload art → preview in frames live; mat proportions are the design system. Framebridge's "mat caption" option — printed text on the mat *below* the artwork — is the physical-world confirmation of our caption-beneath grammar: when framers add words, they put them on the mat under the print, never on the print. Level Frames shows exact outer dimensions as you customize — the object's physicality (size, edge, depth) is always explicit.

**18. Saatchi Art "View in a Room" / King & McGaw room views.**
Every artwork can be seen at true scale on a wall (photographed room or WebAR): "80% of hesitant art buyers want to see art in their space before purchase." King & McGaw merchandises by room. The pattern: *scale context* — showing the object at believable physical scale in a believable environment is what converts "image" into "thing that exists." Their frame previews also standardize shadows: a consistent soft drop under the frame edge, never painterly glows.

---

## Part 2 — Named patterns (10, with mechanics)

**P1. The Gallery Wall.** (Museums, auction houses, Apple, Cosmos.) The image sits alone on a flat neutral field — white cell or black box — with generous margins; information sits *below or beside* in a fixed label grammar; nothing overlays the artwork. Monumentality = isolation + scale ratio + chrome suppression, not effects. Mechanics: one object per view; margins ≥ the label's height; metadata in tombstone order; actions typographically minimal.

**P2. The Specimen Mat.** (Framebridge, proof prints, our card.) The image is mounted on a visible substrate (mat/card) with a caption engraved beneath. The mat is part of the object; the caption belongs to the mat, not the image. Mechanics: hairline or beveled edge on the image; caption in a smaller, fixed grammar directly under; mat margin proportions consistent across every instance.

**P3. The Dissolve.** (Letterboxd, Apple TV detail pages.) On a dark ground, the hero doesn't end — it *fades into* the page: bottom-anchored gradient terminating in the exact body background color, with the info block overlapping the darkened band. Mechanics: `transparent 0% → bg-color 100%` over the image's lower third; gradient endpoint === page background hex; info block negative-margined into the pre-darkened zone; text only where the scrim has already won.

**P4. The Engineered Scrim.** (Smashing/Shadeed/NN-g.) When text must sit on an image: eased gradient (8–16 stops, no hard edge), ~40% black floor, gradient extends past the text box, shadow fallback, tested against worst-case frames. Or refuse: move the text off the image (NN/g's preferred answer, and ours).

**P5. The Container Transform.** (Motion.dev, View Transitions, Material.) Image-first views open by *morphing the image itself* from its resting place to its monumental place — bounds animate, everything else (dim, caption, chrome) arrives after; closing reverses along the same path. The image is the through-line; nothing "pops."

**P6. The Loupe Reward.** (Rijksmuseum, Leiden Collection, Sotheby's zoom.) Depth of inspection is a designed payoff: zoom to the crackle in the paint, curtain to the x-ray. The inspection room is darker and quieter than the page that launched it; controls hug the edges of the dim, not the artwork.

**P7. The Select Beside Its Alternatives.** (Magnum contact sheets.) Show the chosen frame *in dialogue with* the frames not chosen, with a human mark of choice on the sheet. Choice displayed is worth more than choice implied.

**P8. Title Inside the Art — or Fully Off It.** (Apple TV spec, A24 logo animations.) Two honest homes for the title: art-directed *into* the key art (per-piece, never generic), or entirely off the image in the label zone. The dishonest middle — generic type slapped over the image — is what every strong reference avoids.

**P9. Scale Witness.** (Saatchi AR, King & McGaw, Level Frames.) Show the object at believable physical scale in a believable context; make its edges and dimensions explicit. Physicality converts image → object.

**P10. Actions Off the Image; Chrome at the Edge of the Dim.** (Every family.) Buy/bid/save/share never sit on the artwork. In lightboxes, paddles and close affordances live on the *dim*, outside the image bounds; on detail pages, actions cluster in the label zone. The one sanctioned exception: quiet utility chips in the image's own chrome family (our dark chips; Savee's hover icons) — monochrome, small, corner-anchored.

---

## Part 3 — Mapping to our system

| Pattern | Verdict | Application |
|---|---|---|
| P1 Gallery Wall | **Already ours — deepen** | The photo box is our black box; the card is our white cell. Deepen: give the photo box true gallery margins and a composed label (see Rec 2). |
| P2 Specimen Mat | **Adopt (confirmed)** | Independent convergence: Framebridge's mat caption = our caption-beneath law. Keep the mat grammar identical across card, frontispiece, and Stage filmstrip — the *consistency* is the pattern. |
| P3 Dissolve | **Adapt, narrowly** | Never on paper (working registers stay crisp; the mat's hairline is the point). Adapt only where dark ground meets the print: the poster seam bridge (Rec 3) and, later, Stage idle treatments. The gradient must terminate in our exact ground (#0A0A0C dim / ink panel color) and may never carry text. |
| P4 Engineered Scrim | **Reject as primary; keep as engineering** | Our law already made the stronger choice (ink panel solid 0.94 after the 0.82 failure — Round 8). We do not put running text on prints, so we don't need scrims for reading. Keep the eased-gradient technique in the toolbox solely for the on-image chip chrome's legibility floor. |
| P5 Container Transform | **Adopt — highest impact** | Our lightbox is currently a fade+rise popup; our own doctrine says "the portal zoom is the only travel metaphor." The print should *travel* from mat to room scale. Rec 1. |
| P6 Loupe Reward | **Adapt** | We already have loupe = frame inspection. The deeper museum move (pixel zoom into the print) is a future darkroom feature, not now; but the "inspection room is darker" cue supports deepening the photo-box dim from 0.92 toward opaque. |
| P7 Select Beside Alternatives | **Already ours — keep** | The contact sheet + "Use this frame" + Stage choosing-out-loud (Round 8 item 6) is this pattern verbatim. No change. |
| P8 Title Inside Art / Off It | **Adopt the "off it" branch** | We never bake text into generated prints (captions are true data; prints are art). Title stays in the label zone on every surface. This also rules out any future "put the idea name on the poster image" temptation — cite Apple TV: "no extraneous text." |
| P9 Scale Witness | **Adapt lightly** | AR is theater-park for us. What transfers: the photo box's claim of "room scale" should be *felt* — print sized to viewport with intentional gallery margins, hairline as the frame edge. Already mostly true; Rec 2 finishes it. |
| P10 Actions Off Image | **Adopt as audit rule** | Poster darkroom chips (Round 9 law) are the sanctioned corner-chip exception — keep. Fix the violation: in inspection mode the loupe's ‹ › paddles can overlap the print at narrow viewports (`left-4/right-4` on the screen, not the dim margin). Paddles must be guaranteed off-print (Rec 2). "Use this frame" already lives in the caption band — correct. |

---

## Part 4 — Contrary cases: where image-first fails

1. **IMDb 2023 title pages.** Hero-ified media (black ground, big poster + trailer) with "mostly negative" reception: oversized elements, information scattered, reference utility taxed. *Failure mode: monumentality purchased with the information's density.* Our guard: the board stays a working proof sheet — the mat never grows at the expense of scan density; the epic register lives in poster/photo box only.
2. **NN/g "illusion of completeness."** Full-viewport heroes create a false floor — users don't scroll because the page *looks* finished. Our guard: on any scrolling surface, the print band must visibly sit within a longer sheet (frame numbers and grid continuation do this today).
3. **Hero-image fatigue (Webdesigner Depot et al.).** Full-bleed heroes → bloated loads, low information density, "overwhelming sameness." A hero is only epic if it's *scarce*. Our guard: prints earn full-bleed exactly twice (poster, photo box); everywhere else they're mounted specimens among many.
4. **Text-over-image contrast failures.** The universal cheap move (generic scrim under generic type) fails worst-case frames and reads as template. We already outlawed it (solid ink panel); the Letterboxd dissolve is safe only because text enters *after* the gradient has fully won — adopt it only under that condition.
5. **Scroll-driven image theater (Apple, Pudding).** Superb in their context; forbidden in ours (motion is an event; nothing animates on scroll; nothing moves while the room reads). Adaptations of Family B/D references must strip the scroll trigger and keep only the composition.
6. **Novel navigation over utility (Sotheby's "gallery stroll").** Horizontal/mixed-axis catalog scrolling wins awards and confuses buyers; Christie's later replatform explicitly re-centered findability. Our guard: the portal morph is the only spatial metaphor; no new travel schemes.

---

## Part 5 — Top 3 highest-impact changes

### Rec 1 — The portal morph: the print travels from mat to room scale (P5)
Replace the photo box's fade+rise entry with a true container transform. The mat's print and the lightbox print share identity (Framer Motion `layoutId={'print-' + idea.id}` on both `<img>` wrappers in `IdeaCard.tsx` / `ExpandedCard.tsx` frontispiece and `PrintLightbox.tsx`). Beat structure: dim cuts in under the morph (DUR.cut, as today), the print's *bounds* morph from mat rect to `min(92vw, 82vh·16/9)` on the house EASE over DUR.beat (no y-offset entrance — the travel IS the entrance), caption band settles at BEAT.hero as today. Exit reverses along the same path on EASE_EXIT/DUR.cut — the print returns to its mat, which is what makes the board feel like where prints *live*. Inspection mode (frames present) keeps the current entrance for frames 2–3 when flipping; only the mounted frame travels. This is our own "portal zoom" doctrine finally applied to the print system, and it's the single pattern every reference family agrees on.

### Rec 2 — The lot card: give the photo box its ceremony (P1, P6, P10)
The most monumental surface currently has the least typographic ceremony (one 12px slug). Recompose the caption band as a museum/auction label, off-image as now: idea name set in **Ogilvy Serif 28–34px white** (the surface's one named serif moment — sanctioned: ≥28px, dark register), with the slug line (`№ 02 · TEAM ONE · FRAME 1 OF 3`) in 12px Courier beneath it, and "Use this frame" remaining in this band. Deepen the dim from 0.92 to **0.97** (the inspection room is darker than the page — P6; museum viewers sit on effectively opaque #111). Move the loupe paddles into a three-column grid (`[paddle] [print] [paddle]`) so they are structurally outside the print bounds at every viewport instead of `absolute left-4/right-4` (P10 — chrome lives on the dim, never the artwork). Cost: ~half a day; turns "big preview" into "the lot presented."

### Rec 3 — The seam bridge: make the poster one printed object (P3, adapted)
The poster currently reads as image-block-atop-ink-panel — two stacked rectangles. Adapt the Letterboxd dissolve within Round 8 law: a **40px eased gradient** (8+ stops, per Shadeed — no hard linear edge) from transparent into the ink panel's exact ground color, overlapping the print's bottom edge, with the panel's first baseline starting *below* the fully-solid line. The panel body stays ≥0.94 everywhere type exists; the bridge zone carries no text, ever — so "type never sits on visible print texture" holds. Result: the print dissolves into its own caption ground the way a Letterboxd backdrop melts into the page — one object, not a stack. Guardrails to encode in the component comment: gradient endpoint === panel ground hex; bridge height fixed at 40px regardless of print height; if the ≤52ch description would collide with the bridge, the bridge loses, not the text. Prototype in `/card-lab` first and squint-test at 720p projection before adopting — this touches a settled law's neighborhood, so it ships only if it beats the current seam in the lab.

---

## Sources

**Auction/collection:** [Your Majesty — Sotheby's case study](https://yourmajesty.co/work/sothebys) · [Pentagram — Sotheby's](https://www.pentagram.com/work/sothebys-1) · [It's Nice That — Pentagram Sotheby's redesign](https://www.itsnicethat.com/articles/pentagram-sothebys-redesign) · [Ekta Daryanani — Sotheby's eCatalogue UX](https://www.ektad.com/projects/sothebys) · [Actum Digital — Christie's](https://www.actumdigital.com/cases/christies-success-stories/christie-s-discovery-website) · [Fabrique — Rijksmuseum](https://www.fabrique.com/cases/digital-design/rijksmuseum/) · [Q42 — Rijksmuseum website](https://www.q42.nl/en/work/rijks-website1) · [Rijksmuseum — The Night Watch (SK-C-5)](https://www.rijksmuseum.nl/en/collection/SK-C-5) · [U. Oregon — Online collections analysis: Tate, MoMA, Pompidou (PDF)](https://bpb-us-e1.wpmucdn.com/blogs.uoregon.edu/dist/d/9014/files/2015/01/Online-Collections-Analysis_Tate-MoMA-and-the-Centre-Pompidou-26r58z4.pdf) · [Cuberis — Deep zoom with OpenSeadragon (Leiden Collection)](https://cuberis.com/a-case-study-of-deep-zoom-with-openseadragon/) · [MW18 — Rijksstudio redesign](https://mw18.mwconf.org/paper/rijksmuseum-mobile-first-redesign-rijksstudio-the-new-rijksmuseum-app/index.html)

**Editorial/photography:** [Magnum — Contact sheets: the images behind the image](https://www.magnumphotos.com/theory-and-practice/magnum-photographers-contact-sheets-the-images-behind-the-image/) · [Magnum — Contact Sheets theme](https://www.magnumphotos.com/theme/magnum-contact-sheets/) · [Storybench — How The Pudding structures visual essays](https://www.storybench.org/pudding-structures-stories-visual-essays/) · [The Pudding — Storytelling process](https://pudding.cool/process/how-to-make-dope-shit-part-3/) · [Smashing — Accessible text over images, Part 1](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/) · [Ahmad Shadeed — Handling text over images in CSS](https://ishadeed.com/article/handling-text-over-image-css/) · [NN/g — Ensure high contrast for text over images](https://www.nngroup.com/articles/text-over-images/)

**Film/entertainment:** [Blake Crosley — Letterboxd design guide](https://blakecrosley.com/guides/design/letterboxd) · [Letterboxd Journal — The Backdroppers](https://letterboxd.com/journal/backdroppers-custom-backdrops/) · [A24 — The Brutalist](https://a24films.com/films/the-brutalist) · [GrandArmy — A24 identity](https://www.grandarmy.com/projects/a24) · [Pixel Parlor — A24 film sites](https://pixelparlor.com/our-work/a24-films/) · [Apple TV — Artwork requirements](https://tvpartners.apple.com/support/3708-artwork-requirements) · [Apple TV channels — Artwork spec](https://help.apple.com/itc/appletv/channelsartspec/en.lproj/static.html) · [IMDb forums — Updated title page experience](https://community-imdb.sprinklr.com/conversations/imdbcom/introducing-updated-imdbcom-title-page-experience/60a40631c1307254c6cc1b0d) · [IndieWire — IMDb redesign launch](https://www.indiewire.com/features/general/imdb-launches-site-redesign-revamped-name-pages-1234746279/)

**Product/portfolio:** [UX Planet — 8 things from Apple's product pages](https://uxplanet.org/8-things-i-learned-analyzing-apples-product-pages-9a5284681b37) · [CSS-Tricks — Apple-style scroll animation](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/) · [Kyla Medina — Cosmos vs Are.na vs Savee](https://medium.com/@kylamedina/saving-and-organizing-creative-inspiration-a-comparison-of-cosmos-are-na-savee-4e50760a4947) · [Artisan Apps — Cosmos](https://artisan-apps.beehiiv.com/p/cosmos-the-moodboard-reinvented) · [Motion — Lightbox tutorial](https://motion.dev/tutorials/js-lightbox) · [Motion — animateView](https://motion.dev/docs/animate-view) · [Animation Patterns — Shared element layout transition](https://animationpatterns.art/animations/shared-element-layout-transition/) · [Smashing — View Transitions API, Part 1](https://www.smashingmagazine.com/2023/12/view-transitions-api-ui-animations-part1/)

**Print commerce:** [Framebridge — Personalization (mat captions)](https://www.framebridge.com/pages/personalization) · [Framebridge — How it works](https://www.framebridge.com/pages/how-it-works) · [Level Frames vs Framebridge](https://www.levelframes.com/blog/level-frames-vs-framebridge) · [King & McGaw — Art by room](https://www.kingandmcgaw.com/collections/art-by-room) · [Saatchi Art — View in a Room (8th Wall case)](https://www.8thwall.com/rockpaperreality/saatchi-art-view-in-my-room) · [Artnet — Saatchi AR app](https://news.artnet.com/market/saatchi-arts-virtually-hangs-artworks-196036)

**Contrary cases:** [NN/g — Illusion of completeness](https://www.nngroup.com/articles/illusion-of-completeness/) · [Webdesigner Depot — Stop using hero images](https://webdesignerdepot.com/stop-using-hero-images-theyre-killing-your-ux/) · [NN/g — Carousel usability](https://www.nngroup.com/articles/designing-effective-carousels/)
