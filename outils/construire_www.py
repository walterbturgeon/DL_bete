# -*- coding: utf-8 -*-
# Construit www/ : le dossier web de l'APP NATIVE (Capacitor, iPhone et Android) = la maquette B SEULE, a plat.
#   - maquettes/b/index.html devient www/index.html (chemins « ../../ » retires) ; b.js, b.css, b-textes.js a cote ;
#   - js/, css/, img/ : seulement les fichiers que B charge ; lib/tesseract/ en entier (avec ses licences) ;
#   - lib/capacitor/ : le coeur Capacitor et le module Bluetooth (node_modules), charges AVANT js/kit.js.
# Rien d'autre : pas les maquettes A et C, pas l'apercu iPhone, pas le kit graphique, pas les outils.
# Chaque remplacement est compte ; un fichier manquant ou un compte faux arrete tout (un echec doit se voir).
#   python outils/construire_www.py        (npm install d'abord, pour node_modules)
import os, re, shutil, sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..'))
WWW = os.path.join(RACINE, 'www')


def lire(rel):
    p = os.path.join(RACINE, rel)
    if not os.path.isfile(p):
        sys.exit('!!! fichier manquant : ' + rel)
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def ecrire(rel, txt):
    p = os.path.join(WWW, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(txt)


def copier(src_rel, dst_rel):
    s = os.path.join(RACINE, src_rel)
    if not os.path.isfile(s) or os.path.getsize(s) == 0:
        sys.exit('!!! fichier manquant ou vide : ' + src_rel)
    d = os.path.join(WWW, dst_rel)
    os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copyfile(s, d)


def remplacer(txt, a, b, n, nom):
    c = txt.count(a)
    if c != n:
        sys.exit('!!! %s : %r trouve %d fois, attendu %d' % (nom, a, c, n))
    return txt.replace(a, b)


def main():
    if os.path.isdir(WWW):
        shutil.rmtree(WWW)
    os.makedirs(WWW)

    # 1) la page : B a plat, et le Bluetooth natif charge avant js/kit.js
    page = lire('maquettes/b/index.html')
    page = remplacer(page, '../../', '', page.count('../../'), 'index.html')
    if page.count('src="js/kit.js') != 1:
        sys.exit('!!! index.html : js/kit.js pas trouve une seule fois')
    page = page.replace('<script src="js/kit.js',
                        '<script src="lib/capacitor/capacitor.js"></script>\n'
                        '<script src="lib/capacitor/bluetooth-le.js"></script>\n'
                        '<script src="js/kit.js', 1)
    ecrire('index.html', page)

    # 2) les fichiers propres a B
    b = lire('maquettes/b/b.js')
    b = remplacer(b, "'../../lib/tesseract/'", "'lib/tesseract/'", 1, 'b.js')
    ecrire('b.js', b)
    for f in ('b.css', 'b-textes.js'):
        copier('maquettes/b/' + f, f)

    # 3) ce que la page charge (relu dans la page : un fichier ajoute a B est pris sans retoucher ce script)
    refs = re.findall(r'(?:src|href)="([^"?#]+)', page)
    for r in refs:
        if r.startswith(('lib/capacitor/', 'http', 'data:')) or r in ('b.js', 'b.css', 'b-textes.js'):
            continue
        copier(r, r)

    # 4) Tesseract.js en entier (licences comprises) et Capacitor depuis node_modules
    t = os.path.join(RACINE, 'lib', 'tesseract')
    for dossier, _, fichiers in os.walk(t):
        for f in fichiers:
            rel = os.path.relpath(os.path.join(dossier, f), RACINE).replace(os.sep, '/')
            copier(rel, rel)
    copier('node_modules/@capacitor/core/dist/capacitor.js', 'lib/capacitor/capacitor.js')
    copier('node_modules/@capacitor-community/bluetooth-le/dist/plugin.js', 'lib/capacitor/bluetooth-le.js')
    copier('node_modules/@capacitor/core/LICENSE', 'lib/capacitor/LICENSE-capacitor')
    copier('node_modules/@capacitor-community/bluetooth-le/LICENSE', 'lib/capacitor/LICENSE-bluetooth-le')

    # 5) controle : plus aucun chemin qui sort de www/, et chaque reference de la page existe
    for r in re.findall(r'(?:src|href)="([^"?#]+)', page):
        if not os.path.isfile(os.path.join(WWW, r)):
            sys.exit('!!! la page charge %s, absent de www/' % r)
    for dossier, _, fichiers in os.walk(WWW):
        for f in fichiers:
            if f.endswith(('.html', '.js', '.css')) and 'lib' not in os.path.relpath(dossier, WWW).split(os.sep):
                with open(os.path.join(dossier, f), encoding='utf-8') as h:
                    if '../' in h.read():
                        sys.exit('!!! « ../ » reste dans ' + os.path.join(dossier, f))
    n, o = 0, 0
    for dossier, _, fichiers in os.walk(WWW):
        for f in fichiers:
            n += 1
            o += os.path.getsize(os.path.join(dossier, f))
    print('www/ construit : %d fichiers, %.1f Mo' % (n, o / 1048576))


main()
