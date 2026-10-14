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
  var BORNES = { rpo: [0, 36], jpo: [-120, 36], d60: [-72, 72], cms: [-600, 600], tzh: [-12, 14] };

  // ---------------------------------------------------------------- le kit de demonstration
  var demo = {
    cfg: { fw: 'PT2.1.56', app: 'dlg', sfx: 'DEMO', board: 'DEMO00000000', rpo: 12, jpo: 12, cms: 0, d60: 0, pfft: 0,
           mode: 'HOLLEY', cbr: 1000000, hecu: 1, strig: 1, scid: 1280, grate: 40, dynm: 8, imuf: 2, tzh: -4,
           imu: 1, cal: 1, sats: 14, fix: 3, hz: 25,
           // [B v0.4] l'ECU et le depart CAN, memes cles que le JSON du kit
           hid: 1500, lect: 'LINK_GD', lid: 1000, eid: 1200, scid: 0, scext: 0, scby: 0, scmk: 255, sced: 2 },
    minuterie: null, rejeu: null,
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
        var etat = (e[0] < 0) ? 'ARME' : (i >= r.ech.length - 1 ? 'FINI' : 'COURSE');
        emettre('telem', { ms: now, kmh: e[1], g: e[3], etat: etat, sats: this.cfg.sats, fix: this.cfg.fix, hz: this.cfg.hz, el: Math.max(0, e[0]) });
        if (i >= r.ech.length - 1) { this.rejeu = null; this.finJusqua = now + 6000; emettre('run', { id: r.run.id, fini: true }); }
        return;
      }
      // apres un run, le kit reste « TERMINE » quelques secondes (le temps de lire les jalons), puis se rearme
      var etatRepos = (this.finJusqua && now < this.finJusqua) ? 'FINI' : 'ARME';
      emettre('telem', { ms: now, kmh: 0, g: (Math.random() - 0.5) * 0.02, etat: etatRepos, sats: this.cfg.sats, fix: this.cfg.fix, hz: this.cfg.hz });
    },
    rejouer: function (id) {
      var run = (window.DL_DEMO_RUNS || []).filter(function (r) { return r.id === id; })[0];
      if (!run) return false;
      this.rejeu = { run: run, ech: run.ech, i: 0, debut: Date.now(), vus: {}, t0: null };
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
    kitPasDlpt2: 'Ce module n’est pas un kit DRAGLOG (DLAP ou autre).', kitRefus: 'le kit a refusé : {x}',
    kitDumpDelai: 'les runs n’arrivent plus (rien depuis 8 s)', kitCmdAbsente: 'ce kit ne prend pas de commande',
    calRefus: 'Calibration refusée : {x}', calMuet: 'Le kit ne répond pas à la calibration (6 s).',
    calR1: 'IMU muet', calR2: 'véhicule en mouvement', calR3: 'trop de vibrations (moteur au ralenti ?)',
    calR4: 'le kit bouge', calR5: 'rotation réelle détectée', calR6: 'IMU absent', kitRejeuBle: 'pas de rejeu avec un vrai kit'
  }, {
    kitPasDlpt2: 'This module is not a DRAGLOG kit (DLAP or other).', kitRefus: 'the kit refused: {x}',
    kitDumpDelai: 'the runs stopped arriving (nothing for 8 s)', kitCmdAbsente: 'this kit takes no command',
    calRefus: 'Calibration refused: {x}', calMuet: 'The kit does not answer the calibration (6 s).',
    calR1: 'IMU silent', calR2: 'vehicle moving', calR3: 'too much vibration (engine idling?)',
    calR4: 'the kit is moving', calR5: 'real rotation detected', calR6: 'no IMU', kitRejeuBle: 'no replay with a real kit'
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
    emettre('telem', { ms: j.now, kmh: (j.v || 0) / 100, g: j.g || 0, etat: ETATS[p.st] || 'ATTENTE', sats: j.sats, fix: j.valid ? 3 : 0, hz: j.hz,
                       el: p.el || 0, tb: p.tb, tbs: p.tbs, sim: !!p.sim });
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
  function connecterBle() {
    if (!navigator.bluetooth) return Promise.reject(new Error('ble-absent'));
    var dev, svc;
    return navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }], optionalServices: [SVC] }).then(function (d) {
      dev = d; dev.addEventListener('gattserverdisconnected', finBle);
      return dev.gatt.connect();
    }).then(function (srv) { return srv.getPrimaryService(SVC); }).then(function (s) {
      svc = s;
      var opt = function (u) { return svc.getCharacteristic(u).catch(function () { return null; }); };
      return Promise.all([svc.getCharacteristic(C_CONFIG), opt(C_TELEM), opt(C_CMD), opt(C_DUMP)]);
    }).then(function (c) {
      ble.dev = dev; ble.ch = { config: c[0], telem: c[1], cmd: c[2], dump: c[3] };
      return lireJson(ble.ch.config);
    }).then(function (cfg) {
      // la nouvelle app parle aux DLPT2 seulement : un DLAP (E3B4) a sa propre page
      if (cfg.dev === 'DLAP' || !ble.ch.telem) { dev.gatt.disconnect(); throw new Error(TT('kitPasDlpt2')); }
      var p = [ble.ch.telem.startNotifications().then(function () { ble.ch.telem.addEventListener('characteristicvaluechanged', surTelem); })];
      if (ble.ch.dump) p.push(ble.ch.dump.startNotifications().then(function () { ble.ch.dump.addEventListener('characteristicvaluechanged', surDump); }));
      return Promise.all(p).then(function () {
        st = { connecte: true, mode: 'ble', nom: dev.name || ('DL_' + (cfg.sfx || '?')) };
        emettre('etat', { connecte: true, mode: 'ble', nom: st.nom });
        return st;
      });
    });
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
        reglages: { rpo: +(x.kv.rollout_po || 12), jpo: +(x.kv.jalons_po != null ? x.kv.jalons_po : (x.kv.rollout_po || 12)),
                    cms: +(x.kv.corr_ms || 0), d60: +(x.kv.dec60_po || 0) },
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
      Object.keys(cfg).forEach(function (k) { demo.cfg[k] = cfg[k]; });
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
        return Promise.reject(new Error(TT('kitRejeuBle')));
      }
      if (nom === 'rearmer') { demo.finJusqua = 0; return Promise.resolve(true); }
      if (nom.indexOf('rejouer:') === 0) return Promise.resolve(demo.rejouer(nom.slice(8)));
      if (nom === 'calibrer') return new Promise(function (ok) { setTimeout(function () { demo.cfg.cal = 1; ok(true); }, 1500); });
      if (nom === 'maj') return Promise.reject(new Error('maj-demo'));
      return Promise.resolve(true);
    },
    // pour les essais sans kit : le decodeur du texte des runs (meme code que pour le vrai kit)
    _analyserDump: analyserDump
  };
})();
