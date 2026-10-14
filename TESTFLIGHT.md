# DRAGLOGICS sur iPhone : envoi à TestFlight

L'app iPhone est la page `maquettes/b/` dans une app native **Capacitor 8**, avec le module Bluetooth natif
`@capacitor-community/bluetooth-le`. Un **Mac de GitHub Actions** la compile et l'envoie à TestFlight :
aucun Mac n'est nécessaire.

| | |
|---|---|
| Nom de l'app | DRAGLOGICS |
| Bundle ID | `com.bps.draglogics` (permanent) |
| Version | 0.8.0 ; numéro de build = numéro de l'exécution GitHub |
| Appareils | iPhone seulement, portrait, iOS 15 ou plus récent |
| Compilation | Xcode 26 et SDK iOS 26 (obligatoires depuis le 28 avril 2026), Mac `macos-26` de GitHub |
| Signature | automatique « cloud » : Apple garde le certificat de distribution ; une clé API Admin suffit |

## Étape 1 — Le titulaire du compte Apple Developer (une seule fois)

1. Sur https://developer.apple.com/account/resources/identifiers/list, touche **+**, choisis **App IDs**, puis **App**.
   - Description : `DRAGLOGICS`
   - Bundle ID : **Explicit**, `com.bps.draglogics`
   - Capacités : aucune. Touche **Register**.
2. Sur https://appstoreconnect.apple.com/apps, touche **+**, puis **Nouvelle app**.
   - Plateforme : iOS. Nom : `DRAGLOGICS` (si le nom est pris : `DRAGLOGICS by BPS`).
   - Langue principale : français (Canada). Bundle ID : `com.bps.draglogics`. SKU : `draglogics-ios`.
3. Dans App Store Connect, va dans **Utilisateurs et accès > Intégrations > App Store Connect API > Clés d'équipe**.
   Touche **+**. Nom : `GitHub TestFlight`. Accès : **Admin** (la signature cloud a besoin de ce rôle).
   - Télécharge le fichier `AuthKey_XXXXXXXXXX.p8`. **Apple le donne une seule fois.**
   - Note le **Key ID** (10 caractères) et l'**Issuer ID** (en haut de la page).
4. Sur https://developer.apple.com/account, section **Membership details**, note le **Team ID** (10 caractères).
5. Donne au propriétaire du dépôt GitHub ces 4 éléments : le fichier `.p8`, le Key ID, l'Issuer ID et le Team ID.
   Utilise un moyen privé. **N'envoie jamais le fichier `.p8` dans un message public ni dans git.**
6. Dans App Store Connect, va dans **Utilisateurs et accès** et invite chaque testeur comme utilisateur (rôle
   « Développeur » ou « Marketing »). Puis, dans l'app, va dans **TestFlight > Tests internes**, crée un groupe
   (ex. « Équipe »), ajoute les testeurs et active la **distribution automatique**.

## Étape 2 — Vérifier la compilation (sans secret)

1. Ouvre https://github.com/walterbturgeon/DL_bete/actions/workflows/ios-testflight.yml
2. Touche **Run workflow**. Laisse **envoyer** décoché. Touche le bouton vert **Run workflow**.
3. Attends 10 à 20 min. Une coche verte = l'app compile avec Xcode 26. Une croix rouge : ouvre l'exécution ;
   le journal `journaux-ios-N` est en bas de la page.

## Étape 3 — Les secrets dans GitHub (une seule fois)

Ouvre https://github.com/walterbturgeon/DL_bete/settings/secrets/actions et touche **New repository secret**
pour chacun :

| Nom du secret | Valeur |
|---|---|
| `ASC_KEY_ID` | le Key ID |
| `ASC_ISSUER_ID` | l'Issuer ID |
| `ASC_KEY_P8` | tout le contenu du fichier `.p8`, de `-----BEGIN PRIVATE KEY-----` à `-----END PRIVATE KEY-----` compris |
| `APPLE_TEAM_ID` | le Team ID |

GitHub ne montre plus jamais un secret après son enregistrement, et ne le montre pas dans les journaux.

## Étape 4 — Envoyer une build à TestFlight

