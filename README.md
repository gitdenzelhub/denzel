# DNZL SZN — media kit

A single-page media kit for Denzel: hybrid athlete and creator, Dubai.
Built to be sent to brands.

**Voice.** Everything on the page is written in the first person, because it
is his site. No em dashes, no marketing filler, and nothing that explains
the influencer industry back to the brand reading it.

**Design.** Three typographic voices, and colour handled entirely in tokens.

| Voice | Font | Used for |
|---|---|---|
| The athlete | Anton | poster-scale display caps |
| The timing | IBM Plex Mono | data, labels, splits |
| The soul | Instrument Serif (italic) | faith and human asides |

The racing runs through the page rather than sitting in an intro: a course
profile across the top that fills as you scroll and ticks off a checkpoint
at every section, a timing strip along the bottom with live Dubai time and
the current split, track lane lines behind the hero, bib-tag section
numbers, a start-list treatment for the work rows, and a chequered finish
line just before the contact section.

The centrepiece is the **athlete pass**: his photo, bib number, team and UAE
media licence on a laminated card. Strap and card hang off one rig, so
moving the pointer swings the whole assembly from its anchor the way a real
lanyard would, while the card tips on its own axis.

## Choosing the colour scheme

Set `palette:` in the `## Meta` block of `content.md`. Five are built in:

| `palette:` | Look |
|---|---|
| `night` | floodlit dark navy, cool white, start-line red (default) |
| `bib` | white paper, press black, race red. Prints beautifully |
| `gulf` | ultramarine field, bone type, amber |
| `blackout` | black and bone, no accent colour. His photos carry it |
| `sand` | the original warm dusk |

Every colour on the site is a CSS custom property, so a palette swap never
touches a component rule. Panels (the manifesto, work and contact sections,
and the "why small wins" band) remap those tokens locally, which is why the
same rules work on inverted grounds.

While Denzel is choosing, `compare: on` in the same block ships a small
switcher in the bottom corner so he can try all five on the real page.
Set it to `off` once he has picked, and put his choice in `palette`.
`?compare=1` on the URL does the same thing without editing anything.

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
| benchmark rows | bar widths scaled to the largest value; the row flagged `me` is drawn in the accent |
| pillar numbers `01` | the Arabic-numeral watermark `٠١` |
| `palette:` | the `data-palette` attribute and the browser chrome colour |
| `compare:` | whether the palette switcher ships with the page |
| `site-url:` | the absolute URL of the Open Graph share image |
| `+971 50 917 9493` | the `tel:` and `wa.me` links |
| `male:` / `female:` | split-bar width and its screen-reader label |

## Running it

```bash
python serve.py     # http://localhost:8899 — rebuilds on refresh
```

Or build once and serve the output however you like:

```bash
python build.py     # writes index.html
```

`index.html` is generated. Edit `content.md` for text, or `template.html`
for markup. Never `index.html` directly.

## Deploying

Pushing to `main` deploys via GitHub Pages automatically (see
`.github/workflows/deploy.yml`). The workflow rebuilds `index.html` from
`content.md`, so editing `content.md` in the GitHub web editor is enough to
update the live site.

## Handy URLs

- `?static=1` renders the settled page with no motion. Use it for
  screenshots, or print it (Ctrl/Cmd+P) to hand a brand the kit as a PDF.
  A print stylesheet reflows the whole site for paper.
- `?compare=1` shows the palette switcher without editing `content.md`.

## Assets

- `assets/front-page-mobile.jpeg` — athlete-pass photo (DEKA, Etihad Arena)
- `assets/denzel.jpg` / `.webp` — story portrait, 800×1190
- `assets/og.jpg` — 1200×630 Open Graph share card
- `assets/favicon.svg` — browser-tab mark
- `assets/logos/` — brand logos, referenced by filename from `content.md`.
  A missing file falls back to the brand name set as a wordmark.

## Notes

- Motion respects `prefers-reduced-motion`: all travel is dropped and the
  pass stops swinging, but the hero still cross-fades in.
- The timing strip stays hidden over the opening frame and slides up once
  you start scrolling, so the first thing a brand sees is uncluttered.
- If the GSAP CDN is unreachable the page renders fully visible rather than
  blank. Every entrance state hangs off a class set only when GSAP loads,
  and the hero waits on the display font with a 1.8 s failsafe.
- Logos are normalised per palette: darkened on light grounds, knocked out
  to the page foreground on dark ones. They regain full colour on hover.
- The timing strip clock is Asia/Dubai regardless of the visitor's timezone.
