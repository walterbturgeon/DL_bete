'use strict';
// Les deux langues de l'application. Un texte = une cle ; le HTML porte data-i18n (texte) ou data-i18n-aria
// (etiquette pour les lecteurs d'ecran). {x} dans un texte = une valeur donnee par T(cle, {x: ...}).
// La langue par defaut suit celle de l'appareil ; le choix de l'utilisateur est garde dans l'appareil.
window.DLI18n = (function () {
  var TXT = {
    fr: {
      demo: 'DÉMO', horsLigne: 'Pas connecté', connecte: 'Connecté',
      bConnecter: 'Connecter', bConnecte: 'Connecté', bDirect: 'Direct', bRuns: 'Runs', bKit: 'Kit', bReglages: 'Réglages',
      ariaNav: 'Navigation principale',
      hDirect: 'En direct', lG: 'G', hGraphDirect: 'Vitesse et G', bRejouer: 'Rejouer un run',
      ariaDirect: 'Graphique de la vitesse et du G en direct',
      lgVitesse: 'Vitesse', lgG: 'G (accéléromètre)', lgCmp: 'Run comparé', lgJalons: 'Jalons',
      videDirect: 'Connecte un kit pour voir la vitesse en direct.',
      etatArme: 'ARMÉ', etatCourse: 'EN COURSE', etatFini: 'TERMINÉ', etatAucun: '—',
      j60: '60 pi', j330: '330 pi', j660: '1/8', j1320: '1/4', pi: 'pi',
      hRuns: 'Runs du kit', thQuand: 'Quand', videRuns: 'Aucun run. Connecte un kit.',
      hDetail: 'Détail du run', ariaPrec: 'Run précédent', ariaSuiv: 'Run suivant', runPos: 'Run {i} sur {n}',
      axeTemps: 'Temps', axeDistance: 'Distance', comparer: 'Comparer avec', cmpAucun: '— aucun —',
      ariaRun: 'Graphique de la vitesse et du G pendant le run',
      xTitreT: 's depuis le départ', xTitreD: 'pi depuis l’arrêt',
      lectureAide: 'Touche la courbe pour lire les valeurs.',
      lecture: '{x} · vitesse {v} {u} · G {g}', lectureCmp: ' · comparé {v} {u}',
      rRegl: 'Réglages de ce run : roll-out {rpo} po · jalons {jpo} po · correction {cms} ms · 60 pi {d60} po',
      hKit: 'Le kit', videKit: 'Aucun kit connecté.',
      fNom: 'Nom', fFw: 'Firmware', fMetier: 'Métier', fGps: 'GPS', fImu: 'Accéléromètre', fCal: 'Calibration', fMode: 'Liaison',
      oui: 'oui', non: 'non', faite: 'faite', aFaire: 'à faire', modeDemo: 'kit de démonstration',
      gpsTxt: '{s} satellites · {hz} Hz',
      hEntretien: 'Entretien', calNom: 'Calibration de l’accéléromètre', calAide: 'Kit monté, voiture à plat et immobile, moteur arrêté.',
      calBtn: 'Calibrer', calEnCours: 'Calibration en cours… ne bouge pas la voiture.', calOk: 'Calibration faite.',
      majNom: 'Mise à jour du kit', majAide: 'Le kit ouvre un WiFi le temps de la mise à jour. Le Bluetooth se coupe pendant ce temps.',
      majBtn: 'Passer en mise à jour', majDemo: 'Pas de mise à jour avec le kit de démonstration.',
      horsLigneMsg: 'Connecte un kit d’abord.',
      hRegKit: 'Réglages du kit', videReg: 'Connecte un kit pour lire et changer ses réglages.',
      fsChrono: 'Chrono', rpoNom: 'Roll-out : où le chrono part (pouces)',
      rpoAide: 'Le chrono part quand le véhicule a avancé de ce nombre de pouces depuis l’arrêt. Il règle seulement le départ.',
      jpoNom: 'Position des jalons (pouces)', jpoAide: 'Chaque jalon D et son piège de vitesse sont pris à D + ce nombre de pouces depuis l’arrêt.',
      d60Nom: 'Décalage du 60 pi (pouces)', d60Aide: 'Change seulement le 60 pi. Commence à 0.',
      cmsNom: 'Correction de départ (ms)', cmsAide: 'Ajoutée à tous les temps. Sert seulement à un écart constant sur tous les jalons.',
      pfftNom: 'Jalon partiel', pfftOff: 'Aucun',
      fsDepart: 'Départ', hecuNom: 'Transbrake (Holley)', strigNom: 'Entrée de départ câblée',
      strig0: 'Désactivée', strig1: 'Front montant', strig2: 'Front descendant',
      fsSortie: 'Sortie CAN', modeNom: 'Vers l’ECU', cbrNom: 'Débit CAN',
      fsGps: 'GPS et unité', grateNom: 'Cadence du GPS', sfxNom: 'Nom de l’unité', tzhNom: 'Fuseau horaire (heures)',
      envoyer: 'Envoyer au kit', formOk: 'Réglages envoyés au kit. Ils comptent à la course suivante.',
      formErr: 'Valeur refusée : {x}. Rien n’est envoyé.', formRien: 'Aucun changement : rien n’est envoyé au kit.',
      hApp: 'Application', langue: 'Langue', unite: 'Vitesse', theme: 'Thème', themeAuto: 'Auto', themeClair: 'Clair', themeSombre: 'Sombre',
      texte: 'Texte', texteN: 'Normal', texteG: 'Grand',
      hPrive: 'Confidentialité',
      priveTexte: 'Tes runs et tes réglages restent dans ton appareil et dans ton kit. L’application n’a pas de compte, pas de publicité et ne mesure pas son utilisation. Elle utilise le Bluetooth seulement pour parler à ton kit.',
      effacer: 'Effacer les données de l’application', priveOk: 'Données de l’application effacées.',
      hApropos: 'À propos', apropos: 'DRAGLOGICS — maquette {v}. Locale : rien n’est publié. Les runs de démonstration viennent d’un vrai kit, sans nom.',
      cxTitre: 'Connecter un kit', cxPourquoi: 'DRAGLOGICS utilise le Bluetooth seulement pour parler à ton kit. Aucune donnée ne quitte ton appareil.',
      cxBle: 'Chercher un kit (Bluetooth)', cxDemo: 'Essayer avec le kit de démonstration', cxDeco: 'Déconnecter', fermer: 'Fermer',
      cxBleAbsent: 'Ce navigateur ne fait pas le Bluetooth Web. Prends Chrome sur ordinateur ou sur Android.',
      cxBleCherche: 'Allume le kit : il s’annonce 20 s après l’allumage. Choisis-le dans la liste.',
      cxBleAnnule: 'Aucun kit choisi. Éteins et rallume le kit, puis réessaie dans les 20 s.',
      cxBleErr: 'Connexion impossible : {x}'
    },
    en: {
      demo: 'DEMO', horsLigne: 'Not connected', connecte: 'Connected',
      bConnecter: 'Connect', bConnecte: 'Connected', bDirect: 'Live', bRuns: 'Runs', bKit: 'Kit', bReglages: 'Settings',
      ariaNav: 'Main navigation',
      hDirect: 'Live', lG: 'G', hGraphDirect: 'Speed and G', bRejouer: 'Replay a run',
      ariaDirect: 'Live speed and G chart',
      lgVitesse: 'Speed', lgG: 'G (accelerometer)', lgCmp: 'Compared run', lgJalons: 'Timing marks',
      videDirect: 'Connect a kit to see the live speed.',
      etatArme: 'ARMED', etatCourse: 'RUNNING', etatFini: 'FINISHED', etatAucun: '—',
      j60: '60 ft', j330: '330 ft', j660: '1/8', j1320: '1/4', pi: 'ft',
      hRuns: 'Kit runs', thQuand: 'When', videRuns: 'No run. Connect a kit.',
      hDetail: 'Run detail', ariaPrec: 'Previous run', ariaSuiv: 'Next run', runPos: 'Run {i} of {n}',
      axeTemps: 'Time', axeDistance: 'Distance', comparer: 'Compare with', cmpAucun: '— none —',
      ariaRun: 'Speed and G chart during the run',
      xTitreT: 's from start', xTitreD: 'ft from rest',
      lectureAide: 'Touch the chart to read the values.',
      lecture: '{x} · speed {v} {u} · G {g}', lectureCmp: ' · compared {v} {u}',
      rRegl: 'Settings of this run: roll-out {rpo} in · timing marks {jpo} in · start correction {cms} ms · 60 ft {d60} in',
      hKit: 'The kit', videKit: 'No kit connected.',
      fNom: 'Name', fFw: 'Firmware', fMetier: 'Mode', fGps: 'GPS', fImu: 'Accelerometer', fCal: 'Calibration', fMode: 'Link',
      oui: 'yes', non: 'no', faite: 'done', aFaire: 'to do', modeDemo: 'demo kit',
      gpsTxt: '{s} satellites · {hz} Hz',
      hEntretien: 'Maintenance', calNom: 'Accelerometer calibration', calAide: 'Kit mounted, car level and still, engine off.',
      calBtn: 'Calibrate', calEnCours: 'Calibrating… do not move the car.', calOk: 'Calibration done.',
      majNom: 'Kit update', majAide: 'The kit opens a WiFi network during the update. Bluetooth stops during that time.',
      majBtn: 'Enter update mode', majDemo: 'No update with the demo kit.',
      horsLigneMsg: 'Connect a kit first.',
      hRegKit: 'Kit settings', videReg: 'Connect a kit to read and change its settings.',
      fsChrono: 'Timing', rpoNom: 'Roll-out: where the timer starts (inches)',
      rpoAide: 'The timer starts when the vehicle has moved this many inches from rest. It sets the start only.',
      jpoNom: 'Timing mark position (inches)', jpoAide: 'Each timing mark D and its speed trap are taken at D + this many inches from rest.',
      d60Nom: '60 ft offset (inches)', d60Aide: 'Changes the 60 ft only. Start at 0.',
      cmsNom: 'Start correction (ms)', cmsAide: 'Added to every time. Use it only for an offset that is the same on every timing mark.',
      pfftNom: 'Extra timing mark', pfftOff: 'None',
      fsDepart: 'Start', hecuNom: 'Transbrake (Holley)', strigNom: 'Wired start input',
      strig0: 'Off', strig1: 'Rising edge', strig2: 'Falling edge',
      fsSortie: 'CAN output', modeNom: 'To the ECU', cbrNom: 'CAN bit rate',
      fsGps: 'GPS and unit', grateNom: 'GPS rate', sfxNom: 'Unit name', tzhNom: 'Time zone (hours)',
      envoyer: 'Send to the kit', formOk: 'Settings sent to the kit. They apply from the next run.',
      formErr: 'Value refused: {x}. Nothing was sent.', formRien: 'No change: nothing is sent to the kit.',
      hApp: 'App', langue: 'Language', unite: 'Speed', theme: 'Theme', themeAuto: 'Auto', themeClair: 'Light', themeSombre: 'Dark',
      texte: 'Text', texteN: 'Normal', texteG: 'Large',
      hPrive: 'Privacy',
      priveTexte: 'Your runs and settings stay on your device and in your kit. The app has no account, no ads and no usage tracking. It uses Bluetooth only to talk to your kit.',
      effacer: 'Delete the app data', priveOk: 'App data deleted.',
      hApropos: 'About', apropos: 'DRAGLOGICS — mockup {v}. Local only: nothing is published. The demo runs come from a real kit, without names.',
      cxTitre: 'Connect a kit', cxPourquoi: 'DRAGLOGICS uses Bluetooth only to talk to your kit. No data leaves your device.',
      cxBle: 'Find a kit (Bluetooth)', cxDemo: 'Try the demo kit', cxDeco: 'Disconnect', fermer: 'Close',
      cxBleAbsent: 'This browser has no Web Bluetooth. Use Chrome on a computer or on Android.',
      cxBleCherche: 'Turn the kit on: it advertises for 20 s after power-up. Pick it in the list.',
      cxBleAnnule: 'No kit picked. Turn the kit off and on, then try again within 20 s.',
      cxBleErr: 'Cannot connect: {x}'
    }
  };
  var langue = 'fr';
  function T(cle, vars) {
    var s = (TXT[langue] && TXT[langue][cle]) || TXT.fr[cle];
    if (s == null) { console.warn('i18n : cle absente', cle); return cle; }   // une cle absente se voit
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  function appliquer(racine) {
    (racine || document).querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = T(e.getAttribute('data-i18n')); });
    (racine || document).querySelectorAll('[data-i18n-aria]').forEach(function (e) { e.setAttribute('aria-label', T(e.getAttribute('data-i18n-aria'))); });
    document.documentElement.lang = langue;
  }
  function choisir(l) { langue = TXT[l] ? l : 'fr'; appliquer(); }
  function parDefaut() { var n = (navigator.language || 'fr').slice(0, 2).toLowerCase(); return TXT[n] ? n : 'en'; }
  // controle : les deux langues ont les memes cles (un oubli se voit dans la console)
  function controler(fr, en) {
    Object.keys(fr).forEach(function (k) { if (!(k in en)) console.warn('i18n : cle sans anglais', k); });
    Object.keys(en).forEach(function (k) { if (!(k in fr)) console.warn('i18n : cle sans francais', k); });
  }
  controler(TXT.fr, TXT.en);
  // [maquettes A, B, C] chaque maquette ajoute ses propres textes aux textes communs
  function ajouter(fr, en) {
    controler(fr, en);
    Object.keys(fr).forEach(function (k) { TXT.fr[k] = fr[k]; });
    Object.keys(en).forEach(function (k) { TXT.en[k] = en[k]; });
  }
  return { T: T, appliquer: appliquer, choisir: choisir, langue: function () { return langue; }, parDefaut: parDefaut, ajouter: ajouter };
})();
