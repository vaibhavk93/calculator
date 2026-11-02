#!/usr/bin/env python3
"""
Draws the Calc logo and writes every size the app needs, from ONE set of numbers so nothing drifts.

    python3 scripts/make-brand-assets.py

The mark is the keypad's own grammar: three OUTLINED keys (things that act: divide, multiply, minus) and one FILLED
citron key (the single primary action: equals). See docs/BRAND.md.

Writes:
  assets/brand/*.svg                      source artwork
  public/favicon.svg                      browser tab icon
  android/app/src/main/res/...            adaptive icon (vector), themed icon, legacy PNGs, splash images
Needs Pillow only. Colours come from src/lib/theme.ts (dark palette, citron accent).
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"

# ---- colours (src/lib/theme.ts: dark palette and the citron accent) ---------------------------
BG = "#060606"
OUTLINE = "#A4A4A4"   # ink-2: readable at small sizes on the ground
GLYPH = "#F5F5F5"     # ink
CITRON = "#CCD539"    # accent fill
CITRON_INK = "#121300"

# ---- geometry on a 512 canvas -----------------------------------------------------------------
SPAN = 320            # width of the 2x2 grid on the full-bleed icon
GAP = 24
KEY = (SPAN - GAP) / 2
RADIUS = 34
OUTLINE_W = 10
GLYPH_W = 13
CANVAS = 512
ADAPTIVE_SCALE = 250 / SPAN   # inside the 66dp safe circle of a 108dp adaptive icon

CELLS = [(0, 0, "divide"), (1, 0, "times"), (0, 1, "minus"), (1, 1, "equals")]


def keys(scale: float = 1.0):
    """Yields (x, y, size, glyph) for each key, scaled about the canvas centre."""
    origin = (CANVAS - SPAN) / 2
    for i, j, g in CELLS:
        x = origin + i * (KEY + GAP)
        y = origin + j * (KEY + GAP)
        yield (
            CANVAS / 2 + (x - CANVAS / 2) * scale,
            CANVAS / 2 + (y - CANVAS / 2) * scale,
            KEY * scale,
            g,
        )


def glyph_shapes(g: str, cx: float, cy: float, s: float):
    """Returns (lines, dots) for a glyph centred at (cx, cy), at scale s. Lines are (x1, y1, x2, y2)."""
    h = 26 * s
    if g == "minus":
        return [(cx - h, cy, cx + h, cy)], []
    if g == "times":
        d = 20 * s
        return [(cx - d, cy - d, cx + d, cy + d), (cx - d, cy + d, cx + d, cy - d)], []
    if g == "divide":
        return [(cx - h, cy, cx + h, cy)], [(cx, cy - 27 * s, 8.5 * s), (cx, cy + 27 * s, 8.5 * s)]
    if g == "equals":
        o = 12 * s
        return [(cx - h, cy - o, cx + h, cy - o), (cx - h, cy + o, cx + h, cy + o)], []
    raise ValueError(g)


# ---- SVG ----------------------------------------------------------------------------------------
def svg_mark(scale: float = 1.0, background: str | None = BG, bg_radius: int = 112, mono: str | None = None) -> str:
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" width="{CANVAS}" height="{CANVAS}" role="img" aria-label="Calc">']
    if background:
        out.append(f'  <rect width="{CANVAS}" height="{CANVAS}" rx="{bg_radius}" fill="{background}"/>')
    for x, y, k, g in keys(scale):
        cx, cy = x + k / 2, y + k / 2
        filled = g == "equals" and mono is None
        stroke = mono or OUTLINE
        gcol = mono or (CITRON_INK if filled else GLYPH)
        if filled:
            out.append(f'  <rect x="{x:.1f}" y="{y:.1f}" width="{k:.1f}" height="{k:.1f}" rx="{RADIUS * scale:.1f}" fill="{CITRON}"/>')
        else:
            out.append(f'  <rect x="{x + OUTLINE_W * scale / 2:.1f}" y="{y + OUTLINE_W * scale / 2:.1f}" width="{k - OUTLINE_W * scale:.1f}" height="{k - OUTLINE_W * scale:.1f}" rx="{RADIUS * scale:.1f}" fill="none" stroke="{stroke}" stroke-width="{OUTLINE_W * scale:.1f}"/>')
        lines, dots = glyph_shapes(g, cx, cy, scale)
        for x1, y1, x2, y2 in lines:
            out.append(f'  <path d="M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}" stroke="{gcol}" stroke-width="{GLYPH_W * scale:.1f}" stroke-linecap="round" fill="none"/>')
        for dx, dy, r in dots:
            out.append(f'  <circle cx="{dx:.1f}" cy="{dy:.1f}" r="{r:.1f}" fill="{gcol}"/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


def svg_lockup() -> str:
    """Mark on the left, the word 'Calc' on the right. The word is live text in IBM Plex Mono (the app's own number font)."""
    mark = svg_mark(background=BG).split("\n", 1)[1].rsplit("</svg>", 1)[0]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 512" width="1100" height="512" role="img" aria-label="Calc">\n'
        f'  <rect width="1100" height="512" fill="{BG}"/>\n'
        f'  <g>{mark}</g>\n'
        f'  <text x="560" y="330" fill="{GLYPH}" font-family="\'IBM Plex Mono\', ui-monospace, Menlo, monospace" font-size="230" font-weight="500" letter-spacing="-6">Calc</text>\n'
        "</svg>\n"
    )


