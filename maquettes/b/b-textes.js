'use strict';
// Les textes de la maquette B (francais et anglais), a part : l'application ET le kit graphique les chargent.
DLI18n.ajouter({
  b_accueil: 'Accueil', b_courir: 'Courir', b_regler: 'Régler', b_monKit: 'Mon kit', b_kitOff: 'Pas connecté — touche ici',
  b_kitOn: '{nom} · {s} satellites', b_pret: 'Prêt à courir', b_pretOff: 'Connecte le kit d’abord.', b_dernier: 'Dernier : {t} s',
  b_mesRuns: 'Mes runs', b_nbRuns: '{n} runs · meilleur {t} s', b_aucunRun: 'Aucun run pour l’instant.',
  b_ticket: 'Comparer au ticket', b_ticketSous: 'Vérifie ton kit avec le ticket de la piste', b_etapes: 'Les étapes',
  b_e1: 'Connecter le kit', b_e2: 'Faire un run', b_e3: 'Comparer au ticket',
  b_hTicket: 'Comparer au ticket de la piste', b_run: 'Run', b_saisir: 'Entre les temps du ticket, en secondes (ex. 1,290).',
  b_remplirDemo: 'Remplir avec le ticket de démo', b_comparer: 'Comparer', b_jalon: 'Jalon', b_kit: 'Kit', b_tk: 'Ticket', b_ecart: 'Écart',
  b_bilan: '{n} jalons sur {m} dans ta cible de 0,02 s.', b_conseil60: 'Le 60 pi seul est en retard : essaie « Où sont les jalons » dans Régler.',
  b_conseilTous: 'Tous les jalons ont le même écart : essaie « Où le chrono part » dans Régler.', b_conseilOk: 'Ton kit colle au ticket.',
  b_vit18: 'Vitesse 1/8 (mph)', b_vit14: 'Vitesse 1/4 (mph)', b_s1: 'Où le chrono part', b_s2: 'Où sont les jalons', b_s2b: 'Si le 60 pi reste à part',
  b_s3: 'Ton départ', b_s4: 'Vers l’ECU', b_s5: 'Le kit', b_ticketVide: 'Aucun run à comparer. Connecte le kit et fais un run.',
  b_ticketAvecRun: 'Comparer ce run au ticket', b_saisieErr: 'Entre au moins un temps du ticket.', b_vitLab: 'vitesse {d}'
}, {
  b_accueil: 'Home', b_courir: 'Run', b_regler: 'Set up', b_monKit: 'My kit', b_kitOff: 'Not connected — tap here',
  b_kitOn: '{nom} · {s} satellites', b_pret: 'Ready to run', b_pretOff: 'Connect the kit first.', b_dernier: 'Last: {t} s',
  b_mesRuns: 'My runs', b_nbRuns: '{n} runs · best {t} s', b_aucunRun: 'No run yet.',
  b_ticket: 'Check against the slip', b_ticketSous: 'Check your kit against the time slip', b_etapes: 'The steps',
  b_e1: 'Connect the kit', b_e2: 'Make a run', b_e3: 'Check against the slip',
  b_hTicket: 'Check against the time slip', b_run: 'Run', b_saisir: 'Type the times from the slip, in seconds (e.g. 1.290).',
  b_remplirDemo: 'Fill with the demo slip', b_comparer: 'Compare', b_jalon: 'Mark', b_kit: 'Kit', b_tk: 'Slip', b_ecart: 'Difference',
  b_bilan: '{n} of {m} timing marks within your 0.02 s target.', b_conseil60: 'Only the 60 ft is late: try “Where the timing marks are” in Set up.',
  b_conseilTous: 'Every timing mark has the same difference: try “Where the timer starts” in Set up.', b_conseilOk: 'Your kit matches the slip.',
  b_vit18: '1/8 speed (mph)', b_vit14: '1/4 speed (mph)', b_s1: 'Where the timer starts', b_s2: 'Where the timing marks are', b_s2b: 'If the 60 ft stays apart',
  b_s3: 'Your start', b_s4: 'To the ECU', b_s5: 'The kit', b_ticketVide: 'No run to compare. Connect the kit and make a run.',
  b_ticketAvecRun: 'Check this run against the slip', b_saisieErr: 'Type at least one time from the slip.', b_vitLab: '{d} speed'
});
DLI18n.ajouter({ b_tkPastille: '{n}/{m}', b_version: 'DRAGLOGICS {v} — version d’essai. Le kit de démonstration rejoue des runs synthétiques.' },
                 { b_tkPastille: '{n}/{m}', b_version: 'DRAGLOGICS {v} — test version. The demo kit replays synthetic runs.' });
