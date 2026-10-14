# -*- coding: utf-8 -*-
# Serveur de developpement de la maquette : comme `python -m http.server`, mais SANS cache navigateur.
# Sans lui, le navigateur gardait l'ancienne page ou l'ancien script apres une modification (vu le 7 oct.).
#   python outils/serveur_dev.py 8741
import http.server, os, sys, functools

class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8741
racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
gestion = functools.partial(SansCache, directory=racine)
print("maquette DRAGLOGICS sur http://localhost:%d (racine %s, sans cache)" % (port, racine), flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), gestion).serve_forever()
