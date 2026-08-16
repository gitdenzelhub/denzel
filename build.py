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

def render_nav(rows):
    return "\n".join(
        f'      <a class="link" href="{attr(col(r, 1, "#"))}">{esc(col(r, 0))}</a>'
        for r in rows
    )


def render_stats(rows):
    NUMERIC = re.compile(r"^[0-9.,]+$")
    out = []

    for row in rows:
        value = col(row, 0)
        label = col(row, 1)
        counts = "count" in [c.lower() for c in row[2:]]

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

        out.append(
            '        <div class="stat reveal">\n'
            f'          <dt class="stat-value">{"".join(pieces)}</dt>\n'
            f'          <dd class="stat-label">{esc(label)}</dd>\n'
            "        </div>"
        )

    return "\n".join(out)


def render_reels(rows):
    out = []
    for i, row in enumerate(rows, start=1):
        caption, label, link = col(row, 0), col(row, 1), col(row, 2, "#")
        out.append(
            '        <li class="reel-row">\n'
            f'          <a class="reel-link" href="{attr(link)}" target="_blank" rel="noopener noreferrer">\n'
            f'            <span class="reel-index">{i:02d}</span>\n'
            f'            <h3 class="reel-title">{esc(caption)}</h3>\n'
            f'            <p class="reel-meta">{esc(label)}</p>\n'
            '            <span class="reel-cta">Watch</span>\n'
            '            <span class="reel-arrow" aria-hidden="true">↗</span>\n'
            "          </a>\n"
            "        </li>"
        )
    return "\n".join(out)


def render_logos(rows):
    out = []
    for row in rows:
        name, logo = col(row, 0), col(row, 1)
        if logo:
            out.append(
                '        <li class="logo reveal">\n'
                f'          <img src="assets/logos/{attr(logo)}" alt="{attr(name)}"\n'
                "               onerror=\"this.closest('.logo').classList.add('is-empty'); this.remove();\">\n"
                f'          <span class="logo-fallback">{esc(name)}</span>\n'
                "        </li>"
            )
        else:
            # No file given, so go straight to the wordmark.
            out.append(
                '        <li class="logo reveal is-empty">\n'
                f'          <span class="logo-fallback">{esc(name)}</span>\n'
                "        </li>"
            )
    return "\n".join(out)


def render_tags(rows):
    return "\n".join(f"            <li>{esc(col(r, 0))}</li>" for r in rows)


def render_contact_links(sections):
    email = field(sections, "contact", "email")
    phone = field(sections, "contact", "phone")
    insta = field(sections, "contact", "instagram").lstrip("@")

    out = []
    if email:
        out.append(f'        <a class="link" href="mailto:{attr(email)}">{esc(email)}</a>')
    if phone:
        tel = re.sub(r"[^\d+]", "", phone)
        out.append(f'        <a class="link" href="tel:{attr(tel)}">{esc(phone)}</a>')
    if insta:
        out.append(
            f'        <a class="link" href="https://instagram.com/{attr(insta)}" '
            f'target="_blank" rel="noopener noreferrer">@{esc(insta)}</a>'
        )
    return "\n".join(out)


# ── Assembly ─────────────────────────────────────────────────────────────

def build():
    if not CONTENT.exists():
        sys.exit(f"missing {CONTENT.name}")
    if not TEMPLATE.exists():
        sys.exit(f"missing {TEMPLATE.name}")

    s = parse(CONTENT.read_text(encoding="utf-8"))

    name = field(s, "header", "name", "Name")
    headline = field(s, "hero", "headline")
    male = field(s, "numbers", "male", "50")
    female = field(s, "numbers", "female", "50")
    photo = field(s, "about", "photo", "assets/photo.jpg")

    initials = field(s, "about", "initials") or "".join(
        w[0] for w in name.split() if w
    ).upper()[:2]

    tokens = {
        "META_TITLE": esc(field(s, "meta", "title", name)),
        "META_DESCRIPTION": attr(field(s, "meta", "description")),
        "SHARE_TEXT": attr(field(s, "meta", "share-text")),

        "NAME": esc(name),
        "NAV": render_nav(items(s, "header")),

        "HERO_EYEBROW": esc(field(s, "hero", "eyebrow")),
        # The sr-only copy is the headline without the line markers.
        "HERO_HEADLINE_PLAIN": esc(re.sub(r"\s*\|\s*", " ", headline)),
        "HERO_HEADLINE": attr(headline),
        "HERO_INTRO": esc(field(s, "hero", "intro")),
        "HERO_SCROLL": esc(field(s, "hero", "scroll", "Scroll")),

        "NUMBERS_HEADING": esc(field(s, "numbers", "heading")),
        "NUMBERS_TAG": esc(field(s, "numbers", "tag")),
        "STATS": render_stats(items(s, "numbers")),
        "SPLIT_HEADING": esc(field(s, "numbers", "split-heading")),
        "SPLIT_ARIA": attr(
            f"Audience gender split: {male} percent male, {female} percent female"
        ),
        "MALE": attr(male),
        "FEMALE": attr(female),

        "CONTENT_HEADING": esc(field(s, "content", "heading")),
        "CONTENT_COUNT": f"{len(items(s, 'content')):02d}",
        "REELS": render_reels(items(s, "content")),

        "BRANDS_HEADING": esc(field(s, "brands", "heading")),
        "BRANDS_COUNT": f"{len(items(s, 'brands')):02d}",
        "LOGOS": render_logos(items(s, "brands")),

        "PHOTO": attr(photo),
        "PHOTO_WEBP": attr(field(s, "about", "photo-webp", photo)),
        "PHOTO_ALT": attr(field(s, "about", "photo-alt", name)),
        "INITIALS": esc(initials),
        "ABOUT_KICKER": esc(field(s, "about", "kicker")),
        "ABOUT_LEDE": esc(field(s, "about", "lede")),
        "ABOUT_BODY": esc(field(s, "about", "body")),
        "ABOUT_TAGS": render_tags(items(s, "about")),

        "CONTACT_KICKER": esc(field(s, "contact", "kicker")),
        "CONTACT_CTA": esc(field(s, "contact", "cta")),
        "CONTACT_CTA_EM": esc(field(s, "contact", "cta-emphasis")),
        "EMAIL": attr(field(s, "contact", "email")),
        "CONTACT_LINKS": render_contact_links(s),
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
