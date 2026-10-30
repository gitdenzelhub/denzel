"""
Shared plumbing for the follower updater and the local editor: rewriting
a single line of content.md, and getting a change onto GitHub.

Pushing to `main` is all it takes to go live, because the Pages workflow
rebuilds the site on every push.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content.md"

sys.path.insert(0, str(ROOT))
import build  # noqa: E402

REMOTE = "origin"
BRANCH = "main"
LIVE_URL = "https://gitdenzelhub.github.io/denzel"


class PublishError(Exception):
    """Raised with a message that is safe to show a non-programmer."""


# ── Editing content.md in place ──────────────────────────────────────────
# Touches only the line it is asked to, so every note and comment in
# content.md survives an edit. The editor page has its own copy of this
# (and of the list writer) in edit/index.html.

def _section_bounds(lines, section):
    start = None
    for i, line in enumerate(lines):
        if line.strip().startswith("## "):
            if start is not None:
                return start, i
            if line.strip()[3:].strip().lower() == section.lower():
                start = i + 1
    if start is None:
        raise KeyError(f"content.md has no '## {section}' section")
    return start, len(lines)


def set_field(text, section, key, value):
    lines = text.split("\n")
    start, end = _section_bounds(lines, section)
    pattern = re.compile(rf"^{re.escape(key)}\s*:")
    for i in range(start, end):
        if pattern.match(lines[i].strip()):
            lines[i] = f"{key}: {value}"
            return "\n".join(lines)
    raise KeyError(f"'{key}:' not found under '## {section}'")


# ── Git ──────────────────────────────────────────────────────────────────

def git(*args):
    try:
        result = subprocess.run(
            ["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
        )
    except FileNotFoundError:
        raise PublishError("Git is not installed on this computer, so the change could not be sent to GitHub.")
    if result.returncode != 0:
        raise PublishError(f"git {args[0]} failed:\n{(result.stderr or result.stdout).strip()}")
    return result.stdout.strip()


def check_branch():
    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    if branch != BRANCH:
        raise PublishError(
            f"This folder is on the '{branch}' branch, not '{BRANCH}'. "
            f"Switch with:  git checkout {BRANCH}"
        )


def sync():
    """Pull whatever is already on GitHub, so edits start from the latest."""
    check_branch()
    git("pull", "--rebase", "--autostash", REMOTE, BRANCH)


def publish(paths, message):
    """Rebuild, commit the given paths, and push. Returns a status line."""
    check_branch()
    build.build()

    git("add", "--", "index.html", *[str(p) for p in paths])
    if git("diff", "--cached", "--name-only"):
        git("commit", "-m", message)

    try:
        git("pull", "--rebase", "--autostash", REMOTE, BRANCH)
        # Also catches a commit left behind by an earlier push that failed.
        if git("rev-list", "--count", f"{REMOTE}/{BRANCH}..HEAD") == "0":
            return "Nothing had changed, so there was nothing to publish."
        git("push", REMOTE, f"HEAD:{BRANCH}")
    except PublishError as exc:
        raise PublishError(
            f"Saved on this computer, but it did not reach GitHub.\n{exc}\n\n"
            "Check the internet connection and try publishing again."
        )
    return f"Published. The live site updates in a minute or two: {LIVE_URL}"
