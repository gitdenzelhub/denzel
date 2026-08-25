"""
Renders index.html from content.md + template.html.

    python build.py

The dev server (serve.py) runs this automatically whenever content.md or
template.html changes, so during editing you only need to refresh the browser.
"""

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
CONTENT = ROOT / "content.md"
TEMPLATE = ROOT / "template.html"
OUTPUT = ROOT / "index.html"

# A line only counts as a field when the key looks like a key. This keeps
# prose such as "Rules: ..." from being swallowed as data.
FIELD = re.compile(r"^([a-z][a-z0-9-]*)\s*:\s*(.*)$")

# Every palette defined in styles.css, mapped to the browser chrome colour
# that matches its page ground.
PALETTES = {
    "night": "#0a0e17",
    "bib": "#ffffff",
    "gulf": "#152bc4",
    "blackout": "#000000",
    "sand": "#ebe3d3",
}


def parse(text):
    """content.md -> {section: {"fields": {...}, "items": [[col, ...], ...]}}"""
    sections, current = {}, None

    for raw in text.splitlines():
        line = raw.strip()

        if line.startswith("## "):
            current = line[3:].strip().lower()
            sections[current] = {"fields": {}, "items": []}
            continue

        if current is None or not line:
            continue

        if line.startswith("- "):
            cols = [c.strip() for c in line[2:].split("|")]
            sections[current]["items"].append(cols)
            continue

        match = FIELD.match(line)
        if match:
            sections[current]["fields"][match.group(1)] = match.group(2).strip()

    return sections


def esc(value):
    return html.escape(str(value), quote=False)


def attr(value):
    return html.escape(str(value), quote=True)


def field(sections, section, key, default=""):
    return sections.get(section, {}).get("fields", {}).get(key, default)


def items(sections, section):
    return sections.get(section, {}).get("items", [])


def col(row, index, default=""):
    return row[index] if len(row) > index and row[index] else default


# ── Block renderers ──────────────────────────────────────────────────────

def render_nav(rows, link_class):
    return "\n".join(
        f'      <a class="{link_class}" href="{attr(col(r, 1, "#"))}">{esc(col(r, 0))}</a>'
        for r in rows
    )


def render_hero_stack(rows):
    out = []
    for r in rows:
        text = col(r, 0)
        out.append(
            '          <span class="hero-line" aria-hidden="true">'
            f'<span class="hero-line-inner">{esc(text)}</span></span>'
        )
    return "\n".join(out)


def render_ticker(rows):
    out = []
    for r in rows:
        out.append(
            f'          <span class="ticker-item">{esc(col(r, 0))}'
            '<span class="ticker-sep">✦</span></span>'
        )
    return "\n".join(out)


def render_manifesto(rows):
    return "\n".join(
        '          <p class="manifesto-line">'
        f'<span class="manifesto-line-inner">{esc(col(r, 0))}</span></p>'
        for r in rows
    )


def render_benchmarks(rows):
    """label|value|me rows -> comparison bars, scaled to the largest value."""
    values = []
    for r in rows:
        try:
            values.append(float(col(r, 1, "0")))
        except ValueError:
            values.append(0.0)
    peak = max(values) if values else 1.0

    out = []
    for r, v in zip(rows, values):
        label = col(r, 0)
        pct = round(v / peak * 100, 2) if peak else 0
        me = " is-me" if col(r, 2).lower() == "me" else ""
        out.append(
            f'              <div class="bench-row{me}">\n'
            f'                <span class="bench-label mono">{esc(label)}</span>\n'
            f'                <span class="bench-track"><span class="bench-fill" style="--w: {pct}%"></span></span>\n'
            f'                <span class="bench-value mono">{esc(f"{v:.2f}")}%</span>\n'
            "              </div>"
        )
    return "\n".join(out)


def bench_aria(rows):
    parts = [f"{col(r, 0)} {col(r, 1)} percent" for r in rows]
    return attr("Engagement compared: " + ", ".join(parts))


