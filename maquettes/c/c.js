'use strict';
// MAQUETTE C « UNE PAGE » v0.2 (choisie le 7 oct.).
// Maintenant, Run (le dernier, ou celui touche dans l'historique), Historique sur une seule page.
// Feuilles : Reglages (avec la langue), Comparer au ticket, Connexion.
(function () {
  var VERSION = 'C v0.2';
  var $ = DLC.$, T = DLI18n.T;
  DLI18n.ajouter({
    c_bienvenue: 'Connecte ton kit', c_bienvenueAide: 'Le kit envoie la vitesse en direct, les temps de chaque run et ses réglages.',
    c_maintenant: 'Maintenant', c_dernier: 'Dernier run', c_enCourse: 'Run en cours', c_runCourt: 'Run', c_runN: 'Run {n}',
    c_retourDernier: 'Revenir au dernier run', c_historique: 'Historique', c_cmpTitre: 'Comparaison',
    c_histAide: 'Touche un run pour le voir en haut. Coche deux runs pour les comparer.', c_avance: 'Avancé',
    c_comparer: 'Comparer', c_meilleur: 'meilleur', c_chronoKit: 'Chrono du kit',
    c_ticket: 'Comparer au ticket', c_saisir: 'Entre les temps du ticket, en secondes (ex. 1,290).',
    c_vit18: 'Vitesse 1/8 (mph)', c_vit14: 'Vitesse 1/4 (mph)', c_remplirDemo: 'Remplir avec le ticket de démo', c_comparer2: 'Comparer',
    c_jalon: 'Jalon', c_kit: 'Kit', c_tk: 'Ticket', c_ecart: 'Écart', c_vitLab: 'vitesse {d}',
    c_tkErr: 'Une valeur n’est pas un nombre. Rien n’est comparé.', c_tkVide: 'Entre au moins un temps du ticket.',
    c_tkPastille: '{n}/{m}', c_version: 'DRAGLOGICS — maquette {v}. Locale : rien n’est publié.'
  }, {
    c_bienvenue: 'Connect your kit', c_bienvenueAide: 'The kit sends the live speed, the times of each run and its settings.',
    c_maintenant: 'Now', c_dernier: 'Last run', c_enCourse: 'Run in progress', c_runCourt: 'Run', c_runN: 'Run {n}',
    c_retourDernier: 'Back to the last run', c_historique: 'History', c_cmpTitre: 'Comparison',
    c_histAide: 'Tap a run to see it above. Tick two runs to compare them.', c_avance: 'Advanced',
    c_comparer: 'Compare', c_meilleur: 'best', c_chronoKit: 'Kit timing',
    c_ticket: 'Check against the slip', c_saisir: 'Type the times from the slip, in seconds (e.g. 1.290).',
    c_vit18: '1/8 speed (mph)', c_vit14: '1/4 speed (mph)', c_remplirDemo: 'Fill with the demo slip', c_comparer2: 'Compare',
    c_jalon: 'Mark', c_kit: 'Kit', c_tk: 'Slip', c_ecart: 'Difference', c_vitLab: '{d} speed',
    c_tkErr: 'One value is not a number. Nothing was compared.', c_tkVide: 'Type at least one time from the slip.',
    c_tkPastille: '{n}/{m}', c_version: 'DRAGLOGICS — mockup {v}. Local only: nothing is published.'
  });
  var prefs = new DLC.Prefs('dlxC_prefs', { langue: null, unite: null, theme: 'auto', texte: 'n' });
  DLC.brancher(prefs);
  DLI18n.choisir(prefs.v.langue);
  DLC.poserTheme(prefs.v.theme, prefs.v.texte === 'g');

  // les tickets tapes, gardes dans l'appareil par run (jamais envoyes)
  var TK_CLE = 'dlxC_tickets', tickets = {};
  try { tickets = JSON.parse(localStorage.getItem(TK_CLE) || '{}'); } catch (e) {}
  function garderTickets() { try { localStorage.setItem(TK_CLE, JSON.stringify(tickets)); } catch (e) {} }

  // ---- la barre du bas : saute aux sections, et suit le defilement
  document.querySelectorAll('.c-barre [data-cible]').forEach(function (b) {
    b.addEventListener('click', function () { $(b.getAttribute('data-cible')).scrollIntoView({ block: 'start' }); });
  });
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        document.querySelectorAll('.c-barre [data-cible]').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-cible') === e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['s-maintenant', 's-run', 's-historique'].forEach(function (id) { io.observe($(id)); });
  }
  // ---- les feuilles
  function feuille(id, voile, o, focus) { $(id).hidden = !o; $(voile).hidden = !o; if (o && focus) $(focus).focus(); }
  $('cBtnReg').addEventListener('click', function () { feuille('feuilleReg', 'voileReg', true, 'cRegFermer'); });
  $('cRegFermer').addEventListener('click', function () { feuille('feuilleReg', 'voileReg', false); });
  $('voileReg').addEventListener('click', function () { feuille('feuilleReg', 'voileReg', false); });
  $('cTkFermer').addEventListener('click', function () { feuille('feuilleTk', 'voileTk', false); });
  $('voileTk').addEventListener('click', function () { feuille('feuilleTk', 'voileTk', false); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('feuilleTk').hidden) feuille('feuilleTk', 'voileTk', false);
    else if (!$('feuilleReg').hidden) feuille('feuilleReg', 'voileReg', false);
  });

  var cx = DLC.feuilleConnexion([$('cPilule'), $('cAccueilBtn')]);
  var runs = [], cfg = null, live = {}, enCourse = false, buf = [], coches = [], choisi = null, runVu = null, axe = 't';
  function sections(connecte) {
    $('cAccueil').hidden = connecte;
    ['s-maintenant', 's-run', 's-historique'].forEach(function (id) { $(id).hidden = !connecte; });
  }
  DLKit.sur('etat', function (e) {
    $('cPilule').className = 'c-pilule ' + (e.connecte ? 'on' : 'off');
    $('cPiluleTxt').setAttribute('data-i18n', e.connecte ? 'connecte' : 'bConnecter');
    $('cPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    $('cRejouer').hidden = e.mode !== 'demo';
    sections(e.connecte);
    if (!e.connecte) { runs = []; cfg = null; buf = []; coches = []; choisi = null; runVu = null; majMaintenant(null); rendreRun(); rendreFil(); rendreCmp(); rendreRegl(); rendreFiche(); return; }
    DLKit.lireConfig().then(function (c) { cfg = c; rendreRegl(); rendreFiche(); });
    chargerRuns();
  });
  function chargerRuns() {
    DLKit.listerRuns().then(function (l) {
      runs = DLC.trier(l);
      if (choisi && !runs.some(function (r) { return r.id === choisi; })) choisi = null;
      rendreFil(); voirRun(choisi);
    });
  }

  // ---- maintenant
  var courbe = new DLGraph.Courbe($('cvC'), { hauteur: 150, curseur: false, xFmt: function (v) { return DLC.nf(v, 0) + ' s'; },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G' });
  function majMaintenant(t) {
    $('cU').textContent = DLC.unite();
    $('cVit').textContent = t ? DLC.nf(DLC.vit(t.kmh), 0) : '--';
    $('cG').textContent = t ? DLC.nf(t.g, 2) : '--';
    var e = $('cEtat'), c = t && t.etat === 'COURSE' ? ' course' : t && t.etat === 'FINI' ? ' fini' : '';
    e.className = 'c-etat' + c;
    e.textContent = !t ? T('etatAucun') : T(t.etat === 'COURSE' ? 'etatCourse' : t.etat === 'FINI' ? 'etatFini' : 'etatArme');
    $('cMini').textContent = t ? DLC.nf(DLC.vit(t.kmh), 0) + ' ' + DLC.unite() : '';
    $('cMini').className = 'c-mini num' + (t && t.etat === 'COURSE' ? ' course' : '');
  }
  DLKit.sur('telem', function (t) {
    if (t.etat === 'COURSE' && !enCourse) { enCourse = true; live = {}; rendreChiffres(live); titreRun(); }
    if (t.etat === 'ARME' && enCourse) { enCourse = false; titreRun(); }
    majMaintenant(t);
    buf.push([t.ms, t.kmh, t.g]); while (buf.length && buf[0][0] < t.ms - 11000) buf.shift();
    dessinerMaintenant();
  });
  DLKit.sur('jalon', function (j) { live[String(j.d)] = { t: j.t, v: j.v }; rendreChiffres(live); });
  DLKit.sur('run', function (r) { if (r.fini) { enCourse = false; choisi = null; chargerRuns(); } });
  function dessinerMaintenant() {
    if (!buf.length) { courbe.donnees(null); return; }
    var now = buf[buf.length - 1][0], x = [], v = [], g = [];
    buf.forEach(function (p) { if (p[0] >= now - 10000) { x.push((p[0] - now) / 1000); v.push(DLC.vit(p[1])); g.push(p[2]); } });
    courbe.o.gTitre = DLC.unite();
    courbe.donnees({ xMin: -10, xMax: 0, gMin: 0, dSym: true, series: [{ x: x, y: v, axe: 'g', couleur: '--trait', largeur: 2 }, { x: x, y: g, axe: 'd', couleur: '--gcol', largeur: 1.4 }] });
  }
  var iRejeu = 0;
  $('cRejouer').addEventListener('click', function () { var l = window.DL_DEMO_RUNS || []; if (l.length) DLKit.commande('rejouer:' + l[iRejeu++ % l.length].id); });

  // ---- le run (le dernier par defaut ; celui touche dans l'historique sinon)
  function nomRun(id) { var i = runs.findIndex(function (r) { return r.id === id; }); return T('c_runN', { n: runs.length - i }); }
  function titreRun() {
    $('cRunTitre').textContent = enCourse ? T('c_enCourse') : (choisi && runVu ? nomRun(runVu.id) + ' · ' + DLC.quand(runVu.quand) : T('c_dernier'));
    $('cRetourDernier').hidden = !choisi || enCourse;
  }
  function rendreChiffres(jal) {
    var f = jal && jal['1320'], h = '<span class="gros num">' + DLC.sec(f && f.t) + '<small>s</small></span>';
    ['60', '330', '660'].forEach(function (k) {
      var j = jal && jal[k];
      h += '<span class="pt"><span class="l">' + T('j' + k) + '</span><span class="t num">' + DLC.sec(j && j.t) + '</span><span class="v num">' + (j && j.v ? DLC.nf(DLC.vit(j.v), 1) + ' ' + DLC.unite() : '') + '</span></span>';
    });
    h += '<span class="pt"><span class="l">' + T('j1320') + '</span><span class="t num">' + (f && f.v ? DLC.nf(DLC.vit(f.v), 1) : '--') + '</span><span class="v">' + DLC.unite() + '</span></span>';
    $('cChiffres').innerHTML = h;
  }
  var courbeRun = new DLGraph.Courbe($('cvCRun'), { hauteur: 230, xFmt: function (v) { return DLC.nf(v, axe === 't' ? 1 : 0); },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G',
    surCurseur: function (info) { $('cLecture').textContent = DLC.lecture(info, axe, false); } });
  DLC.segment('cAxe', axe, function (v) { axe = v; rendreRun(); });
  function voirRun(id) {
    choisi = id || null;
    var cible = choisi || (runs[0] && runs[0].id);
    marquerChoisi();
    if (!cible) { runVu = null; rendreRun(); return; }
    DLKit.lireRun(cible).then(function (r) { runVu = r; rendreRun(); });
  }
  function rendreRun() {
    titreRun();
    if (!enCourse) rendreChiffres(runVu && runVu.jalons);
    $('cTicketBtn').disabled = !runVu;
    pastille($('cTicketPastille'), runVu);
    if (!runVu) { courbeRun.donnees(null); $('cLecture').textContent = ''; $('cRegRun').textContent = ''; return; }
    courbeRun.o.gTitre = DLC.unite(); courbeRun.o.xTitre = T(axe === 't' ? 'xTitreT' : 'xTitreD');
    courbeRun.donnees(DLC.donneesRun(runVu, null, axe));
    $('cLecture').textContent = T('lectureAide');
    var g = runVu.reglages; $('cRegRun').textContent = T('rRegl', { rpo: g.rpo, jpo: g.jpo, cms: g.cms, d60: g.d60 });
  }
  $('cRetourDernier').addEventListener('click', function () { voirRun(null); });

  // ---- historique
  function pastille(el, run) {
    var tk = run && tickets[run.id];
    if (!tk) { el.hidden = true; return; }
    var c = DLC.comparerTicket(run, tk);
    el.hidden = !c.nTot; el.textContent = T('c_tkPastille', { n: c.nOk, m: c.nTot });
    el.className = 'c-pastille ' + (c.nOk === c.nTot ? 'ok' : 'hors');
  }
  function marquerChoisi() {
    var cible = choisi || (runs[0] && runs[0].id);
    $('cFil').querySelectorAll('li[data-id]').forEach(function (li) { li.classList.toggle('choisi', li.getAttribute('data-id') === cible); });
  }
  function rendreFil() {
    $('cFilVide').hidden = runs.length > 0;
    var best = null; runs.forEach(function (r) { var f = r.jalons['1320']; if (f && (!best || f.t < best.t)) best = { id: r.id, t: f.t }; });
    $('cFil').innerHTML = runs.map(function (r, i) {
      var f = r.jalons['1320'], j = r.jalons;
      return '<li data-id="' + r.id + '" class="' + (best && best.id === r.id ? 'meilleur' : '') + '"><span><span class="q">' + T('c_runN', { n: runs.length - i }) + ' · ' + DLC.quand(r.quand) +
             (best && best.id === r.id ? ' · ' + T('c_meilleur') : '') + '</span><br><span class="p num">60 ' + DLC.sec(j['60'] && j['60'].t) + ' · 1/8 ' + DLC.sec(j['660'] && j['660'].t) + '</span></span>' +
             '<span><span class="et num">' + DLC.sec(f && f.t) + '</span><br><span class="vf num">' + (f && f.v ? DLC.nf(DLC.vit(f.v), 1) + ' ' + DLC.unite() : '') + '</span></span>' +
             '<canvas class="graphe" data-mini="' + r.id + '" aria-hidden="true"></canvas>' +
             '<span class="bas"><label class="coche"><input type="checkbox" data-coche="' + r.id + '"' + (coches.indexOf(r.id) >= 0 ? ' checked' : '') + '> <span>' + T('c_comparer') + '</span></label>' +
             '<span class="c-pastille" data-pastille="' + r.id + '" hidden></span></span></li>';
    }).join('');
    $('cFil').querySelectorAll('li[data-id]').forEach(function (li) {
      var id = li.getAttribute('data-id');
      var c = new DLGraph.Courbe(li.querySelector('canvas'), { hauteur: 46, nu: true, curseur: false });
      DLKit.lireRun(id).then(function (r) { c.donnees(DLC.donneesMini(r)); pastille(li.querySelector('[data-pastille]'), r); });
      // toucher la carte = la voir en haut ; toucher la case = la comparer (sans changer le run vu)
      li.addEventListener('click', function (ev) {
        if (ev.target.closest('label.coche')) return;
        voirRun(id); $('s-run').scrollIntoView({ block: 'start' });
      });
    });
    $('cFil').querySelectorAll('input[data-coche]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-coche');
        coches = coches.filter(function (x) { return x !== id; });
        if (cb.checked) { coches.push(id); if (coches.length > 2) coches.shift(); }
        $('cFil').querySelectorAll('input[data-coche]').forEach(function (x) { x.checked = coches.indexOf(x.getAttribute('data-coche')) >= 0; });
        rendreCmp();
      });
    });
    marquerChoisi();
  }
  var courbeCmp = new DLGraph.Courbe($('cvCCmp'), { hauteur: 220, xFmt: function (v) { return DLC.nf(v, 1); },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G',
    surCurseur: function (info) { $('cCmpLecture').textContent = DLC.lecture(info, 't', true); } });
  function rendreCmp() {
    if (coches.length < 2) { $('cCmpBloc').hidden = true; return; }
    Promise.all([DLKit.lireRun(coches[0]), DLKit.lireRun(coches[1])]).then(function (rr) {
      $('cCmpBloc').hidden = false;
      $('cCmpA').textContent = nomRun(rr[0].id); $('cCmpB').textContent = nomRun(rr[1].id);
      courbeCmp.o.gTitre = DLC.unite(); courbeCmp.o.xTitre = T('xTitreT');
      courbeCmp.donnees(DLC.donneesRun(rr[0], rr[1], 't'));
      $('cCmpLecture').textContent = T('lectureAide');
    });
  }

  // ---- comparer au ticket
  var CHAMPS_TK = ['60', '330', '660', '1320', 'v660', 'v1320'];
  function decimal(v, dec) { return DLC.nf(v, dec).replace(/\s/g, ''); }
  $('cTicketBtn').addEventListener('click', function () {
    if (!runVu) return;
    $('cTkRun').textContent = nomRun(runVu.id) + ' · ' + DLC.quand(runVu.quand);
    var tk = tickets[runVu.id] || {};
    CHAMPS_TK.forEach(function (k) { $('tk' + k).value = tk[k] != null ? decimal(tk[k], k.charAt(0) === 'v' ? 2 : 3) : ''; });
    $('cTkDemo').hidden = !(DLKit.etat().mode === 'demo' && DLC.TICKETS_DEMO[runVu.id]);
    $('cTkErr').textContent = '';
    if (tickets[runVu.id]) montrerTicket(DLC.comparerTicket(runVu, tickets[runVu.id])); else $('cTkRes').hidden = true;
    feuille('feuilleTk', 'voileTk', true, 'tk60');
  });
  $('cTkDemo').addEventListener('click', function () {
    var tk = DLC.TICKETS_DEMO[runVu && runVu.id]; if (!tk) return;
    CHAMPS_TK.forEach(function (k) { $('tk' + k).value = decimal(tk[k], k.charAt(0) === 'v' ? 2 : 3); });
  });
  $('cTkComparer').addEventListener('click', function () {
    var tk = {}, faux = false, n = 0;
    CHAMPS_TK.forEach(function (k) { var v = DLC.lireNombre($('tk' + k).value); if (v !== null && isNaN(v)) faux = true; tk[k] = (v === null || isNaN(v)) ? null : v; if (tk[k] != null && k.charAt(0) !== 'v') n++; });
    if (faux) { $('cTkErr').textContent = T('c_tkErr'); return; }
    if (!n) { $('cTkErr').textContent = T('c_tkVide'); return; }
    $('cTkErr').textContent = '';
    tickets[runVu.id] = tk; garderTickets();
    montrerTicket(DLC.comparerTicket(runVu, tk));
    pastille($('cTicketPastille'), runVu);
    var p = $('cFil').querySelector('[data-pastille="' + runVu.id + '"]'); if (p) pastille(p, runVu);
  });
  function montrerTicket(c) {
    var h = c.temps.map(function (r) {
      return '<tr><td>' + T('j' + r.k) + '</td><td class="n num">' + DLC.nf(r.kit, 3) + '</td><td class="n num">' + DLC.nf(r.tk, 3) +
             '</td><td class="n num">' + (r.e >= 0 ? '+' : '−') + DLC.nf(Math.abs(r.e), 3) + '</td><td class="n"><span class="marque ' + r.cl + '">' + (r.cl === 'ok' ? '✓' : r.cl === 'proche' ? '≈' : '!') + '</span></td></tr>';
    }).concat(c.vitesses.map(function (r) {
      return '<tr><td>' + T('c_vitLab', { d: T('j' + r.k) }) + '</td><td class="n num">' + DLC.nf(r.kit, 2) + '</td><td class="n num">' + DLC.nf(r.tk, 2) +
             '</td><td class="n num">' + (r.pc >= 0 ? '+' : '−') + DLC.nf(Math.abs(r.pc), 1) + ' %</td><td></td></tr>';
    })).join('');
    $('cTkCorps').innerHTML = h; $('cTkRes').hidden = false;
    $('cTkBilan').textContent = c.nTot ? T('tk_bilan', { n: c.nOk, m: c.nTot }) : '';
    $('cTkConseil').textContent = c.conseil ? T(c.conseil) : '';
  }

  // ---- reglages : application, chrono du kit, le kit, confidentialite
  DLC.brancherPas($('cForm'));
  function rendreRegl() { $('cRegVide').hidden = !!cfg; $('cRegCorps').hidden = !cfg; $('cFormMsg').textContent = ''; if (cfg) DLC.remplirForm(cfg); }
  $('cForm').addEventListener('submit', function (ev) { ev.preventDefault(); DLC.envoyerForm($('cFormMsg'), function (c) { cfg = c; rendreFiche(); }); });
  function rendreFiche() {
    var e = DLKit.etat();
    $('cFicheVide').hidden = !!cfg; $('cFiche').hidden = !cfg; $('cCal').disabled = !cfg; $('cMaj').disabled = !cfg;
    if (!cfg) { $('cFiche').innerHTML = ''; return; }
    var l = [[T('fNom'), e.nom], [T('fFw'), cfg.fw], [T('fMode'), e.mode === 'demo' ? T('modeDemo') : 'Bluetooth'],
             [T('fGps'), T('gpsTxt', { s: cfg.sats, hz: cfg.hz })], [T('fCal'), T(cfg.cal ? 'faite' : 'aFaire')]];
    $('cFiche').innerHTML = l.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('');
  }
  $('cCal').addEventListener('click', function () {
    $('cKitMsg').textContent = T('calEnCours'); $('cCal').disabled = true;
    DLKit.commande('calibrer').then(function () { $('cKitMsg').textContent = T('calOk'); }, function () { $('cKitMsg').textContent = T('horsLigneMsg'); })
      .then(function () { $('cCal').disabled = !cfg; });
  });
  $('cMaj').addEventListener('click', function () {
    DLKit.commande('maj').catch(function (err) { $('cKitMsg').textContent = T(err.message === 'maj-demo' ? 'majDemo' : 'horsLigneMsg'); });
  });
  function prefsApp() {
    DLC.segment('segLangue', prefs.v.langue, function (v) { prefs.v.langue = v; prefs.garder(); DLI18n.choisir(v); DLC.viderCache(); toutRendre(); });
    DLC.segment('segUnite', prefs.v.unite, function (v) { prefs.v.unite = v; prefs.garder(); toutRendre(); });
    DLC.segment('segTheme', prefs.v.theme, function (v) { prefs.v.theme = v; prefs.garder(); DLC.poserTheme(v, prefs.v.texte === 'g'); toutRendre(); });
    DLC.segment('segTexte', prefs.v.texte, function (v) { prefs.v.texte = v; prefs.garder(); DLC.poserTheme(prefs.v.theme, v === 'g'); toutRendre(); });
    $('cVersion').textContent = T('c_version', { v: VERSION });
  }
  $('cEffacer').addEventListener('click', function () {
    prefs.effacer(); tickets = {}; try { localStorage.removeItem(TK_CLE); } catch (e) {}
    $('cPriveMsg').textContent = T('priveOk'); rendreFil(); rendreRun();
  });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { toutRendre(); }); }

  function toutRendre() {
    var e = DLKit.etat();
    $('cPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    prefsApp(); majMaintenant(null); dessinerMaintenant(); rendreRun(); rendreFil(); rendreCmp(); rendreFiche();
    if (cfg) DLC.remplirForm(cfg);
  }
  sections(false); prefsApp(); majMaintenant(null); rendreRun(); rendreFil(); rendreRegl(); rendreFiche();
  $('cRejouer').hidden = true;
})();
