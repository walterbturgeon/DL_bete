'use strict';
// Le kit graphique de la maquette B : remplit les exemples avec les runs de demonstration (synthetiques), dessine les
// graphiques avec le moteur de l'application, et montre les 5 ecrans en direct. Theme et langue au choix.
(function () {
  var $ = DLC.$, T = DLI18n.T;
  DLI18n.ajouter({
    kg_titre: 'Kit graphique — maquette B', kg_couleurs: 'Couleurs', kg_couleursAide: 'Une couleur = un sens. Les valeurs changent avec le thème ; le sens ne change jamais.',
    kg_rAtt: 'Orange', kg_rAttTxt: '= seulement ce qui demande une action', kg_rSel: 'Bleu', kg_rSelTxt: '= ce qui est choisi, les jalons, l’action principale',
    kg_rOk: 'Vert', kg_rOkTxt: '= connecté, fait, dans la cible, meilleur', kg_rLent: 'Rouge', kg_rLentTxt: '= plus lent, valeur refusée',
    kg_clair: 'clair', kg_sombre: 'sombre',
    kg_textes: 'Textes', kg_textesAide: 'Police du système (San Francisco sur iPhone, Roboto sur Android). Chiffres à largeur fixe pour les temps.',
    kg_tVitesse: 'vitesse', kg_tTemps: 'temps d’un jalon', kg_tTuile: 'titre de tuile', kg_tCarte: 'titre de carte', kg_tCorps: 'texte',
    kg_tCorpsEx: 'Le chrono part quand le véhicule a avancé.', kg_tAide: 'aide, secondaire', kg_tEtiq: 'en-tête de tableau, barre du bas', kg_tEtiqEx: 'Étiquette',
    kg_icones: 'Icônes', kg_iconesAide: 'Trait de 1,8 px, bouts arrondis, couleur du texte. Dessinées dans l’application : aucun fichier extérieur.',
    kg_nav: 'Navigation', kg_pilule: 'Connexion dans l’en-tête', kg_piluleAide: 'Orange : il faut connecter. Vert : le kit est connecté (son nom).',
    kg_barre: 'Barre du bas (fixe)', kg_barreAide: '4 boutons, 66 px de haut, icône + mot. L’écran actif est bleu, avec un fond sous l’icône.',
    kg_tuiles: 'Tuiles : à faire, normale, faite', kg_etapes: 'Étapes : faites, à faire',
    kg_bandeaux: 'Bandeau d’état : pas connecté, prêt, en course, terminé', kg_vitesse: 'Vitesse et G',
    kg_jalons: 'Jalons : vide, en course (le dernier reçu en bleu), complets',
    kg_lignes: 'Lignes : normale, choisie, avec ticket', kg_pastilles: 'Pastilles et marques du ticket',
    kg_pastillesAide: '✓ : écart ≤ 0,020 s (la cible). ≈ : ≤ 0,040 s. ! : plus de 0,040 s. Pastille verte = tous les jalons dans la cible.',
    kg_graphes: 'Graphiques', kg_graphesAide: 'Un seul moteur pour tous les graphiques : axes ronds, deux axes (vitesse à gauche, G à droite), jalons en bleu pointillé, zone grise avant le départ, lecture au doigt. Net sur la tablette.',
    kg_gDirect: 'En direct (Courir) — 10 dernières secondes', kg_gTemps: 'Un run, en temps', kg_gDist: 'Un run, en distance', kg_gCmp: 'Deux runs comparés',
    kg_ticketCourt: 'Ticket', kg_saisie: 'Saisie', kg_resultat: 'Résultat',
    kg_etape: 'Étape numérotée, avec un réglage en pouces', kg_champs: 'Choix, champs, boutons, messages',
    kg_feuilles: 'Feuilles', kg_feuilleAide: 'Monte du bas, sur un voile sombre. Le Bluetooth est demandé seulement ici, avec la raison.', kg_vides: 'États vides',
    kg_ecrans: 'Écrans', kg_ecransAide: 'Les 5 écrans de l’application, en direct, connectés au kit de démonstration. « Courir » rejoue un run de démonstration toutes les 20 s.',
    kg_ouvrir: 'Ouvrir seul',
    kg_jBg: 'fond de l’écran', kg_jCard: 'cartes, tuiles, barre du bas', kg_jInk: 'texte', kg_jMuted: 'texte secondaire, axes', kg_jLine: 'traits, bords, grille',
    kg_jSel: 'choisi, jalons, action principale', kg_jSelbg: 'fond de ce qui est choisi', kg_jOk: 'connecté, fait, dans la cible', kg_jLent: 'plus lent, refusé',
    kg_jAtt: 'il faut agir (orange réservé)', kg_jTab: 'fond des champs et des tuiles', kg_jTrait: 'courbe de vitesse', kg_jCmp: 'run comparé (pointillé)',
    kg_jGcol: 'G de l’accéléromètre', kg_jDoux: 'fond d’une tuile « faite »', kg_jDouxAtt: 'fond d’une tuile « à faire »', kg_jZone: 'avant le départ (graphiques)'
  }, {
    kg_titre: 'Design kit — mockup B', kg_couleurs: 'Colors', kg_couleursAide: 'One color = one meaning. Values change with the theme; the meaning never changes.',
    kg_rAtt: 'Orange', kg_rAttTxt: '= only what needs an action', kg_rSel: 'Blue', kg_rSelTxt: '= what is selected, timing marks, main action',
    kg_rOk: 'Green', kg_rOkTxt: '= connected, done, within target, best', kg_rLent: 'Red', kg_rLentTxt: '= slower, refused value',
    kg_clair: 'light', kg_sombre: 'dark',
    kg_textes: 'Text', kg_textesAide: 'System font (San Francisco on iPhone, Roboto on Android). Fixed-width digits for times.',
    kg_tVitesse: 'speed', kg_tTemps: 'timing mark time', kg_tTuile: 'tile title', kg_tCarte: 'card title', kg_tCorps: 'body',
    kg_tCorpsEx: 'The timer starts when the vehicle has moved.', kg_tAide: 'help, secondary', kg_tEtiq: 'table header, bottom bar', kg_tEtiqEx: 'Label',
    kg_icones: 'Icons', kg_iconesAide: '1.8 px stroke, round ends, text color. Drawn in the app: no external file.',
    kg_nav: 'Navigation', kg_pilule: 'Connection in the header', kg_piluleAide: 'Orange: you must connect. Green: the kit is connected (its name).',
    kg_barre: 'Bottom bar (fixed)', kg_barreAide: '4 buttons, 66 px high, icon + word. The active screen is blue, with a background under the icon.',
    kg_tuiles: 'Tiles: to do, normal, done', kg_etapes: 'Steps: done, to do',
    kg_bandeaux: 'Status banner: not connected, ready, running, finished', kg_vitesse: 'Speed and G',
    kg_jalons: 'Timing marks: empty, running (last received in blue), complete',
    kg_lignes: 'Rows: normal, selected, with a slip', kg_pastilles: 'Badges and slip marks',
    kg_pastillesAide: '✓: difference ≤ 0.020 s (the target). ≈: ≤ 0.040 s. !: more than 0.040 s. Green badge = every timing mark within target.',
    kg_graphes: 'Charts', kg_graphesAide: 'One engine for every chart: round ticks, two axes (speed left, G right), dashed blue timing marks, grey zone before the start, touch to read. Sharp on the tablet.',
    kg_gDirect: 'Live (Run screen) — last 10 seconds', kg_gTemps: 'A run, by time', kg_gDist: 'A run, by distance', kg_gCmp: 'Two runs compared',
    kg_ticketCourt: 'Slip', kg_saisie: 'Input', kg_resultat: 'Result',
    kg_etape: 'Numbered step, with a setting in inches', kg_champs: 'Choices, fields, buttons, messages',
    kg_feuilles: 'Sheets', kg_feuilleAide: 'Slides up from the bottom, over a dark veil. Bluetooth is asked only here, with the reason.', kg_vides: 'Empty states',
    kg_ecrans: 'Screens', kg_ecransAide: 'The 5 screens of the app, live, connected to the demo kit. “Run” replays a demo run every 20 s.',
    kg_ouvrir: 'Open alone',
    kg_jBg: 'screen background', kg_jCard: 'cards, tiles, bottom bar', kg_jInk: 'text', kg_jMuted: 'secondary text, axes', kg_jLine: 'lines, borders, grid',
    kg_jSel: 'selected, timing marks, main action', kg_jSelbg: 'background of what is selected', kg_jOk: 'connected, done, within target', kg_jLent: 'slower, refused',
    kg_jAtt: 'action needed (orange reserved)', kg_jTab: 'background of fields and tiles', kg_jTrait: 'speed curve', kg_jCmp: 'compared run (dashed)',
    kg_jGcol: 'accelerometer G', kg_jDoux: 'background of a “done” tile', kg_jDouxAtt: 'background of a “to do” tile', kg_jZone: 'before the start (charts)'
  });
  var prefs = new DLC.Prefs('dlxKG_prefs', { langue: null, unite: null, theme: 'light' });
  DLC.brancher(prefs);
  DLI18n.choisir(prefs.v.langue);
  DLC.poserTheme(prefs.v.theme);

  var RUNS = window.DL_DEMO_RUNS || [];
  function run(id) { return RUNS.filter(function (r) { return r.id === id; })[0]; }
  var RPLEIN = run('demo-1'), RLEVE = run('demo-2'), RLENT = run('demo-3');

  // ---- couleurs : la valeur en clair ET en sombre, lue dans b.css (le theme est pose puis remis)
  var JETONS = [['--bg', 'kg_jBg'], ['--card', 'kg_jCard'], ['--ink', 'kg_jInk'], ['--muted', 'kg_jMuted'], ['--line', 'kg_jLine'],
                ['--sel', 'kg_jSel'], ['--selbg', 'kg_jSelbg'], ['--ok', 'kg_jOk'], ['--lent', 'kg_jLent'], ['--att', 'kg_jAtt'],
                ['--tab', 'kg_jTab'], ['--trait', 'kg_jTrait'], ['--cmp', 'kg_jCmp'], ['--gcol', 'kg_jGcol'], ['--doux', 'kg_jDoux'],
                ['--doux-att', 'kg_jDouxAtt'], ['--zone', 'kg_jZone']];
  function lire(theme) {
    var html = document.documentElement, avant = html.getAttribute('data-theme');
    html.setAttribute('data-theme', theme);
    var cs = getComputedStyle(html), v = {};
    JETONS.forEach(function (j) { v[j[0]] = cs.getPropertyValue(j[0]).trim(); });
    if (avant == null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', avant);
    return v;
  }
  function nuancier() {
    var c = lire('light'), s = lire('dark');
    $('kgNuancier').innerHTML = JETONS.map(function (j) {
      return '<div class="kg-nuance"><span class="kg-deux"><i data-c="' + c[j[0]] + '"></i><i data-c="' + s[j[0]] + '"></i></span><b>' + j[0] +
             '</b><span>' + T(j[1]) + '</span><code>' + T('kg_clair') + ' ' + c[j[0]] + ' · ' + T('kg_sombre') + ' ' + s[j[0]] + '</code></div>';
    }).join('');
    // couleur posee par le CSSOM (permis par la politique de securite), jamais par un attribut style
    $('kgNuancier').querySelectorAll('i[data-c]').forEach(function (i) { i.style.background = i.getAttribute('data-c'); });
  }

  // ---- exemples remplis avec le run de demonstration du 3 oct.
  function listeJal(id, jal, vient) {
    $(id).innerHTML = DLC.JALONS.map(function (k) {
      var j = jal && jal[k];
      return '<li' + (vient === k ? ' class="vient"' : '') + '><span class="l">' + T('j' + k) + '</span><span class="v num">' +
             (j && j.v ? DLC.nf(DLC.vit(j.v), 1) + ' ' + DLC.unite() : '') + '</span><span class="t num">' + (j ? DLC.sec(j.t) : '--') + '</span></li>';
    }).join('');
  }
  function exemples() {
    document.querySelectorAll('.kgU').forEach(function (e) { e.textContent = DLC.unite(); });
    $('kgVit').textContent = DLC.nf(DLC.vit(288.5), 0);
    $('kgTuileRuns').textContent = T('b_nbRuns', { n: 3, t: DLC.sec(RPLEIN.jalons['1320'].t) });
    listeJal('kgJalVide', null);
    listeJal('kgJalCourse', { '60': RPLEIN.jalons['60'], '330': RPLEIN.jalons['330'] }, '330');
    listeJal('kgJalPlein', RPLEIN.jalons);
    var lignes = [[RLEVE, false, null], [RPLEIN, true, 'hors'], [RLENT, false, 'ok']];
    $('kgLignes').innerHTML = lignes.map(function (l, i) {
      var r = l[0], f = r.jalons['1320'];
      return '<div class="b-ligne' + (l[1] ? ' choisi' : '') + '"><span class="q">' + (3 - i) + ' · ' + DLC.quand(r.quand) +
             (l[2] ? '<span class="b-pastille ' + l[2] + '">' + (l[2] === 'ok' ? '4/4' : '3/4') + '</span>' : '') + '</span><span class="vf num">' +
             DLC.nf(DLC.vit(f.v), 1) + ' ' + DLC.unite() + '</span><span class="et num">' + DLC.sec(f.t) + '</span></div>';
    }).join('');
    var c = DLC.comparerTicket(RPLEIN, DLC.TICKETS_DEMO['demo-1']);
    $('kgTkCorps').innerHTML = c.temps.map(function (x) {
      return '<tr><td>' + T('j' + x.k) + '</td><td class="n num">' + DLC.nf(x.kit, 3) + '</td><td class="n num">' + DLC.nf(x.tk, 3) +
             '</td><td class="n num">' + (x.e >= 0 ? '+' : '−') + DLC.nf(Math.abs(x.e), 3) + '</td><td class="n"><span class="marque ' + x.cl + '">' + (x.cl === 'ok' ? '✓' : x.cl === 'proche' ? '≈' : '!') + '</span></td></tr>';
    }).concat(c.vitesses.map(function (x) {
      return '<tr><td>' + T('b_vitLab', { d: T('j' + x.k) }) + '</td><td class="n num">' + DLC.nf(x.kit, 2) + '</td><td class="n num">' + DLC.nf(x.tk, 2) +
             '</td><td class="n num">' + (x.pc >= 0 ? '+' : '−') + DLC.nf(Math.abs(x.pc), 1) + ' %</td><td></td></tr>';
    })).join('');
    $('kgTkBilan').textContent = T('b_bilan', { n: c.nOk, m: c.nTot });
    $('kgTkConseil').textContent = T('b_conseil60');
    $('kgErr').textContent = T('formErr', { x: T('jpoNom') + ' : −120 … 36' });
    var l = [[T('fNom'), 'DRAGLOG_DEMO'], [T('fFw'), 'PT2.1.56'], [T('fMode'), T('modeDemo')], [T('fGps'), T('gpsTxt', { s: 14, hz: 25 })], [T('fCal'), T('faite')]];
    $('kgFiche').innerHTML = l.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('');
    DLC.majPieds('jpo');
  }
  DLC.brancherPas(document);

  // ---- graphiques : le moteur de l'application, les runs de demonstration
  function nouvelle(id, h, axe, lectureId, cmp) {
    return new DLGraph.Courbe($(id), { hauteur: h, xFmt: function (v) { return DLC.nf(v, axe === 'd' ? 0 : 1); },
      gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G',
      curseur: !!lectureId, surCurseur: lectureId ? function (info) { $(lectureId).textContent = DLC.lecture(info, axe, cmp); } : null });
  }
  var gDirect = nouvelle('kgCvDirect', 190, 't'), gTemps = nouvelle('kgCvTemps', 250, 't', 'kgLecTemps', false),
      gDist = nouvelle('kgCvDist', 250, 'd'), gCmp = nouvelle('kgCvCmp', 250, 't', 'kgLecCmp', true);
  gDirect.o.xFmt = function (v) { return DLC.nf(v, 0) + ' s'; };
  function graphiques() {
    var fin = RPLEIN.ech[RPLEIN.ech.length - 1][0], x = [], v = [], g = [];
    RPLEIN.ech.forEach(function (e) { if (e[0] >= fin - 10000) { x.push((e[0] - fin) / 1000); v.push(DLC.vit(e[1])); g.push(e[3]); } });
    [gDirect, gTemps, gDist, gCmp].forEach(function (c) { c.o.gTitre = DLC.unite(); });
    gDirect.donnees({ xMin: -10, xMax: 0, gMin: 0, dSym: true, series: [{ x: x, y: v, axe: 'g', couleur: '--trait', largeur: 2.2 }, { x: x, y: g, axe: 'd', couleur: '--gcol', largeur: 1.5 }] });
    gTemps.o.xTitre = T('xTitreT'); gTemps.donnees(DLC.donneesRun(RPLEIN, null, 't'));
    gDist.o.xTitre = T('xTitreD'); gDist.donnees(DLC.donneesRun(RPLEIN, null, 'd'));
    gCmp.o.xTitre = T('xTitreT'); gCmp.donnees(DLC.donneesRun(RPLEIN, RLEVE, 't'));
    $('kgLecTemps').textContent = T('lectureAide'); $('kgLecCmp').textContent = T('lectureAide');
  }

  // ---- les 5 ecrans en direct (?apercu=1 : rien n'est ecrit dans l'appareil)
  var ECRANS = [['accueil', 'b_accueil'], ['courir', 'b_courir'], ['runs', 'bRuns'], ['ticket', 'kg_ticketCourt'], ['regler', 'b_regler']];
  function ecrans() {
    var z = 0.72, w = 390, h = 844;
    $('kgEcrans').innerHTML = ECRANS.map(function (e) {
      var url = 'index.html?demo=1&apercu=1&vue=' + e[0] + '&lang=' + DLI18n.langue() + (prefs.v.theme !== 'auto' ? '&theme=' + prefs.v.theme : '');
      return '<div class="kg-ecran"><b>' + T(e[1]) + '</b><div class="kg-tel"><iframe title="' + T(e[1]) + '" src="' + url + '"></iframe></div>' +
             '<a href="' + url + '" target="_blank" rel="noopener">' + T('kg_ouvrir') + '</a></div>';
    }).join('');
    $('kgEcrans').querySelectorAll('.kg-tel').forEach(function (t) {
      var f = t.querySelector('iframe');
      f.style.width = w + 'px'; f.style.height = h + 'px'; f.style.transform = 'scale(' + z + ')';
      t.style.width = Math.round(w * z) + 14 + 'px'; t.style.height = Math.round(h * z) + 14 + 'px';
    });
  }

  function tout() { DLI18n.appliquer(); nuancier(); exemples(); graphiques(); ecrans(); }
  DLC.segment('kgTheme', prefs.v.theme, function (v) { prefs.v.theme = v; prefs.garder(); DLC.poserTheme(v); nuancier(); graphiques(); ecrans(); });
  DLC.segment('kgLangue', prefs.v.langue, function (v) { prefs.v.langue = v; prefs.garder(); DLI18n.choisir(v); DLC.viderCache(); tout(); });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { graphiques(); }); }
  tout();
})();
