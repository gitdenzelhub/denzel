# Denzel — media kit

A single-page brand kit and media kit for a hybrid athlete and content creator.
Dark editorial layout, oversized type, a cursor-reactive particle field, and
GSAP-driven scroll choreography.

All the text on the site is edited from one markdown file — no HTML required.

## Editing content

Open `content.md`, change what you need, save, refresh the browser.

- `key: value` sets a single field.
- `- a | b | c` adds a row to a list. Columns are documented above each list.
- Any other line is ignored, so notes are safe to leave in the file.

Several things are derived automatically so they cannot drift out of sync:

| Written in `content.md` | Derived for you |
|---|---|
| `5.75%` + `count` | count-up target, decimal places, accent-coloured unit |
| `1,890` + `count` | comma formatting |
| number of list rows | the `(04)` / `(06)` counts beside headings |
| `+971 50 917 9493` | the `tel:` link |
| `Documenting the \| real journey.` | line breaks for the headline animation, plus a screen-reader copy without the marker |
| `male:` / `female:` | split-bar width and its screen-reader label |

## Running it

```bash
python serve.py     # http://localhost:8899 — rebuilds on refresh
```

Or build once and serve the output however you like:

```bash
python build.py     # writes index.html
```

`index.html` is generated. Edit `content.md` for text, or `template.html` for
markup — never `index.html` directly.

## Deploying

Run `python build.py`, then publish these:

```
index.html
styles.css
main.js
assets/
```

The `.py` and `.md` files are only needed for authoring.

## Assets

- `assets/denzel.jpg` / `.webp` — portrait, 800×1190
- `assets/logos/` — brand logos, referenced by filename from `content.md`.
  A missing file falls back to the brand name set as a wordmark.

## Notes

- Motion respects `prefers-reduced-motion`: all travel and parallax is dropped,
  but the headline still cross-fades in.
- If the GSAP CDN is unreachable, the page renders fully visible rather than
  blank — the entrance states are gated behind a class set only when GSAP loads.
- Particle field is capped and drawn one depth layer per canvas path, so a
  ~3,000-particle field costs roughly 1.6 ms a frame.
