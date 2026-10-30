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

Behind the hero sits the cursor-reactive dust field carried over from the
original site: a few thousand drifting particles across eight depth layers,
which scatter and swirl around the pointer. It is off on phones, where
there is no cursor to react to and the battery cost is not worth it.

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

While Denzel is choosing, `compare: on` in the same block puts a small grey
arrow in the bottom corner. Clicking it opens the five colour swatches, and
clicking anywhere else (or pressing Escape) puts it away. Collapsed by
default so it never competes with the page. Set it to `off` once he has
picked, and put his choice in `palette`. `?compare=1` on the URL does the
same thing without editing anything.

## Editing without code

Double-click **`Edit Website.bat`** (Windows) or **`Edit Website.command`**
(Mac). A page opens in the browser with the follower count, engagement
rate, audience split, stat boxes, reels, brands and contact details as plain
form fields. Reels can be added by pasting their Instagram link, given a
caption and pillar, reordered or removed. Brands can be added, removed, reordered and given a logo by
uploading any PNG, JPG or SVG; the page converts it to the same silhouette
format the rest of the logo wall uses. **Save & preview** shows the real
site with the change, and **Publish** pushes it to GitHub, which puts it
live a minute or two later.

Needs Python 3 and Git on the computer, and a GitHub login with push
access to this repo (Git asks for it the first time). The editor pulls the
latest version from GitHub when it opens, so it never edits a stale copy.
It only listens on this computer.

### From a phone

The same editor is published with the site at
**https://gitdenzelhub.github.io/denzel/edit/**. Bookmark it or add it to
the home screen. Nothing needs installing; it saves straight to GitHub.

The first time, it asks to connect: sign in to GitHub as `gitdenzelhub`,
tap **Create a key on GitHub**, give the key access to the `denzel`
repository with **Contents: Read and write**, and paste it in. The key is
kept in that phone's browser only. Keys expire after a year; when one
does, the editor says so and asks for a new one.

On the phone there is no Save & preview and no "Get from Instagram"
button (the weekly update covers that). Publish commits `content.md` and
any new logos in one go, and the site redeploys a minute or two later.
Each save is applied to the newest version on GitHub, so it never undoes
the weekly follower update or a change made from another device.

The page itself is `edit/index.html`. It does all the reading and writing
of `content.md` in the browser; `tools/editor.py` only serves it locally
and handles Git on a computer.

## Updating the follower count

Double-click **`Update Followers.bat`** / **`Update Followers.command`**, or:

```bash
python tools/update_followers.py            # read Instagram, update, publish
python tools/update_followers.py 2250       # use this number instead
python tools/update_followers.py --no-push  # update content.md only
```

It reads the count from the public profile page at instagram.com/dnzlszn.
Instagram sometimes answers with a login page instead, so for a reliable
read, save an Instagram API access token (from a Meta developer app linked
to @dnzlszn as a professional account) in `instagram-token.txt` next to
`content.md`. That file is gitignored. If neither works, the script asks
for the number.

The page never shows fewer followers than `followers-minimum` in
`content.md` (2,250), so a week where the real count dips leaves the
number on the site where it is.

### Weekly automatic update

`.github/workflows/update-followers.yml` runs the same script every Monday
at 10:00 Dubai time, commits the new count if it changed, and redeploys.
It can also be started by hand from the repo's Actions tab ("Weekly
follower count" → Run workflow).

Instagram often refuses requests from GitHub's servers. When it does, that
week is skipped and the count stays as it was. For a reliable weekly read,
add the Instagram API token as a repository secret named `IG_ACCESS_TOKEN`
(Settings → Secrets and variables → Actions). GitHub also pauses scheduled
workflows after 60 days with no commits to the repo; re-enable it from
the Actions tab if that happens.

## Editing content

Open `content.md`, change what you need, save, refresh the browser.

- `key: value` sets a single field.
- `- a | b | c` adds a row to a list. Columns are documented above each list.
- Any other line is ignored, so notes are safe to leave in the file.

Figures that appear in more than one place are written once and dropped
in elsewhere as placeholders, so one edit updates the whole page:

| Placeholder | Comes from | Example |
|---|---|---|
| `{followers}` | `followers:` under Numbers | 2,250 |
| `{followers-over}` | the same, rounded down | 2,000 ("over 2,000 people") |
| `{engagement}` | `hero-value:` under Numbers | 5.75 |
| `{partners}` | the number of rows under Partners | 8 |

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
| `male:` | `female` (100 minus male), split-bar width and its screen-reader label |

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
  These are generated silhouettes, not the original artwork. A missing
  file falls back to the brand name set as a wordmark.
- `logo-sources/` — the original logo files, kept out of the deployed site.

### Replacing a logo

Drop the new file into `logo-sources/`, then run:

```bash
python tools/normalize_logos.py     # needs Pillow
```

It rewrites `assets/logos/` and keeps the filename, so `content.md` does
not change. The partner wall has to sit on five different grounds, and the
logos arrive in three incompatible forms: dark marks on transparency,
white marks on transparency, and light marks baked onto an opaque coloured
square. No single CSS filter can reconcile those, so each logo is stored as
an alpha silhouette instead. One rule then reads correctly everywhere.
The site build itself never touches images, so GitHub Actions needs no
extra dependencies.

## Notes

- Motion respects `prefers-reduced-motion`: all travel is dropped and the
  pass stops swinging, but the hero still cross-fades in.
- The timing strip stays hidden over the opening frame and slides up once
  you start scrolling, so the first thing a brand sees is uncluttered.
- If the GSAP CDN is unreachable the page renders fully visible rather than
  blank. Every entrance state hangs off a class set only when GSAP loads,
  and the hero waits on the display font with a 1.8 s failsafe.
- Logos sit at 60% opacity and come up to full on hover, in the page's own
  foreground colour rather than their brand colours. See above for why.
- The timing strip clock is Asia/Dubai regardless of the visitor's timezone.
- The hero dust reads its two colours from the live palette rather than
  hardcoding them, so it recolours with everything else. It pauses when the
  hero scrolls out of view or the tab is hidden, and draws a single still
  frame under `prefers-reduced-motion`.
