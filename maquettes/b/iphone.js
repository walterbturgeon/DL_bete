'use strict';
// APERCU TELEPHONE DE LA MAQUETTE B (outil de mise au point, pas l'application) : iPhone ET Android.
// Tailles d'ecran en points iOS / dp Android, en portrait. haut / bas = zones sures donnees a une app plein ecran.
// [7 oct.] Android ajoute (demande du 7 oct.) : « l'app sous Android, modeles les plus populaires en Amerique du
// Nord depuis 3 ans ». Ventes US (Counterpoint, mars 2025) : Galaxy S25 Ultra et Galaxy A16 5G en tete d'Android ;
// en 2024 : S24 et A15. Pixel loin derriere (garde comme reference Google).
// ⚠ Tailles : yesviz.com (S25 Ultra 412x891, S23/S24/S25 360x780, Pixel 7/8/8a 412x915). A15/A16 : ESTIMEE comme
//   l'A35/A54/A55 (meme dalle 1080x2340, 412x892). Barres Android ESTIMEES : etat ~32 dp (Samsung) / ~40 dp (Pixel),
//   navigation 24 dp en gestes, 48 dp en 3 boutons (Android 12+). L'app reelle lira les vraies valeurs a l'execution.
(function () {
  var MODELES = {
    '15':     { nom: 'iPhone 15 / 16',            os: 'ios', w: 393, h: 852, haut: 59, bas: 34, ile: true,  coin: 55 },
    '16pro':  { nom: 'iPhone 16 Pro',             os: 'ios', w: 402, h: 874, haut: 62, bas: 34, ile: true,  coin: 55 },
    'plus':   { nom: 'iPhone 15/16 Plus',         os: 'ios', w: 430, h: 932, haut: 59, bas: 34, ile: true,  coin: 55 },
    'se':     { nom: 'iPhone SE',                 os: 'ios', w: 375, h: 667, haut: 20, bas: 0,  ile: false, coin: 0 },
    's25u':   { nom: 'Galaxy S25 Ultra',          os: 'android', w: 412, h: 891, haut: 32, coin: 22, trou: 'rond' },
    's24':    { nom: 'Galaxy S23 / S24 / S25',    os: 'android', w: 360, h: 780, haut: 32, coin: 36, trou: 'rond' },
    'a16':    { nom: 'Galaxy A15 / A16 (taille estimée)', os: 'android', w: 412, h: 892, haut: 32, coin: 30, trou: 'goutte' },
    'pixel8': { nom: 'Pixel 7 / 8 / 8a',          os: 'android', w: 412, h: 915, haut: 40, coin: 44, trou: 'rond' }
  };
  var CHOIX = {
    ipModele:  [['15', 'iPhone 15/16'], ['16pro', '16 Pro'], ['plus', 'Plus'], ['se', 'SE']],
    ipModeleA: [['s25u', 'S25 Ultra'], ['s24', 'S24/S25'], ['a16', 'A15/A16'], ['pixel8', 'Pixel 8']],
    ipNav:     [['gestes', 'Gestes'], ['boutons', '3 boutons']],
    ipVue:     [['accueil', 'Accueil'], ['courir', 'Courir'], ['runs', 'Runs'], ['ticket', 'Ticket'], ['regler', 'Régler']],
    ipKit:     [['demo', 'Kit démo'], ['aucun', 'Sans kit']],
    ipEchelle: [['ajuste', 'Ajusté'], ['reel', '100 %']]
  };
  var CLES = { ipModele: 'modele', ipModeleA: 'modele', ipNav: 'nav', ipVue: 'vue', ipKit: 'kit', ipEchelle: 'echelle' };
  var CADRE = 12;

  // ⚠ Le stockage peut manquer (navigation privee) : l'outil marche sans.
  var CLE = 'dlxIP_prefs';
  var etat = { modele: '15', nav: 'gestes', vue: 'accueil', kit: 'demo', echelle: 'ajuste' };
  try { var lu = JSON.parse(localStorage.getItem(CLE) || '{}'); Object.keys(etat).forEach(function (k) { if (lu[k] != null) etat[k] = lu[k]; }); } catch (e) {}
  if (!MODELES[etat.modele]) etat.modele = '15';
  function garder() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  var app = $('ipApp'), tel = $('ipTel'), ecran = $('ipEcran'), boite = $('ipBoite'), barreEtat = $('ipEtat'),
      ile = $('ipIle'), trou = $('ipTrou'), accueil = $('ipAccueil'), nav3 = $('ipNav3');

  var SIG = '<svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
  var WIFI = '<svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 11.6 5.7 9.2a3.3 3.3 0 0 1 4.6 0Z"/><path d="M3.5 7a6.4 6.4 0 0 1 9 0l-1.4 1.4a4.4 4.4 0 0 0-6.2 0Z"/><path d="M1.3 4.8a9.5 9.5 0 0 1 13.4 0l-1.4 1.4a7.5 7.5 0 0 0-10.6 0Z"/></svg>';
  var BAT = '<svg viewBox="0 0 27 12" width="27" height="12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="8" rx="1.8"/><path d="M25 4v4a2 2 0 0 0 0-4Z" opacity=".4"/></svg>';
  // Android : signal en triangle, batterie verticale
  var SIG_A = '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M12 0v12H0Z"/></svg>';
  var BAT_A = '<svg viewBox="0 0 8 13" width="8" height="13"><rect x="2.5" y="0" width="3" height="1.5" rx=".5"/><rect x="0" y="1.2" width="8" height="11.8" rx="1.5"/></svg>';
  function etatHTML(m) {
    if (m.os === 'android') return '<span class="g">9:41</span><span></span><span class="d">' + WIFI + SIG_A + BAT_A + '</span>';
    return m.ile ? '<span class="g">9:41</span><span></span><span class="d">' + SIG + WIFI + BAT + '</span>'
                 : '<span class="g">' + SIG + WIFI + '</span><span class="c">9:41</span><span class="d">' + BAT + '</span>';
  }
  function bas(m) { return m.os === 'android' ? (etat.nav === 'boutons' ? 48 : 24) : m.bas; }

  function marquer() {
    Object.keys(CLES).forEach(function (id) {
      $(id).querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === etat[CLES[id]]); });
    });
  }
  function charger() {
    var m = MODELES[etat.modele];
    var q = ['sa=' + m.haut + ',' + bas(m), 'vue=' + etat.vue];
    if (etat.kit === 'demo') q.push('demo=1');
    pret = false;
    app.src = 'index.html?' + q.join('&');
  }
  // ⚠ Pendant un rechargement, l'ancienne page (ou la nouvelle avant b.js) montre l'Accueil : on ne suit l'ecran
  // qu'apres l'evenement load, sinon le choix « Regler » etait remplace par « Accueil ».
  var pret = false;
  app.addEventListener('load', function () {
    pret = true;
    // un telephone n'a pas de barre de defilement qui prend de la place : on retire celle de l'ordinateur (15 px)
    try { app.contentDocument.documentElement.style.scrollbarWidth = 'none'; } catch (e) {}
  });
  function poser() {
    var m = MODELES[etat.modele], W = m.w + 2 * CADRE, H = m.h + 2 * CADRE, andro = m.os === 'android';
    tel.style.width = W + 'px'; tel.style.height = H + 'px'; tel.style.borderRadius = (m.coin ? m.coin + CADRE : 40) + 'px';
    ecran.style.width = m.w + 'px'; ecran.style.height = m.h + 'px'; ecran.style.borderRadius = m.coin + 'px';
    app.style.width = m.w + 'px'; app.style.height = m.h + 'px';
    barreEtat.className = 'ip-etat' + (andro ? ' android' : m.ile ? '' : ' se'); barreEtat.innerHTML = etatHTML(m);
    if (andro) barreEtat.style.height = m.haut + 'px'; else barreEtat.style.height = '';
    ile.hidden = !m.ile;
    trou.hidden = !andro; trou.className = 'ip-trou' + (m.trou === 'goutte' ? ' goutte' : '');
    // en bas : barre d'accueil iOS, ou trait des gestes Android, ou les 3 boutons Android
    accueil.hidden = andro ? etat.nav === 'boutons' : !m.bas;
    accueil.className = 'ip-accueil' + (andro ? ' android' : '');
    nav3.hidden = !(andro && etat.nav === 'boutons');
    $('ipNav').hidden = !andro;
    var dispoH = window.innerHeight - $('ipTete').offsetHeight - 32, dispoL = window.innerWidth - 32;
    var k = etat.echelle === 'reel' ? 1 : Math.max(0.3, Math.min(1, dispoH / H, dispoL / W));
    tel.style.transform = 'scale(' + k + ')';
    boite.style.width = Math.round(W * k) + 'px'; boite.style.height = Math.round(H * k) + 'px';
    $('ipInfo').textContent = m.nom + ' · ' + m.w + ' × ' + m.h + (andro ? ' dp · barres ' : ' pt · zones sûres ') + m.haut + ' / ' + bas(m) +
                              (andro ? ' (estimées)' : '') + ' · ' + Math.round(k * 100) + ' %';
  }

  Object.keys(CHOIX).forEach(function (id) {
    CHOIX[id].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-v', p[0]); b.textContent = p[1];
      b.addEventListener('click', function () {
        etat[CLES[id]] = p[0]; garder(); marquer();
        if (id === 'ipEchelle') poser(); else { if (id === 'ipModele' || id === 'ipModeleA' || id === 'ipNav') poser(); charger(); }
      });
      $(id).appendChild(b);
    });
  });
  $('ipRecharger').addEventListener('click', charger);
  window.addEventListener('resize', poser);

  // Suit l'application : couleur du texte des barres systeme, theme de l'outil, ecran montre (pour recharger au meme).
  var aviseErreur = false;
  function suivre() {
    var doc = null;
    try { doc = app.contentDocument; } catch (e) {
      if (!aviseErreur) { aviseErreur = true; console.error('[apercu telephone] lecture de l\'application impossible : ' + e.message); }
    }
    if (!doc || !doc.documentElement || !doc.body) return;
    var ink = getComputedStyle(doc.documentElement).getPropertyValue('--ink').trim();
    if (ink) { barreEtat.style.color = ink; accueil.style.background = ink; nav3.style.color = ink; }
    var th = doc.documentElement.getAttribute('data-theme');
    if (th) document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme');
    if (!pret) return;
    var v = doc.querySelector('section.vue:not([hidden])');
    if (v && v.id.indexOf('v-') === 0 && v.id.slice(2) !== etat.vue) { etat.vue = v.id.slice(2); garder(); marquer(); }
  }
  setInterval(suivre, 400);

  marquer(); poser(); charger();
})();
