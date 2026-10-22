'use strict';
// Le noyau commun des trois maquettes (A, B, C) : preferences, formats, calcul des courbes d'un run, reglages du
// kit (bornes du firmware PT2.1.56), feuille de connexion. Chaque maquette ne garde que SA facon d'afficher.
window.DLC = (function () {
  var T = DLI18n.T;
  function $(id) { return document.getElementById(id); }

  // [apercu iPhone] ?sa=haut,bas (en points) impose les zones sures d'un iPhone : dans un iframe, env() vaut 0.
  // Les styles lisent --sa-h et --sa-b (base-maquettes.css). Une valeur mal formee est refusee a voix haute.
  (function () {
    var sa = new URLSearchParams(location.search).get('sa');
    if (sa == null) return;
    var m = /^(\d{1,3}),(\d{1,3})$/.exec(sa);
    if (!m) { console.error('[DLC] ?sa= attendu « haut,bas » en points, recu : ' + sa); return; }
    document.documentElement.style.setProperty('--sa-h', m[1] + 'px');
    document.documentElement.style.setProperty('--sa-b', m[2] + 'px');
  })();

  // ---------------------------------------------------------------- preferences (une cle par maquette)
  // ⚠ Le stockage peut manquer (navigation privee) : tout est protege, l'application marche sans.
  function Prefs(cle, defauts) {
    this.cle = cle; this.v = defauts;
    var moi = this;
    try { var lu = JSON.parse(localStorage.getItem(cle) || '{}'); Object.keys(defauts).forEach(function (k) { if (lu[k] != null) moi.v[k] = lu[k]; }); } catch (e) {}
    var q = new URLSearchParams(location.search);          // ?lang=fr|en et ?theme=… : pour la page de comparaison
    if (q.get('lang')) this.v.langue = q.get('lang');
    if (q.get('theme')) this.v.theme = q.get('theme');
    // [kit graphique] ?vue=… ouvre un ecran ; ?apercu=1 = vitrine : rien n'est ecrit dans l'appareil
    if (q.get('vue')) this.v.vue = q.get('vue');
    this.apercu = q.get('apercu') === '1';
    if (!this.v.langue) this.v.langue = DLI18n.parDefaut();
    if (!this.v.unite) this.v.unite = this.v.langue === 'en' ? 'mph' : 'kmh';
  }
  Prefs.prototype.garder = function () { if (this.apercu) return; try { localStorage.setItem(this.cle, JSON.stringify(this.v)); } catch (e) {} };
  Prefs.prototype.effacer = function () { try { localStorage.removeItem(this.cle); } catch (e) {} };

  // ---------------------------------------------------------------- formats
  var cache = {}, prefs = null;
  function brancher(p) { prefs = p; }
  function nf(v, dec) {
    var k = DLI18n.langue() + dec;
    if (!cache[k]) cache[k] = new Intl.NumberFormat(DLI18n.langue() === 'fr' ? 'fr-CA' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return cache[k].format(v);
  }
  function vit(kmh) { return prefs && prefs.v.unite === 'mph' ? kmh * 0.621371 : kmh; }
  function unite() { return prefs && prefs.v.unite === 'mph' ? 'mph' : 'km/h'; }
  function sec(ms) { return ms == null ? '--' : nf(ms / 1000, 3); }
  function quand(iso) {
    // [B v0.3] un run du vrai kit ne porte que son heure (texte du firmware : « heure=18:31:12 ») : on montre l'heure
    if (/^\d{1,2}:\d{2}/.test(String(iso))) return String(iso).slice(0, 5);
    return new Date(iso).toLocaleString(DLI18n.langue() === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function pieds(po) { return (po > 0 ? '+' : po < 0 ? '−' : '') + nf(Math.abs(po) / 12, 1) + ' ' + T('pi'); }
  function poserTheme(theme, grand) {
    if (!theme || theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('texte-g', !!grand);
  }

  // ---------------------------------------------------------------- un run
  // T0 = l'instant ou la distance depuis l'arret passe le roll-out du run (comme le kit)
  function t0Run(r) {
    var R = r.ech, x = r.reglages.rpo / 12;
    for (var i = 1; i < R.length; i++) if (R[i - 1][2] < x && R[i][2] >= x) return R[i - 1][0] + (x - R[i - 1][2]) / (R[i][2] - R[i - 1][2]) * (R[i][0] - R[i - 1][0]);
    return 0;
  }
  // axe 't' = secondes depuis T0 ; axe 'd' = pieds depuis l'arret. quoi 'v' = vitesse (unite choisie), 'g' = G.
  function serie(r, axe, quoi) {
    var t0 = t0Run(r), x = [], y = [];
    r.ech.forEach(function (e) {
      if (axe === 'd' && e[0] < 0) return;
      x.push(axe === 't' ? (e[0] - t0) / 1000 : e[2]);
      y.push(quoi === 'v' ? vit(e[1]) : e[3]);
    });
    return { x: x, y: y };
  }
  var JALONS = ['60', '330', '660', '1320'];
  function reperes(r, axe) {
    var g = r.reglages;
    return JALONS.map(function (k) {
      var j = r.jalons[k]; if (!j) return null;
      return { x: axe === 't' ? (j.t - g.cms) / 1000 : (+k + g.jpo / 12 + (k === '60' ? g.d60 / 12 : 0)), texte: T('j' + k) };
    }).filter(Boolean);
  }
  // les donnees d'un graphique de run (vitesse A, G de A, vitesse B en pointille)
  function donneesRun(a, b, axe) {
    var sA = serie(a, axe, 'v'), gA = serie(a, axe, 'g'), series = [];
    if (b) { var sB = serie(b, axe, 'v'); series.push({ x: sB.x, y: sB.y, axe: 'g', couleur: '--cmp', largeur: 2, tirets: [6, 4], nom: 'cmp' }); }
    series.push({ x: gA.x, y: gA.y, axe: 'd', couleur: '--gcol', largeur: 1.4, nom: 'g' });
    series.push({ x: sA.x, y: sA.y, axe: 'g', couleur: '--trait', largeur: 2.2, nom: 'v' });
    var fin = a.jalons['1320'];
    return { series: series, reperes: reperes(a, axe), dSym: true, gMin: 0,
             xMin: axe === 't' ? -0.5 : 0, xMax: axe === 't' ? (fin ? fin.t / 1000 + 0.4 : null) : 1400,
             zoneAvant: axe === 't' ? 0 : a.reglages.rpo / 12 };
  }
  // une mini-courbe de vitesse (liste des runs)
  function donneesMini(r) {
    var s = serie(r, 't', 'v'), fin = r.jalons['1320'];
    return { series: [{ x: s.x, y: s.y, axe: 'g', couleur: '--sel', largeur: 2 }], gMin: 0, xMin: 0, xMax: fin ? fin.t / 1000 : null };
  }
  // le plus recent d'abord ; [B v0.3] les runs du vrai kit n'ont pas de date : leur ordre dans le kit fait foi
  function trier(l) { return l.slice().sort(function (a, b) {
    if (a.ordre != null && b.ordre != null) return b.ordre - a.ordre;
    return a.quand < b.quand ? 1 : a.quand > b.quand ? -1 : 0; }); }
  function lecture(info, axe, avecCmp) {
    if (!info) return T('lectureAide');
    var val = {}; info.valeurs.forEach(function (v) { val[v.nom] = v.y; });
    var xTxt = axe === 't' ? nf(info.x, 3) + ' s' : nf(info.x, 0) + ' ' + T('pi');
    var s = T('lecture', { x: xTxt, v: val.v == null ? '--' : nf(val.v, 1), u: unite(), g: val.g == null ? '--' : nf(val.g, 2) });
    if (avecCmp) s += T('lectureCmp', { v: val.cmp == null ? '--' : nf(val.cmp, 1), u: unite() });
    return s;
  }

  // ---------------------------------------------------------------- reglages du kit
  // memes bornes que le firmware : le kit refuse un envoi ENTIER pour une seule valeur hors bornes, on le dit avant
  // [B v0.4] + l'ECU : expander Holley, ID lu / envoye du Link, trame CAN de depart (memes bornes que applyConfigJson)
  // [0.10.0] + le type de vehicule et le depart en demi-pouces (kit PT2.1.64)
  var BORNES = { rpo: [0, 36], jpo: [-120, 36], d60: [-72, 72], cms: [-600, 600], tzh: [-12, 14], veh: [0, 2], dep: [0, 72],
                 hid: [0, 2047], lid: [1, 2047], eid: [1, 2046], scby: [0, 7], scmk: [1, 255], sced: [0, 2], strig: [0, 2],
                 // [B v0.9] la course a index (PT2.1.60) ; idxc (0 ou 3000..30000 ms) est verifiee plus bas
                 idxon: [0, 1], idxid: [1, 2047], idxz: [0, 200], idxp: [10, 1000], idxf: [0, 3000], idxv: [50, 10230], idxam: [0, 1] };
  function borner(k, v) { var b = BORNES[k]; return Math.max(b[0], Math.min(b[1], v)); }
  function verifier(cfg) {
    var err = null;
    Object.keys(BORNES).forEach(function (k) {
      if (cfg[k] == null || err || (typeof cfg[k] === 'number' && isNaN(cfg[k]))) return;   // champ vide : pas envoye
      var v = Number(cfg[k]), b = BORNES[k];
      if (!Number.isInteger(v) || v < b[0] || v > b[1]) err = T(k + 'Nom') + ' : ' + b[0] + ' … ' + b[1];
    });
    // [B v0.3] meme jeu que le firmware ([A-Za-z0-9_-], 1 a 5) : un nom comme AB_C (souligne) etait refuse par l'ancien filtre
    if (cfg.sfx != null && !/^[A-Za-z0-9_-]{1,5}$/.test(cfg.sfx)) err = err || T('sfxNom');
    // la trame CAN de depart : 11 bits = 0..0x7FF, 29 bits = 0..0x1FFFFFFF (le kit refuserait tout l'envoi)
    if (cfg.scid != null && !isNaN(cfg.scid)) {
      var max = Number(cfg.scext) === 1 ? 0x1FFFFFFF : 0x7FF;
      if (!Number.isInteger(Number(cfg.scid)) || cfg.scid < 0 || cfg.scid > max) err = err || (T('b_scidNom') + ' : 0 … ' + max);
    }
    // [B v0.9] la cible d'index : 0 (aucune) ou 3,000 a 30,000 s ; la pleine commande doit venir apres la zone morte
    if (cfg.idxc != null && !isNaN(cfg.idxc)) {
      var c = Number(cfg.idxc);
      if (!Number.isInteger(c) || (c !== 0 && (c < 3000 || c > 30000))) err = err || (T('idxcNom') + ' : 3,000 … 30,000 s');
    }
    if (cfg.idxz != null && cfg.idxp != null && !isNaN(cfg.idxz) && !isNaN(cfg.idxp) && Number(cfg.idxp) <= Number(cfg.idxz))
      err = err || (T('idxpNom') + ' > ' + T('idxzNom'));
    return err;
  }

  // Les champs du formulaire portent l'id f-<cle> (cle = celle du JSON du kit). Un champ absent de la maquette est ignore.
  var CHAMPS = ['rpo', 'jpo', 'd60', 'cms', 'pfft', 'hecu', 'strig', 'mode', 'cbr', 'grate', 'sfx', 'tzh',
                'hid', 'lect', 'lid', 'eid', 'scid', 'scext', 'scby', 'scmk', 'sced',   // [B v0.4] l'ECU et le depart CAN
                'idxon', 'idxc', 'idxid', 'idxz', 'idxp', 'idxf', 'idxv', 'idxam',       // [B v0.9] la course a index
                'veh', 'dep'];                                                           // [0.10.0] type et depart (PT2.1.64)
  var TEXTES = { mode: 1, sfx: 1, lect: 1 };   // les cles dont la valeur est un mot, pas un nombre
  function majPieds(k) {
    var el = $('p-' + k), inp = $('f-' + k); if (!el || !inp) return;
    var v = Number(inp.value); el.textContent = Number.isInteger(v) ? pieds(v) : '?';
  }
  // les boutons -6 / -1 / +1 / +6 d'un champ en pouces : <div class="pas" data-champ="jpo"> ... <button data-pas="-6">
  function brancherPas(racine) {
    (racine || document).querySelectorAll('.pas[data-champ]').forEach(function (p) {
      var k = p.getAttribute('data-champ'), inp = $('f-' + k);
      p.querySelectorAll('button[data-pas]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = Number(inp.value); if (!Number.isInteger(v)) v = 0;
          inp.value = borner(k, v + Number(b.getAttribute('data-pas'))); majPieds(k);
          inp.dispatchEvent(new Event('change'));
        });
      });
      inp.addEventListener('input', function () { majPieds(k); });
    });
  }
  function optionsPartiel(sel) {
    if (!sel) return;
    var o = sel.value, h = '<option value="0">' + T('pfftOff') + '</option>';
    for (var d = 50; d <= 1300; d += 50) h += '<option value="' + d + '">' + d + ' ' + T('pi') + '</option>';
    sel.innerHTML = h; if (o) sel.value = o;
  }
  function remplirForm(cfg) {
    optionsPartiel($('f-pfft'));
    CHAMPS.forEach(function (k) {
      var el = $('f-' + k); if (!el || cfg[k] == null) return;
      // [B v0.3] une valeur du kit absente de la liste (ex. mode FUELTECH_GPS) : on l'ajoute telle quelle. Sinon la
      // liste resterait vide et l'envoi partirait avec une valeur vide (le kit refuse alors TOUT l'envoi).
      if (el.tagName === 'SELECT' && !Array.prototype.some.call(el.options, function (o) { return o.value === String(cfg[k]); })) {
        var o = document.createElement('option'); o.value = String(cfg[k]); o.textContent = String(cfg[k]); el.appendChild(o);
      }
      el.value = cfg[k];
    });
    ['rpo', 'jpo', 'd60'].forEach(majPieds);
  }
  function lireForm() {
    var cfg = {};
    CHAMPS.forEach(function (k) {
      var el = $('f-' + k); if (!el) return;
      if (TEXTES[k]) cfg[k] = el.value.trim();   // ⚠ sfx : pas de majuscules forcees, ce serait renommer le kit en douce
      else cfg[k] = (el.value === '') ? NaN : Number(el.value);
    });
    if (Number.isFinite(cfg.cms)) cfg.cms = Math.round(cfg.cms / 5) * 5;
    return cfg;
  }
  // envoie le formulaire au kit ; le message dit ce qui est refuse, et rien ne part si une valeur est fausse
  function envoyerForm(msgEl, apres) {
    var cfg = lireForm(), err = verifier(cfg);
    msgEl.className = '';
    if (err) { msgEl.className = 'msg-err'; msgEl.textContent = T('formErr', { x: err }); return; }
    var rien = false;
    DLKit.ecrireConfig(cfg).then(function (res) {
      rien = !!(res && res.envoye && !Object.keys(res.envoye).length);   // [B v0.4] le vrai kit : rien n'a change
      return DLKit.lireConfig();
    }).then(function (c) {
      remplirForm(c); msgEl.className = 'msg-ok'; msgEl.textContent = T(rien ? 'formRien' : 'formOk'); if (apres) apres(c);
    }, function (e) { msgEl.className = 'msg-err'; msgEl.textContent = T('formErr', { x: e.message }); });
  }
  // un groupe de boutons a choix unique : <div class="seg" id="..."><button data-v="fr">
  function segment(id, valeur, surChoix) {
    var seg = $(id); if (!seg) return;
    seg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === valeur);
      b.onclick = function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        surChoix(b.getAttribute('data-v'));
      };
    });
  }

  // ---------------------------------------------------------------- comparaison au ticket de la piste
  // Tickets FICTIFS des runs de demonstration synthetiques (outils/gen_demo_runs.py), en secondes et en mph.
  // [0.10.0] la piste fictive part a 8,5 po (le kit de demo a 8 po) : le calage automatique de la demo trouve 8,5 po
  var TICKETS_DEMO = {
    'demo-1': { 60: 1.229, 330: 3.216, 660: 4.794, 1320: 7.304, v660: 156.24, v1320: 195.24 },
    'demo-2': { 60: 1.238, 330: 3.252, 660: 4.882, 1320: 8.696, v660: 140.06, v1320: 100.92 },
    'demo-3': { 60: 1.835, 330: 4.944, 660: 7.527, 1320: 11.694, v660: 94.78, v1320: 117.45 }
  };
  DLI18n.ajouter({
    tk_conseil60: 'Le 60 pi seul est en retard : essaie « Position des jalons » ou « Décalage du 60 pi ».',
    tk_conseilTous: 'Tous les jalons ont le même écart : essaie le roll-out (« Où le chrono part »).',
    tk_conseilOk: 'Ton module colle au ticket.', tk_bilan: '{n} jalons sur {m} dans ta cible de 0,02 s.'
  }, {
    tk_conseil60: 'Only the 60 ft is late: try “Timing mark position” or “60 ft offset”.',
    tk_conseilTous: 'Every timing mark has the same difference: try the roll-out (“Where the timer starts”).',
    tk_conseilOk: 'Your module matches the slip.', tk_bilan: '{n} of {m} timing marks within your 0.02 s target.'
  });
  // tk = { 60, 330, 660, 1320 (s), v660, v1320 (mph) } ; une valeur absente = null. Ecart = kit - ticket.
  // Classe : ok <= 0,020 s (la cible), proche <= 0,040 s, hors au-dela.
  function comparerTicket(run, tk) {
    var temps = [], vitesses = [], ecarts = {}, nOk = 0;
    JALONS.forEach(function (k) {
      var j = run.jalons[k]; if (!j || tk[k] == null) return;
      var e = j.t / 1000 - tk[k]; ecarts[k] = e;
      var cl = Math.abs(e) <= 0.020 ? 'ok' : Math.abs(e) <= 0.040 ? 'proche' : 'hors';
      if (cl === 'ok') nOk++;
      temps.push({ k: k, kit: j.t / 1000, tk: tk[k], e: e, cl: cl });
    });
    ['660', '1320'].forEach(function (k) {
      var j = run.jalons[k], tv = tk['v' + k]; if (!j || !j.v || tv == null) return;
      var kv = j.v * 0.621371; vitesses.push({ k: k, kit: kv, tk: tv, pc: (kv - tv) / tv * 100 });
    });
    var autres = ['330', '660', '1320'].filter(function (k) { return ecarts[k] != null; }).map(function (k) { return ecarts[k]; });
    var moy = autres.length ? autres.reduce(function (a, b) { return a + b; }, 0) / autres.length : null;
    var conseil = '';
    if (ecarts['60'] != null && moy != null && ecarts['60'] - moy > 0.02) conseil = 'tk_conseil60';
    else if (moy != null && Math.abs(moy) > 0.02) conseil = 'tk_conseilTous';
    else if (temps.length && nOk === temps.length) conseil = 'tk_conseilOk';
    return { temps: temps, vitesses: vitesses, nOk: nOk, nTot: temps.length, conseil: conseil };
  }
  // un nombre tape a la main : virgule ou point ; vide = null ; faux = NaN (refuse a voix haute)
  function lireNombre(s) { s = String(s || '').trim().replace(',', '.'); if (s === '') return null; var v = Number(s); return isFinite(v) && v > 0 ? v : NaN; }

  // ---------------------------------------------------------------- feuille de connexion (meme HTML dans A, B, C)
  function feuilleConnexion(onglets) {
    var f = $('feuilleCx'), voile = $('voile');
    function ouvrir(o) { f.hidden = !o; voile.hidden = !o; if (o) $('cxMsg').textContent = ''; }
    (onglets || []).forEach(function (el) { el.addEventListener('click', function () { ouvrir(true); }); });
    $('cxFermer').addEventListener('click', function () { ouvrir(false); });
    voile.addEventListener('click', function () { ouvrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !f.hidden) ouvrir(false); });
    $('cxDemo').addEventListener('click', function () { DLKit.connecter('demo').then(function () { ouvrir(false); }); });
    // [B v0.3] le vrai kit : on rappelle la fenetre de 20 s, on ferme la feuille si ca marche, on dit pourquoi sinon
    $('cxBle').addEventListener('click', function () {
      $('cxMsg').textContent = T('cxBleCherche');
      DLKit.connecter('ble').then(function () { ouvrir(false); }, function (e) {
        $('cxMsg').textContent = e.message === 'ble-absent' ? T('cxBleAbsent')
          : e.name === 'NotFoundError' ? T('cxBleAnnule') : T('cxBleErr', { x: e.message });
      });
    });
    $('cxDeco').addEventListener('click', function () { DLKit.deconnecter(); ouvrir(false); });
    DLKit.sur('etat', function (e) { $('cxDemo').hidden = e.connecte; $('cxBle').hidden = e.connecte; $('cxDeco').hidden = !e.connecte; });
    // ?demo=1 : se connecte tout seul au kit de demonstration (page de comparaison)
    // (apres un court delai : la maquette doit d'abord avoir pose ses propres ecouteurs)
    if (new URLSearchParams(location.search).get('demo') === '1') setTimeout(function () { DLKit.connecter('demo'); }, 200);
    return { ouvrir: ouvrir };
  }

  return { $: $, Prefs: Prefs, brancher: brancher, nf: nf, vit: vit, unite: unite, sec: sec, quand: quand, pieds: pieds,
           poserTheme: poserTheme, t0Run: t0Run, serie: serie, reperes: reperes, donneesRun: donneesRun, donneesMini: donneesMini,
           trier: trier, lecture: lecture, JALONS: JALONS, BORNES: BORNES, borner: borner, verifier: verifier,
           brancherPas: brancherPas, remplirForm: remplirForm, lireForm: lireForm, envoyerForm: envoyerForm,
           optionsPartiel: optionsPartiel, segment: segment, majPieds: majPieds,
           TICKETS_DEMO: TICKETS_DEMO, comparerTicket: comparerTicket, lireNombre: lireNombre,
           feuilleConnexion: feuilleConnexion, viderCache: function () { cache = {}; } };
})();