// [B v0.8] la lecture automatique du ticket (7 oct.)
DLI18n.ajouter({
  b_ocrLire: 'Lire le ticket', b_ocrNumero: 'Ton numéro sur le ticket', b_ocrNumeroAide: 'Sert à trouver ton couloir (ex. NT1234).',
  b_ocrCote: 'Ton couloir', b_ocrGauche: 'Gauche', b_ocrDroite: 'Droite',
  b_ocrEnCours: 'Lecture du ticket… {n}/{m}',
  b_ocrFini: 'Lu en {s} s : {sur} valeurs sûres (en vert), {verif} à vérifier (en orange). Vérifie-les avant de comparer.',
  b_ocrPasLus: '{n} case(s) pas lue(s).', b_ocrDate: 'Ticket du {d}.', b_ocrRetire: 'Retirée(s) car hors ordre : {x}.',
  b_ocrRien: 'Aucune valeur lue. Essaie une capture d’écran du ticket, ou entre les temps à la main.',
  b_ocrCoteInconnu: 'Couloir pas trouvé : choisis ton couloir (ou entre ton numéro, puis relis).',
  b_ocrSur: 'Lu pareil par plusieurs lectures', b_ocrVerif: 'Une seule lecture : à vérifier', b_ocrRepare: 'point décimal remis',
  b_ocrConflit: 'lectures en désaccord : {x}',
  b_ocrAbsent: '⚠ Lecture automatique pas installée (lib/tesseract). Entre les temps à la main.', b_ocrErr: '⚠ Lecture impossible : {x}'
}, {
  b_ocrLire: 'Read the slip', b_ocrNumero: 'Your number on the slip', b_ocrNumeroAide: 'Used to find your lane (e.g. NT1234).',
  b_ocrCote: 'Your lane', b_ocrGauche: 'Left', b_ocrDroite: 'Right',
  b_ocrEnCours: 'Reading the slip… {n}/{m}',
  b_ocrFini: 'Read in {s} s: {sur} sure values (green), {verif} to check (orange). Check them before comparing.',
  b_ocrPasLus: '{n} box(es) not read.', b_ocrDate: 'Slip of {d}.', b_ocrRetire: 'Removed as out of order: {x}.',
  b_ocrRien: 'No value read. Try a screenshot of the slip, or type the times.',
  b_ocrCoteInconnu: 'Lane not found: pick your lane (or type your number, then read again).',
  b_ocrSur: 'Read the same by several passes', b_ocrVerif: 'Read only once: check it', b_ocrRepare: 'decimal point restored',
  b_ocrConflit: 'passes disagree: {x}',
  b_ocrAbsent: '⚠ Automatic reading not installed (lib/tesseract). Type the times.', b_ocrErr: '⚠ Cannot read: {x}'
});
// [B v0.7] la photo du ticket (7 oct.)
DLI18n.ajouter({
  b_photoPrendre: 'Prendre une photo', b_photoImporter: 'Importer une image', b_photoAgrandir: 'Agrandir', b_photoRetirer: 'Retirer la photo',
  b_photoAide: 'Photo ou capture d’écran du ticket. Elle reste dans ce téléphone, avec le run, et n’est jamais envoyée.',
  b_photoAlt: 'Photo du ticket de la piste', b_photoTraite: 'Photo en traitement…', b_photoGardee: 'Photo gardée avec ce run ({ko} ko).',
  b_photoIllisible: 'image illisible', b_photoErr: '⚠ Photo pas gardée : {x}'
}, {
  b_photoPrendre: 'Take a photo', b_photoImporter: 'Import an image', b_photoAgrandir: 'Enlarge', b_photoRetirer: 'Remove the photo',
  b_photoAide: 'Photo or screenshot of the time slip. It stays on this phone, with the run, and is never sent.',
  b_photoAlt: 'Photo of the track time slip', b_photoTraite: 'Processing the photo…', b_photoGardee: 'Photo kept with this run ({ko} kB).',
  b_photoIllisible: 'unreadable image', b_photoErr: '⚠ Photo not kept: {x}'
});
// [B v0.5] l'ecran Courir ajuste (7 oct.)
DLI18n.ajouter({
  b_etatPret: 'PRÊT — pars quand tu veux', b_etatSansGps: 'PAS DE POSITION GPS — attends avant de partir',
  b_etatCourse: 'EN COURSE · {t} s', b_etatSim: 'SIMULATION · {t} s', b_etatFini: 'TERMINÉ · {t} s',
  b_etatAbandon: 'ABANDON (20 s sans arrivée) — réarme', b_etatAttente: 'EN ATTENTE — réarme le chrono',
  b_gpsOk: 'GPS · {s} satellites · {hz} Hz', b_gpsNon: 'GPS : pas de position ({s} satellites). Mets le kit à ciel ouvert.',
  b_tbAttente: 'Transbrake : rien reçu de l’ECU', b_tbEngage: 'Transbrake engagé', b_tbRelache: 'Transbrake relâché',
  b_rearmer: 'Réarmer le chrono', b_banc: 'Banc d’essai',
  b_simAvert: 'La course simulée s’enregistre dans le kit comme un vrai run : elle remplace le plus ancien des 8 runs gardés.',
  b_simConfirme: 'Lancer une course simulée ? Elle remplace le plus ancien des 8 runs gardés dans le kit.'
}, {
  b_etatPret: 'READY — go when you want', b_etatSansGps: 'NO GPS POSITION — wait before you go',
  b_etatCourse: 'RUNNING · {t} s', b_etatSim: 'SIMULATION · {t} s', b_etatFini: 'FINISHED · {t} s',
  b_etatAbandon: 'ABORTED (20 s without finish) — re-arm', b_etatAttente: 'WAITING — re-arm the timer',
  b_gpsOk: 'GPS · {s} satellites · {hz} Hz', b_gpsNon: 'GPS: no position ({s} satellites). Put the kit under open sky.',
  b_tbAttente: 'Transbrake: nothing from the ECU', b_tbEngage: 'Transbrake engaged', b_tbRelache: 'Transbrake released',
  b_rearmer: 'Re-arm the timer', b_banc: 'Bench test',
  b_simAvert: 'The simulated run is stored in the kit like a real run: it replaces the oldest of the 8 runs kept.',
  b_simConfirme: 'Start a simulated run? It replaces the oldest of the 8 runs kept in the kit.'
});
// [B v0.4] l'etape « Ton ECU » (7 oct.)
DLI18n.ajouter({
  b_s3e: 'Ton ECU', b_ecuNom: 'Marque de l’ECU', b_ecuHp: 'Holley HP / Terminator X', b_ecuDom: 'Holley Dominator',
  b_ecuFt: 'FuelTech FT450 / FT550 / FT600', b_ecuLink: 'Link', b_ecuEcum: 'ECUMaster', b_ecuAutre: 'Autre (mode ancien)',
  b_hidNom: 'ID de l’expander (logiciel Holley)', b_hidAide: 'Le numéro de module que tu as mis dans le logiciel Holley (0 à 2047).',
  b_lectNom: 'Flux lu sur le Link', b_lidNom: 'ID lu (entrée)', b_eidNom: 'ID envoyé (sortie)', b_eidAide: 'Trames {a} et {b} ({h})',
  b_departPlus: 'Départ : réglages avancés', b_scidNom: 'Trame CAN de départ (ID, 0 = aucune)', b_scextNom: 'Format de l’ID',
  b_scext0: 'Standard 11 bits', b_scext1: 'Étendu 29 bits', b_scbyNom: 'Octet (0 à 7)', b_scmkNom: 'Masque des bits (1 à 255)',
  b_scedNom: 'Front qui donne le départ', b_frDesc: 'au relâchement (front descendant)', b_frMont: 'à l’appui (front montant)',
  b_depAucun: 'aucune trame CAN réglée : départ au GPS seulement', b_depTrame: 'trame {id}, octet {o}, masque {m}, {f}',
  b_res_holley_hp: 'Débit 1 Mbit/s, automatique. Départ : relâchement du transbrake (canal 298).',
  b_res_holley_dom: 'Débit 1 Mbit/s, automatique. Départ : relâchement du transbrake (sortie 0 du canal 8).',
  b_res_fueltech: 'Débit 1 Mbit/s, fixe. Départ : 2-step du FuelTech, lu dans son flux. Les 5 voies envoyées au FuelTech sont déjà définies :',
  b_res_link: 'Départ : Launch Control du Link, au relâchement, lu dans le flux choisi.',
  b_res_ecumaster: 'Le kit envoie le flux GPStoCAN V2 (ID de base {base}). Départ : {dep}.',
  b_res_autre: 'Mode ancien, gardé pour les kits déjà réglés ainsi.',
  b_ftV1: 'in1 « Brake pressure » = distance (pi × 10)', b_ftV2: 'in2 « Tire temp FL » = vitesse au dernier jalon (mph)',
  b_ftV3: 'in3 « Tire temp FR » = vitesse instantanée (mph)', b_ftV4: 'in21 « Fuel flow A » = temps au dernier jalon',
  b_ftV5: 'in22 « Fuel flow B » = temps au 60 pi',
  b_avLink157: '⚠ Avec le firmware {fw}, en DRAGLOGICS, le kit lit toujours le Generic Dash 1000 et envoie 1200 / 1201 : le flux et les ID choisis ici comptent seulement à partir de la PT2.1.57.',
  b_avTrameEnPlus: '⚠ Une trame CAN de départ est aussi active : {dep}. Retire-la dans « Départ : réglages avancés » si elle ne sert pas.'
}, {
  b_s3e: 'Your ECU', b_ecuNom: 'ECU brand', b_ecuHp: 'Holley HP / Terminator X', b_ecuDom: 'Holley Dominator',
  b_ecuFt: 'FuelTech FT450 / FT550 / FT600', b_ecuLink: 'Link', b_ecuEcum: 'ECUMaster', b_ecuAutre: 'Other (old mode)',
  b_hidNom: 'Expander ID (Holley software)', b_hidAide: 'The module number you set in the Holley software (0 to 2047).',
  b_lectNom: 'Stream read from the Link', b_lidNom: 'ID read (input)', b_eidNom: 'ID sent (output)', b_eidAide: 'Frames {a} and {b} ({h})',
  b_departPlus: 'Start: advanced settings', b_scidNom: 'CAN start frame (ID, 0 = none)', b_scextNom: 'ID format',
  b_scext0: 'Standard 11-bit', b_scext1: 'Extended 29-bit', b_scbyNom: 'Byte (0 to 7)', b_scmkNom: 'Bit mask (1 to 255)',
  b_scedNom: 'Edge that starts the run', b_frDesc: 'on release (falling edge)', b_frMont: 'on press (rising edge)',
  b_depAucun: 'no CAN frame set: GPS start only', b_depTrame: 'frame {id}, byte {o}, mask {m}, {f}',
  b_res_holley_hp: 'Bit rate 1 Mbit/s, automatic. Start: transbrake release (channel 298).',
  b_res_holley_dom: 'Bit rate 1 Mbit/s, automatic. Start: transbrake release (output 0 of channel 8).',
  b_res_fueltech: 'Bit rate 1 Mbit/s, fixed. Start: FuelTech 2-step, read from its stream. The 5 inputs sent to the FuelTech are already set:',
  b_res_link: 'Start: Link Launch Control, on release, read from the chosen stream.',
  b_res_ecumaster: 'The kit sends the GPStoCAN V2 stream (base ID {base}). Start: {dep}.',
  b_res_autre: 'Old mode, kept for kits already set this way.',
  b_ftV1: 'in1 “Brake pressure” = distance (ft × 10)', b_ftV2: 'in2 “Tire temp FL” = speed at the last timing mark (mph)',
  b_ftV3: 'in3 “Tire temp FR” = live speed (mph)', b_ftV4: 'in21 “Fuel flow A” = time at the last timing mark',
  b_ftV5: 'in22 “Fuel flow B” = 60 ft time',
  b_avLink157: '⚠ With firmware {fw}, in DRAGLOGICS, the kit always reads Generic Dash 1000 and sends 1200 / 1201: the stream and IDs chosen here apply only from PT2.1.57.',
  b_avTrameEnPlus: '⚠ A CAN start frame is also active: {dep}. Remove it in “Start: advanced settings” if it is not used.'
});
// [B v0.3] le vrai kit par Bluetooth
DLI18n.ajouter({
  b_sim: 'Course simulée du kit (banc)', b_runsLecture: 'Lecture des runs du kit…', b_runsErr: 'Runs pas lus : {x}',
  b_runsManque: '⚠ Le kit annonce {a} runs mais {n} ne sont pas arrivés : le kit n’a pas pu les envoyer (firmware).',
  b_majConfirme: 'Passer le kit en mise à jour ? Il quitte le Bluetooth et ouvre son WiFi de mise à jour jusqu’au prochain redémarrage.',
  b_majBle: 'Le kit est en mise à jour : rejoins son WiFi BPS-GPS-OTA, puis ouvre http://192.168.4.1/update.'
}, {
  b_sim: 'Kit simulated run (bench)', b_runsLecture: 'Reading the kit runs…', b_runsErr: 'Runs not read: {x}',
  b_runsManque: '⚠ The kit announces {a} runs but {n} did not arrive: the kit could not send them (firmware).',
  b_majConfirme: 'Put the kit in update mode? It leaves Bluetooth and opens its update WiFi until the next restart.',
  b_majBle: 'The kit is in update mode: join its BPS-GPS-OTA WiFi, then open http://192.168.4.1/update.'
});

