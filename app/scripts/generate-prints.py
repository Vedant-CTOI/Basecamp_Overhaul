#!/usr/bin/env python3
"""
Darkroom print generator — showcase stand-ins.

Renders eight abstract duotone "prints" (red / ink / paper, 1600x900)
into public/prints/, each seeded from its idea's name so the same idea
always develops the same print. Vocabulary: halftone dot fields,
editorial bars, hairline rules, and a china-marker-like stroke — the
showcase's geometric-editorial language (docs/ogilvy-showcase-direction.md).

FORMAT LAW (docs/ogilvy-showcase-direction.md, Round 9): prints are
CINEMATIC 16:9 — campaign key visuals composed for the wide frame —
and no surface ever crops one. Compositions here are built wide:
focal masses sit on the thirds, halftone sweeps run the full width,
horizon bands cut low or high, never centered-square thinking.

These are STAND-INS. In a real engagement the Darkroom calls an image
model with the engagement's art-direction prompt (see lib/darkroom.ts);
this script only exists so the showcase demos the choreography.

Run from app/:  python3 scripts/generate-prints.py
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

# Render at 2x, downsample for clean edges. Output is the canonical
# cinematic 16:9 print — 1600x900.
W, H = 3200, 1800
OUT_W, OUT_H = 1600, 900

RED = (235, 63, 67)
INK = (35, 31, 32)
PAPER = (255, 255, 255)

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "prints"

# print file -> idea name (the seed). Keep in sync with SHOWCASE_PRINTS
# in lib/showcase-data.ts.
PRINTS = {
    "print-01": "The Overnight Agency",
    "print-02": "The First-Party Feelings Desk",
    "print-03": "Do the Homework Engine",
    "print-04": "The Category Almanac",
    "print-05": "The Apprentice Deck",
    "print-06": "One Agency, One Face",
    "print-07": "Clients in the Room",
    "print-08": "The House Critique",
}


def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def halftone(draw, rng, x0, y0, x1, y1, color, alpha, spacing, direction):
    """A halftone field: dot radius swells across the region."""
    rows = int((y1 - y0) / spacing)
    cols = int((x1 - x0) / spacing)
    for r in range(rows + 1):
        for c in range(cols + 1):
            cx = x0 + c * spacing + (spacing / 2 if r % 2 else 0)
            cy = y0 + r * spacing
            if direction == "x":
                t = (cx - x0) / max(1, (x1 - x0))
            elif direction == "y":
                t = (cy - y0) / max(1, (y1 - y0))
            else:  # radial
                t = math.hypot(cx - (x0 + x1) / 2, cy - (y0 + y1) / 2) / (
                    math.hypot(x1 - x0, y1 - y0) / 2
                )
                t = 1 - min(1, t)
            rad = spacing * 0.46 * max(0.04, t)
            draw.ellipse(
                [cx - rad, cy - rad, cx + rad, cy + rad],
                fill=color + (alpha,),
            )


def china_stroke(draw, rng, cx, cy, rx, ry, color, width, alpha, arc=1.9):
    """A wavering grease-pencil ellipse — open at the join, hand drift."""
    start = rng.uniform(0, math.pi * 2)
    steps = 90
    pts = []
    drift_x, drift_y = 0.0, 0.0
    for i in range(steps):
        t = start + arc * math.pi * (i / steps)
        drift_x += rng.uniform(-1.6, 1.6)
        drift_y += rng.uniform(-1.6, 1.6)
        drift_x *= 0.94
        drift_y *= 0.94
        wobble = 1 + 0.045 * math.sin(3.1 * t + start)
        pts.append(
            (cx + rx * wobble * math.cos(t) + drift_x * 12,
             cy + ry * wobble * math.sin(t) + drift_y * 12)
        )
    col = color + (alpha,)
    draw.line(pts, fill=col, width=width, joint="curve")
    for px, py in (pts[0], pts[-1]):
        draw.ellipse([px - width / 2, py - width / 2, px + width / 2, py + width / 2], fill=col)


def bars(draw, rng, color, alpha, vertical, n, x0, y0, x1, y1):
    """Editorial bars — solid, confident, unrotated."""
    span = (x1 - x0) if vertical else (y1 - y0)
    for i in range(n):
        w = rng.uniform(0.05, 0.22) * span
        pos = x0 + rng.uniform(0, span - w) if vertical else y0 + rng.uniform(0, span - w)
        if vertical:
            draw.rectangle([pos, y0, pos + w, y1], fill=color + (alpha,))
        else:
            draw.rectangle([x0, pos, x1, pos + w], fill=color + (alpha,))


def hairlines(draw, rng, color, n):
    for _ in range(n):
        if rng.random() < 0.5:
            y = rng.uniform(H * 0.1, H * 0.9)
            draw.line([(0, y), (W, y)], fill=color + (120,), width=6)
        else:
            x = rng.uniform(W * 0.1, W * 0.9)
            draw.line([(x, 0), (x, H)], fill=color + (120,), width=6)


def third(rng):
    """A rule-of-thirds anchor — the cinematic frame's focal columns."""
    return rng.choice([W / 3, 2 * W / 3]) + rng.uniform(-W * 0.04, W * 0.04)


