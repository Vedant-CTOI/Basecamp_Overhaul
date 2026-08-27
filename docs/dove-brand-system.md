# Dove Brand System — Design-Token Reference
**Purpose:** Verified reference for the "Dove Real Intelligence" workshop-platform reskin (Next.js app, currently Ogilvy red `#EB3F43`). Theme: *Real Beauty in the Age of Generative AI & Digital Self-Esteem*.
**Provenance labels:** `[L]` = literal from dove.com CSS / official assets · `[P]` = pixel-measured · `[D]` = derived for accessibility.

---

## 1. Brand Colors

Extracted literally from dove.com's inline styles and Unilever clientlib CSS (`dove.com/us/en/home.html`, Aug 2026):

| Token | Hex | Role | Provenance |
|---|---|---|---|
| **Dove Blue (primary)** | `#002663` | Deep navy blue — dominant brand color on dove.com (134 inline occurrences) | [L] |
| Dove Blue (dark variant) | `#001F5F` | Footer/deep sections | [L] |
| Mid Blue | `#366AA5` | Links, secondary UI accents | [L] |
| Bright Blue | `#0090C1` | Occasional accent/highlight | [L] |
| **Gold (secondary)** | `#B78938` | Gold accent (logo dove heritage) — 42 occurrences | [L] |
| Light Gold | `#DABF80` | Gold tint for gradients/dividers | [L] |
| Pale Gold | `#FFE2AC` | Highlight tint | [L] |
| Ink (text) | `#303334` | Primary body text | [L] |
| Ink Cool | `#35414B` | Secondary text / dark slate | [L] |
| Slate Dark | `#2A343C` | Headings on light surfaces | [L] |
| Surface | `#F6F6F6` / `#F0F0F0` | Light gray backgrounds | [L] |
| White | `#FFFFFF` | Base surface | [L] |

**Note:** Dove's palette is navy-dominant with warm gold accents — a clean swap for Ogilvy red. Avoid using red anywhere in the reskin.

## 2. Typography

- **Actual web font (verified):** dove.com loads **FF Mark Pro** (`font-family: "MarkPro"`, weights 300–875 + italics) via Monotype fonts.net kit. `[L]` — FF Mark is a geometric sans (FontFont, by Luc(as) de Groot & Christoph Dunst).
- **Logo lettering:** custom script/lettering by Ian Brignell (not a loadable typeface). Closest matches cited: Elicit Script SemiBold, Australis Pro Swash Italic — not free. For web we use an SVG wordmark instead (see §5).
- **Google Fonts substitutes:**
  - Primary sans (FF Mark stand-in): **Poppins** (closest geometric; slightly rounder) or **Jost** (tighter, more Mark-like proportions). Recommended: Poppins 300/400/500/600.
  - Editorial serif for campaign-style headlines ("Real Beauty" voice): **Fraunces** or **Playfair Display** — gives warmth that geometric sans lacks for long editorial copy.

## 3. Design Language

- **Photography:** real people, unretouched skin, natural light, diverse ages/bodies/ethnicities; candid portraits over studio gloss. The #NoDigitalDistortion stance is core — for this AI-themed reskin, pair real-skin photography with subtle "generated vs. real" visual contrast motifs.
- **Tone:** warm, honest, empowering, quietly confident — never clinical or luxury-aloof. Short declarative statements, second person ("You are more than your filter").
- **Motifs:** generous whitespace, soft rounded corners, full-bleed photography with navy overlays, thin gold rules as accents, large humanist headlines.

## 4. Taglines & Voice

- Master platform: **"Real Beauty"** (since 2004). Related: "Real Beauty Sketches", "#NoDigitalDistortion", "Detox Your Feed", "Reverse Selfie".
- Voice principles: plain language, affirmation over instruction, evidence-backed care claims, inclusive plural address ("we", "you").
- Workshop-safe copy phrases: "Real beauty is not generated." · "See yourself, unfiltered." · "Confidence is the original algorithm." · "No digital distortion."

## 5. Logo

Structure: lowercase-feeling custom wordmark "Dove" (blue, soft rounded letterforms with distinctive curved D and open e) above a gold dove bird in flight (facing right), on white. We will recreate as **text/SVG only**: set the wordmark in the substitute serif/script-free style — recommend SVG paths or styled text in Fraunces/Poppins at `--dove-blue`, with a simple gold dove silhouette (`--gold`) if needed. Do not attempt to fake the custom script with a Google font italic.

## 6. WCAG Contrast Audit

Computed (WCAG 2.x relative luminance):

| Foreground | Background | Ratio | AA/AAA |
|---|---|---|---|
| `#FFFFFF` | `#002663` (Dove blue) | **14.41** | AAA ✅ |
| `#FFFFFF` | `#001F5F` | 15.43 | AAA ✅ |
| `#002663` | `#FFFFFF` | 14.41 | AAA ✅ |
| `#303334` (ink) | `#FFFFFF` | 12.74 | AAA ✅ |
| `#35414B` | `#F6F6F6` | 9.67 | AAA ✅ |
| `#366AA5` (mid blue text) | `#FFFFFF` | 5.58 | AA ✅ |
| `#B78938` (gold) | `#002663` | 4.56 | AA ✅ (large/UI) |
| `#DABF80` (light gold) | `#002663` | 8.06 | AAA ✅ |
| `#B78938` (gold) | `#FFFFFF` | 3.16 | ❌ fails normal-text AA |

**Text-safe variants (hue-preserving HSV darkening, derived):**
- Gold text on white: use `#96702E` → ratio ≈ 5.1 (AA) `[D]`. Reserve raw `#B78938` for large decorative elements, borders, and gold-on-navy only.

## 7. Ready-to-Paste Token Block

```css
/* ===== Dove Real Intelligence — design tokens ===== */
:root {
  /* Brand colors */
  --dove-blue:        #002663;  /* primary — [L] */
  --dove-blue-dark:   #001F5F;  /* deep sections — [L] */
  --dove-blue-mid:    #366AA5;  /* links/accents — [L] */
  --dove-blue-bright: #0090C1;  /* highlight accent — [L] */

  /* Gold accents */
  --gold:             #B78938;  /* decorative/large only — [L] */
  --gold-light:       #DABF80;  /* gradients/dividers — [L] */
  --gold-pale:        #FFE2AC;  /* tint highlights — [L] */
  --gold-text:        #96702E;  /* AA-safe gold on white — [D] */

  /* Neutrals */
  --ink:              #303334;  /* body text — [L] */
  --ink-cool:         #35414B;  /* secondary text — [L] */
  --slate-dark:       #2A343C;  /* headings on light — [L] */
  --surface:          #F6F6F6;  /* light bg — [L] */
  --surface-alt:      #F0F0F0;  /* alt light bg — [L] */
  --white:            #FFFFFF;

  /* Typography */
  --font-sans: 'Poppins', 'Helvetica Neue', Arial, sans-serif; /* FF Mark Pro substitute */
  --font-serif: 'Fraunces', Georgia, serif; /* editorial headlines */

  /* Type scale (suggested) */
  --text-hero: clamp(2.75rem, 6vw, 4.5rem);
  --text-h1: clamp(2rem, 4vw, 3rem);
  --text-body: 1.0625rem;

  /* Radii / spacing feel */
  --radius-card: 16px;
  --radius-pill: 999px;

  /* Semantic pairs (verified WCAG) */
  --pair-on-blue-fg: var(--white);        /* 14.41:1 on --dove-blue */
  --pair-on-light-fg: var(--ink);         /* 12.74:1 on white */
}
```
