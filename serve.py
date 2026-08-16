"""
Dev server.

    python serve.py

Rebuilds index.html whenever content.md or template.html has changed, and
sends no-cache headers so a refresh always shows the current build.
"""

import http.server
import socketserver
from pathlib import Path

import build

ROOT = Path(__file__).parent
WATCHED = [ROOT / "content.md", ROOT / "template.html"]
PORT = 8899

_stamps = {}


def rebuild_if_stale():
    """Rebuild only when a source file's mtime has moved."""
    global _stamps
    current = {p.name: p.stat().st_mtime for p in WATCHED if p.exists()}
    if current == _stamps:
        return
    _stamps = current
    try:
        build.build()
        print("  rebuilt index.html")
    except Exception as exc:                      # keep serving the last good build
        print(f"  build failed: {exc}")


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Only the page itself needs a rebuild check; assets don't.
        if self.path in ("/", "/index.html"):
            rebuild_if_stale()
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    rebuild_if_stale()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"serving http://localhost:{PORT}/  (edit content.md, then refresh)")
        httpd.serve_forever()
