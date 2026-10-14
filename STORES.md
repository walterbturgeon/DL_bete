# Règles des magasins Apple et Google — ce que la maquette applique

But : que la maquette DRAGLOGICS devienne une application des magasins (App Store, Google Play) sans tout réécrire.
Chemin prévu : la même page dans **Capacitor** (application native qui affiche la page), avec un module Bluetooth natif.

## 1. Ce qui est déjà appliqué dans la maquette

| Règle | Pourquoi | Dans le code |
|---|---|---|
| Tout le code et toutes les images sont dans l'application | Apple 2.5.2 : une application ne télécharge pas de code ; Google : pas de code exécutable venu d'ailleurs | Aucun CDN, aucune police en ligne, aucun script distant |
| Pas de script en ligne ni de `onclick` dans le HTML | Politique de sécurité du contenu (CSP) stricte, contrôlable par les magasins | `index.html` : balise CSP `default-src 'self'` ; tous les écouteurs dans `js/app.js` |
| Une seule couche parle au matériel | Le Bluetooth Web n'existe pas sur iPhone : il faudra un module natif | `js/kit.js` : interface `DLKit` ; la démo, le Bluetooth Web et le natif se branchent derrière |
| Le Bluetooth est demandé quand l'utilisateur touche « Chercher un kit », jamais au démarrage | Apple et Google : permission demandée au moment de l'usage, avec la raison | Feuille de connexion : texte de raison + bouton |
| Aucune donnée ne sort de l'appareil | Pas de déclaration de collecte (Apple « App Privacy », Google « Data safety ») | Pas de compte, pas de publicité, pas de mesure d'audience, pas de jeton |
| Effacer les données de l'application | Contrôle de l'utilisateur sur ses données | Réglages > Confidentialité |
| Texte de confidentialité dans l'application | Apple 5.1.1, Google : politique de confidentialité | Réglages > Confidentialité (une page web publique sera aussi nécessaire) |
| Accessibilité : cibles de 44 px, étiquettes pour lecteur d'écran, mouvement réduit, texte « Grand » | Directives Apple (HIG) et Android | `css/app.css`, `data-i18n-aria` |
| Encoches et barres système | Affichage plein écran sur iPhone et Android | `viewport-fit=cover`, `env(safe-area-inset-*)` |
| Deux langues, au choix et selon l'appareil | Fiches des magasins en français et en anglais | `js/i18n.js` |
| Le stockage local peut manquer | Navigation privée, appareil plein | Chaque accès à `localStorage` est protégé (`try/catch`) |

## 2. À faire au moment de passer à Capacitor

### iPhone (App Store)
- `Info.plist` : `NSBluetoothAlwaysUsageDescription` (sinon l'application plante au premier accès Bluetooth). Texte proposé : « DRAGLOGICS utilise le Bluetooth pour lire les temps et régler ton kit de chrono. »
- `UIBackgroundModes: bluetooth-central` seulement si le transfert des runs doit continuer écran éteint.
- Fichier de confidentialité `PrivacyInfo.xcprivacy` : déclarer les API à « raison requise » utilisées par Capacitor et ses modules (par exemple `UserDefaults` pour les préférences).
- Guideline 4.2 (fonctions minimales) : l'application parle à un appareil Bluetooth, garde les runs hors ligne et les compare ; ce n'est pas un simple site emballé.
- [B v0.7] Photo du ticket : `NSCameraUsageDescription` est **obligatoire** dès qu'un champ « fichier » peut ouvrir l'appareil photo dans la vue web (sinon plantage). Texte proposé : « DRAGLOGICS utilise l'appareil photo pour photographier le ticket de la piste et le comparer à ton kit. » Le choix d'une image passe par le sélecteur du système : pas d'accès à toute la photothèque.

### Android (Google Play)
- Viser **Android 16 (API 36)** : obligatoire pour les nouvelles applications et les mises à jour depuis le 31 août 2026.
- Permissions Bluetooth d'Android 12+ : `BLUETOOTH_SCAN` avec `neverForLocation` (pas de localisation demandée) et `BLUETOOTH_CONNECT`.
- Formulaire « Data safety » : aucune donnée collectée ni partagée.
- [B v0.7] Photo du ticket : le champ « fichier » passe par l'application photo et le sélecteur du système. En principe, aucune permission `CAMERA` ni d'accès aux médias à déclarer. **À vérifier au portage Capacitor** : si le manifeste déclare `CAMERA` (pour un autre module), Android exige alors qu'elle soit accordée avant l'appareil photo. La photo reste dans l'application (IndexedDB) : toujours rien de collecté.

### Les deux
- Module Bluetooth : `@capacitor-community/bluetooth-le` (iOS, Android, et Web en secours).
- Le service Bluetooth du kit (`7a1e0000-…`) ne change pas : les kits en voiture restent compatibles.
- La mise à jour du firmware du kit par WiFi touche le kit, pas l'application : elle reste permise.
- Publier une politique de confidentialité à une adresse web stable (dépôt à part, jamais le dépôt de la PWA actuelle).
- [B v0.8] Lecture automatique du ticket : Tesseract.js (licence **Apache-2.0**) tourne **dans l'appareil**, sans réseau ; aucune donnée ne sort. Il ajoute ~15 Mo à l'application (`lib/tesseract`, dans git depuis le 14 oct. ; `outils/installer_tesseract.sh` le refait). Garder les avis de licence (`lib/tesseract/AVIS.txt` et les fichiers LICENSE ; le paquet de langue est MIT, le modèle d'origine Apache-2.0) et les citer dans « À propos ».
- [14 oct.] Version publique : **aucun nom réel ni donnée de piste réelle**. Les 3 runs de démonstration et leurs tickets sont synthétiques (`outils/gen_demo_runs.py`, voiture fictive, graine fixe). Au portage natif, comparer avec ML Kit (Android) et Vision (iOS), plus légers et plus rapides.

## Sources
- Google Play, niveau d'API cible : https://developer.android.com/google/play/requirements/target-sdk
- Google Play, exigences 2026 : https://support.google.com/googleplay/android-developer/answer/11926878
- Module Bluetooth Capacitor : https://github.com/capacitor-community/bluetooth-le
- Apple, guideline 4.2 et applications web emballées : https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Apple, règles d'examen (2.5.2, 4.2, 5.1.1) : https://developer.apple.com/app-store/review/guidelines/