// [B v0.9] la course a index (kit PT2.1.60) : la trame 0x406 vers l'ECU, le run de reference.
// [0.9.0, 15 oct.] un seul choix Oui / Non (Oui = toujours armee) : plus de menu d'armement ni de bouton Armer.
DLI18n.ajouter({
  b_idxTitre: 'Course à index', idxonNom: 'Mode index', b_idxCoupee: 'Non', b_idxActive: 'Oui',
  b_idxIndex: 'Index (s)', b_idxMarge: 'Marge (s)', idxcNom: 'Cible (index + marge)',
  b_idxCibleTxt: 'Le kit vise {c} s au 1/4 (temps de la piste). Breakout sous {i} s.',
  b_idxCibleVide: 'Entre l’index et la marge : sans cible, le kit ne commande rien.',
  b_idxRef: 'Run de référence', b_idxRefBtn: 'Prendre ce run comme référence', b_idxPasDeRun: 'Aucun 1/4 complet dans le kit',
  b_idxRefAucune: 'Référence actuelle : aucune. Sans référence, le kit ne commande rien.',
  b_idxRefActuelle: 'Référence actuelle : le run de {h}, 1/4 à {t} s.',
  b_idxRefEnvoi: 'Envoi au kit…', b_idxRefOk: 'Référence prise par le kit.',
  b_idxRefNon: '⚠ Le kit n’a pas pris ce run (pas un 1/4 complet, ou flash pleine). La référence n’a pas changé.',
  b_idxAide: 'Entre 330 et 1320 pi, le kit projette ton 1/4 avec le run de référence. S’il finirait avant la cible, il envoie à l’ECU une commande de 0 à 1023 qui réduit le papillon, jamais plus vite qu’un pied. 0 = aucune réduction. La limite de la réduction est dans la table de l’ECU. Avec « Oui », chaque run passe par l’index, jusqu’à ce que tu remettes « Non ».',
  b_idxPlus: 'Commande : réglages avancés', idxidNom: 'Trame CAN (ID en hexadécimal)', b_idxIdErr: 'ID CAN invalide : 1 à 7FF en hexadécimal.',
  idxzNom: 'Zone morte (ms d’avance)', idxpNom: 'Commande pleine à (ms d’avance)', idxfNom: 'Filtre (ms)', idxvNom: 'Pente maximale (comptes par seconde)',
  b_idxTrame: 'Trame de 8 octets, gros-boutiste, 25 fois par seconde : octets 0-1 commande (0-1023), 2 état, 3 compteur, 4-5 avance projetée (ms, signée), 6-7 distance (pi).',
  b_idxArme: 'INDEX ACTIF', b_idxPasArme: 'INDEX PAS ARMÉ : renvoie « Oui » dans Régler',
  b_idxCibleCourte: 'cible {c} s', b_idxDirect: 'Avance {a} ms · commande {c} ({p} %)'
}, {
  b_idxTitre: 'Index racing', idxonNom: 'Index mode', b_idxCoupee: 'No', b_idxActive: 'Yes',
  b_idxIndex: 'Index (s)', b_idxMarge: 'Margin (s)', idxcNom: 'Target (index + margin)',
  b_idxCibleTxt: 'The kit aims at {c} s in the 1/4 (track time). Breakout under {i} s.',
  b_idxCibleVide: 'Enter the index and the margin: without a target, the kit commands nothing.',
  b_idxRef: 'Reference run', b_idxRefBtn: 'Use this run as the reference', b_idxPasDeRun: 'No full 1/4 in the kit',
  b_idxRefAucune: 'Current reference: none. Without a reference, the kit commands nothing.',
  b_idxRefActuelle: 'Current reference: the run of {h}, 1/4 in {t} s.',
  b_idxRefEnvoi: 'Sending to the kit…', b_idxRefOk: 'Reference taken by the kit.',
  b_idxRefNon: '⚠ The kit did not take this run (not a full 1/4, or flash full). The reference did not change.',
  b_idxAide: 'Between 330 and 1320 ft, the kit projects your 1/4 with the reference run. If you would finish before the target, it sends the ECU a 0 to 1023 command that reduces the throttle, never faster than a foot. 0 = no reduction. The reduction limit is in the ECU table. With “Yes”, every run goes through the index until you set “No” again.',
  b_idxPlus: 'Command: advanced settings', idxidNom: 'CAN frame (hexadecimal ID)', b_idxIdErr: 'Invalid CAN ID: 1 to 7FF in hexadecimal.',
  idxzNom: 'Dead band (ms of lead)', idxpNom: 'Full command at (ms of lead)', idxfNom: 'Filter (ms)', idxvNom: 'Maximum slope (counts per second)',
  b_idxTrame: '8-byte frame, big-endian, 25 times per second: bytes 0-1 command (0-1023), 2 state, 3 counter, 4-5 projected lead (ms, signed), 6-7 distance (ft).',
  b_idxArme: 'INDEX ON', b_idxPasArme: 'INDEX NOT ARMED: send “Yes” again in Set up',
  b_idxCibleCourte: 'target {c} s', b_idxDirect: 'Lead {a} ms · command {c} ({p} %)'
});
