# Essai OCR des tickets (7 oct. 2026)

Mesure, pas l'application : Tesseract.js lit-il les tickets numériques d'une piste ?

## Refaire l'essai
1. Les photos vont dans `photos/ticket_NN.jpg` (hors git : données de piste réelles).
   Les valeurs vraies, lues à l'œil, vont dans `photos/verite.js` (hors git aussi) :

       window.OCR_VERITE = { cible: 'NUMERO', photos: [51, 52],
         vrai: { 51: { date: 'MM/JJ/AAAA hh:mm:ss', cote: 'droite', rt: '0.074', t60: '1.098', ... } } };

   Sans ce fichier, l'essai s'arrête et le dit.
2. Les bibliothèques vont dans `lib/` (hors git, 69 Mo) :

       cd outils/ocr_essai/lib
       npm pack tesseract.js@7.0.0 tesseract.js-core@7.0.0 @tesseract.js-data/eng@1.0.0
       (décompresser chaque .tgz ; renommer « package » en tesseract.js-7.0.0, tesseract.js-core-7.0.0, tesseract.js-data-eng-1.0.0)

   ⚠ Tesseract.js 7 exige le cœur 7 (variante « relaxedsimd ») : le cœur 6.1.2 échoue au chargement.
3. Ouvrir http://localhost:8741/outils/ocr_essai/ (serveur d'aperçu `draglogics-app`). Le bilan s'affiche en haut.

## Méthode (essai.js)
- Pour chaque photo : on cherche l'angle qui redresse le ticket (0, ±3, ±6, ±9°), puis 4 lectures :
  l'image et sa **polarité égalisée** (seules les rangées sur fond foncé sont inversées), chacune en **PSM 4** et **PSM 6**.
- **Vote** : la valeur la plus lue ; « sûre » si au moins 2 lectures concordent sans contradiction.
- Point décimal perdu (« 1290 ») ou bord de case lu « 1 » (« 7.3061 ») : valeur **réparée**, à confirmer.
- Bornes de vraisemblance par champ, et **ordre des temps** (60' < 330' < 1/8 < E.T.) : une valeur hors ordre est retirée.
- Couloir : le mot qui contient le numéro de voiture, loin du milieu ; sinon le seul côté qui porte des valeurs.

## Résultat (7 photos, 50 valeurs à lire)
| Type de photo | Justes |
|---|---|
| Capture d'écran (51) | 5 / 5 |
| Photo de près (52, 50, 53) | 23 / 24 |
| Téléphone tenu en main, penché (55, 54, 56) | 12 / 21 |
| **Total** | **40 / 50, 0 fausse, 0 inventée** ; couloir 7/7 ; date 6/7 |

Durée sur PC : 4,6 à 18 s par photo (plus lent sur téléphone).

## Leçons
- **PSM 6** perdait une rangée sur deux (les rangées claires) ; **PSM 4** les lit. Ni le négatif ni le contraste local n'aidaient.
- La fausse valeur « sûre » vient d'une rangée lue deux fois (« 1/8 ET. » pris aussi pour « E.T. ») : l'ordre des temps la bloque.
- Le ticket se lit d'autant mieux qu'il est net : **une capture d'écran du ticket numérique vaut mieux qu'une photo de l'écran**.
