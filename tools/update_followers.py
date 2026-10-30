"""
Set the site's follower count from Instagram, then publish.

    python tools/update_followers.py            # fetch, update, push
    python tools/update_followers.py 2250       # skip the fetch, use this number
    python tools/update_followers.py --no-push  # update content.md only
    python tools/update_followers.py --auto     # never ask; used by the weekly Action

The site never shows fewer than `followers-minimum` in content.md, so a
week where the real count dips does not move the number on the page.

`.github/workflows/update-followers.yml` runs this every Monday.

On Windows, double-clicking `Update Followers.bat` runs the first one.

Where the number comes from, in order:

1. Instagram's official API, if an access token is saved in
   `instagram-token.txt` next to content.md (or in the IG_ACCESS_TOKEN
   environment variable). This is the reliable route. The token comes from
   a Meta developer app connected to @dnzlszn as a professional account;
   the file is gitignored so it never reaches GitHub.
2. The public profile page. Works some of the time. Instagram often sends a
   login page instead, especially after a few tries in a row.
3. Asking. If both fail, the script asks you to type the number in.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish import CONTENT, ROOT, PublishError, publish, set_field, sync  # noqa: E402

USERNAME = "dnzlszn"
TOKEN_FILE = ROOT / "instagram-token.txt"
GRAPH_URL = "https://graph.instagram.com/v21.0/me?fields=username,followers_count&access_token={}"
PROFILE_URL = f"https://www.instagram.com/{USERNAME}/"


class FetchError(Exception):
    pass


def _get(url):
    request = urllib.request.Request(url, headers={"Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def _token():
    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not token and TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    return token


def from_api(token):
    try:
        data = json.loads(_get(GRAPH_URL.format(token)))
    except urllib.error.HTTPError as exc:
        raise FetchError(f"the Instagram API refused the token (HTTP {exc.code}); it may have expired")
    if "followers_count" not in data:
        raise FetchError("the Instagram API did not return a follower count")
    return int(data["followers_count"])


def from_profile_page():
    """Read "2,250 Followers, ..." out of the page's share description."""
    page = _get(PROFILE_URL)
    meta = re.search(r'<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]+)"', page)
    found = meta and re.search(r"([\d.,]+)\s*([KkMm]?)\s+Followers", meta.group(1))
    if not found:
        raise FetchError("Instagram sent a login page instead of the profile")

    number, suffix = found.groups()
    if suffix:
        # "12.5K" is Instagram's own rounding. Close enough, but say so.
        print(f"  note: Instagram only showed a rounded figure ({number}{suffix})")
        return int(float(number.replace(",", "")) * (1_000 if suffix.lower() == "k" else 1_000_000))
    return int(number.replace(",", ""))


def fetch_followers():
    """Return the live follower count, or raise FetchError explaining why not."""
    token = _token()
    problems = []
    if token:
        try:
            return from_api(token)
        except (FetchError, urllib.error.URLError, ValueError) as exc:
            problems.append(f"API: {exc}")
    try:
        return from_profile_page()
    except (FetchError, urllib.error.URLError) as exc:
        problems.append(f"profile page: {exc}")
    raise FetchError("; ".join(problems))


def save_followers(count):
    text = CONTENT.read_text(encoding="utf-8")
    CONTENT.write_text(set_field(text, "numbers", "followers", str(count)), encoding="utf-8")


def current_followers():
    match = re.search(r"^followers:\s*([\d,]+)", CONTENT.read_text(encoding="utf-8"), re.M)
    return int(match.group(1).replace(",", "")) if match else None


def ask():
    try:
        typed = input(f"Type the follower count shown on instagram.com/{USERNAME}: ")
    except EOFError:
        return None
    digits = re.sub(r"[^\d]", "", typed)
    return int(digits) if digits else None


def main(argv):
    push = "--no-push" not in argv
    # --auto is for the weekly GitHub Action: never stop to ask, and treat a
    # failed read as "no change" rather than an error.
    auto = "--auto" in argv
    given = [a for a in argv if not a.startswith("--")]

    if push:
        sync()

    if given:
        count = int(re.sub(r"[^\d]", "", given[0]))
    else:
        print(f"Checking @{USERNAME} on Instagram...")
        try:
            count = fetch_followers()
        except FetchError as exc:
            print(f"Could not read the count automatically ({exc}).")
            if auto:
                print("::warning::Instagram did not return a follower count; leaving it as is.")
                return 0
            count = ask()
            if count is None:
                print("No number entered, nothing changed.")
                return 1

    before = current_followers()
    if count == before:
        print(f"Already showing {count:,} followers. Nothing to do.")
        return 0

    save_followers(count)
    print(f"Followers: {before:,} -> {count:,}" if before else f"Followers set to {count:,}")

    if push:
        print(publish([CONTENT], f"Update follower count to {count:,}"))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except PublishError as exc:
        print(exc)
        sys.exit(1)