# ---- Android vector drawables (108dp, the adaptive-icon canvas) --------------------------------
def rrect_path(x: float, y: float, w: float, h: float, r: float) -> str:
    return (
        f"M{x + r:.2f},{y:.2f} H{x + w - r:.2f} A{r:.2f},{r:.2f} 0 0 1 {x + w:.2f},{y + r:.2f} "
        f"V{y + h - r:.2f} A{r:.2f},{r:.2f} 0 0 1 {x + w - r:.2f},{y + h:.2f} H{x + r:.2f} "
        f"A{r:.2f},{r:.2f} 0 0 1 {x:.2f},{y + h - r:.2f} V{y + r:.2f} A{r:.2f},{r:.2f} 0 0 1 {x + r:.2f},{y:.2f} Z"
    )


def circle_path(cx: float, cy: float, r: float) -> str:
    return f"M{cx - r:.2f},{cy:.2f} a{r:.2f},{r:.2f} 0 1 1 {2 * r:.2f},0 a{r:.2f},{r:.2f} 0 1 1 {-2 * r:.2f},0 Z"


def android_vector(mono: bool) -> str:
    f = 108 / CANVAS
    s = ADAPTIVE_SCALE
    out = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">',
    ]
    for x, y, k, g in keys(s):
        cx, cy = (x + k / 2) * f, (y + k / 2) * f
        filled = g == "equals" and not mono
        if filled:
            out.append(f'    <path android:fillColor="{CITRON}" android:pathData="{rrect_path(x * f, y * f, k * f, k * f, RADIUS * s * f)}"/>')
        else:
            ow = OUTLINE_W * s * f
            col = "#FFFFFF" if mono else OUTLINE
            out.append(
                f'    <path android:fillColor="#00000000" android:strokeColor="{col}" android:strokeWidth="{ow:.2f}" '
                f'android:pathData="{rrect_path(x * f + ow / 2, y * f + ow / 2, k * f - ow, k * f - ow, RADIUS * s * f)}"/>'
            )
        gcol = "#FFFFFF" if mono else (CITRON_INK if filled else GLYPH)
        lines, dots = glyph_shapes(g, cx / f, cy / f, s)
        for x1, y1, x2, y2 in lines:
            out.append(
                f'    <path android:fillColor="#00000000" android:strokeColor="{gcol}" android:strokeWidth="{GLYPH_W * s * f:.2f}" '
                f'android:strokeLineCap="round" android:pathData="M{x1 * f:.2f},{y1 * f:.2f} L{x2 * f:.2f},{y2 * f:.2f}"/>'
            )
        for dx, dy, r in dots:
            out.append(f'    <path android:fillColor="{gcol}" android:pathData="{circle_path(dx * f, dy * f, r * f)}"/>')
    out.append("</vector>")
    return "\n".join(out) + "\n"


# ---- PNG (drawn at 4x then reduced, for smooth edges) -------------------------------------------
SS = 4


