'use strict';
// MAQUETTE D « BRUT » : LES ONGLETS QUI GLISSENT (21 oct.). Dans chaque ecran, les blocs sont ranges cote a cote
// (.d-panneau dans une .d-glisse) : on glisse du doigt, ou on touche l'onglet. Moins de defilement vertical.
// Ce fichier ne fait QUE la navigation entre panneaux : la logique de l'app est celle de B (../b/b.js), inchangee.
//   - un onglet suit son panneau : un panneau cache par b.js, ou dont tous les blocs sont caches, n'a pas d'onglet ;
//     les numeros (01, 02...) se suivent sur les onglets restants ;
//   - la hauteur de la piste suit le panneau montre ; pendant le glisser, la plus grande des deux hauteurs ;
//   - quelques gestes menent au bon panneau : choisir un run -> ses temps ; la lecture du ticket finie -> les temps ;
//     « Comparer » -> le resultat ; « Comparer ce run au ticket » -> la photo ;
//   - « Envoyer au kit » se cache sur le panneau Application (data-envoi="non") et sans kit.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var doux = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pistes = [];

  function cache(el) { for (var p = el; p && p !== document.body; p = p.parentElement) if (p.hidden) return true; return false; }
  // un panneau compte s'il est visible ET qu'au moins un de ses blocs l'est
  function present(pan) {
    if (cache(pan)) return false;
    return Array.prototype.some.call(pan.children, function (c) { return !c.hidden; });
  }

  function Piste(nav, glisse) {
    var moi = this;
    this.nav = nav; this.glisse = glisse; this.actif = null; this.auto = false;
    this.onglets = Array.prototype.slice.call(nav.querySelectorAll('[data-panneau]'));
    this.onglets.forEach(function (o) {
      if (!$(o.getAttribute('data-panneau'))) console.error('[D] onglet sans panneau : ' + o.getAttribute('data-panneau'));
      o.addEventListener('click', function () { moi.aller(o.getAttribute('data-panneau'), true); });
    });
    var fin = null;
    glisse.addEventListener('scroll', function () {
      if (moi.auto) return;                       // un aller() programme : on attend qu'il finisse
      moi.suivre(false);
      clearTimeout(fin); fin = setTimeout(function () { moi.suivre(true); }, 120);
    }, { passive: true });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { if (!moi.auto) moi.hauteur(false); });
      this.panneaux().forEach(function (p) { ro.observe(p); });
    }
    // ⚠ l'evenement « scroll » manque parfois (vu au banc dans le navigateur de l'app, 21 oct. : 1 glisser sur 4 sans
    // aucun evenement). Le panneau visible aux deux tiers devient aussi le panneau montre par cet observateur.
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (l) {
        l.forEach(function (e) {
          if (moi.auto || !e.isIntersecting || e.intersectionRatio < 0.66 || e.target === moi.actif || !present(e.target)) return;
          moi.actif = e.target; moi.marquer(); moi.hauteur(false);
        });
      }, { root: glisse, threshold: [0.66, 1] });
      this.panneaux().forEach(function (p) { io.observe(p); });
    }
  }
  Piste.prototype.panneaux = function () { return Array.prototype.slice.call(this.glisse.querySelectorAll('.d-panneau')); };
  Piste.prototype.visibles = function () { return this.panneaux().filter(present); };
  Piste.prototype.rafraichir = function () {
    var vis = this.visibles(), n = 0;
    this.onglets.forEach(function (o) {
      var p = $(o.getAttribute('data-panneau')), ok = !!p && vis.indexOf(p) >= 0;
      if (o.hidden !== !ok) o.hidden = !ok;      // seulement si ca change : l'observateur ne doit pas boucler
      var i = o.querySelector('i');
      if (ok) { var t = String(++n); if (t.length < 2) t = '0' + t; if (i.textContent !== t) i.textContent = t; }
    });
    var seul = vis.length < 2;
    if (this.nav.hidden !== seul) this.nav.hidden = seul;   // un seul panneau : pas de rangee d'onglets
    if (!this.actif || vis.indexOf(this.actif) < 0) { this.actif = vis[0] || null; this.placer(); }
    var f = this.glisse.closest('form'), corps = f && $('bRegCorps');
    if (corps) f.classList.toggle('d-sans-kit', corps.hidden);
    this.marquer(); this.hauteur(false);
  };
  Piste.prototype.placer = function () { if (this.actif) this.glisse.scrollLeft = this.actif.offsetLeft; };
  Piste.prototype.marquer = function () {
    var id = this.actif && this.actif.id, nav = this.nav;
    this.onglets.forEach(function (o) {
      var on = o.getAttribute('data-panneau') === id;
      o.classList.toggle('on', on); o.setAttribute('aria-selected', on ? 'true' : 'false');
      // l'onglet montre reste dans la rangee (elle defile de cote si elle est plus large que l'ecran)
      if (on && !o.hidden) {
        if (o.offsetLeft < nav.scrollLeft) nav.scrollLeft = o.offsetLeft;
        else if (o.offsetLeft + o.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = o.offsetLeft + o.offsetWidth - nav.clientWidth;
      }
    });
    var f = this.glisse.closest('form');
    if (f) f.classList.toggle('d-sans-envoi', !!(this.actif && this.actif.getAttribute('data-envoi') === 'non'));
  };
  Piste.prototype.hauteur = function (large) {
    if (!this.actif) { this.glisse.style.height = ''; return; }
    var h = this.actif.offsetHeight;
    if (large) {
      var x = this.glisse.scrollLeft, w = this.glisse.clientWidth;
      this.visibles().forEach(function (p) { if (p.offsetLeft < x + w && p.offsetLeft + p.offsetWidth > x) h = Math.max(h, p.offsetHeight); });
    }
    var v = h + 'px';
    if (this.glisse.style.height !== v) this.glisse.style.height = v;
  };
  // le panneau le plus proche de la position de la piste devient le panneau montre
  Piste.prototype.suivre = function (arret) {
    var x = this.glisse.scrollLeft, best = null, d = Infinity;
    this.visibles().forEach(function (p) { var e = Math.abs(p.offsetLeft - x); if (e < d) { d = e; best = p; } });
    if (best && best !== this.actif) { this.actif = best; this.marquer(); }
    this.hauteur(!arret);
  };
  Piste.prototype.aller = function (id, anime) {
    var p = $(id), moi = this;
    if (!p || !present(p)) return;
    this.actif = p; this.marquer(); this.hauteur(true);
    this.auto = true;
    this.glisse.scrollTo({ left: p.offsetLeft, behavior: anime && doux ? 'smooth' : 'auto' });
    clearTimeout(this.tAuto);
    this.tAuto = setTimeout(function () { moi.auto = false; moi.placer(); moi.hauteur(false); }, anime && doux ? 420 : 30);
    // l'ecran remonte au debut du panneau (s'il etait plus bas), sous la rangee d'onglets collee en haut
    var y = this.glisse.getBoundingClientRect().top + window.scrollY - this.nav.offsetHeight - 16;
    if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
  };

  document.querySelectorAll('.d-onglets').forEach(function (nav) {
    var g = nav.nextElementSibling;
    if (!g || !g.classList.contains('d-glisse')) { console.error('[D] .d-onglets sans .d-glisse juste apres', nav); return; }
    pistes.push(new Piste(nav, g));
  });
  function tout() { pistes.forEach(function (p) { p.rafraichir(); }); }
  var prevu = false;
  function bientot() { if (prevu) return; prevu = true; requestAnimationFrame(function () { prevu = false; tout(); }); }
  // b.js montre et cache des blocs (ecran choisi, run choisi, resultat, index...) : les onglets suivent
  new MutationObserver(function (l) {
    if (l.some(function (m) { return !(m.target.closest && m.target.closest('.d-onglets')); })) bientot();
  }).observe(document.querySelector('main'), { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', function () { pistes.forEach(function (p) { p.placer(); p.hauteur(false); }); });

  function pisteDe(id) { var p = $(id); return p ? pistes.filter(function (x) { return x.glisse.contains(p); })[0] : null; }
  function allerA(id) { var p = pisteDe(id); if (p) { p.rafraichir(); p.aller(id, true); } }
  // les gestes qui menent au bon panneau (apres le travail de b.js : ses ecouteurs sont poses avant les notres)
  $('bListe').addEventListener('click', function (e) { if (e.target.closest('.b-ligne')) setTimeout(function () { allerA('pRuTemps'); }, 60); });
  $('bVersTicket').addEventListener('click', function () { setTimeout(function () { allerA('pTkPhoto'); }, 60); });
  $('bComparer').addEventListener('click', function () { setTimeout(function () { if (!$('bResultat').hidden) allerA('pTkRes'); }, 60); });
  // la lecture du ticket est finie quand b.js montre le choix du couloir : on passe aux temps lus
  new MutationObserver(function () { if (!$('bOcrCoteL').hidden) setTimeout(function () { allerA('pTkTemps'); }, 500); })
    .observe($('bOcrCoteL'), { attributes: true, attributeFilter: ['hidden'] });

  // la photo du ticket, en bandeau au-dessus des cases des temps (on verifie les chiffres lus sans changer de panneau)
  var img = $('bPhotoImg'), fig = $('bPhotoFig'), mini = $('dPhotoMini'), miniImg = $('dPhotoMiniImg');
  function copierPhoto() {
    var s = img.getAttribute('src');
    var sans = fig.hidden || !s;
    if (mini.hidden !== sans) mini.hidden = sans;
    if (s && miniImg.getAttribute('src') !== s) { miniImg.src = s; miniImg.alt = img.alt; }
  }
  new MutationObserver(copierPhoto).observe(img, { attributes: true, attributeFilter: ['src'] });
  new MutationObserver(copierPhoto).observe(fig, { attributes: true, attributeFilter: ['hidden'] });
  mini.addEventListener('click', function () { mini.classList.toggle('grand'); });

  tout();
})();