def render_stats(rows):
    NUMERIC = re.compile(r"^[0-9.,]+$")
    out = []

    for row in rows:
        value = col(row, 0)
        label = col(row, 1)
        note = col(row, 2)
        counts = "count" in [c.lower() for c in row[3:]]

        # Split "5.75%" into ["5.75", "%"] so the unit can be accented.
        parts = re.findall(r"[0-9.,]+|[^0-9.,]+", value)
        has_digit = any(NUMERIC.match(p) for p in parts)

        pieces, counted = [], False
        for part in parts:
            if NUMERIC.match(part):
                if counts and not counted:
                    counted = True
                    number = part.replace(",", "")
                    decimals = len(number.split(".")[1]) if "." in number else 0
                    commas = " data-commas" if "," in part else ""
                    pieces.append(
                        f'<span data-count="{attr(number)}" '
                        f'data-decimals="{decimals}"{commas}>{esc(part)}</span>'
                    )
                else:
                    pieces.append(esc(part))
            elif has_digit:
                pieces.append(f'<span class="stat-unit">{esc(part)}</span>')
            else:
                pieces.append(esc(part))

        note_html = f'\n          <dd class="stat-note">{esc(note)}</dd>' if note else ""
        out.append(
            '        <div class="stat reveal">\n'
            f'          <dt class="stat-label mono">{esc(label)}</dt>\n'
            f'          <dd class="stat-value">{"".join(pieces)}</dd>'
            f"{note_html}\n"
            "        </div>"
        )

    return "\n".join(out)


def render_values(rows):
    out = []
    for row in rows:
        figure, text, support = col(row, 0), col(row, 1), col(row, 2)
        sup = f'\n              <p class="value-support mono">{esc(support)}</p>' if support else ""
        out.append(
            '          <li class="value-row reveal">\n'
            f'            <p class="value-figure">{esc(figure)}</p>\n'
            '            <div class="value-copy">\n'
            f'              <p class="value-text">{esc(text)}</p>'
            f"{sup}\n"
            "            </div>\n"
            "          </li>"
        )
    return "\n".join(out)


ARABIC_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def render_pillars(rows):
    out = []
    for row in rows:
        number, name, desc = col(row, 0), col(row, 1), col(row, 2)
        # Faded Arabic-Indic numeral watermark — a small nod to home turf.
        arabic = number.translate(ARABIC_DIGITS)
        out.append(
            f'          <li class="pillar reveal" data-arabic="{attr(arabic)}">\n'
            f'            <p class="pillar-index mono">{esc(number)}</p>\n'
            f'            <h3 class="pillar-name">{esc(name)}</h3>\n'
            f'            <p class="pillar-desc">{esc(desc)}</p>\n'
            "          </li>"
        )
    return "\n".join(out)


def render_reels(rows):
    out = []
    for i, row in enumerate(rows, start=1):
        title, pillar, link = col(row, 0), col(row, 1), col(row, 2, "#")
        out.append(
            '          <li class="reel-row">\n'
            f'            <a class="reel-link" href="{attr(link)}" target="_blank" rel="noopener noreferrer">\n'
            f'              <span class="reel-index mono">{i:02d}</span>\n'
            f'              <h3 class="reel-title">{esc(title)}</h3>\n'
            f'              <span class="reel-pill mono">{esc(pillar)}</span>\n'
            '              <span class="reel-cta mono">Watch</span>\n'
            '              <span class="reel-arrow" aria-hidden="true">↗</span>\n'
            "            </a>\n"
            "          </li>"
        )
    return "\n".join(out)


def render_logos(rows):
    out = []
    for row in rows:
        name, logo, url = col(row, 0), col(row, 1), col(row, 2)
        classes = "logo reveal" + ("" if logo else " is-empty")

        pieces = []
        if logo:
            pieces.append(
                f'<img src="assets/logos/{attr(logo)}" alt="{attr(name)}" loading="lazy"\n'
                "                 onerror=\"this.closest('.logo').classList.add('is-empty'); this.remove();\">"
            )
        pieces.append(f'<span class="logo-fallback">{esc(name)}</span>')
        inner = "\n            ".join(pieces)

        if url:
            inner = (
                f'<a class="logo-link" href="{attr(url)}" '
                f'target="_blank" rel="noopener noreferrer" '
                f'aria-label="{attr(name)}">\n'
                f"            {inner}\n"
                "          </a>"
            )

        out.append(
            f'        <li class="{classes}">\n'
            f"          {inner}\n"
            "        </li>"
        )
    return "\n".join(out)


def render_offers(rows):
    out = []
    for i, row in enumerate(rows, start=1):
        name, desc = col(row, 0), col(row, 1)
        out.append(
            '          <li class="offer-row reveal">\n'
            f'            <span class="offer-index mono">{i:02d}</span>\n'
            '            <div class="offer-copy">\n'
            f'              <h3 class="offer-name">{esc(name)}</h3>\n'
            f'              <p class="offer-desc">{esc(desc)}</p>\n'
            "            </div>\n"
            '            <span class="offer-arrow" aria-hidden="true">→</span>\n'
            "          </li>"
        )
    return "\n".join(out)


