# DRAGLOGICS — maquette de l'application (v0.1)

Maquette **locale** de l'application DRAGLOGICS (drag seulement), en français et en anglais.
Les données de démonstration sont synthétiques (`outils/gen_demo_runs.py`) : aucune donnée de piste réelle, aucun nom.
La E3B4 et TRACLOGICS restent à part pour l'instant.

## Lancer
Dans Claude Code : serveur d'aperçu `draglogics-app` (port 8741). Ou à la main :

    python outils/serveur_dev.py 8741

puis ouvrir http://localhost:8741. ⚠ Pas en `file://` : la politique de sécurité (CSP) et le service worker ont besoin d'un serveur.

## Écrans (barre fixe en bas)
| Bouton | Contenu |
|---|---|
| Connecter | Feuille de connexion : kit de démonstration (Bluetooth pas encore branché) |
| Direct | Vitesse, G, état du kit, tuiles 60 / 330 / 1/8 / 1/4, graphique vitesse + G (5, 10 ou 30 s), « Rejouer un run » |
| Runs | Liste des runs du kit, détail : tuiles, graphique en temps ou en distance, jalons, comparaison avec un autre run, lecture au doigt |
| Kit | Fiche du kit, calibration de l'accéléromètre, mise à jour |
| Réglages | Réglages du kit (roll-out, jalons, 60 pi, correction, partiel, départ, sortie CAN, GPS, nom, fuseau) ; application (langue, unités, thème, texte) ; confidentialité ; à propos |

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | La structure, sans aucun script en ligne |
| `css/app.css` | Le style (jetons de couleur clair et sombre, repris du tableau E3B4 du 30 sept.) |
| `js/i18n.js` | Les textes en français et en anglais |
| `js/graph.js` | Le module de graphiques commun (axes, deux axes Y, jalons, superposition, curseur) |
| `js/kit.js` | La SEULE couche qui parle au matériel (`DLKit`) ; aujourd'hui : le kit de démonstration |
| `js/demo-runs.js` | 3 runs synthétiques d'une voiture fictive (`outils/gen_demo_runs.py`, graine fixe) |
| `js/app.js` | Les écrans |
| `sw.js`, `manifest.json` | Hors ligne dans le navigateur |
| `STORES.md` | Les règles Apple et Google, et ce qui reste à faire pour les magasins |

## Maquette retenue : B « Guidée » (7 oct., second choix)
Retour à la B, avec le choix FR/EN SEULEMENT dans « Régler ». B v0.2 (`maquettes/b/`) : l'en-tête montre
la connexion à la place de FR/EN ; repris de C : fiche du kit (calibration, mise à jour) dans « Régler », ticket
gardé par run (`dlxB_tickets`) avec pastille n/m dans la liste des runs et sur le bouton du détail ; la comparaison
passe par `DLC.comparerTicket` (noyau commun). C v0.2 reste dans `maquettes/c/`.

## Kit graphique de B (7 oct.)
http://localhost:8741/maquettes/b/kit-graphique.html : couleurs (clair et sombre, avec leur sens), textes, icônes,
chaque composant dans chacun de ses états, les 4 graphiques, le ticket, les réglages, les feuilles, et les 5 écrans
en direct (`?apercu=1` : rien n'est écrit dans l'appareil). Thème et langue au choix. Les textes de B sont dans
`maquettes/b/b-textes.js` (chargés par l'app et par le kit).

## Aperçu iPhone de B (7 oct.)
http://localhost:8741/maquettes/b/iphone.html : B tourne dans un cadre d'iPhone à la taille exacte de l'écran en
points iOS (15/16 = 393 × 852, 16 Pro, Plus, SE), avec la Dynamic Island, la barre d'état et la barre d'accueil
dessinées par-dessus. On touche l'application à travers. Les zones sûres sont imposées par `?sa=haut,bas`
(15/16 : 59 / 34), car `env(safe-area-inset-*)` vaut 0 dans un iframe : les styles lisent `--sa-h` et `--sa-b`.
⚠ Le moteur reste Chrome, pas Safari : à vérifier un jour sur un vrai iPhone.
Corrigé grâce à l'aperçu : le réglage au pas tient sur une ligne (le +6 tombait seul dessous) ; le bouton
« Envoyer au kit » touche la barre du bas (une bande de 13 px laissait voir la page).

## Maquette C « Une page » v0.2 (7 oct., premier choix, puis remplacée par B)
C a d'abord été choisie. La v0.2 (`maquettes/c/`) : la langue est dans les Réglages ; un seul bouton à l'accueil sans kit ;
section « Run » = le dernier run, ou celui touché dans l'historique, en temps ou en distance ; « Comparer au ticket »
(écart de chaque jalon contre la cible de 0,02 s, conseil, ticket gardé par run dans l'appareil, pastille n/m) ;
Réglages : application, chrono du kit, fiche du kit + calibration + mise à jour, confidentialité.
Serveur d'aperçu sans cache : `python outils/serveur_dev.py 8741`.

## Les trois maquettes à comparer (6 oct.)
Page de comparaison : http://localhost:8741/maquettes/ (côte à côte, téléphone ou tablette, FR ou EN, clair ou sombre).

| Maquette | Idée |
|---|---|
| A · Cockpit (`maquettes/a/`) | Sombre, très gros chiffres, 3 boutons (Direct, Runs, Réglages), l'essentiel d'abord, détail en plein écran |
| B · Guidée (`maquettes/b/`) | Accueil à 4 tuiles, étapes 1-2-3, comparaison au ticket de la piste avec un conseil, réglages par étapes |
| C · Une page (`maquettes/c/`) | Tout sur une page qui défile, la barre saute aux sections, mini-courbe par run, cocher 2 runs = comparaison |

Noyau commun : `js/commun.js` (préférences, formats, courbes d'un run, réglages du kit), `css/base-maquettes.css`,
plus `i18n.js`, `graph.js`, `kit.js`, `demo-runs.js`. `?demo=1` connecte seul le kit de démonstration ;
`?lang=fr|en` et `?theme=light|dark` forcent la langue et le thème.

## Règles de couleur
Orange = seulement ce qui demande une action. Bleu = ce qui est choisi et les jalons. Rouge = plus lent, vert = plus rapide.
