# Brand: the Calc logo

**The idea:** the logo is the keypad's own grammar. Three **outlined** keys (÷ × −) are things that act. One **filled citron**
key (=) is the single primary action. That is the app's design rule (`docs/DESIGN-SYSTEM.md` section 9) in one mark, so the
icon and the interface say the same thing.

Source: `assets/brand/calc-mark.svg`. Regenerate every size with `python3 scripts/make-brand-assets.py` (needs Pillow).
The script draws from one set of numbers, so the SVG, the Android icons and the PNGs cannot drift apart.

## Files

| File | Use |
|---|---|
| `assets/brand/calc-mark.svg` | The app icon: rounded square on the dark ground |
| `assets/brand/calc-mark-transparent.svg` | The mark alone, to place on your own dark ground |
| `assets/brand/calc-mark-mono-white.svg` | One colour, for the Android themed icon and watermarks |
| `assets/brand/calc-lockup.svg` | Mark and the word "Calc" (live text in IBM Plex Mono) |
| `assets/brand/calc-icon-512.png` | 512px store-size icon |
| `assets/brand/preview.png` | Contact sheet: sizes, round, light and dark grounds |
| `public/favicon.svg` | Browser tab icon |
| `android/app/src/main/res/drawable/ic_calc_foreground.xml` | Adaptive icon foreground (vector) |
| `android/app/src/main/res/drawable/ic_calc_monochrome.xml` | Themed icon (Android 13+) |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | Legacy icons for Android 7 and 7.1 |
| `android/app/src/main/res/drawable*/splash*.png` | Launch images: dark ground with the mark |

## Colours (from `src/lib/theme.ts`)

| Role | Value |
|---|---|
| Ground | `#060606` |
| Key outline | `#A4A4A4` (ink-2: readable at small sizes) |
| Glyphs | `#F5F5F5` (ink) |
| The one filled key | `#CCD539` (citron), with `#121300` for its glyph |

If the user's accent changes in Settings, the icon does not: an icon is identity, not a theme.

## Rules

- The mark sits on the dark ground. On a light surface, use the rounded-square version so the dark tile stays whole.
- Clear space: at least one key's width on every side.
- Smallest size: 24px for the mark. The mark has been checked down to 48px for the launcher.
- Never recolour the filled key, rotate or skew the mark, add a shadow or gradient, or put the word in another typeface.
- The adaptive icon keeps the keys inside the 66dp safe circle, so any phone's mask shape (circle, squircle, teardrop) leaves the whole grid visible.
