"""Serve two checkouts on one origin with their GitHub Pages paths."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
ROOT = Path(__file__).resolve().parents[4]
OTHER = Path(os.environ.get('PWA_9062_ROOT', ROOT.parent / '9062')).resolve()
class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm'}
    def translate_path(self, url):
        from urllib.parse import urlsplit, unquote
        path = unquote(urlsplit(url).path)
        base, relative = (OTHER, path[len('/9062/'):]) if path.startswith('/9062/') else (ROOT, path[len('/chess/'):]) if path.startswith('/chess/') else (ROOT, '__missing__')
        target = (base / relative).resolve()
        return str(target) if target.is_relative_to(base) else str(base / '__missing__')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *args): pass
if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 4174), Handler).serve_forever()