def draw_mark(size: int, scale: float = 1.0, background: str | None = BG, shape: str = "rounded") -> Image.Image:
    """shape: 'rounded' (square with rounded corners), 'round' (circle), 'none' (transparent, mark only)."""
    px = size * SS
    k = px / CANVAS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if background and shape != "none":
        if shape == "round":
            d.ellipse((0, 0, px - 1, px - 1), fill=background)
        else:
            d.rounded_rectangle((0, 0, px - 1, px - 1), radius=int(112 * k), fill=background)
    for x, y, kk, g in keys(scale):
        x, y, kk = x * k, y * k, kk * k
        cx, cy = x + kk / 2, y + kk / 2
        filled = g == "equals"
        if filled:
            d.rounded_rectangle((x, y, x + kk, y + kk), radius=RADIUS * scale * k, fill=CITRON)
        else:
            d.rounded_rectangle((x, y, x + kk, y + kk), radius=RADIUS * scale * k, outline=OUTLINE, width=max(1, round(OUTLINE_W * scale * k)))
        gcol = CITRON_INK if filled else GLYPH
        gw = max(1, round(GLYPH_W * scale * k))
        lines, dots = glyph_shapes(g, cx / k, cy / k, scale)
        for x1, y1, x2, y2 in lines:
            d.line((x1 * k, y1 * k, x2 * k, y2 * k), fill=gcol, width=gw)
            for ex, ey in ((x1, y1), (x2, y2)):
                d.ellipse((ex * k - gw / 2, ey * k - gw / 2, ex * k + gw / 2, ey * k + gw / 2), fill=gcol)
        for dx, dy, r in dots:
            d.ellipse(((dx - r) * k, (dy - r) * k, (dx + r) * k, (dy + r) * k), fill=gcol)
    return img.resize((size, size), Image.LANCZOS)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    print("wrote", path.relative_to(ROOT))


def main() -> None:
    # SVG sources
    brand = ROOT / "assets/brand"
    write(brand / "calc-mark.svg", svg_mark())
    write(brand / "calc-mark-transparent.svg", svg_mark(background=None))
    write(brand / "calc-mark-mono-white.svg", svg_mark(background=None, mono="#FFFFFF"))
    write(brand / "calc-lockup.svg", svg_lockup())
    write(ROOT / "public/favicon.svg", svg_mark())

    # Android: adaptive icon from vectors, themed (monochrome) icon, dark background
    write(RES / "drawable/ic_calc_foreground.xml", android_vector(mono=False))
    write(RES / "drawable/ic_calc_monochrome.xml", android_vector(mono=True))
    write(
        RES / "mipmap-anydpi-v26/ic_launcher.xml",
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@drawable/ic_calc_foreground"/>\n'
        '    <monochrome android:drawable="@drawable/ic_calc_monochrome"/>\n</adaptive-icon>\n',
    )
    write(
        RES / "mipmap-anydpi-v26/ic_launcher_round.xml",
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@drawable/ic_calc_foreground"/>\n'
        '    <monochrome android:drawable="@drawable/ic_calc_monochrome"/>\n</adaptive-icon>\n',
    )
    write(
        RES / "values/ic_launcher_background.xml",
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG}</color>\n</resources>\n',
    )

    # Legacy PNG launcher icons (Android 7 and 7.1 have no adaptive icons)
    for density, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        draw_mark(px).save(RES / f"mipmap-{density}/ic_launcher.png")
        draw_mark(px, shape="round").save(RES / f"mipmap-{density}/ic_launcher_round.png")
    print("wrote legacy launcher PNGs (5 densities, square and round)")

    # Splash images: dark ground with the mark in the middle, at each existing size (no white flash on a dark app)
    n = 0
    for splash in RES.glob("drawable*/splash.png"):
        w, h = Image.open(splash).size
        side = int(min(w, h) * 0.30)
        canvas = Image.new("RGBA", (w, h), BG)
        canvas.alpha_composite(draw_mark(side, background=None, shape="none"), ((w - side) // 2, (h - side) // 2))
        canvas.convert("RGB").save(splash)
        n += 1
    print(f"wrote {n} splash images")

    # Store-size preview and a contact sheet to look at
    draw_mark(512).save(brand / "calc-icon-512.png")
    sheet = Image.new("RGB", (1180, 560), "#1B1B1B")
    x = 30
    for size in (320, 192, 96, 48):
        sheet.paste(draw_mark(size), (x, 30), draw_mark(size))
        x += size + 30
    x = 30
    for size in (192, 96, 48):
        sheet.paste(draw_mark(size, shape="round"), (x, 380), draw_mark(size, shape="round"))
        x += size + 30
    light = Image.new("RGB", (330, 170), "#F2F2F2")
    light.paste(draw_mark(128), (20, 21), draw_mark(128))
    light.paste(draw_mark(64), (180, 21), draw_mark(64))
    sheet.paste(light, (800, 360))
    sheet.save(brand / "preview.png")
    print("wrote assets/brand/calc-icon-512.png and preview.png")


if __name__ == "__main__":
    main()