def render_tags(rows):
    return "\n".join(f"            <li>{esc(col(r, 0))}</li>" for r in rows)


def render_contact_links(sections):
    email = field(sections, "contact", "email")
    phone = field(sections, "contact", "phone")
    whatsapp = re.sub(r"[^\d]", "", field(sections, "contact", "whatsapp"))
    insta = field(sections, "contact", "instagram").lstrip("@")

    def card(label, value, href, external=False):
        target = ' target="_blank" rel="noopener noreferrer"' if external else ""
        return (
            f'        <a class="contact-link reveal" href="{attr(href)}"{target}>\n'
            f'          <span class="contact-link-label mono">{esc(label)}</span>\n'
            f'          <span class="contact-link-value">{esc(value)}</span>\n'
            '          <span class="contact-link-arrow" aria-hidden="true">↗</span>\n'
            "        </a>"
        )

    out = []
    if email:
        out.append(card("Email", email, f"mailto:{email}"))
    if whatsapp:
        out.append(card("WhatsApp", field(sections, "contact", "phone", whatsapp),
                        f"https://wa.me/{whatsapp}", external=True))
    if insta:
        out.append(card("Instagram", f"@{insta}",
                        f"https://instagram.com/{insta}", external=True))
    if phone:
        tel = re.sub(r"[^\d+]", "", phone)
        out.append(card("Call", phone, f"tel:{tel}"))
    return "\n".join(out)


# ── Assembly ─────────────────────────────────────────────────────────────

