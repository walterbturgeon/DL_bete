'use strict';
// MAQUETTE A « COCKPIT » : l'essentiel en tres gros, 3 ecrans (Direct, Runs, Reglages), le reste replie.
(function () {
  var $ = DLC.$, T = DLI18n.T;
  DLI18n.ajouter({
    a_dernier: 'Dernier run', a_enCourse: 'Run en cours', a_rejouer: 'Rejouer un run (démo)', a_voirCourbe: 'Voir la courbe',
    a_cacherCourbe: 'Cacher la courbe', a_vide: 'Touche « Connecter » en haut pour commencer.', a_plus: 'Plus de réglages',
    a_meilleur: 'Meilleur', a_runN: 'Run {n}'
  }, {
    a_dernier: 'Last run', a_enCourse: 'Run in progress', a_rejouer: 'Replay a run (demo)', a_voirCourbe: 'Show the chart',
    a_cacherCourbe: 'Hide the chart', a_vide: 'Tap “Connect” at the top to start.', a_plus: 'More settings',
    a_meilleur: 'Best', a_runN: 'Run {n}'
  });
  var prefs = new DLC.Prefs('dlxA_prefs', { langue: null, unite: null, theme: 'dark', vue: 'direct', courbe: false });
  DLC.brancher(prefs);
  DLI18n.choisir(prefs.v.langue);
  DLC.poserTheme(prefs.v.theme === 'light' ? 'light' : 'dark');

  // ---- navigation
  function vue(v) {
    prefs.v.vue = v; prefs.garder();
    document.querySelectorAll('.vue').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    document.querySelectorAll('.a-barre [data-vue]').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-vue') === v); });
    window.scrollTo(0, 0); dessinerDirect();
  }
  document.querySelectorAll('.a-barre [data-vue]').forEach(function (b) { b.addEventListener('click', function () { vue(b.getAttribute('data-vue')); }); });

  // ---- tuiles
  function tuiles(id, jal) {
    $(id).innerHTML = DLC.JALONS.map(function (k) {
      var j = jal && jal[k];
      return '<div class="a-tuile" data-j="' + k + '"><div class="l">' + T('j' + k) + '</div><div class="t num">' + (j ? DLC.sec(j.t) : '--') +
             '</div><div class="v num">' + (j && j.v ? DLC.nf(DLC.vit(j.v), 1) + ' ' + DLC.unite() : '') + '</div></div>';
    }).join('');
  }

  // ---- connexion
  DLC.feuilleConnexion([$('aPilule')]);
  var runs = [], cfg = null, live = {}, enCourse = false, buf = [];
  DLKit.sur('etat', function (e) {
    $('aPilule').className = 'pilule ' + (e.connecte ? 'on' : 'off');
    $('aPiluleTxt').setAttribute('data-i18n', e.connecte ? 'connecte' : 'bConnecter');
    $('aPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    $('aVide').hidden = e.connecte; $('aRejouer').disabled = !e.connecte;
    if (!e.connecte) { runs = []; cfg = null; buf = []; rendreDernier(); rendreListe(); rendreRegl(); majDirect(null); return; }
    DLKit.lireConfig().then(function (c) { cfg = c; rendreRegl(); });
    DLKit.listerRuns().then(function (l) { runs = DLC.trier(l); rendreListe(); rendreDernier(); });
  });

  // ---- direct
  var courbe = new DLGraph.Courbe($('cvA'), { hauteur: 200, curseur: false, xFmt: function (v) { return DLC.nf(v, 0) + ' s'; },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G' });
  function majDirect(t) {
    $('aU').textContent = DLC.unite();
    $('aVit').textContent = t ? DLC.nf(DLC.vit(t.kmh), 0) : '--';
    $('aG').textContent = t ? DLC.nf(t.g, 2) : '--';
    var e = $('aEtat');
    e.className = 'a-etat' + (t && t.etat === 'COURSE' ? ' course' : t && t.etat === 'FINI' ? ' fini' : '');
    e.textContent = !t ? T('etatAucun') : T(t.etat === 'COURSE' ? 'etatCourse' : t.etat === 'FINI' ? 'etatFini' : 'etatArme');
  }
  DLKit.sur('telem', function (t) {
    if (t.etat === 'COURSE' && !enCourse) { enCourse = true; live = {}; rendreDernier(); }
    if (t.etat !== 'COURSE' && enCourse && t.etat !== 'FINI') enCourse = false;
    majDirect(t);
    buf.push([t.ms, t.kmh, t.g]); while (buf.length && buf[0][0] < t.ms - 11000) buf.shift();
    if (!$('aCourbe').hidden) dessinerDirect();
  });
  DLKit.sur('jalon', function (j) {
    live[String(j.d)] = { t: j.t, v: j.v }; rendreDernier();
    var el = $('aTuiles').querySelector('[data-j="' + j.d + '"]'); if (el) el.classList.add('vient');
  });
  DLKit.sur('run', function (r) { if (r.fini) { enCourse = false; DLKit.listerRuns().then(function (l) { runs = DLC.trier(l); rendreListe(); rendreDernier(); }); } });
  function rendreDernier() {
    var jal = enCourse ? live : (runs[0] && runs[0].jalons);
    $('aDernierLab').textContent = T(enCourse ? 'a_enCourse' : 'a_dernier');
    var fin = jal && jal['1320'];
    $('aEt').textContent = fin ? DLC.sec(fin.t) : '--';
    $('aVfin').textContent = fin && fin.v ? DLC.nf(DLC.vit(fin.v), 1) + ' ' + DLC.unite() : '';
    tuiles('aTuiles', jal);
  }
  function dessinerDirect() {
    if ($('v-direct').hidden || $('aCourbe').hidden || !buf.length) return;
    var now = buf[buf.length - 1][0], x = [], v = [], g = [];
    buf.forEach(function (p) { if (p[0] >= now - 10000) { x.push((p[0] - now) / 1000); v.push(DLC.vit(p[1])); g.push(p[2]); } });
    courbe.o.gTitre = DLC.unite();
    courbe.donnees({ xMin: -10, xMax: 0, gMin: 0, dSym: true, series: [{ x: x, y: v, axe: 'g', couleur: '--trait', largeur: 2.2 }, { x: x, y: g, axe: 'd', couleur: '--gcol', largeur: 1.5 }] });
  }
  function majBoutonCourbe() {
    $('aCourbe').hidden = !prefs.v.courbe;
    $('aCourbeBtn').setAttribute('data-i18n', prefs.v.courbe ? 'a_cacherCourbe' : 'a_voirCourbe'); $('aCourbeBtn').textContent = T(prefs.v.courbe ? 'a_cacherCourbe' : 'a_voirCourbe');
    dessinerDirect();
  }
  $('aCourbeBtn').addEventListener('click', function () { prefs.v.courbe = !prefs.v.courbe; prefs.garder(); majBoutonCourbe(); });
  var iRejeu = 0;
  $('aRejouer').addEventListener('click', function () {
    var l = window.DL_DEMO_RUNS || []; if (!l.length) return;
    DLKit.commande('rejouer:' + l[iRejeu++ % l.length].id);
  });

  // ---- runs
  function rendreListe() {
    $('aRunsVide').hidden = runs.length > 0;
    var best = null; runs.forEach(function (r) { var f = r.jalons['1320']; if (f && (!best || f.t < best.t)) best = { id: r.id, t: f.t }; });
    $('aListe').innerHTML = runs.map(function (r, i) {
      var j = r.jalons, f = j['1320'];
      return '<button type="button" class="a-carte" data-id="' + r.id + '"><span class="n">' + (runs.length - i) + '</span>' +
             '<span><span class="q">' + DLC.quand(r.quand) + (best && best.id === r.id ? '<span class="meilleur">' + T('a_meilleur') + '</span>' : '') + '</span><br>' +
             '<span class="p num">60 ' + DLC.sec(j['60'] && j['60'].t) + ' · 1/8 ' + DLC.sec(j['660'] && j['660'].t) + '</span></span>' +
             '<span><span class="et num">' + DLC.sec(f && f.t) + '</span><br><span class="vf num">' + (f && f.v ? DLC.nf(DLC.vit(f.v), 1) + ' ' + DLC.unite() : '') + '</span></span></button>';
    }).join('');
    $('aListe').querySelectorAll('.a-carte').forEach(function (b) { b.addEventListener('click', function () { ouvrirDetail(b.getAttribute('data-id')); }); });
  }
  var runA = null, runB = null, axe = 't';
  var courbeRun = new DLGraph.Courbe($('cvARun'), { hauteur: 300, xFmt: function (v) { return DLC.nf(v, axe === 't' ? 1 : 0); },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G',
    surCurseur: function (info) { $('aLecture').textContent = DLC.lecture(info, axe, !!runB); } });
  function ouvrirDetail(id) {
    var i = runs.findIndex(function (r) { return r.id === id; });
    $('aDetailTitre').textContent = T('a_runN', { n: runs.length - i }) + ' · ' + DLC.quand(runs[i].quand);
    var h = '<option value="">' + T('cmpAucun') + '</option>';
    runs.forEach(function (r, k) { if (r.id !== id) h += '<option value="' + r.id + '">' + T('a_runN', { n: runs.length - k }) + '</option>'; });
    $('aCmp').innerHTML = h; runB = null;
    DLKit.lireRun(id).then(function (r) { runA = r; $('aDetail').hidden = false; document.body.style.overflow = 'hidden'; rendreDetail(); $('aRetour').focus(); });
  }
  function fermerDetail() { $('aDetail').hidden = true; document.body.style.overflow = ''; }
  $('aRetour').addEventListener('click', fermerDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('aDetail').hidden) fermerDetail(); });
  $('aCmp').addEventListener('change', function () { var v = $('aCmp').value; (v ? DLKit.lireRun(v) : Promise.resolve(null)).then(function (b) { runB = b; rendreDetail(); }); });
  DLC.segment('aAxe', axe, function (v) { axe = v; rendreDetail(); });
  function rendreDetail() {
    if (!runA) return;
    var f = runA.jalons['1320'];
    $('aDEt').textContent = DLC.sec(f && f.t); $('aDVfin').textContent = f && f.v ? DLC.nf(DLC.vit(f.v), 1) + ' ' + DLC.unite() : '';
    tuiles('aDTuiles', runA.jalons);
    $('aLgCmp').hidden = !runB;
    courbeRun.o.gTitre = DLC.unite(); courbeRun.o.xTitre = T(axe === 't' ? 'xTitreT' : 'xTitreD');
    courbeRun.donnees(DLC.donneesRun(runA, runB, axe));
    $('aLecture').textContent = T('lectureAide');
  }

  // ---- reglages
  DLC.brancherPas($('aForm'));
  function rendreRegl() {
    $('aRegVide').hidden = !!cfg; $('aRegCorps').hidden = !cfg; $('aFormMsg').textContent = '';
    if (cfg) DLC.remplirForm(cfg);
  }
  $('aForm').addEventListener('submit', function (ev) { ev.preventDefault(); DLC.envoyerForm($('aFormMsg'), function (c) { cfg = c; }); });
  function prefsApp() {
    DLC.segment('segLangue', prefs.v.langue, function (v) { prefs.v.langue = v; prefs.garder(); DLI18n.choisir(v); DLC.viderCache(); toutRendre(); });
    DLC.segment('segUnite', prefs.v.unite, function (v) { prefs.v.unite = v; prefs.garder(); toutRendre(); });
    DLC.segment('segTheme', prefs.v.theme === 'light' ? 'light' : 'dark', function (v) { prefs.v.theme = v; prefs.garder(); DLC.poserTheme(v); toutRendre(); });
  }
  $('aEffacer').addEventListener('click', function () { prefs.effacer(); $('aPriveMsg').textContent = T('priveOk'); });

  function toutRendre() {
    var e = DLKit.etat();
    $('aPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    majDirect(null); rendreDernier(); rendreListe(); majBoutonCourbe(); prefsApp();
    if (cfg) DLC.remplirForm(cfg);
    if (!$('aDetail').hidden) rendreDetail();
  }
  prefsApp(); majDirect(null); rendreDernier(); rendreListe(); rendreRegl(); majBoutonCourbe();
  $('aRejouer').disabled = true;
  vue(['direct', 'runs', 'reglages'].indexOf(prefs.v.vue) >= 0 ? prefs.v.vue : 'direct');
})();
