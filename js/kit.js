'use strict';
// LA COUCHE « KIT » : la SEULE partie qui parle au materiel.
// app.js ne connait que cette interface. Trois branchements prevus derriere elle :
//   - demo     : le kit de demonstration (ici, maquette v0.1) ;
//   - ble      : Bluetooth Web (Chrome Android et ordinateur ; pas sur iPhone) -- ECRIT le 7 oct. (B v0.3) ;
//   - natif    : Bluetooth natif par Capacitor (magasins Apple et Google) -- a ecrire.
// Regles magasins (voir STORES.md) : aucune donnee ne sort de l'appareil, aucun code telecharge, le Bluetooth
// est demande au moment ou l'utilisateur touche « Chercher un kit », jamais au demarrage.
//
// Interface :
//   DLKit.sur(type, f)          type = 'etat' | 'telem' | 'jalon' | 'run' ; f recoit l'objet de l'evenement
//   DLKit.connecter(mode)       mode = 'demo' | 'ble' ; rend une promesse
//   DLKit.deconnecter()
//   DLKit.etat()                { connecte, mode, nom }
//   DLKit.lireConfig()          promesse -> objet (memes cles que le JSON du kit : rpo, jpo, cms, d60, pfft...)
//   DLKit.ecrireConfig(cfg)     promesse ; refuse (erreur) une valeur hors des bornes du firmware
//   DLKit.listerRuns()          promesse -> [{ id, quand, jalons, ... }]
//   DLKit.lireRun(id)           promesse -> le run complet (ech = echantillons)
//   DLKit.commande(nom)         'calibrer' | 'maj' | 'rejouer:<id>' (demo) | 'sim' (vrai kit : course simulee au banc)
//   [0.13.0] la mise a jour du firmware par le Bluetooth (module PT2.1.66 et plus) :
//   DLKit.majPossible()         true si le module connecte a la caracteristique 7a1e0006 (ou en demo)
//   DLKit.lireFirmware(buf)     ArrayBuffer d'un .bin -> { fw, taille, crc, octets } ; une erreur dite si ce n'est pas un DLPT2
//   DLKit.majFirmware(f, suivi) promesse -> { octets, ms, trous, avant, apres } ; suivi({ fait, total, oPs, trous, etape })
//   DLKit.arreterMaj()          arrete le transfert (le module redemarre sur son ancien firmware)
window.DLKit = (function () {
  var ecouteurs = { etat: [], telem: [], jalon: [], run: [] };
  function emettre(type, x) { (ecouteurs[type] || []).forEach(function (f) { try { f(x); } catch (e) { console.error(e); } }); }
  var st = { connecte: false, mode: null, nom: '' };

  // Bornes des reglages = celles du firmware PT2.1.56 (un envoi hors bornes est refuse en entier par le kit).
  // [B v0.9] + la course a index (PT2.1.60) ; idxc (0 ou 3000..30000) est verifiee a part.
  // [0.10.0] + le type de vehicule (veh 0..2) et le depart en demi-pouces (dep 0..72, 0 = defaut du type) : PT2.1.64
  var BORNES = { rpo: [0, 36], jpo: [-120, 36], d60: [-72, 72], cms: [-600, 600], tzh: [-12, 14], veh: [0, 2], dep: [0, 72],
                 idxid: [1, 2047], idxz: [0, 200], idxp: [10, 1000], idxf: [0, 3000], idxv: [50, 10230], idxam: [0, 1], idxon: [0, 1] };

  // ---------------------------------------------------------------- le kit de demonstration
  var demo = {
    // [0.10.0] comme un kit PT2.1.64 de type voiture : depart par defaut 8 po (16 demi-pouces), jalons a D - 50 po
    // [0.12.0] annonce la PT2.1.65 : le choix FuelTech FT470 / FT700 (mode FUELTECH_CAN) se montre aussi en demo
    // [0.13.0] annonce la PT2.1.66 : la mise a jour par le Bluetooth se montre aussi en demo (transfert simule)
    cfg: { fw: 'PT2.1.66', app: 'dlg', sfx: 'DEMO', board: 'DEMO00000000', rpo: 8, jpo: -50, cms: 0, d60: 0, veh: 1, dep: 16, pfft: 0,
           mode: 'HOLLEY', cbr: 1000000, hecu: 1, strig: 1, scid: 1280, grate: 40, dynm: 8, imuf: 2, tzh: -4,
           imu: 1, cal: 1, sats: 14, fix: 3, hz: 25,
           // [B v0.4] l'ECU et le depart CAN, memes cles que le JSON du kit
           hid: 1500, lect: 'LINK_GD', lid: 1000, eid: 1200, scid: 0, scext: 0, scby: 0, scmk: 255, sced: 2,
           // [B v0.9] la course a index, memes cles que le JSON du kit PT2.1.60 (idxa et idxr : lecture seule)
           idxon: 0, idxc: 0, idxid: 0x406, idxz: 20, idxp: 150, idxf: 500, idxv: 1023, idxam: 0, idxa: 0, idxr: '' },
    minuterie: null, rejeu: null,
    // [B v0.9] l'index du kit demo : le MEME calcul que le kit (js/index-calc.js), en mode ombre (le rejeu ne ralentit pas)
    idx: { ref: null, st: null, dernier: 0 },
    idxPas: function (m, dt) {
      if (!window.DLIndex) return null;
      if (!this.idx.st) this.idx.st = DLIndex.etatNeuf();
      DLIndex.pas(this.idx.st, this.idx.ref, this.cfg, !!this.cfg.idxa, m, dt);
      return Number(this.cfg.idxon) ? [this.idx.st.cmd, this.idx.st.avance == null ? null : Math.round(this.idx.st.avance), this.idx.st.etat] : undefined;
    },
    demarrer: function () {
      var moi = this;
      this.minuterie = setInterval(function () { moi.tic(); }, 100);
    },
    arreter: function () { clearInterval(this.minuterie); this.minuterie = null; this.rejeu = null; },
    // A l'arret : vitesse 0 et un peu de bruit de G ; pendant un rejeu : les vrais echantillons du run, en temps reel.
    tic: function () {
      var now = Date.now();
      if (this.rejeu) {
        var r = this.rejeu, t = now - r.debut + r.ech[0][0], i = r.i;
        while (i < r.ech.length - 1 && r.ech[i + 1][0] <= t) i++;
        r.i = i;
        var e = r.ech[i];
        ['60', '330', '660', '1320'].forEach(function (k) {
          var j = r.run.jalons[k];
          if (j && !r.vus[k] && r.t0 != null && t - r.t0 >= j.t) { r.vus[k] = true; emettre('jalon', { d: +k, t: j.t, v: j.v, ms: now, el: t }); }
        });
        // [B v0.6] le rejeu peut finir juste avant le passage du dernier jalon (echantillons a ~25 Hz, tic a 100 ms) :
        // on envoie alors les jalons restants, sinon l'ecran disait « Termine · 4,785 s » (le 1/8) au lieu du 1/4
        if (i >= r.ech.length - 1) ['60', '330', '660', '1320'].forEach(function (k) {
          var j = r.run.jalons[k];
          if (j && !r.vus[k]) { r.vus[k] = true; emettre('jalon', { d: +k, t: j.t, v: j.v, ms: now, el: t }); }
        });
        if (r.t0 == null && e[2] >= r.run.reglages.rpo / 12) r.t0 = e[0];
        // [B v0.9] l'index : un pas par echantillon (25 Hz, comme le kit), meme entre deux tics de 100 ms
        var ix;
        for (var q = r.iIdx; q <= i; q++) {
          var s = r.ech[q]; if (s[0] < 0) continue;
          if (r.tRoll == null && s[2] >= r.run.reglages.rpo / 12) r.tRoll = s[0];
          ix = this.idxPas({ course: true, gotRoll: r.tRoll != null, dist: s[2], kmh: s[1], eNow: s[0], tRoll: r.tRoll || 0,
                             corrMs: r.run.reglages.cms || 0, jalFt: (r.run.reglages.jpo != null ? r.run.reglages.jpo : 12) / 12, gpsOk: true },
                           r.qAvant == null ? 40 : s[0] - r.qAvant);
          r.qAvant = s[0];
        }
        r.iIdx = i + 1;
        var etat = (e[0] < 0) ? 'ARME' : (i >= r.ech.length - 1 ? 'FINI' : 'COURSE');
        emettre('telem', { ms: now, kmh: e[1], g: e[3], etat: etat, sats: this.cfg.sats, fix: this.cfg.fix, hz: this.cfg.hz, el: Math.max(0, e[0]), ix: ix });
        if (i >= r.ech.length - 1) {
          this.rejeu = null; this.finJusqua = now + 6000;
          if (Number(this.cfg.idxam) === 0) this.cfg.idxa = 0;   // comme le kit : arme a la main pour UN run
          emettre('run', { id: r.run.id, fini: true });
        }
        return;
      }
      // apres un run, le kit reste « TERMINE » quelques secondes (le temps de lire les jalons), puis se rearme
      var etatRepos = (this.finJusqua && now < this.finJusqua) ? 'FINI' : 'ARME';
      var ixr = this.idxPas({ course: false, gotRoll: false, dist: 0, kmh: 0, eNow: 0, tRoll: 0, corrMs: 0, jalFt: 1, gpsOk: true }, 100);
      emettre('telem', { ms: now, kmh: 0, g: (Math.random() - 0.5) * 0.02, etat: etatRepos, sats: this.cfg.sats, fix: this.cfg.fix, hz: this.cfg.hz, ix: ixr });
    },
    rejouer: function (id) {
      var run = (window.DL_DEMO_RUNS || []).filter(function (r) { return r.id === id; })[0];
      if (!run) return false;
      this.rejeu = { run: run, ech: run.ech, i: 0, debut: Date.now(), vus: {}, t0: null, iIdx: 0, tRoll: null, qAvant: null };
      emettre('run', { id: run.id, debut: true });
      return true;
    }
  };

  function verifier(cfg) {
    Object.keys(BORNES).forEach(function (k) {
      if (cfg[k] == null || (typeof cfg[k] === 'number' && isNaN(cfg[k]))) return;
      var v = Number(cfg[k]), b = BORNES[k];
      if (!Number.isInteger(v) || v < b[0] || v > b[1]) throw new Error(k + ' : ' + b[0] + ' .. ' + b[1]);
    });
    // [B v0.9] la cible d'index : 0 (aucune) ou 3000..30000 ms ; la pleine commande vient apres la zone morte
    if (cfg.idxc != null && !isNaN(cfg.idxc)) {
      var c = Number(cfg.idxc);
      if (!Number.isInteger(c) || (c !== 0 && (c < 3000 || c > 30000))) throw new Error('idxc : 0, ou 3000 .. 30000');
    }
    if (cfg.idxz != null && cfg.idxp != null && !isNaN(cfg.idxz) && !isNaN(cfg.idxp) && Number(cfg.idxp) <= Number(cfg.idxz))
      throw new Error('idxp > idxz');
  }

  // ---------------------------------------------------------------- le vrai kit, par Bluetooth Web
  // [B v0.3, 7 oct.] MEME protocole que la PWA v118 (DRAGLOG_webapp/index.html) et le firmware PT2.1.56 : service
  // 7a1e0000, rien de nouveau cote kit. Telemetrie et config en JSON, commandes en texte (calib, sim, ota, dumpble),
  // runs en texte par blocs sur DUMP jusqu'a « [BLE_DUMP_END] ».
  // ⚠ En DRAGLOGICS, le kit n'annonce son Bluetooth que 20 s apres l'allumage (PT2.1.51) : la feuille le dit.
  // ⚠ Le kit refuse un JSON de config ENTIER pour une seule valeur fausse, sans repondre d'erreur : on n'envoie que
  //   les reglages CHANGES, puis on RELIT le kit et on compare chaque valeur envoyee (un refus est dit a voix haute).
  function uuid(n) { return '7a1e000' + n + '-9f2b-4b8e-8f21-3d6c9a1e0000'; }
  var SVC = uuid(0), C_TELEM = uuid(1), C_CONFIG = uuid(3), C_CMD = uuid(4), C_DUMP = uuid(5), C_MAJ = uuid(6);
  var dec = new TextDecoder(), enc = new TextEncoder();
  var FIN_DUMP = '[BLE_DUMP_END]';
  var CAL_RAISONS = ['', 'calR1', 'calR2', 'calR3', 'calR4', 'calR5', 'calR6'];
  if (window.DLI18n) DLI18n.ajouter({
    kitPasDlpt2: 'Cet appareil n’est pas un module DRAGLOG (DLAP ou autre).', kitRefus: 'le module a refusé : {x}',
    kitDumpDelai: 'les runs n’arrivent plus (rien depuis 8 s)', kitCmdAbsente: 'ce module ne prend pas de commande',
    calRefus: 'Calibration refusée : {x}', calMuet: 'Le module ne répond pas à la calibration (6 s).',
    calR1: 'IMU muet', calR2: 'véhicule en mouvement', calR3: 'trop de vibrations (moteur au ralenti ?)',
    calR4: 'le module bouge', calR5: 'rotation réelle détectée', calR6: 'IMU absent', kitRejeuBle: 'pas de rejeu avec un vrai module',
    kitRunAbsent: 'ce run n’est plus dans le module', idxRefusOff: 'la course à index est coupée',
    idxRefusCourse: 'un run est en cours', idxRefusManque: 'il manque le run de référence ou la cible',
    // [0.13.0] la mise a jour du firmware
    majPasImage: 'Ce fichier n’est pas un firmware ESP32 (.bin).', majPasEsp32: 'Ce firmware n’est ni pour une puce ESP32 ni pour une ESP32-S3.',
    majTropGros: 'Ce firmware est trop gros pour le module ({n} ko).',
    majPasDlpt2: 'Ce fichier n’est pas un firmware DLPT2 qui se met à jour par l’app (PT2.1.66 ou plus).',
    majAbsente: 'Ce module ne se met pas à jour par l’app : installe une fois la PT2.1.66 ou plus par USB.',
    majRefus: 'Mise à jour refusée par le module : {x}', majRoule: 'la voiture roule ou un run est en cours',
    majTaille: 'taille du fichier refusée', majDebut: 'le module ne peut pas commencer', majEcriture: 'erreur d’écriture dans le module',
    majIncomplet: 'fichier incomplet', majCrc: 'fichier abîmé pendant le transfert (CRC)', majImage: 'le module refuse l’image (vérification)',
    majSession: 'pas de mise à jour en cours', majFormat: 'paquet mal formé', majArret: 'arrêt demandé', majTropLong: 'trop d’octets',
    majInconnu: 'raison inconnue', majMuet: 'Le module ne répond plus pendant la mise à jour.', majArretee: 'Mise à jour arrêtée. Le module garde son ancien firmware.',
    majPasRevenu: 'Le module n’est pas revenu après son redémarrage (45 s). Rallume-le, puis reconnecte-le pour lire sa version.'
  }, {
    kitPasDlpt2: 'This is not a DRAGLOG device (DLAP or other).', kitRefus: 'the device refused: {x}',
    kitDumpDelai: 'the runs stopped arriving (nothing for 8 s)', kitCmdAbsente: 'this device takes no command',
    calRefus: 'Calibration refused: {x}', calMuet: 'The device does not answer the calibration (6 s).',
    calR1: 'IMU silent', calR2: 'vehicle moving', calR3: 'too much vibration (engine idling?)',
    calR4: 'the device is moving', calR5: 'real rotation detected', calR6: 'no IMU', kitRejeuBle: 'no replay with a real device',
    kitRunAbsent: 'this run is no longer in the device', idxRefusOff: 'index racing is off',
    idxRefusCourse: 'a run is in progress', idxRefusManque: 'the reference run or the target is missing',
    majPasImage: 'This file is not an ESP32 firmware (.bin).', majPasEsp32: 'This firmware is for neither an ESP32 nor an ESP32-S3 chip.',
    majTropGros: 'This firmware is too big for the device ({n} KB).',
    majPasDlpt2: 'This file is not a DLPT2 firmware that updates from the app (PT2.1.66 or later).',
    majAbsente: 'This device does not update from the app: install PT2.1.66 or later once by USB.',
    majRefus: 'Update refused by the device: {x}', majRoule: 'the vehicle is moving or a run is in progress',
    majTaille: 'file size refused', majDebut: 'the device cannot start', majEcriture: 'write error in the device',
    majIncomplet: 'incomplete file', majCrc: 'file damaged during the transfer (CRC)', majImage: 'the device refuses the image (check)',
    majSession: 'no update in progress', majFormat: 'malformed packet', majArret: 'stop requested', majTropLong: 'too many bytes',
    majInconnu: 'unknown reason', majMuet: 'The device stopped answering during the update.', majArretee: 'Update stopped. The device keeps its old firmware.',
    majPasRevenu: 'The device did not come back after its restart (45 s). Turn it on again, then reconnect it to read its version.'
  });
  function TT(k, v) { return window.DLI18n ? DLI18n.T(k, v) : k; }

  // [0.13.0] + connu (pour se reconnecter sans la liste apres le redemarrage d'une mise a jour), fw, majSession
  var ble = { dev: null, ch: {}, telem: null, etatPerf: null, suivi: false, vus: {}, runs: null, dump: null, connu: null, fw: '', majSession: null };
  function lireJson(c) { return c.readValue().then(function (v) { return JSON.parse(dec.decode(v)); }); }
  function ecrire(c, txt) {
    var d = enc.encode(txt);
    if (typeof c.writeValueWithResponse === 'function') return c.writeValueWithResponse(d);
    return c.writeValue(d);
  }
  function commandeBle(txt) {
    if (!ble.ch.cmd) return Promise.reject(new Error(TT('kitCmdAbsente')));
    return ecrire(ble.ch.cmd, txt);
  }
  // [B v0.5] TIMEOUT n'est plus confondu avec un run fini : c'est un abandon (20 s sans arrivee). IDLE = attente du reset.
  var ETATS = { ARMED: 'ARME', RUNNING: 'COURSE', DONE: 'FINI', TIMEOUT: 'ABANDON', IDLE: 'ATTENTE' };
  function surTelem(ev) {
    var j; try { j = JSON.parse(dec.decode(ev.target.value)); } catch (e) { return; }   // trame coupee : on attend la suivante
    ble.telem = j;
    var p = j.perf || {}, avant = ble.etatPerf;
    ble.etatPerf = p.st;
    // un run commence : on suit ses jalons (pas ceux d'un run fini avant la connexion)
    if (p.st === 'RUNNING' && avant !== 'RUNNING') { ble.suivi = true; ble.vus = {}; emettre('run', { debut: true }); }
    if (ble.suivi) ['60', '330', '660', '1320'].forEach(function (k) {
      var t = p['t' + k];
      // [B v0.6] ms et el = le moment ou le kit annonce le jalon (repere du graphique, a une trame pres)
      if (t && !ble.vus[k]) { ble.vus[k] = true; emettre('jalon', { d: +k, t: t, v: (k !== '60' && p['v' + k]) ? p['v' + k] / 100 : null, ms: j.now, el: p.el }); }
    });
    // [B v0.5] + temps ecoule du run (el), temoin transbrake (tb/tbs, mode Holley seulement), simulation en cours
    // [B v0.9] + la commande d'index du kit PT2.1.60 : ix = [commande 0-1023, avance ms ou null, etat]
    emettre('telem', { ms: j.now, kmh: (j.v || 0) / 100, g: j.g || 0, etat: ETATS[p.st] || 'ATTENTE', sats: j.sats, fix: j.valid ? 3 : 0, hz: j.hz,
                       el: p.el || 0, tb: p.tb, tbs: p.tbs, sim: !!p.sim, ix: p.ix });
    // fin du run : le kit l'ecrit en flash, puis la liste est relue (cache efface)
    if (ble.suivi && avant === 'RUNNING' && (p.st === 'DONE' || p.st === 'TIMEOUT')) {
      ble.suivi = false; ble.runs = null;
      setTimeout(function () { emettre('run', { fini: true }); }, 1500);
    }
  }
  function surDump(ev) {
    var d = ble.dump; if (!d) return;
    var morceau = dec.decode(ev.target.value);
    clearTimeout(d.minuterie);
    if (morceau === FIN_DUMP) { ble.dump = null; d.ok(d.texte); return; }
    d.texte += morceau;
    d.minuterie = setTimeout(d.delai, 8000);
  }
  function finBle() {
    if (ble.dump) { var d = ble.dump; ble.dump = null; clearTimeout(d.minuterie); d.ko(new Error('hors-ligne')); }
    // [0.13.0] une mise a jour en cours le sait tout de suite (sinon elle attendrait 4 s une reponse qui ne viendra pas)
    if (ble.majSession && ble.majSession.attente) { var a = ble.majSession.attente; ble.majSession.attente = null; a.ko(new Error('hors-ligne')); }
    ble = { dev: null, ch: {}, telem: null, etatPerf: null, suivi: false, vus: {}, runs: null, dump: null, connu: null, fw: '', majSession: null };
    if (st.mode === 'ble') { st = { connecte: false, mode: null, nom: '' }; emettre('etat', { connecte: false, mode: null, nom: '' }); }
  }
  // [B v0.9] L'APP NATIVE (iPhone, Android : Capacitor) n'a pas navigator.bluetooth. Le module
  // @capacitor-community/bluetooth-le (BleClient, charge seulement dans l'app native par outils/construire_www.py) est
  // habille comme le Bluetooth Web : un faux « device » et de fausses « caracteristiques » (readValue,
  // writeValueWithResponse, startNotifications, addEventListener). Le reste de la couche ne change pas.
  // ?natif=1 force ce chemin dans Chrome (BleClient y passe par le Bluetooth Web) : essai avec un vrai kit sur le PC.
  function bleNatifDispo() {
    var C = window.Capacitor, P = window.capacitorCommunityBluetoothLe;
    if (!P || !P.BleClient) return false;
    return !!(C && C.isNativePlatform && C.isNativePlatform()) || /[?&]natif=1\b/.test(location.search);
  }
  var bleNatifPret = null;
  // [0.13.0] connu = { id, name } d'un module deja choisi : on se reconnecte sans montrer la liste (apres une mise a jour)
  function ouvrirBleNatif(connu) {
    var B = window.capacitorCommunityBluetoothLe.BleClient, finDev = [], dev = null;
    // la permission Bluetooth est demandee ICI, quand l'utilisateur touche « Chercher un kit » (regle Apple et Google)
    if (!bleNatifPret) bleNatifPret = B.initialize({ androidNeverForLocation: true }).catch(function (e) { bleNatifPret = null; throw e; });
    function carac(u) {
      var ecoute = [];
      return {
        readValue: function () { return B.read(dev.id, SVC, u); },
        writeValueWithResponse: function (d) { return B.write(dev.id, SVC, u, new DataView(d.buffer, d.byteOffset, d.byteLength)); },
        // [0.13.0] ⚠ sur iOS, le module n'attend PAS la file d'iOS : un paquet peut etre jete (voir majBle)
        writeValueWithoutResponse: function (d) { return B.writeWithoutResponse(dev.id, SVC, u, new DataView(d.buffer, d.byteOffset, d.byteLength)); },
        startNotifications: function () {
          return B.startNotifications(dev.id, SVC, u, function (v) { ecoute.forEach(function (f) { f({ target: { value: v } }); }); });
        },
        addEventListener: function (t, f) { if (t === 'characteristicvaluechanged') ecoute.push(f); }
      };
    }
    return bleNatifPret.then(function () {
      if (connu) return { deviceId: connu.id, name: connu.name };
      return B.requestDevice({ services: [SVC] });
    }).catch(function (e) {
      // l'utilisateur ferme la liste : meme message que dans le navigateur (« recherche annulee »)
      if (/cancel/i.test(e && e.message || '')) { var a = new Error(e.message); a.name = 'NotFoundError'; throw a; }
      throw e;
    }).then(function (d) {
      dev = { id: d.deviceId, name: d.name || '', ouvert: false };
      return B.connect(dev.id, function () { dev.ouvert = false; finDev.forEach(function (f) { f(); }); }, { timeout: 15000 });
    }).then(function () {
      dev.ouvert = true;
      return B.getServices(dev.id);
    }).then(function (services) {
      var s = services.filter(function (x) { return String(x.uuid).toLowerCase() === SVC; })[0];
      var uu = s ? s.characteristics.map(function (c) { return String(c.uuid).toLowerCase(); }) : [];
      if (uu.indexOf(C_CONFIG) < 0) { B.disconnect(dev.id); throw new Error(TT('kitPasDlpt2')); }
      var opt = function (u) { return uu.indexOf(u) >= 0 ? carac(u) : null; };
      var faux = {
        name: dev.name,
        addEventListener: function (t, f) { if (t === 'gattserverdisconnected') finDev.push(f); },
        gatt: { get connected() { return dev.ouvert; }, disconnect: function () { B.disconnect(dev.id); } }
      };
      return { dev: faux, c: [carac(C_CONFIG), opt(C_TELEM), opt(C_CMD), opt(C_DUMP), opt(C_MAJ)], connu: { natif: true, id: dev.id, name: dev.name } };
    });
  }
  // [0.13.0] connu = ble.connu d'une connexion d'avant : pas de liste, on rouvre le meme module (apres une mise a jour)
  function connecterBle(connu) {
    var natif = bleNatifDispo();
    if (!natif && !navigator.bluetooth) return Promise.reject(new Error('ble-absent'));
    var dev, svc, garde;
    var ouvrir = natif ? ouvrirBleNatif(connu).then(function (r) {
      dev = r.dev; dev.addEventListener('gattserverdisconnected', finBle);
      garde = r.connu;
      return r.c;
    }) : (connu && connu.web ? Promise.resolve(connu.web) : navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }], optionalServices: [SVC] })).then(function (d) {
      dev = d; garde = { web: d };
      if (!dev._dlFin) { dev._dlFin = true; dev.addEventListener('gattserverdisconnected', finBle); }   // une seule fois par appareil
      return dev.gatt.connect();
    }).then(function (srv) { return srv.getPrimaryService(SVC); }).then(function (s) {
      svc = s;
      var opt = function (u) { return svc.getCharacteristic(u).catch(function () { return null; }); };
      return Promise.all([svc.getCharacteristic(C_CONFIG), opt(C_TELEM), opt(C_CMD), opt(C_DUMP), opt(C_MAJ)]);
    });
    return ouvrir.then(function (c) {
      ble.dev = dev; ble.ch = { config: c[0], telem: c[1], cmd: c[2], dump: c[3], maj: c[4] }; ble.connu = garde;
      return lireJson(ble.ch.config);
    }).then(function (cfg) {
      // la nouvelle app parle aux DLPT2 seulement : un DLAP (E3B4) a sa propre page
      if (cfg.dev === 'DLAP' || !ble.ch.telem) { dev.gatt.disconnect(); throw new Error(TT('kitPasDlpt2')); }
      ble.fw = cfg.fw || '';
      var p = [ble.ch.telem.startNotifications().then(function () { ble.ch.telem.addEventListener('characteristicvaluechanged', surTelem); })];
      if (ble.ch.dump) p.push(ble.ch.dump.startNotifications().then(function () { ble.ch.dump.addEventListener('characteristicvaluechanged', surDump); }));
      if (ble.ch.maj) p.push(ble.ch.maj.startNotifications().then(function () { ble.ch.maj.addEventListener('characteristicvaluechanged', surMaj); }));
      return Promise.all(p).then(function () {
        st = { connecte: true, mode: 'ble', nom: nomDuKit(cfg, dev.name) };
        emettre('etat', { connecte: true, mode: 'ble', nom: st.nom });
        return st;
      });
    });
  }
  // [0.9.0, 15 oct.] LE NOM VIENT DU KIT, PAS DU SYSTEME. dev.name est le nom que Chrome ou iOS ont GARDE EN CACHE
  // (iOS : peripheral.name, lu a la derniere connexion) : apres un changement de nom, l'app montrait un vieux nom.
  // Le firmware s'annonce « CAR » + les 5 premiers caracteres permis du suffixe (buildBleDeviceName) : on le recalcule
  // depuis la configuration lue dans le kit. Repli sur le nom du systeme si le kit n'a pas de suffixe.
  function nomDuKit(cfg, nomSysteme) {
    var s = String(cfg && cfg.sfx != null ? cfg.sfx : '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 5);
    return s ? 'CAR' + s : (nomSysteme || '?');
  }
  function lireConfigBle() {
    return lireJson(ble.ch.config).then(function (cfg) {
      var t = ble.telem;   // la fiche du kit montre aussi ce que dit la telemetrie
      if (t) { cfg.sats = t.sats; cfg.hz = t.hz; cfg.fix = t.valid ? 3 : 0; cfg.cal = t.cal ? 1 : 0; cfg.imu = t.imu ? 1 : 0; }
      return cfg;
    });
  }
  function egal(a, b) { return String(a) === String(b); }
  function ecrireConfigBle(cfg) {
    try { verifier(cfg); } catch (e) { return Promise.reject(e); }
    return lireJson(ble.ch.config).then(function (kit) {
      var diff = {};
      Object.keys(cfg).forEach(function (k) {
        var v = cfg[k];
        if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return;   // champ vide : on ne touche pas
        if (!(k in kit)) return;                                                     // reglage que ce firmware n'a pas
        if (!egal(v, kit[k])) diff[k] = v;
      });
      var cles = Object.keys(diff);
      if (!cles.length) return { envoye: {} };
      return ecrire(ble.ch.config, JSON.stringify(diff)).then(function () { return lireJson(ble.ch.config); }).then(function (apres) {
        var refus = cles.filter(function (k) { return !egal(apres[k], diff[k]); });
        if (refus.length) throw new Error(TT('kitRefus', { x: refus.join(', ') }));
        // [0.9.0] nouveau nom : l'app le montre tout de suite (le kit l'annonce a son prochain demarrage)
        if ('sfx' in diff) { st.nom = nomDuKit(apres, st.nom); emettre('etat', { connecte: st.connecte, mode: st.mode, nom: st.nom }); }
        return { envoye: diff };
      });
    });
  }
  // ---- les runs : le texte du firmware (runWriteText), du plus ancien (#1) au plus recent
  function lireDump() {
    if (ble.dump) return ble.dump.promesse;
    if (!ble.ch.dump) return Promise.reject(new Error(TT('kitCmdAbsente')));
    var d = { texte: '' };
    d.promesse = new Promise(function (ok, ko) {
      d.ok = ok; d.ko = ko;
      d.delai = function () { if (ble.dump === d) ble.dump = null; ko(new Error(TT('kitDumpDelai'))); };
      d.minuterie = setTimeout(d.delai, 8000);
    });
    ble.dump = d;
    commandeBle('dumpble').catch(function (e) { if (ble.dump === d) { ble.dump = null; clearTimeout(d.minuterie); d.ko(e); } });
    return d.promesse;
  }
  function analyserDump(texte) {
    var tete = /board=(\w+)/.exec(texte), carte = tete ? tete[1] : 'KIT';
    var annonce = /--\s*(\d+) run\(s\)/.exec(texte);
    var runs = [], r = null, refus = [];
    texte.split('\n').forEach(function (l) {
      l = l.replace(/\r$/, '');
      var m;
      // [PT2.1.58] un run que le kit n'a pas pu envoyer : « [dump] !!! RUN #n (seq s) non envoye : raison »
      if ((m = /^\[dump\] !!! (.*)$/.exec(l))) { refus.push(m[1]); r = null; return; }
      if ((m = /^\[dump\] RUN #(\d+) heure=(\S+)(.*)$/.exec(l))) {
        var reste = m[3], kv = {};
        reste.replace(/(\w+)=(\S+)/g, function (_, k, v) { kv[k] = v; });
        r = { ordre: +m[1], heure: m[2], kv: kv, R: [], J: {}, fin: false }; runs.push(r); return;
      }
      if (!r) return;
      if (l.indexOf('R,') === 0) { r.R.push(l.split(',').slice(1).map(Number)); return; }
      if ((m = /^\[dump\] J(\d+) t_ms=(\d+)(?: vcross_x100=(\d+) vtrap_x100=(\d+))?/.exec(l))) {
        r.J[m[1]] = { t: +m[2], v: m[4] ? +m[4] / 100 : null }; return;
      }
      if (/^\[dump\] FIN RUN #/.test(l)) r.fin = true;
    });
    var complets = runs.filter(function (x) { return x.fin; });
    // ⚠ un run incomplet (ou absent : le kit saute un run qu'il ne peut pas relire) est dit, pas cache
    // [B v0.4] vu le 7 oct. sur un kit (PT2.1.56) : « 8 annonces, 0 recu » -- le kit n'a pas la memoire pour
    // construire le texte d'un run d'un seul bloc et le saute sans rien dire. L'ecart remonte jusqu'a l'ecran.
    var manque = annonce ? Math.max(0, +annonce[1] - complets.length) : 0;
    if (complets.length !== runs.length || manque)
      console.error('[DLKit] runs annonces ' + (annonce ? annonce[1] : '?') + ', recus ' + runs.length + ', complets ' + complets.length);
    var res = complets.map(function (x) {
      var avant = x.R.filter(function (e) { return e[0] < -100; });
      var ay0 = avant.length ? avant.reduce(function (s, e) { return s + e[4]; }, 0) / avant.length : 0;
      var fin = x.J['1320'] || x.J['660'] || x.J['60'];
      return {
        id: carte + '_' + x.heure.replace(/:/g, '') + '_' + (fin ? fin.t : 0) + '_' + x.R.length,
        quand: x.heure, ordre: x.ordre, genre: '', src: x.kv.src, statut: x.kv.statut,
        // [0.10.0] kit PT2.1.64 : « veh=moto|voiture » (type de vehicule) et le depart au demi-pouce (rollout_po=10.5) ;
        // dyn = le modele GPS du run (le calage n'utilise que les runs en modele 8)
        reglages: { rpo: +(x.kv.rollout_po || 12), jpo: +(x.kv.jalons_po != null ? x.kv.jalons_po : (x.kv.rollout_po || 12)),
                    cms: +(x.kv.corr_ms || 0), d60: +(x.kv.dec60_po || 0),
                    veh: x.kv.veh === 'voiture' ? 1 : x.kv.veh === 'moto' ? 2 : 0, dyn: x.kv.dyn != null ? +x.kv.dyn : null },
        jalons: x.J, colonnes: ['t_ms', 'kmh', 'pi', 'g_long'],
        // colonnes du kit : elapsed_ms, kmh_x100, dist_ft, ax, ay, az (mg)... ; G long = -(ay - ay au repos), comme la demo
        ech: x.R.map(function (e) { return [e[0], e[1] / 100, e[2], Math.round(-(e[4] - ay0)) / 1000]; })
      };
    });
    res.manque = manque; res.annonce = annonce ? +annonce[1] : null; res.refus = refus;
    if (refus.length) console.error('[DLKit] le kit dit : ' + refus.join(' | '));
    return res;
  }
  function listerRunsBle() {
    if (ble.runs) return Promise.resolve(ble.runs);
    // une liste a qui il manque des runs n'est pas gardee : la prochaine demande relit le kit
    return lireDump().then(function (t) { var l = analyserDump(t); if (!l.manque) ble.runs = l; return l; });
  }
  function calibrerBle() {
    return commandeBle('calib').then(function () {
      return new Promise(function (ok, ko) {
        var t0 = Date.now(), vu = false;
        var m = setInterval(function () {
          var j = ble.telem || {};
          if (j.calSt === 1) vu = true;
          if (vu && j.calSt === 2) { clearInterval(m); ok(true); }
          else if (vu && j.calSt === 3) { clearInterval(m); ko(new Error(TT('calRefus', { x: TT(CAL_RAISONS[j.calErr] || 'calR1') }))); }
          else if (!vu && Date.now() - t0 > 6000) { clearInterval(m); ko(new Error(TT('calMuet'))); }
          else if (Date.now() - t0 > 20000) { clearInterval(m); ko(new Error(TT('calMuet'))); }
        }, 200);
      });
    });
  }

  // ---------------------------------------------------------------- [0.13.0] mise a jour du firmware par le Bluetooth
  // Protocole : le meme que le firmware du module (PT2.1.66). Le fichier .bin est CHOISI DANS LE TELEPHONE : il n'est ni
  // dans l'app ni dans le depot.
  // ⚠ Le module Bluetooth d'iOS (bluetooth-le 8.3.0, Device.swift) envoie une ecriture sans reponse SANS attendre la
  //   file d'iOS : un paquet peut etre jete sans erreur. Le module n'ecrit que la position qu'il attend et dit le trou
  //   (0x85) ; l'app repart de la. Chaque fenetre finit par un POINT (0x03, avec reponse) : le telephone n'a jamais plus
  //   d'une fenetre d'avance, et la fenetre se reduit a chaque trou.
  // ⚠ CHAQUE POINT PORTE UN NUMERO que le module renvoie (0x82). Sans lui, une reponse en retard etait prise pour celle du
  //   POINT suivant : l'app reculait a une vieille position, le module disait un trou, et ainsi de suite (banc simule,
  //   perte de 2 % : 3 448 reprises pour 254 paquets perdus). Une reponse d'un autre numero est ignoree.
  var MAJ_MARQUE = '@@DLPT2@@';
  // [0.13.2] DEUX PUCES : le DLPT2 PT2.1.67 compile pour l'ESP32 (kits) et pour l'ESP32-S3 (modules de serie). Puce = octets
  // 12-13 de l'en-tete de l'image. La taille maximale est celle d'un emplacement d'application du module : 0x1E0000 pour
  // l'ESP32 (min_spiffs, 4 Mo), 0x640000 pour l'ESP32-S3 (default_16MB, 16 Mo). Le module refuse aussi une image de
  // l'AUTRE puce : au premier paquet depuis la PT2.1.67, a la fin du transfert avant (verification de l'image).
  var MAJ_PUCES = { 0: { nom: 'ESP32', max: 0x1E0000 }, 9: { nom: 'ESP32-S3', max: 0x640000 } };
  var MAJ_CODES = ['', 'majRoule', 'majTaille', 'majDebut', 'majEcriture', 'majIncomplet', 'majCrc', 'majImage', 'majSession', 'majFormat', 'majArret', 'majTropLong'];
  var CRC_T = null;
  function crc32(u8) {   // CRC-32 de zlib (le module calcule le meme avec esp_rom_crc32_le)
    if (!CRC_T) {
      CRC_T = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var r = n; for (var k = 0; k < 8; k++) r = (r & 1) ? (0xEDB88320 ^ (r >>> 1)) : (r >>> 1); CRC_T[n] = r >>> 0; }
    }
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // Un .bin du DLPT2 : image ESP32 ou ESP32-S3 (0xE9, puce 0 ou 9) qui porte la marque « @@DLPT2@@PT2.x.yy » (PT2.1.66 et
  // plus). Sans la marque : autre carte, autre croquis, ou firmware qui ne saurait plus se mettre a jour par l'app -> refus.
  function lireFirmware(buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length < 65536 || u8[0] !== 0xE9) throw new Error(TT('majPasImage'));
    var puce = MAJ_PUCES[u8[12] | (u8[13] << 8)];
    if (!puce) throw new Error(TT('majPasEsp32'));
    if (u8.length > puce.max) throw new Error(TT('majTropGros', { n: Math.round(u8.length / 1024) }));
    var mq = enc.encode(MAJ_MARQUE), at = -1, p = 0;
    while ((p = u8.indexOf(mq[0], p)) >= 0) {
      var k = 1; while (k < mq.length && u8[p + k] === mq[k]) k++;
      if (k === mq.length) { at = p; break; }
      p++;
    }
    if (at < 0) throw new Error(TT('majPasDlpt2'));
    var v = '', q = at + mq.length;
    while (q < u8.length && u8[q] && v.length < 16) v += String.fromCharCode(u8[q++]);
    if (!/^PT2\.\d+\.\d+$/.test(v)) throw new Error(TT('majPasDlpt2'));
    return { fw: v, puce: puce.nom, taille: u8.length, crc: crc32(u8), octets: u8 };
  }
  function erreurMaj(x) {
    return new Error(TT('majRefus', { x: TT(MAJ_CODES[x.code] || 'majInconnu') + (x.err ? ' (Update ' + x.err + ')' : '') }));
  }
  function surMaj(ev) {
    var dv = ev.target.value, m = ble.majSession, a;
    if (!m || !dv || dv.byteLength < 1) return;
    var t = dv.getUint8(0);
    if (t === 0x84) {   // la session est finie sur une erreur (le module redemarre)
      m.erreur = { code: dv.byteLength > 1 ? dv.getUint8(1) : 0, err: dv.byteLength > 2 ? dv.getUint8(2) : 0 };
      if (m.attente) { a = m.attente; m.attente = null; a.ko(erreurMaj(m.erreur)); }
      return;
    }
    if (t === 0x82 && dv.byteLength >= 6) {   // la reponse d'un POINT : seulement celle du numero attendu
      if (m.attente && m.attente.type === 0x82 && m.attente.numero === dv.getUint8(5)) { a = m.attente; m.attente = null; a.ok(dv.getUint32(1, true)); }
      return;
    }
    if (t === 0x85 && dv.byteLength >= 5) { m.trou = dv.getUint32(1, true); return; }   // un trou : la fenetre se ferme tout de suite
    if (m.attente && m.attente.type === t) { a = m.attente; m.attente = null; a.ok(dv); }
  }
  function ecrireOctets(c, b) {
    if (typeof c.writeValueWithResponse === 'function') return c.writeValueWithResponse(b);
    return c.writeValue(b);
  }
  function ecrireSans(c, b) {
    if (typeof c.writeValueWithoutResponse === 'function') return c.writeValueWithoutResponse(b);
    return ecrireOctets(c, b);
  }
  function pause(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  // La taille d'un paquet : MTU - 3 (ATT) - 6 (en-tete du POINT), au plus 512 par valeur (NimBLE), multiple de 16.
  function tailleMorceau() {
    var B = window.capacitorCommunityBluetoothLe && window.capacitorCommunityBluetoothLe.BleClient;
    if (!ble.connu || !ble.connu.natif || !B || !B.getMtu) return Promise.resolve(176);   // Bluetooth Web : MTU inconnue
    return B.getMtu(ble.connu.id).then(function (mtu) {
      var n = Math.min(Number(mtu) - 3, 512) - 6;
      return n >= 32 ? Math.floor(n / 16) * 16 : 16;
    }, function () { return 176; });
  }
  function majBle(f, suivi) {
    var c = ble.ch.maj;
    if (!c) return Promise.reject(new Error(TT('majAbsente')));
    var u8 = f.octets, N = u8.length, connu = ble.connu, avant = ble.fw;
    var m = { attente: null, trou: null, erreur: null, arret: false, numero: 0 }, morceau = 176, fen = 16, propres = 0, trous = 0, t0 = Date.now();
    ble.majSession = m;
    function attendre(type, ms, numero) {   // AVANT l'ecriture : la reponse peut arriver avant que l'ecriture ne rende la main
      var p = new Promise(function (ok, ko) {
        var att, t = setTimeout(function () { if (m.attente === att) { m.attente = null; ko(new Error('delai')); } }, ms);
        att = m.attente = { type: type, numero: numero, ok: function (x) { clearTimeout(t); ok(x); }, ko: function (e) { clearTimeout(t); ko(e); } };
      });
      // [0.13.2] ⚠ Un refus du module (0x84) peut rejeter cette attente AVANT que l'ecriture ne rende la main, donc avant
      // le .then(() => w) qui s'y abonne : rejet « non traite » a cet instant. Le navigateur l'ecrit en rouge dans la
      // console ; Node arrete le processus (banc simule, image S3 vers un module ESP32). La promesse rendue reste la meme :
      // l'appelant recoit toujours le refus.
      p.catch(function () {});
      return p;
    }
    function paquet(op, pos, len, numero) {   // DONNEE : 5 octets d'en-tete ; POINT : 6 (le numero a l'octet 5)
      var e = op === 0x03 ? 6 : 5, b = new Uint8Array(e + len);
      b[0] = op; b[1] = pos & 255; b[2] = (pos >>> 8) & 255; b[3] = (pos >>> 16) & 255; b[4] = (pos >>> 24) & 255;
      if (op === 0x03) b[5] = numero;
      if (len) b.set(u8.subarray(pos, pos + len), e);
      return b;
    }
    function verifierEtat() {
      if (m.erreur) throw erreurMaj(m.erreur);
      if (m.arret) throw new Error(TT('majArretee'));
    }
    function point(pos, len, essais) {   // un POINT : le module dit ou il en est ; 3 essais si la reponse ne vient pas
      m.numero = (m.numero + 1) & 255;
      var w = attendre(0x82, 4000, m.numero);
      return ecrireOctets(c, paquet(0x03, pos, len, m.numero)).then(function () { return w; }).catch(function (e) {
        if (e && e.message === 'delai' && essais > 1 && !m.erreur && !m.arret) return point(0, 0, essais - 1);
        throw (e && e.message === 'delai') ? new Error(TT('majMuet')) : e;
      });
    }
    function fenetre(pos) {
      verifierEtat();
      if (pos >= N) return Promise.resolve();
      var p = pos, k = 0;
      m.trou = null;
      function un() {
        verifierEtat();
        if (m.trou != null || p >= N || k >= fen - 1) return null;
        var len = Math.min(morceau, N - p), b = paquet(0x02, p, len);
        p += len; k++;
        return ecrireSans(c, b).then(un);
      }
      return Promise.resolve().then(un).then(function () {
        var len = (m.trou == null && p < N) ? Math.min(morceau, N - p) : 0, fin = p + len;
        return point(p, len, 3).then(function (attendu) {
          if (attendu < fin) { trous++; propres = 0; fen = Math.max(4, fen >> 1); }
          else if (++propres >= 4) { propres = 0; fen = Math.min(48, fen + 4); }
          suivi({ fait: attendu, total: N, oPs: attendu * 1000 / Math.max(1, Date.now() - t0), trous: trous });
          return fenetre(attendu);
        });
      });
    }
    function finir() {
      var w = attendre(0x83, 20000);   // le module verifie l'image (SHA-256 de 1,5 Mo) avant de repondre
      return ecrireOctets(c, new Uint8Array([0x04])).then(function () { return w; }).then(function (dv) {
        var code = dv.getUint8(1);
        if (code === 5) return fenetre(dv.getUint32(3, true)).then(finir);   // incomplet : on envoie ce qui manque
        if (code) throw erreurMaj({ code: code, err: dv.getUint8(2) });
        return { octets: N, ms: Date.now() - t0, trous: trous };
      }, function (e) { throw (e && e.message === 'delai') ? new Error(TT('majMuet')) : e; });
    }
    return tailleMorceau().then(function (n) {
      morceau = n;
      var d = new Uint8Array(9), w = attendre(0x81, 6000);
      d[0] = 0x01;
      [N, f.crc].forEach(function (v, i) { for (var j = 0; j < 4; j++) d[1 + 4 * i + j] = (v >>> (8 * j)) & 255; });
      return ecrireOctets(c, d).then(function () { return w; });
    }).then(function (dv) {
      var code = dv.getUint8(1);
      if (code) throw erreurMaj({ code: code, err: 0 });
      t0 = Date.now();
      console.log('[maj] debut : ' + N + ' octets, paquets de ' + morceau + ', fenetre ' + fen);
      return fenetre(0);
    }).then(finir).then(function (r) {
      ble.majSession = null;
      console.log('[maj] image acceptee : ' + r.octets + ' octets en ' + r.ms + ' ms, ' + r.trous + ' trous');
      suivi({ fait: N, total: N, etape: 'redemarrage' });
      return reconnecter(connu, 45000).then(function (cfg) { r.avant = avant; r.apres = cfg.fw || ''; return r; });
    }, function (e) {
      ble.majSession = null;
      if (m.arret) e = new Error(TT('majArretee'));   // l'arret a la main : pas « refusee par le module »
      else if (!st.connecte) e = new Error('hors-ligne');   // coupure : l'app dit b_fwCoupe, pas le texte brut du module Bluetooth
      else if (e && e.message === 'delai') e = new Error(TT('majMuet'));
      throw e;
    });
  }
  // Apres l'image acceptee, le module redemarre (1,5 s). On attend la coupure, puis on rouvre LE MEME module sans liste.
  // ⚠ En DRAGLOGICS, le module n'annonce son Bluetooth que 20 s apres l'allumage : les essais commencent tout de suite.
  function reconnecter(connu, limiteMs) {
    var fin = Date.now() + limiteMs, t1 = Date.now();
    function coupe() {
      if (!st.connecte || Date.now() - t1 > 8000) return Promise.resolve();
      return pause(200).then(coupe);
    }
    function essai() {
      return pause(1500).then(function () { return connecterBle(connu); }).catch(function (e) {
        if (Date.now() > fin) throw new Error(TT('majPasRevenu'));
        console.log('[maj] reconnexion : ' + (e && e.message));
        return essai();
      });
    }
    return coupe().then(function () { return st.connecte ? null : essai(); }).then(function () { return lireConfigBle(); });
  }
  // Le module de demonstration : le meme suivi, a ~300 ko/s, puis le « redemarrage » sur la version du fichier.
  function majDemo(f, suivi) {
    var N = f.octets.length, fait = 0, t0 = Date.now(), m = { arret: false };
    demo.maj = m;
    return new Promise(function (ok, ko) {
      (function pas() {
        if (m.arret) { demo.maj = null; ko(new Error(TT('majArretee'))); return; }
        fait = Math.min(N, fait + 24576);
        suivi({ fait: fait, total: N, oPs: fait * 1000 / Math.max(1, Date.now() - t0), trous: 0 });
        if (fait < N) { setTimeout(pas, 80); return; }
        suivi({ fait: N, total: N, etape: 'redemarrage' });
        // [0.13.1] comme le vrai module : il redemarre, la connexion tombe 1,5 s, puis l'app le retrouve
        var nom = st.nom;
        demo.arreter(); st = { connecte: false, mode: null, nom: '' }; emettre('etat', { connecte: false, mode: null, nom: '' });
        setTimeout(function () {
          var avant = demo.cfg.fw; demo.cfg.fw = f.fw; demo.maj = null;
          st = { connecte: true, mode: 'demo', nom: nom }; demo.demarrer(); emettre('etat', { connecte: true, mode: 'demo', nom: nom });
          ok({ octets: N, ms: Date.now() - t0, trous: 0, avant: avant, apres: f.fw });
        }, 1500);
      })();
    });
  }

  return {
    // [0.13.0] la mise a jour du firmware par le Bluetooth
    majPossible: function () { return st.connecte && (st.mode === 'demo' || (st.mode === 'ble' && !!ble.ch.maj)); },
    lireFirmware: lireFirmware,
    majFirmware: function (f, suivi) {
      if (!st.connecte) return Promise.reject(new Error('hors-ligne'));
      suivi = suivi || function () {};
      return st.mode === 'ble' ? majBle(f, suivi) : majDemo(f, suivi);
    },
    arreterMaj: function () {
      if (demo.maj) demo.maj.arret = true;
      var m = ble.majSession;
      if (m && !m.arret) {
        m.arret = true;
        // le module dit 0x84 ARRET et redemarre sur son ancien firmware ; une erreur d'envoi ici ne change rien
        if (ble.ch.maj) ecrireOctets(ble.ch.maj, new Uint8Array([0x05])).catch(function () {});
      }
    },
    sur: function (type, f) { if (ecouteurs[type]) ecouteurs[type].push(f); },
    etat: function () { return { connecte: st.connecte, mode: st.mode, nom: st.nom }; },
    connecter: function (mode) {
      if (mode === 'demo') {
        st = { connecte: true, mode: 'demo', nom: 'DRAGLOG_' + demo.cfg.sfx };
        demo.demarrer(); emettre('etat', this.etat());
        return Promise.resolve(this.etat());
      }
      if (mode === 'ble') return connecterBle();
      return Promise.reject(new Error('mode inconnu : ' + mode));
    },
    deconnecter: function () {
      if (st.mode === 'demo') demo.arreter();
      if (st.mode === 'ble' && ble.dev && ble.dev.gatt.connected) { ble.dev.gatt.disconnect(); return; }   // finBle() suit
      st = { connecte: false, mode: null, nom: '' }; emettre('etat', this.etat());
    },
    lireConfig: function () {
      if (!st.connecte) return Promise.reject(new Error('hors-ligne'));
      if (st.mode === 'ble') return lireConfigBle();
      return Promise.resolve(JSON.parse(JSON.stringify(demo.cfg)));
    },
    ecrireConfig: function (cfg) {
      if (!st.connecte) return Promise.reject(new Error('hors-ligne'));
      if (st.mode === 'ble') return ecrireConfigBle(cfg);
      try { verifier(cfg); } catch (e) { return Promise.reject(e); }
      Object.keys(cfg).forEach(function (k) {
        if (k !== 'idxa' && k !== 'idxr' && !(typeof cfg[k] === 'number' && isNaN(cfg[k]))) demo.cfg[k] = cfg[k];
      });
      if (!Number(demo.cfg.idxon)) demo.cfg.idxa = 0;   // [B v0.9] comme le kit : fonction coupee = desarmee
      // [0.10.0] comme le kit PT2.1.64 (chronoParType) : le type fixe tout le chrono sauf le depart
      var ty = window.DLChrono && DLChrono.TYPES[Number(demo.cfg.veh)];
      if (ty) {
        if (!Number(demo.cfg.dep)) demo.cfg.dep = ty.dep2;
        demo.cfg.jpo = ty.jal; demo.cfg.cms = 0; demo.cfg.d60 = 0; demo.cfg.dynm = 8; demo.cfg.rpo = Math.round(Number(demo.cfg.dep) / 2);
      }
      return Promise.resolve(true);
    },
    listerRuns: function () {
      if (!st.connecte) return Promise.resolve([]);
      if (st.mode === 'ble') return listerRunsBle().then(function (l) {
        var m = l.map(function (r) { return { id: r.id, quand: r.quand, ordre: r.ordre, genre: r.genre, statut: r.statut, jalons: r.jalons, reglages: r.reglages }; });
        m.manque = l.manque; m.annonce = l.annonce; m.refus = l.refus;   // l'ecart et les raisons du kit suivent la liste
        return m;
      });
      return Promise.resolve((window.DL_DEMO_RUNS || []).map(function (r) {
        return { id: r.id, quand: r.quand, genre: r.genre, jalons: r.jalons, reglages: r.reglages };
      }));
    },
    lireRun: function (id) {
      if (st.mode === 'ble') return listerRunsBle().then(function (l) {
        var r = l.filter(function (x) { return x.id === id; })[0];
        if (!r) throw new Error('run-absent'); return r;
      });
      var r = (window.DL_DEMO_RUNS || []).filter(function (x) { return x.id === id; })[0];
      return r ? Promise.resolve(r) : Promise.reject(new Error('run-absent'));
    },
    commande: function (nom) {
      if (!st.connecte) return Promise.reject(new Error('hors-ligne'));
      if (st.mode === 'ble') {
        if (nom === 'calibrer') return calibrerBle();
        if (nom === 'maj') return commandeBle('ota');
        if (nom === 'sim') return commandeBle('sim');
        if (nom === 'rearmer') return commandeBle('reset');   // [B v0.5] perfReset() : le kit repasse ARMED
        // [B v0.9] la course a index (PT2.1.60). Le kit ne repond pas aux commandes : l'ecran relit la config (idxa, idxr).
        if (nom === 'idxarm' || nom === 'idxoff') return commandeBle(nom);
        if (nom.indexOf('idxref:') === 0) {
          var id = nom.slice(7);
          if (id === 'aucun' || id === 'dernier') return commandeBle(nom);
          // l'app parle en id de run ; le kit, en numero dans sa liste (« RUN #n » du dump)
          return listerRunsBle().then(function (l) {
            var r = l.filter(function (x) { return x.id === id; })[0];
            if (!r || !r.ordre) throw new Error(TT('kitRunAbsent'));
            return commandeBle('idxref:' + r.ordre);
          });
        }
        return Promise.reject(new Error(TT('kitRejeuBle')));
      }
      if (nom === 'rearmer') { demo.finJusqua = 0; return Promise.resolve(true); }
      // [B v0.9] l'index du kit demo : memes refus que le kit (dits par une erreur, le kit les dit sur son port serie)
      if (nom === 'idxoff') { demo.cfg.idxa = 0; return Promise.resolve(true); }
      if (nom === 'idxarm') {
        if (!Number(demo.cfg.idxon)) return Promise.reject(new Error(TT('idxRefusOff')));
        if (demo.rejeu) return Promise.reject(new Error(TT('idxRefusCourse')));
        if (!demo.idx.ref || !Number(demo.cfg.idxc)) return Promise.reject(new Error(TT('idxRefusManque')));
        demo.cfg.idxa = 1; return Promise.resolve(true);
      }
      if (nom.indexOf('idxref:') === 0) {
        var rid = nom.slice(7);
        if (rid === 'aucun') { demo.idx.ref = null; demo.cfg.idxr = ''; return Promise.resolve(true); }
        var dr = (window.DL_DEMO_RUNS || []).filter(function (x) { return x.id === rid; })[0];
        if (!dr || !window.DLIndex) return Promise.reject(new Error(TT('kitRunAbsent')));
        var tab = DLIndex.construireRef(dr.ech);
        if (tab.erreur) return Promise.reject(new Error(tab.erreur));
        var hms = (dr.quand || '').slice(11, 19), f = dr.jalons['1320'];
        demo.idx.ref = tab; demo.cfg.idxr = rid + ';' + hms + ';' + (f ? f.t : 0);
        return Promise.resolve(true);
      }
      if (nom.indexOf('rejouer:') === 0) return Promise.resolve(demo.rejouer(nom.slice(8)));
      if (nom === 'calibrer') return new Promise(function (ok) { setTimeout(function () { demo.cfg.cal = 1; ok(true); }, 1500); });
      if (nom === 'maj') return Promise.reject(new Error('maj-demo'));
      return Promise.resolve(true);
    },
    // pour les essais sans kit : le decodeur du texte des runs (meme code que pour le vrai kit)
    _analyserDump: analyserDump
  };
})();