1. Même page qu'à l'étape 2 : **Run workflow**, **coche envoyer**, puis **Run workflow**.
2. Attends 15 à 25 min. Puis Apple traite la build : 5 à 30 min de plus.
3. La build apparaît dans App Store Connect, onglet **TestFlight**. La question sur le chiffrement n'est pas posée :
   l'app déclare `ITSAppUsesNonExemptEncryption = NO` (elle n'utilise que le chiffrement du système).
4. Sur l'iPhone : installe l'app **TestFlight** de l'App Store, ouvre l'invitation reçue par courriel, puis installe DRAGLOGICS.

Une nouvelle build = recommencer l'étape 4. Le numéro de build monte tout seul.

## Textes à coller dans TestFlight (Informations de test)

**Quoi tester — FR**
> Première version iPhone. Essaie : 1) Connecter > « Essayer avec le kit de démonstration » ; 2) Courir et Runs ;
> 3) Comparer au ticket, avec « Prendre une photo » ou « Importer une image » ; 4) avec un vrai kit : allume-le,
> puis touche « Chercher un kit (Bluetooth) » dans les 20 s.

**What to Test — EN**
> First iPhone build. Try: 1) Connect > “Try the demo kit”; 2) Run and Runs; 3) Check against the time slip, with
> “Take a photo” or “Import an image”; 4) with a real kit: turn it on, then tap “Find a kit (Bluetooth)” within 20 s.

**Description de la bêta (tests externes seulement)**
> DRAGLOGICS lit les temps de ton kit de chrono de drag par le Bluetooth, garde tes runs dans le téléphone et les
> compare au ticket de la piste. Un kit de démonstration permet d'essayer l'app sans matériel.

**Notes pour l'examen d'Apple (tests externes et App Store)**
> The app needs a DRAGLOGICS timing kit (Bluetooth LE). Without the kit, use the built-in demo: tap “Connect”, then
> “Try the demo kit”. The demo replays three synthetic runs. No account, no login.

**Politique de confidentialité** : https://walterbturgeon.github.io/DL_bete/confidentialite.html
**Confidentialité de l'app** (App Store Connect > App Privacy) : « Données non collectées ».

## Ce qui reste avant l'App Store (pas nécessaire pour TestFlight interne)

- Un courriel de contact dans `confidentialite.html` et dans la fiche App Store.
- Une vraie icône (l'icône actuelle est le logo sur fond blanc, provisoire).
- Les captures d'écran iPhone 6,9 po (1320 × 2868) et la fiche (description, mots-clés, catégorie Sports).
- Les avis de licence visibles dans « À propos » (Tesseract.js, Capacitor, module Bluetooth : `lib/tesseract/AVIS.txt`, `www/lib/capacitor/`).

## À vérifier sur le premier iPhone

- Le Bluetooth natif : la liste des kits, la connexion, les runs (dump), l'envoi des réglages, la calibration.
- La lecture du ticket : Tesseract.js lance un « worker » depuis `capacitor://localhost`. S'il ne démarre pas dans
  l'app native, le message de l'écran Ticket le dira ; la solution de repli est connue (worker en blob).
- Les zones sûres (encoche, Dynamic Island, barre d'accueil) et le clavier sur l'écran Ticket.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `package.json`, `package-lock.json` | Capacitor 8.5.3 et le module Bluetooth 8.3.0, versions figées |
| `capacitor.config.json` | `com.bps.draglogics`, dossier web `www`, textes de la liste des kits |
| `outils/construire_www.py` | construit `www/` : la page B seule, à plat, plus Tesseract.js et Capacitor |
| `js/kit.js` | le Bluetooth natif (BleClient) habillé comme le Bluetooth Web ; `?natif=1` l'essaie dans Chrome |
| `ios/App/App/Info.plist` | textes des permissions, `ITSAppUsesNonExemptEncryption`, portrait seulement |
| `ios/App/App/PrivacyInfo.xcprivacy` | manifeste de confidentialité : aucun suivi, aucune donnée collectée |
| `ios/App/App/Assets.xcassets` | icône 1024 px et écran de démarrage (faits depuis `img/logo.svg`) |
| `ios/ExportOptions.plist` | export App Store Connect, signature automatique, envoi direct |
| `.github/workflows/ios-testflight.yml` | la compilation et l'envoi, lancés à la main |
| `confidentialite.html` | la politique de confidentialité publique (FR/EN) |
