#!/usr/bin/env bash
# Installe Tesseract.js dans lib/tesseract/ pour la lecture automatique du ticket (B v0.8). ~15 Mo, DANS git depuis le
# 14 oct. (l'application lit le ticket sans reseau) : ce script le refait a l'identique. Avis de licence : lib/tesseract/AVIS.txt.
# Versions mesurees le 7 oct. 2026 (outils/ocr_essai) : tesseract.js 7.0.0 + coeur 7.0.0 (le coeur 6 echoue) +
# anglais 4.0.0_best_int (3,0 Mo ; meme resultat que 4.0.0 de 10,9 Mo : 40/50 justes, 0 fausse). Licences Apache-2.0.
#   bash outils/installer_tesseract.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ICI/lib/tesseract"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm pack tesseract.js@7.0.0 tesseract.js-core@7.0.0 @tesseract.js-data/eng@1.0.0 >/dev/null
for f in *.tgz; do mkdir -p "${f%.tgz}"; tar -xzf "$f" -C "${f%.tgz}" --strip-components=1; done
mkdir -p "$DEST/core" "$DEST/lang"
cp tesseract.js-7.0.0/dist/tesseract.min.js tesseract.js-7.0.0/dist/worker.min.js "$DEST/"
cp tesseract.js-7.0.0/LICENSE.md "$DEST/LICENSE-tesseract.js.md" 2>/dev/null || cp tesseract.js-7.0.0/LICENSE* "$DEST/" || true
# les trois variantes LSTM : le module choisit selon le processeur (relaxed SIMD, SIMD, sans SIMD)
for v in relaxedsimd-lstm simd-lstm lstm; do cp "tesseract.js-core-7.0.0/tesseract-core-$v.wasm.js" "$DEST/core/"; done
cp tesseract.js-core-7.0.0/LICENSE "$DEST/core/LICENSE"
cp tesseract.js-data-eng-1.0.0/4.0.0_best_int/eng.traineddata.gz "$DEST/lang/"   # 3,0 Mo (4.0.0 = 10,9 Mo, meme resultat)
# controle : chaque fichier doit exister et ne pas etre vide (un echec doit se voir)
for f in tesseract.min.js worker.min.js core/tesseract-core-relaxedsimd-lstm.wasm.js core/tesseract-core-simd-lstm.wasm.js core/tesseract-core-lstm.wasm.js lang/eng.traineddata.gz; do
  test -s "$DEST/$f" || { echo "!!! manque $DEST/$f" >&2; exit 1; }
done
du -sh "$DEST"
echo "Tesseract.js installe dans lib/tesseract/"
