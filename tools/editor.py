"""
Run the website editor on this computer.

    python tools/editor.py

Or double-click `Edit Website.bat` (Windows) / `Edit Website.command` (Mac).

The editor itself is edit/index.html, the same page that is published at
<site>/edit/ for editing from a phone. Opened from here, it saves through
this server instead of the GitHub API: "Save & preview" writes the files
and rebuilds index.html, and "Publish" also commits and pushes with Git.

Only listens on this computer (127.0.0.1), and only accepts saves from its
own page.
"""

import base64
import binascii
import json
import re
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_followers  # noqa: E402
from publish import CONTENT, ROOT, PublishError, build, publish, sync  # noqa: E402

PORT = 8900

# The only files the page may write.
WRITABLE = re.compile(
    r"^(content\.md|assets/logos/[a-z0-9-]+\.png|logo-sources/[a-z0-9-]+\.(png|jpe?g|webp|gif|svg))$"
)


def write_files(files):
    written = []
    for f in files:
        path = f.get("path", "")
        if not WRITABLE.match(path):
            raise ValueError(f"The editor is not allowed to write {path!r}.")
        try:
            data = base64.b64decode(f["base64"], validate=True)
        except (KeyError, binascii.Error):
            raise ValueError("A file did not upload properly. Try choosing it again.")
        target = ROOT / path
        if target == CONTENT:
            # Text mode, so line endings match the rest of the checkout.
            target.write_text(data.decode("utf-8"), encoding="utf-8")
        else:
            target.write_bytes(data)
        written.append(target)
    return written


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def local_only(self):
        """Refuse requests addressed to anything but this machine."""
        host = self.headers.get("Host", "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def reply(self, status, payload, content_type="application/json"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.local_only():
            return self.send_error(HTTPStatus.FORBIDDEN)
        if self.path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", "/edit/")
            self.end_headers()
        elif self.path == "/api/file?path=content.md":
            self.reply(HTTPStatus.OK, CONTENT.read_bytes(), "text/plain; charset=utf-8")
        elif self.path == "/api/instagram":
            try:
                self.reply(HTTPStatus.OK, {"followers": update_followers.fetch_followers()})
            except Exception as exc:
                self.reply(HTTPStatus.BAD_GATEWAY, {"error": str(exc)})
        else:
            # The editor page, and the built site for previewing.
            super().do_GET()

    def do_POST(self):
        # The custom header can't be sent cross-site without a CORS
        # preflight, which this server never approves.
        if not self.local_only() or self.headers.get("X-Editor") != "1":
            return self.send_error(HTTPStatus.FORBIDDEN)
        if self.path != "/api/save":
            return self.send_error(HTTPStatus.NOT_FOUND)

        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length))
            changed = write_files(data.get("files", []))
            build.build()
            message = "Saved. Check the preview, then Publish."
            if data.get("publish"):
                message = publish(changed, data.get("message") or "Update site from the editor")
            self.reply(HTTPStatus.OK, {"message": message})
        except ValueError as exc:
            self.reply(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        except PublishError as exc:
            self.reply(HTTPStatus.BAD_GATEWAY, {"error": str(exc)})


def main():
    print("Getting the latest version from GitHub...")
    try:
        sync()
    except PublishError as exc:
        print(f"  could not update ({exc}). Editing the copy on this computer.")

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}/edit/"
    print(f"Editor open at {url}\nLeave this window open while editing. Close it when you are done.")
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