def build():
    if not CONTENT.exists():
        sys.exit(f"missing {CONTENT.name}")
    if not TEMPLATE.exists():
        sys.exit(f"missing {TEMPLATE.name}")

    s = parse(CONTENT.read_text(encoding="utf-8"))

    owner = field(s, "meta", "owner", "Denzel")
    name = field(s, "header", "name", owner)
    stack_rows = items(s, "hero")
    stack_plain = " ".join(col(r, 0) for r in stack_rows)
    male = field(s, "numbers", "male", "50")
    female = field(s, "numbers", "female", "50")
    photo = field(s, "story", "photo", "assets/denzel.jpg")

    initials = field(s, "story", "initials") or "".join(
        w[0] for w in owner.split() if w
    ).upper()[:2]

    # Palette ships baked into the markup so the page paints correctly on
    # first frame, with no flash of the default scheme.
    palette = field(s, "meta", "palette", "night").lower()
    if palette not in PALETTES:
        print(f"warning: unknown palette {palette!r}, using 'night'")
        palette = "night"

    # `compare: on` ships the palette switcher with the page, so it can be
    # handed to someone to choose from without a URL parameter.
    compare_on = field(s, "meta", "compare", "off").lower() in ("on", "yes", "true")
    compare = "on" if compare_on else "off"
    site_url = field(s, "meta", "site-url", "").rstrip("/")

    tokens = {
        "PALETTE": attr(palette),
        "THEME_COLOR": attr(PALETTES[palette]),
        "COMPARE": attr(compare),
        "OG_IMAGE": attr(site_url + "/assets/og.jpg" if site_url else "assets/og.jpg"),

        "META_TITLE": esc(field(s, "meta", "title", name)),
        "META_DESCRIPTION": attr(field(s, "meta", "description")),
        "SHARE_TEXT": attr(field(s, "meta", "share-text")),

        "NAME": esc(name),
        "NAME_PLAIN": esc(owner),
        "NAV": render_nav(items(s, "header"), "nav-link mono"),
        "NAV_MOBILE": render_nav(items(s, "header"), "mobile-link"),

        "HERO_EYEBROW": esc(field(s, "hero", "eyebrow")),
        "HERO_STACK": render_hero_stack(stack_rows),
        "HERO_STACK_PLAIN": esc(stack_plain),
        "DEF_TERM": esc(field(s, "hero", "definition-term")),
        "DEF_SAY": esc(field(s, "hero", "definition-say")),
        "DEF_TEXT": esc(field(s, "hero", "definition-text")),
        "HERO_INTRO": esc(field(s, "hero", "intro")),
        "HERO_PHOTO": attr(field(s, "hero", "photo", "assets/front-page-mobile.jpeg")),
        "HERO_PHOTO_CAPTION": esc(field(s, "hero", "photo-caption")),
        "HERO_SCROLL": esc(field(s, "hero", "scroll", "Scroll")),
        "BIB": esc(field(s, "hero", "bib", "0000")),
        "PASS_TEAM": esc(field(s, "hero", "pass-team", "")).upper(),
        "PASS_LICENSE": esc(field(s, "hero", "license", "")).upper(),

        "TICKER": render_ticker(items(s, "ticker")),

        "MANIFESTO_KICKER": esc(field(s, "manifesto", "kicker")),
        "MANIFESTO_LINES": render_manifesto(items(s, "manifesto")),
        "MANIFESTO_SOUL": esc(field(s, "manifesto", "soul")),

        "NUMBERS_HEADING": esc(field(s, "numbers", "heading")),
        "NUMBERS_TAG": esc(field(s, "numbers", "tag")),
        "ER_VALUE": attr(field(s, "numbers", "hero-value", "0")),
        "ER_UNIT": esc(field(s, "numbers", "hero-unit", "%")),
        "ER_LABEL": esc(field(s, "numbers", "hero-label")),
        "ER_NOTE": esc(field(s, "numbers", "hero-note")),
        "BENCHMARKS": render_benchmarks(items(s, "benchmarks")),
        "BENCH_ARIA": bench_aria(items(s, "benchmarks")),
        "STATS": render_stats(items(s, "numbers")),
        "SPLIT_HEADING": esc(field(s, "numbers", "split-heading")),
        "SPLIT_ARIA": attr(
            f"Audience gender split: {male} percent male, {female} percent female"
        ),
        "MALE": attr(male),
        "FEMALE": attr(female),

        "VALUE_HEADING": esc(field(s, "value", "heading")),
        "VALUE_TAG": esc(field(s, "value", "tag")),
        "VALUES": render_values(items(s, "value")),

        "PILLARS_HEADING": esc(field(s, "pillars", "heading")),
        "PILLARS_TAG": esc(field(s, "pillars", "tag")),
        "PILLARS": render_pillars(items(s, "pillars")),

        "WORK_HEADING": esc(field(s, "work", "heading")),
        "WORK_TAG": esc(field(s, "work", "tag")),
        "REELS": render_reels(items(s, "work")),
        "WORK_IG": attr(field(s, "work", "instagram", "dnzlszn").lstrip("@")),

        "PARTNERS_HEADING": esc(field(s, "partners", "heading")),
        "PARTNERS_TAG": esc(field(s, "partners", "tag")),
        "LOGOS": render_logos(items(s, "partners")),

        "OFFER_HEADING": esc(field(s, "offer", "heading")),
        "OFFER_TAG": esc(field(s, "offer", "tag")),
        "OFFERS": render_offers(items(s, "offer")),

        "PHOTO": attr(photo),
        "PHOTO_WEBP": attr(field(s, "story", "photo-webp", photo)),
        "PHOTO_ALT": attr(field(s, "story", "photo-alt", owner)),
        "PHOTO_CAPTION": esc(field(s, "story", "photo-caption")),
        "INITIALS": esc(initials),
        "STORY_KICKER": esc(field(s, "story", "kicker")),
        "STORY_LEDE": esc(field(s, "story", "lede")),
        "STORY_QUOTE": esc(field(s, "story", "quote")),
        "STORY_BODY": esc(field(s, "story", "body")),
        "STORY_TAGS": render_tags(items(s, "story")),

        "CONTACT_KICKER": esc(field(s, "contact", "kicker")),
        "CONTACT_CTA": esc(field(s, "contact", "cta")),
        "CONTACT_CTA_EM": esc(field(s, "contact", "cta-emphasis")),
        "CONTACT_NOTE": esc(field(s, "contact", "note")),
        "EMAIL": attr(field(s, "contact", "email")),
        "CONTACT_LINKS": render_contact_links(s),
        "LOCATION": esc(field(s, "contact", "location", "Dubai, UAE")),
        "COORDS": esc(field(s, "contact", "coords", "")),
        "FOOTER_LICENSE": esc(field(s, "contact", "license", "")),
    }

    page = TEMPLATE.read_text(encoding="utf-8")
    for key, value in tokens.items():
        page = page.replace("{{" + key + "}}", value)

    leftover = re.findall(r"\{\{([A-Z_]+)\}\}", page)
    if leftover:
        print("warning: unreplaced tokens ->", ", ".join(sorted(set(leftover))))

    OUTPUT.write_text(page, encoding="utf-8")
    return len(page)


if __name__ == "__main__":
    size = build()
    print(f"built index.html ({size:,} bytes) from content.md")
