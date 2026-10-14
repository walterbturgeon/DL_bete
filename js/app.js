'use strict';
// DRAGLOGICS -- maquette de l'application (v0.1). La logique de l'ecran : vues, direct, runs, reglages.
// Ne parle JAMAIS au materiel directement : tout passe par DLKit (js/kit.js).
(function () {
  var VERSION = 'v0.1';
  var T = DLI18n.T;
  function $(id) { return document.getElementById(id); }
  var JALONS = ['60', '330', '660', '1320'];

  // ------------------------------------------------------------ preferences de l'application (dans l'appareil)
  // ⚠ Le stockage peut etre absent ou refuse (navigation privee) : chaque acces est protege, l'application marche sans.
  var PREF_CLE = 'dlx_prefs';
  var prefs = { langue: null, unite: null, theme: 'auto', texte: 'n', vue: 'direct' };
  try { var lu = JSON.parse(localStorage.getItem(PREF_CLE) || '{}'); Object.keys(prefs).forEach(function (k) { if (lu[k] != null) prefs[k] = lu[k]; }); } catch (e) {}
  if (!prefs.langue) prefs.langue = DLI18n.parDefaut();
  if (!prefs.unite) prefs.unite = (prefs.langue === 'en') ? 'mph' : 'kmh';
  function garderPrefs() { try { localStorage.setItem(PREF_CLE, JSON.stringify(prefs)); } catch (e) {} }

  // ------------------------------------------------------------ formats
  var fmtCache = {};
  function nf(v, dec) {
    var cle = DLI18n.langue() + dec;
    if (!fmtCache[cle]) fmtCache[cle] = new Intl.NumberFormat(DLI18n.langue() === 'fr' ? 'fr-CA' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return fmtCache[cle].format(v);
  }
  function vit(kmh) { return prefs.unite === 'mph' ? kmh * 0.621371 : kmh; }
  function uniteTxt() { return prefs.unite === 'mph' ? 'mph' : 'km/h'; }
  function sec(ms) { return ms == null ? '--' : nf(ms / 1000, 3); }
  function quandTxt(iso) {
    var d = new Date(iso);
    return d.toLocaleString(DLI18n.langue() === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function piedsTxt(po) { return (po > 0 ? '+' : po < 0 ? '−' : '') + nf(Math.abs(po) / 12, 1) + ' ' + T('pi'); }

  // ------------------------------------------------------------ theme, texte, langue
  function poserTheme() {
    if (prefs.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', prefs.theme);
    document.body.classList.toggle('texte-g', prefs.texte === 'g');
    redessinerTout();
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { redessinerTout(); });
  }
  function segment(id, valeur, surChoix) {
    var seg = $(id);
    seg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === valeur);
      b.onclick = function () { surChoix(b.getAttribute('data-v')); segment(id, b.getAttribute('data-v'), surChoix); };
    });
  }

  // ------------------------------------------------------------ navigation (barre du bas)
  function montrerVue(v) {
    prefs.vue = v; garderPrefs();
    document.querySelectorAll('.vue').forEach(function (s) { s.hidden = (s.id !== 'v-' + v); });
    document.querySelectorAll('#barbas [data-vue]').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-vue') === v); });
    window.scrollTo(0, 0);
    redessinerTout();   // un canvas cache a une largeur nulle : on le redessine quand il devient visible
  }
  document.querySelectorAll('#barbas [data-vue]').forEach(function (b) {
    b.addEventListener('click', function () { montrerVue(b.getAttribute('data-vue')); });
  });

  // ------------------------------------------------------------ connexion (feuille du bas)
  function feuille(ouvrir) {
    $('feuilleCx').hidden = !ouvrir; $('voile').hidden = !ouvrir;
    if (ouvrir) { $('cxMsg').textContent = ''; (DLKit.etat().connecte ? $('cxDeco') : $('cxDemo')).focus(); }
  }
  $('btnCx').addEventListener('click', function () { feuille(true); });
  $('cxFermer').addEventListener('click', function () { feuille(false); });
  $('voile').addEventListener('click', function () { feuille(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('feuilleCx').hidden) feuille(false); });
  $('cxDemo').addEventListener('click', function () {
    DLKit.connecter('demo').then(function () { feuille(false); });
  });
  $('cxBle').addEventListener('click', function () {
    DLKit.connecter('ble').catch(function () { $('cxMsg').textContent = T('cxBleAbsent'); });
  });
  $('cxDeco').addEventListener('click', function () { DLKit.deconnecter(); feuille(false); });

  var cfgKit = null, runs = [];
  // le plus recent en premier
  function trier(l) { return l.slice().sort(function (a, b) { return a.quand < b.quand ? 1 : a.quand > b.quand ? -1 : 0; }); }
  DLKit.sur('etat', function (e) {
    var ok = e.connecte;
    $('chipPoint').classList.toggle('off', !ok);
    $('chipTxt').setAttribute('data-i18n', ok ? 'connecte' : 'horsLigne');
    $('chipTxt').textContent = ok ? e.nom : T('horsLigne');
    $('chipDemo').hidden = e.mode !== 'demo';
    $('btnCx').className = ok ? 'cx-on' : 'cx-off';
    $('btnCxTxt').setAttribute('data-i18n', ok ? 'bConnecte' : 'bConnecter'); $('btnCxTxt').textContent = T(ok ? 'bConnecte' : 'bConnecter');
    $('cxDemo').hidden = ok; $('cxBle').hidden = ok; $('cxDeco').hidden = !ok;
    $('dVide').hidden = ok; $('btnRejouer').disabled = !ok;
    if (!ok) { cfgKit = null; runs = []; buf = []; viderTuiles('dTuiles'); rendreRuns(); rendreKit(); rendreReglages(); majDirectTexte(null); redessinerTout(); return; }
    DLKit.lireConfig().then(function (c) { cfgKit = c; rendreKit(); rendreReglages(); });
    DLKit.listerRuns().then(function (r) { runs = trier(r); rendreRuns(); });
  });

  // ------------------------------------------------------------ tuiles des jalons
  function tuiles(id, jal) {
    var h = '';
    JALONS.forEach(function (k) {
      var j = jal && jal[k];
      h += '<div class="tuile" data-j="' + k + '"><div class="lab">' + T('j' + k) + '</div><div class="val num">' + (j ? sec(j.t) : '--') +
           '</div><div class="vit num">' + (j && j.v ? nf(vit(j.v), 1) + ' ' + uniteTxt() : '') + '</div></div>';
    });
    $(id).innerHTML = h;
  }
  function viderTuiles(id) { tuiles(id, null); }

  // ------------------------------------------------------------ DIRECT
  var buf = [], fenetre = 10, jalonsDirect = {}, dernierEtat = null, dessinPrevu = false;
  var courbeDirect = new DLGraph.Courbe($('cvDirect'), {
    hauteur: 230, curseur: false,
    xFmt: function (v) { return nf(v, 0) + ' s'; }, gFmt: function (v) { return nf(v, 0); }, dFmt: function (v) { return nf(v, 1); },
    gTitre: '', dTitre: 'G'
  });
  $('segFenetre').querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('on', b.getAttribute('data-f') === String(fenetre));
    b.addEventListener('click', function () {
      fenetre = +b.getAttribute('data-f');
      $('segFenetre').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      dessinerDirect();
    });
  });
  function majDirectTexte(t) {
    $('dVitU').textContent = uniteTxt();
    $('dVit').textContent = t ? nf(vit(t.kmh), 0) : '--';
    $('dG').textContent = t ? nf(t.g, 2) : '--';
    var e = $('dEtat');
    if (!t) { e.className = 'badge cl'; e.textContent = T('etatAucun'); $('dGps').textContent = 'GPS --'; return; }
    e.className = 'badge ' + (t.etat === 'COURSE' ? 'court' : t.etat === 'FINI' ? 'fini' : 'cl');
    e.textContent = T(t.etat === 'COURSE' ? 'etatCourse' : t.etat === 'FINI' ? 'etatFini' : 'etatArme');
    $('dGps').textContent = 'GPS ' + T('gpsTxt', { s: t.sats, hz: t.hz });
  }
  DLKit.sur('telem', function (t) {
    if (dernierEtat !== 'COURSE' && t.etat === 'COURSE') { jalonsDirect = {}; viderTuiles('dTuiles'); }
    dernierEtat = t.etat;
    buf.push([t.ms, t.kmh, t.g]);
    while (buf.length && buf[0][0] < t.ms - 31000) buf.shift();
    majDirectTexte(t);
    if (!dessinPrevu) { dessinPrevu = true; requestAnimationFrame(function () { dessinPrevu = false; dessinerDirect(); }); }
  });
  DLKit.sur('jalon', function (j) {
    jalonsDirect[String(j.d)] = { t: j.t, v: j.v };
    tuiles('dTuiles', jalonsDirect);
    var el = $('dTuiles').querySelector('[data-j="' + j.d + '"]'); if (el) el.classList.add('vient');
  });
  DLKit.sur('run', function (r) { if (r.fini) DLKit.listerRuns().then(function (l) { runs = trier(l); rendreRuns(); }); });
  function dessinerDirect() {
    if ($('v-direct').hidden) return;
    if (!buf.length) { courbeDirect.donnees(null); return; }
    var now = buf[buf.length - 1][0], x = [], v = [], g = [];
    buf.forEach(function (p) { if (p[0] >= now - fenetre * 1000) { x.push((p[0] - now) / 1000); v.push(vit(p[1])); g.push(p[2]); } });
    courbeDirect.o.gTitre = uniteTxt();
    courbeDirect.donnees({ xMin: -fenetre, xMax: 0, gMin: 0, dSym: true,
      series: [{ x: x, y: v, axe: 'g', couleur: '--trait', largeur: 2 }, { x: x, y: g, axe: 'd', couleur: '--gcol', largeur: 1.5 }] });
  }
  var rejeuIndex = 0;
  $('btnRejouer').addEventListener('click', function () {
    var liste = (window.DL_DEMO_RUNS || []); if (!liste.length) return;
    var r = liste[rejeuIndex % liste.length]; rejeuIndex++;
    jalonsDirect = {}; viderTuiles('dTuiles');
    DLKit.commande('rejouer:' + r.id);
  });

  // ------------------------------------------------------------ RUNS
  var choisi = null, runA = null, runB = null, axe = 't';
  var courbeRun = new DLGraph.Courbe($('cvRun'), {
    hauteur: 280,
    xFmt: function (v) { return axe === 't' ? nf(v, 1) : nf(v, 0); }, gFmt: function (v) { return nf(v, 0); }, dFmt: function (v) { return nf(v, 1); },
    dTitre: 'G',
    surCurseur: function (info) { lecture(info); }
  });
  function rendreRuns() {
    $('thVit').textContent = uniteTxt();
    var tb = $('tabRuns').querySelector('tbody'), h = '';
    runs.forEach(function (r, i) {
      var j = r.jalons;
      h += '<tr class="clic' + (r.id === choisi ? ' choisi' : '') + '" data-id="' + r.id + '"><td>' + (runs.length - i) + '</td><td>' + quandTxt(r.quand) +
           '</td><td class="n num">' + sec(j['60'] && j['60'].t) + '</td><td class="n num">' + sec(j['660'] && j['660'].t) +
           '</td><td class="n num">' + sec(j['1320'] && j['1320'].t) + '</td><td class="n num">' + (j['1320'] && j['1320'].v ? nf(vit(j['1320'].v), 1) : '--') + '</td></tr>';
    });
    tb.innerHTML = h;
    tb.querySelectorAll('tr').forEach(function (tr) { tr.addEventListener('click', function () { choisirRun(tr.getAttribute('data-id')); }); });
    $('runsVide').hidden = runs.length > 0;
    $('tabRuns').hidden = runs.length === 0;
    if (!runs.length) { choisi = null; $('runDetail').hidden = true; return; }
    if (!choisi || !runs.some(function (r) { return r.id === choisi; })) choisirRun(runs[0].id);
  }
  function choisirRun(id) {
    choisi = id;
    $('tabRuns').querySelectorAll('tr').forEach(function (tr) { tr.classList.toggle('choisi', tr.getAttribute('data-id') === id); });
    var sel = $('selCmp'), h = '<option value="">' + T('cmpAucun') + '</option>';
    runs.forEach(function (r, i) { if (r.id !== id) h += '<option value="' + r.id + '">#' + (runs.length - i) + ' · ' + quandTxt(r.quand) + '</option>'; });
    var avant = sel.value; sel.innerHTML = h; sel.value = (avant && avant !== id) ? avant : '';
    DLKit.lireRun(id).then(function (r) { runA = r; return sel.value ? DLKit.lireRun(sel.value) : null; })
      .then(function (b) { runB = b; rendreDetail(); });
  }
  $('selCmp').addEventListener('change', function () {
    var v = $('selCmp').value;
    (v ? DLKit.lireRun(v) : Promise.resolve(null)).then(function (b) { runB = b; rendreDetail(); });
  });
  $('runPrec').addEventListener('click', function () { var i = runs.findIndex(function (r) { return r.id === choisi; }); if (i < runs.length - 1) choisirRun(runs[i + 1].id); });
  $('runSuiv').addEventListener('click', function () { var i = runs.findIndex(function (r) { return r.id === choisi; }); if (i > 0) choisirRun(runs[i - 1].id); });
  $('segAxe').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      axe = b.getAttribute('data-a');
      $('segAxe').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      rendreDetail();
    });
  });
  // T0 du run : l'instant ou la distance depuis l'arret passe le roll-out (comme le kit)
  function t0Run(r) {
    var R = r.ech, x = r.reglages.rpo / 12;
    for (var i = 1; i < R.length; i++) if (R[i - 1][2] < x && R[i][2] >= x) return R[i - 1][0] + (x - R[i - 1][2]) / (R[i][2] - R[i - 1][2]) * (R[i][0] - R[i - 1][0]);
    return 0;
  }
  function serie(r, quoi) {
    var t0 = t0Run(r), x = [], y = [];
    r.ech.forEach(function (e) {
      if (axe === 'd' && e[0] < 0) return;
      x.push(axe === 't' ? (e[0] - t0) / 1000 : e[2]);
      y.push(quoi === 'v' ? vit(e[1]) : e[3]);
    });
    return { x: x, y: y };
  }
  function rendreDetail() {
    if (!runA) return;
    $('runDetail').hidden = false;
    var i = runs.findIndex(function (r) { return r.id === choisi; });
    $('runPos').textContent = T('runPos', { i: runs.length - i, n: runs.length }) + ' · ' + quandTxt(runA.quand);
    $('runPrec').disabled = i >= runs.length - 1; $('runSuiv').disabled = i <= 0;
    tuiles('rTuiles', runA.jalons);
    var g = runA.reglages;
    $('rReglages').textContent = T('rRegl', { rpo: g.rpo, jpo: g.jpo, cms: g.cms, d60: g.d60 });
    var sA = serie(runA, 'v'), gA = serie(runA, 'g');
    var series = [];
    if (runB) { var sB = serie(runB, 'v'); series.push({ x: sB.x, y: sB.y, axe: 'g', couleur: '--cmp', largeur: 2, tirets: [6, 4], nom: 'cmp' }); }
    series.push({ x: gA.x, y: gA.y, axe: 'd', couleur: '--gcol', largeur: 1.4, nom: 'g' });
    series.push({ x: sA.x, y: sA.y, axe: 'g', couleur: '--trait', largeur: 2.2, nom: 'v' });
    $('lgCmp').hidden = !runB;
    var reperes = JALONS.map(function (k) {
      var j = runA.jalons[k]; if (!j) return null;
      var x = axe === 't' ? (j.t - g.cms) / 1000 : (+k + g.jpo / 12 + (k === '60' ? g.d60 / 12 : 0));
      return { x: x, texte: T('j' + k) };
    }).filter(Boolean);
    var fin = runA.jalons['1320'];
    courbeRun.o.gTitre = uniteTxt();
    courbeRun.o.xTitre = T(axe === 't' ? 'xTitreT' : 'xTitreD');
    courbeRun.donnees({ series: series, reperes: reperes, dSym: true, gMin: 0,
      xMin: axe === 't' ? -0.5 : 0, xMax: axe === 't' ? (fin ? fin.t / 1000 + 0.4 : null) : 1400,
      zoneAvant: axe === 't' ? 0 : g.rpo / 12 });
    lecture(null);
  }
  function lecture(info) {
    var el = $('rLecture');
    if (!info) { el.textContent = T('lectureAide'); return; }
    var val = {}; info.valeurs.forEach(function (v) { val[v.nom] = v.y; });
    var xTxt = axe === 't' ? nf(info.x, 3) + ' s' : nf(info.x, 0) + ' ' + T('pi');
    var s = T('lecture', { x: xTxt, v: val.v == null ? '--' : nf(val.v, 1), u: uniteTxt(), g: val.g == null ? '--' : nf(val.g, 2) });
    if (runB) s += T('lectureCmp', { v: val.cmp == null ? '--' : nf(val.cmp, 1), u: uniteTxt() });
    el.textContent = s;
  }

  // ------------------------------------------------------------ KIT
  function rendreKit() {
    var c = cfgKit, e = DLKit.etat();
    $('kitVide').hidden = !!c; $('kitFiche').hidden = !c;
    $('btnCal').disabled = !c; $('btnMaj').disabled = !c;
    if (!c) { $('kitFiche').innerHTML = ''; return; }
    var lignes = [[T('fNom'), e.nom], [T('fFw'), c.fw], [T('fMetier'), 'DRAGLOGICS'], [T('fMode'), e.mode === 'demo' ? T('modeDemo') : 'Bluetooth'],
                  [T('fGps'), T('gpsTxt', { s: c.sats, hz: c.hz })], [T('fImu'), T(c.imu ? 'oui' : 'non')], [T('fCal'), T(c.cal ? 'faite' : 'aFaire')]];
    $('kitFiche').innerHTML = lignes.map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('');
  }
  $('btnCal').addEventListener('click', function () {
    $('kitMsg').textContent = T('calEnCours'); $('btnCal').disabled = true;
    DLKit.commande('calibrer').then(function () { $('kitMsg').textContent = T('calOk'); }, function () { $('kitMsg').textContent = T('horsLigneMsg'); })
      .then(function () { $('btnCal').disabled = !cfgKit; });
  });
  $('btnMaj').addEventListener('click', function () {
    DLKit.commande('maj').catch(function (err) { $('kitMsg').textContent = T(err.message === 'maj-demo' ? 'majDemo' : 'horsLigneMsg'); });
  });

  // ------------------------------------------------------------ REGLAGES
  var BORNES_PO = { rpo: [0, 36], jpo: [-120, 36], d60: [-72, 72] };
  (function remplirPartiel() {
    var h = '<option value="0">' + T('pfftOff') + '</option>';
    for (var d = 50; d <= 1300; d += 50) h += '<option value="' + d + '">' + d + ' ' + T('pi') + '</option>';
    $('f-pfft').innerHTML = h;
  })();
  document.querySelectorAll('.pas').forEach(function (p) {
    var k = p.getAttribute('data-champ'), inp = $('f-' + k);
    p.querySelectorAll('button[data-pas]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = Number(inp.value); if (!Number.isInteger(v)) v = 0;
        inp.value = Math.max(BORNES_PO[k][0], Math.min(BORNES_PO[k][1], v + Number(b.getAttribute('data-pas'))));
        piedsChamp(k);
      });
    });
    inp.addEventListener('input', function () { piedsChamp(k); });
  });
  function piedsChamp(k) { var v = Number($('f-' + k).value); $('p-' + k).textContent = Number.isInteger(v) ? piedsTxt(v) : '?'; }
  function rendreReglages() {
    var c = cfgKit;
    $('regVide').hidden = !!c; $('regCorps').hidden = !c; $('formMsg').textContent = '';
    if (!c) return;
    ['rpo', 'jpo', 'd60', 'cms', 'pfft', 'hecu', 'strig', 'mode', 'cbr', 'grate', 'sfx', 'tzh'].forEach(function (k) { $('f-' + k).value = c[k]; });
    ['rpo', 'jpo', 'd60'].forEach(piedsChamp);
  }
  $('formKit').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('formMsg'); msg.className = '';
    var cfg = {}, err = null;
    // memes bornes que le firmware : le kit refuse un envoi ENTIER pour une seule valeur hors bornes, on le dit avant
    var BORNES = { rpo: [0, 36], jpo: [-120, 36], d60: [-72, 72], cms: [-600, 600], tzh: [-12, 14] };
    ['rpo', 'jpo', 'd60', 'cms', 'tzh'].forEach(function (k) {
      var v = Number($('f-' + k).value), b = BORNES[k];
      if (!Number.isInteger(v) || v < b[0] || v > b[1]) { err = err || (T(k + 'Nom') + ' : ' + b[0] + ' … ' + b[1]); return; }
      cfg[k] = (k === 'cms') ? Math.round(v / 5) * 5 : v;
    });
    ['pfft', 'hecu', 'strig', 'cbr', 'grate'].forEach(function (k) { cfg[k] = Number($('f-' + k).value); });
    cfg.mode = $('f-mode').value;
    var sfx = $('f-sfx').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,5}$/.test(sfx)) err = err || T('sfxNom'); else cfg.sfx = sfx;
    if (err) { msg.className = 'msg-err'; msg.textContent = T('formErr', { x: err }); return; }
    DLKit.ecrireConfig(cfg).then(function () {
      return DLKit.lireConfig();
    }).then(function (c) { cfgKit = c; rendreReglages(); msg.className = 'msg-ok'; msg.textContent = T('formOk'); },
      function (e) { msg.className = 'msg-err'; msg.textContent = T('formErr', { x: e.message }); });
  });

  // ------------------------------------------------------------ APPLICATION
  function rendreApp() {
    segment('segLangue', prefs.langue, function (v) { prefs.langue = v; garderPrefs(); DLI18n.choisir(v); fmtCache = {}; toutRendre(); });
    segment('segUnite', prefs.unite, function (v) { prefs.unite = v; garderPrefs(); toutRendre(); });
    segment('segTheme', prefs.theme, function (v) { prefs.theme = v; garderPrefs(); poserTheme(); });
    segment('segTexte', prefs.texte, function (v) { prefs.texte = v; garderPrefs(); poserTheme(); });
    $('apropos').textContent = T('apropos', { v: VERSION });
  }
  $('btnEffacer').addEventListener('click', function () {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('dlx_') === 0) localStorage.removeItem(k); }); } catch (e) {}
    $('priveMsg').textContent = T('priveOk');
  });

  // ------------------------------------------------------------ tout
  function redessinerTout() { dessinerDirect(); if (!$('v-runs').hidden && runA) rendreDetail(); }
  function toutRendre() {
    var etat = DLKit.etat();
    $('chipTxt').textContent = etat.connecte ? etat.nom : T('horsLigne');
    (function () { var o = $('f-pfft').value; var h = '<option value="0">' + T('pfftOff') + '</option>'; for (var d = 50; d <= 1300; d += 50) h += '<option value="' + d + '">' + d + ' ' + T('pi') + '</option>'; $('f-pfft').innerHTML = h; $('f-pfft').value = o; })();
    if (cfgKit) ['rpo', 'jpo', 'd60'].forEach(piedsChamp);
    majDirectTexte(null); tuiles('dTuiles', jalonsDirect); rendreRuns(); rendreKit(); rendreApp();
    if (runA) choisirRun(choisi);
    redessinerTout();
  }

  DLI18n.choisir(prefs.langue);
  poserTheme();
  rendreApp(); viderTuiles('dTuiles'); rendreRuns(); rendreKit(); rendreReglages(); majDirectTexte(null);
  $('btnRejouer').disabled = true;
  montrerVue(prefs.vue === 'runs' || prefs.vue === 'kit' || prefs.vue === 'reglages' ? prefs.vue : 'direct');

  // Le service worker garde l'application hors ligne (navigateur seulement ; l'application des magasins n'en a pas besoin).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
