'use strict';
// MAQUETTE E « PISTE » : LA NAVIGATION (21 oct.). Ce fichier ne fait QUE la navigation et l'etat du tableau de
// chrono : la logique de l'app est celle de B (maquettes/b/b.js), inchangee.
//   - l'ecran GO remplace l'accueil : si b.js montre l'accueil, on passe a GO ;
//   - Runs et Reglages ont une page racine (la liste, le menu) et des sous-pages : une ligne ouvre sa page, le chevron
//     de la bande revient a la racine ; retoucher l'onglet de l'ecran montre revient aussi a la racine ;
//   - la bande porte le titre de l'ecran ou de la sous-page ; l'onglet du bas actif suit l'ecran montre ;
//   - le menu des reglages montre la valeur de chaque page (relue dans ses champs) ;
//   - le tableau de chrono de l'ecran GO suit l'etat du chrono (classes du bandeau de b.js) et la connexion (pilule
//     de b.js) ; sa barre de piste suit les jalons passes. [21 oct.] Plus d'anneau : un tableau de chrono.
(function () {
  var $ = function (id) { return document.getElementById(id); }, T = DLI18n.T;
  var titre = $('eTitre'), retour = $('eRetour');
  var RACINE = { runs: 'pRuListe', regler: 'pReMenu' };
  var ouverte = { runs: null, regler: null };          // la sous-page ouverte de chaque ecran (id), ou null
  var TITRES = { courir: '', runs: 'e_tRuns', ticket: 'e_tTicket', regler: 'e_tRegler' };
  function cacher(el, v) { if (el && el.hidden !== v) el.hidden = v; }   // seulement si ca change : pas de boucle
  function vueActive() { var s = document.querySelector('main > .vue:not([hidden])'); return s ? s.id.slice(2) : null; }
  function texte(el) { return el ? el.textContent.trim() : ''; }
  function choix(sel) { return sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].textContent.trim() : ''; }
  function segOn(id) { var b = document.querySelector('#' + id + ' button.on'); return texte(b); }

  function ouvrir(vue, page) { ouverte[vue] = page; window.scrollTo(0, 0); rendre(); }
  function fermer(vue) { if (ouverte[vue]) { ouverte[vue] = null; window.scrollTo(0, 0); rendre(); } }

  // les valeurs grises du menu des reglages
  function valeurs() {
    var v = {};
    v.veh = !$('bVehEtape').hidden ? [segOn('segVeh'), texte($('bDepVal'))].filter(Boolean).join(' · ') : ($('f-rpo').value ? $('f-rpo').value + ' po' : '');
    v.ecu = choix($('bEcu'));
    v.kit = [$('f-sfx').value, choix($('f-grate'))].filter(Boolean).join(' · ');
    v.idx = choix($('f-idxon'));
    v.app = [segOn('segLangue'), segOn('segUnite')].filter(Boolean).join(' · ');
    var m = /\d+\.\d+\.\d+/.exec(texte($('bVersion'))); v.version = m ? m[0] : '';
    document.querySelectorAll('[data-val]').forEach(function (el) { var t = v[el.getAttribute('data-val')] || ''; if (el.textContent !== t) el.textContent = t; });
  }

  function rendre() {
    var v = vueActive();
    if (v === 'accueil') { var go = document.querySelector('.b-barre [data-vue="courir"]'); if (go) go.click(); return; }
    if (document.body.getAttribute('data-vue') !== v) document.body.setAttribute('data-vue', v || '');
    var avecKit = !$('bRegCorps').hidden;
    // une sous-page du kit n'a plus de sens sans kit : retour au menu
    if (ouverte.regler && !avecKit && $(ouverte.regler).classList.contains('e-page-kit')) ouverte.regler = null;
    Object.keys(RACINE).forEach(function (vv) {
      var p = ouverte[vv];
      document.querySelectorAll('#v-' + vv + ' .e-page').forEach(function (pg) { cacher(pg, p ? pg.id !== p : pg.id !== RACINE[vv]); });
    });
    var p = ouverte[v];
    var t = !p ? (TITRES[v] ? T(TITRES[v]) : '')
          : p === 'pRuDetail' ? (texte($('bDetailTitre')) || T('e_tRun'))
          : texte(document.querySelector('[data-page="' + p + '"] .e-nom'));
    if (titre.textContent !== t) titre.textContent = t;
    cacher(retour, !p);
    // l'onglet du bas : b.js allume « Runs » pour le ticket ; ici le ticket a son onglet
    document.querySelectorAll('.b-barre [data-vue]').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-vue') === v); });
    cacher($('eEnvoi'), !(v === 'regler' && p && $(p).classList.contains('e-page-kit')));
    document.querySelectorAll('.e-kit-seul').forEach(function (el) { cacher(el, !avecKit); });
    cacher($('eLigneIdx'), $('bIdxEtape').hidden);
    valeurs(); anneau();
  }

  // le tableau de chrono et le bandeau : la connexion vient de la pilule, l'etat du chrono des classes du bandeau (b.js)
  function anneau() {
    var con = $('bPilule').classList.contains('on'), b = $('bBandeau'), e = 'off';
    if (con) e = ['course', 'fini', 'pret', 'att'].filter(function (c) { return b.classList.contains(c); })[0] || 'attente';
    if ($('eTableau').getAttribute('data-etat') !== e) $('eTableau').setAttribute('data-etat', e);
    document.body.classList.toggle('e-connecte', con);
    // sans kit, le bandeau devient le bouton « Connecter » (b.js n'y ecrit plus rien tant qu'aucun kit ne parle)
    if (!con && b.textContent !== T('bConnecter')) b.textContent = T('bConnecter');
    piste(e === 'course');
  }
  // la barre de piste : un troncon est plein quand b.js a ecrit le temps de son jalon dans la liste (#bJal, meme ordre
  // 60 / 330 / 1/8 / 1/4) ; pendant le run, le premier troncon pas encore passe bat
  function piste(enCourse) {
    var t = Array.prototype.map.call(document.querySelectorAll('#bJal li .t'), function (x) { return /\d/.test(x.textContent); });
    var premier = t.indexOf(false);
    document.querySelectorAll('#ePiste .e-troncon').forEach(function (tr, i) {
      tr.classList.toggle('passe', !!t[i]);
      tr.classList.toggle('en-cours', enCourse && i === premier);
    });
  }
  function ouvrirConnexion() { if (!$('bPilule').classList.contains('on')) $('bPilule').click(); }
  $('eTableau').addEventListener('click', ouvrirConnexion);
  $('bBandeau').addEventListener('click', ouvrirConnexion);

  // les lignes du menu ouvrent leur page ; un run de la liste ouvre sa page ; le chevron revient
  document.querySelectorAll('#pReMenu [data-page]').forEach(function (l) {
    l.addEventListener('click', function () { ouvrir('regler', l.getAttribute('data-page')); });
  });
  $('bListe').addEventListener('click', function (ev) { if (ev.target.closest('.b-ligne')) setTimeout(function () { ouvrir('runs', 'pRuDetail'); }, 60); });
  retour.addEventListener('click', function () { fermer(vueActive()); });
  // retoucher l'onglet de l'ecran montre = revenir a sa racine (capture : avant l'ecouteur de b.js sur le bouton)
  document.querySelector('.b-barre').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-vue]'); if (b && b.getAttribute('data-vue') === vueActive()) fermer(vueActive());
  }, true);
  // le ticket : apres « Comparer », on descend au resultat
  $('bComparer').addEventListener('click', function () {
    setTimeout(function () { if (!$('bResultat').hidden) $('bResultat').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  });
  // les valeurs du menu suivent ce qui change dans le formulaire
  $('bForm').addEventListener('change', function () { setTimeout(valeurs, 30); });
  $('bForm').addEventListener('click', function () { setTimeout(valeurs, 30); });

  var prevu = false;
  function bientot() { if (prevu) return; prevu = true; requestAnimationFrame(function () { prevu = false; rendre(); }); }
  // b.js montre et cache des blocs (ecran, kit, index, run) et change le bandeau et la pilule : on suit
  new MutationObserver(bientot).observe(document.querySelector('main'), { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(bientot).observe($('bBandeau'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(bientot).observe($('bPilule'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(bientot).observe($('bDetailTitre'), { childList: true, characterData: true, subtree: true });
  // b.js recrit la liste des jalons a chaque jalon passe (et au rearmement) : la barre de piste suit
  new MutationObserver(function () { piste($('eTableau').getAttribute('data-etat') === 'course'); }).observe($('bJal'), { childList: true });
  rendre();
})();