def compose(name: str) -> Image.Image:
    rng = random.Random(name)  # seeded per idea name
    dark_ground = rng.random() < 0.25
    ground = INK if dark_ground else PAPER
    fg_a, fg_b = (PAPER, RED) if dark_ground else ((INK, RED) if rng.random() < 0.5 else (RED, INK))

    img = Image.new("RGBA", (W, H), ground + (255,))
    archetype = rng.choice(["field", "columns", "orbit", "horizon"])

    base = layer()
    d = ImageDraw.Draw(base)

    if archetype == "field":
        # A halftone sweep running the full width of the frame — the
        # dots gather toward one edge, one bar answers on a third.
        direction = rng.choice(["x", "x", "y", "radial"])  # favor the wide sweep
        halftone(d, rng, -80, -80, W + 80, H + 80, fg_a, 235, rng.choice([88, 104, 124]), direction)
        bar_x = third(rng)
        bar_w = rng.uniform(0.06, 0.14) * W
        d.rectangle([bar_x - bar_w / 2, 0, bar_x + bar_w / 2, H], fill=fg_b + (255,))
    elif archetype == "columns":
        # Bars carry the sheet; a halftone band interrupts, cut wide
        bars(d, rng, fg_a, 255, True, rng.randint(2, 3), 0, 0, W, H)
        band_y = rng.uniform(H * 0.15, H * 0.55)
        halftone(d, rng, -80, band_y, W + 80, band_y + H * 0.34, fg_b, 235, 92, "x")
        hairlines(d, rng, fg_a, 1)
    elif archetype == "orbit":
        # A big disc riding a thirds column, a halftone sweep crossing
        # the whole frame behind it, hairlines squaring the geometry
        cx, cy = third(rng), rng.uniform(H * 0.3, H * 0.7)
        rad = rng.uniform(H * 0.3, H * 0.52)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=fg_a + (255,))
        halftone(d, rng, -80, -80, W + 80, H + 80, fg_b, 200, 108, "x")
        hairlines(d, rng, fg_a, 2)
    else:  # horizon
        # The widescreen move: a hard horizon band cut low or high,
        # a dot field breaking over it, one vertical answering on a third
        horizon = H * (rng.uniform(0.6, 0.74) if rng.random() < 0.65 else rng.uniform(0.24, 0.38))
        d.rectangle([0, horizon, W, H], fill=fg_a + (255,))
        halftone(d, rng, -80, -80, W + 80, horizon + H * 0.08, fg_b, 225, 100, rng.choice(["x", "y"]))
        bar_x = third(rng)
        d.rectangle([bar_x - W * 0.035, 0, bar_x + W * 0.035, H], fill=fg_b + (255,))

    img = Image.alpha_composite(img, base)

    # The china-marker stroke — the human mark over the mechanical field.
    # It rides a thirds column too: the select lives where the eye lands.
    mark = layer()
    dm = ImageDraw.Draw(mark)
    stroke_color = RED if (dark_ground or fg_a == INK) else INK
    if rng.random() < 0.7:
        stroke_color = RED
    china_stroke(
        dm, rng,
        third(rng), rng.uniform(H * 0.32, H * 0.68),
        rng.uniform(W * 0.1, W * 0.16), rng.uniform(H * 0.18, H * 0.32),
        stroke_color, 32, 175, arc=rng.uniform(1.75, 1.95),
    )
    img = Image.alpha_composite(img, mark)

    return img.resize((OUT_W, OUT_H), Image.LANCZOS).convert("RGB")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for fname, idea_name in PRINTS.items():
        out = OUT_DIR / f"{fname}.png"
        compose(idea_name).save(out, optimize=True)
        print(f"developed {out.name}  «{idea_name}»")


if __name__ == "__main__":
    main()
