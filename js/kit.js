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
    cfg: { fw: 'PT2.1.64', app: 'dlg', sfx: 'DEMO', board: 'DEMO00000000', rpo: 8, jpo: -50, cms: 0, d60: 0, veh: 1, dep: 16, pfft: 0,
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
  var SVC = uuid(0), C_TELEM = uuid(1), C_CONFIG = uuid(3), C_CMD = uuid(4), C_DUMP = uuid(5);
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
    idxRefusCourse: 'un run est en cours', idxRefusManque: 'il manque le run de référence ou la cible'
  }, {
    kitPasDlpt2: 'This device is not a DRAGLOG module (DLAP or other).', kitRefus: 'the module refused: {x}',
    kitDumpDelai: 'the runs stopped arriving (nothing for 8 s)', kitCmdAbsente: 'this module takes no command',
    calRefus: 'Calibration refused: {x}', calMuet: 'The module does not answer the calibration (6 s).',
    calR1: 'IMU silent', calR2: 'vehicle moving', calR3: 'too much vibration (engine idling?)',
    calR4: 'the module is moving', calR5: 'real rotation detected', calR6: 'no IMU', kitRejeuBle: 'no replay with a real module',
    kitRunAbsent: 'this run is no longer in the module', idxRefusOff: 'index racing is off',
    idxRefusCourse: 'a run is in progress', idxRefusManque: 'the reference run or the target is missing'
  });
  function TT(k, v) { return window.DLI18n ? DLI18n.T(k, v) : k; }

  var ble = { dev: null, ch: {}, telem: null, etatPerf: null, suivi: false, vus: {}, runs: null, dump: null };
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
    ble = { dev: null, ch: {}, telem: null, etatPerf: null, suivi: false, vus: {}, runs: null, dump: null };
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
  function ouvrirBleNatif() {
    var B = window.capacitorCommunityBluetoothLe.BleClient, finDev = [], dev = null;
    // la permission Bluetooth est demandee ICI, quand l'utilisateur touche « Chercher un kit » (regle Apple et Google)
    if (!bleNatifPret) bleNatifPret = B.initialize({ androidNeverForLocation: true }).catch(function (e) { bleNatifPret = null; throw e; });
    function carac(u) {
      var ecoute = [];
      return {
        readValue: function () { return B.read(dev.id, SVC, u); },
        writeValueWithResponse: function (d) { return B.write(dev.id, SVC, u, new DataView(d.buffer, d.byteOffset, d.byteLength)); },
        startNotifications: function () {
          return B.startNotifications(dev.id, SVC, u, function (v) { ecoute.forEach(function (f) { f({ target: { value: v } }); }); });
        },
        addEventListener: function (t, f) { if (t === 'characteristicvaluechanged') ecoute.push(f); }
      };
    }
    return bleNatifPret.then(function () {
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
      return { dev: faux, c: [carac(C_CONFIG), opt(C_TELEM), opt(C_CMD), opt(C_DUMP)] };
    });
  }
  function connecterBle() {
    var natif = bleNatifDispo();
    if (!natif && !navigator.bluetooth) return Promise.reject(new Error('ble-absent'));
    var dev, svc;
    var ouvrir = natif ? ouvrirBleNatif().then(function (r) {
      dev = r.dev; dev.addEventListener('gattserverdisconnected', finBle);
      return r.c;
    }) : navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }], optionalServices: [SVC] }).then(function (d) {
      dev = d; dev.addEventListener('gattserverdisconnected', finBle);
      return dev.gatt.connect();
    }).then(function (srv) { return srv.getPrimaryService(SVC); }).then(function (s) {
      svc = s;
      var opt = function (u) { return svc.getCharacteristic(u).catch(function () { return null; }); };
      return Promise.all([svc.getCharacteristic(C_CONFIG), opt(C_TELEM), opt(C_CMD), opt(C_DUMP)]);
    });
    return ouvrir.then(function (c) {
      ble.dev = dev; ble.ch = { config: c[0], telem: c[1], cmd: c[2], dump: c[3] };
      return lireJson(ble.ch.config);
    }).then(function (cfg) {
      // la nouvelle app parle aux DLPT2 seulement : un DLAP (E3B4) a sa propre page
      if (cfg.dev === 'DLAP' || !ble.ch.telem) { dev.gatt.disconnect(); throw new Error(TT('kitPasDlpt2')); }
      var p = [ble.ch.telem.startNotifications().then(function () { ble.ch.telem.addEventListener('characteristicvaluechanged', surTelem); })];
      if (ble.ch.dump) p.push(ble.ch.dump.startNotifications().then(function () { ble.ch.dump.addEventListener('characteristicvaluechanged', surDump); }));
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

  return {
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
