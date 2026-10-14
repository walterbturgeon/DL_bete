'use strict';
// LE MODULE DE GRAPHIQUES COMMUN (maquette DRAGLOGICS v0.1).
// Un seul moteur pour le direct et pour les runs : axe X en temps ou en distance, deux axes Y (gauche et droite),
// series superposees, reperes verticaux (jalons), zone d'avant le depart, curseur au doigt ou a la souris.
// Canvas 2D net sur un ecran haute densite (devicePixelRatio). Les couleurs viennent des variables CSS du theme :
// une serie dit « --trait », le moteur lit la couleur au moment de dessiner (le canvas ne comprend pas var()).
// Origine : axes et graduations du visualiseur DLPT2 (31 aout), gestes de la page TRACLOGICS, reperes de la
// maquette E3B4 (30 sept.). Aucune bibliotheque externe.
window.DLGraph = (function () {
  function css(nom) {
    if (!nom || nom.charAt(0) !== '-') return nom || '#888';
    var v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    return v || '#888';
  }
  // Graduations « rondes » : pas de 1, 2, 2,5 ou 5 x 10^n, environ `cible` intervalles.
  function graduations(mn, mx, cible) {
    if (!(mx > mn)) mx = mn + 1;
    var brut = (mx - mn) / Math.max(1, cible), p = Math.pow(10, Math.floor(Math.log10(brut))), m = brut / p;
    var pas = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    var t = [], debut = Math.ceil(mn / pas - 1e-9);
    for (var i = 0; i < 200; i++) {
      var v = (debut + i) * pas;
      if (v > mx + pas * 1e-6) break;
      t.push(+v.toFixed(10));
    }
    return { pas: pas, t: t };
  }
  function arrondiHaut(v, pas) { return Math.ceil(v / pas) * pas; }
  // Premier indice dont x >= cible (x croissant).
  function chercher(x, cible) {
    var a = 0, b = x.length - 1;
    if (b < 0) return -1;
    while (a < b) { var m = (a + b) >> 1; if (x[m] < cible) a = m + 1; else b = m; }
    return a;
  }
  function interp(x, y, cible) {
    var i = chercher(x, cible);
    if (i < 0) return null;
    if (i === 0) return (x[0] === cible) ? y[0] : null;
    if (x[i] < cible) return null;
    var f = (cible - x[i - 1]) / (x[i] - x[i - 1]);
    if (y[i] == null || y[i - 1] == null) return null;
    return y[i - 1] + f * (y[i] - y[i - 1]);
  }

  // opts : hauteur (px CSS), xFmt(v), gFmt(v), dFmt(v), xTitre, gTitre, dTitre, curseur (bool), surCurseur(info|null)
  function Courbe(canvas, opts) {
    this.cv = canvas; this.o = opts || {}; this.d = null; this.cx = null; this.dpr = 1;
    var moi = this;
    if (window.ResizeObserver) new ResizeObserver(function () { moi.dessiner(); }).observe(canvas);
    if (this.o.curseur !== false) {
      var pos = function (ev) {
        var r = canvas.getBoundingClientRect(), px = ev.clientX - r.left;
        if (!moi.ech) return;
        var e = moi.ech, xv = e.x0 + (px - e.g) / (e.w) * (e.x1 - e.x0);
        if (px < e.g || px > e.g + e.w) { moi.curseur(null); return; }
        moi.curseur(xv);
      };
      canvas.addEventListener('pointerdown', function (ev) { pos(ev); });
      canvas.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse' || ev.buttons) pos(ev); });
      canvas.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') moi.curseur(null); });
    }
  }
  // d : { series:[{x:[], y:[], axe:'g'|'d', couleur:'--trait', largeur:2, tirets:[], nom}],
  //       reperes:[{x, texte}], zoneAvant:x (grise ce qui est avant x), xMin, xMax, gMin, gMax, dMin, dMax, dSym }
  Courbe.prototype.donnees = function (d) { this.d = d; this.dessiner(); };
  Courbe.prototype.curseur = function (xv) {
    this.cx = xv; this.dessiner();
    if (this.o.surCurseur) this.o.surCurseur(xv == null || !this.d ? null : this.lire(xv));
  };
  Courbe.prototype.lire = function (xv) {
    var out = { x: xv, valeurs: [] };
    (this.d.series || []).forEach(function (s) { out.valeurs.push({ nom: s.nom, axe: s.axe, couleur: s.couleur, y: interp(s.x, s.y, xv) }); });
    return out;
  };
  Courbe.prototype.dessiner = function () {
    var cv = this.cv, o = this.o, d = this.d;
    var W = cv.clientWidth || 300, H = o.hauteur || 240, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    }
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!d || !d.series || !d.series.length) { this.ech = null; return; }
    var aDroite = d.series.some(function (s) { return s.axe === 'd'; });
    var g = 46, dr = aDroite ? 46 : 12, h0 = 14, b = 30;
    if (o.nu) { g = 2; dr = 2; h0 = 3; b = 3; }   // [maquettes] « nu » = mini-courbe sans axes ni texte (liste des runs)
    var w = Math.max(10, W - g - dr), h = Math.max(10, H - h0 - b);
    // bornes en X : celles demandees, sinon l'etendue des series
    var x0 = d.xMin, x1 = d.xMax;
    if (x0 == null) x0 = Math.min.apply(null, d.series.map(function (s) { return s.x.length ? s.x[0] : Infinity; }));
    if (x1 == null) x1 = Math.max.apply(null, d.series.map(function (s) { return s.x.length ? s.x[s.x.length - 1] : -Infinity; }));
    if (!isFinite(x0)) x0 = 0;
    if (!(x1 > x0)) x1 = x0 + 1;
    // bornes en Y : seulement les points visibles
    var gmx = -Infinity, gmn = Infinity, dmx = -Infinity, dmn = Infinity;
    d.series.forEach(function (s) {
      for (var i = 0; i < s.x.length; i++) {
        var yv = s.y[i]; if (yv == null || s.x[i] < x0 || s.x[i] > x1) continue;
        if (s.axe === 'd') { if (yv > dmx) dmx = yv; if (yv < dmn) dmn = yv; } else { if (yv > gmx) gmx = yv; if (yv < gmn) gmn = yv; }
      }
    });
    var nb = Math.max(3, Math.round(h / 45));
    var g0 = d.gMin != null ? d.gMin : Math.min(0, isFinite(gmn) ? gmn : 0);
    var g1 = d.gMax != null ? d.gMax : (isFinite(gmx) ? gmx : 1);
    if (!(g1 > g0)) g1 = g0 + 1;
    var gt = graduations(g0, g1, nb);
    if (d.gMax == null) g1 = arrondiHaut(g1, gt.pas);
    if (d.gMin == null) g0 = Math.floor(g0 / gt.pas) * gt.pas;
    gt = graduations(g0, g1, nb);
    var d0 = 0, d1 = 1, dt = null;
    if (aDroite) {
      d0 = d.dMin != null ? d.dMin : (isFinite(dmn) ? dmn : -1);
      d1 = d.dMax != null ? d.dMax : (isFinite(dmx) ? dmx : 1);
      if (d.dSym) { var m = Math.max(Math.abs(d0), Math.abs(d1), 0.25); d0 = -m; d1 = m; }
      if (!(d1 > d0)) d1 = d0 + 1;
      dt = graduations(d0, d1, nb);
      if (d.dMin == null) d0 = Math.floor(d0 / dt.pas) * dt.pas;
      if (d.dMax == null) d1 = Math.ceil(d1 / dt.pas) * dt.pas;
      dt = graduations(d0, d1, nb);
    }
    this.ech = { g: g, w: w, x0: x0, x1: x1 };
    var X = function (v) { return g + (v - x0) / (x1 - x0) * w; };
    var YG = function (v) { return h0 + h - (v - g0) / (g1 - g0) * h; };
    var YD = function (v) { return h0 + h - (v - d0) / (d1 - d0) * h; };
    var cLigne = css('--line'), cMuet = css('--muted');
    c.font = '11px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    // zone d'avant le depart
    if (d.zoneAvant != null && d.zoneAvant > x0) {
      c.fillStyle = css('--zone'); c.fillRect(g, h0, Math.min(w, X(d.zoneAvant) - g), h);
    }
    // grille + graduations (pas dans une mini-courbe « nu »)
    if (!o.nu) {
    c.strokeStyle = cLigne; c.lineWidth = 1; c.fillStyle = cMuet;
    c.textAlign = 'right'; c.textBaseline = 'middle';
    gt.t.forEach(function (v) {
      var y = Math.round(YG(v)) + 0.5; c.beginPath(); c.moveTo(g, y); c.lineTo(g + w, y); c.stroke();
      c.fillText(o.gFmt ? o.gFmt(v) : String(v), g - 6, y);
    });
    if (dt) {
      c.textAlign = 'left';
      dt.t.forEach(function (v) { c.fillText(o.dFmt ? o.dFmt(v) : String(v), g + w + 6, YD(v)); });
      if (d0 < 0 && d1 > 0) { c.save(); c.setLineDash([2, 3]); c.strokeStyle = css('--gcol'); c.globalAlpha = .45;
        var yz = Math.round(YD(0)) + 0.5; c.beginPath(); c.moveTo(g, yz); c.lineTo(g + w, yz); c.stroke(); c.restore(); }
    }
    var xt = graduations(x0, x1, Math.max(3, Math.round(w / 90)));
    c.textAlign = 'center'; c.textBaseline = 'top';
    xt.t.forEach(function (v) {
      var x = Math.round(X(v)) + 0.5; c.beginPath(); c.moveTo(x, h0 + h); c.lineTo(x, h0 + h + 4); c.stroke();
      c.fillText(o.xFmt ? o.xFmt(v) : String(v), x, h0 + h + 7);
    });
    c.beginPath(); c.moveTo(g + .5, h0); c.lineTo(g + .5, h0 + h); c.lineTo(g + w, h0 + h + .5); c.stroke();
    // titres d'axes
    c.textBaseline = 'top';
    if (o.gTitre) { c.textAlign = 'left'; c.fillText(o.gTitre, 2, 0); }
    if (o.dTitre && aDroite) { c.textAlign = 'right'; c.fillStyle = css('--gcol'); c.fillText(o.dTitre, W - 2, 0); c.fillStyle = cMuet; }
    if (o.xTitre) { c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(o.xTitre, g + w, H); }
    }
    // reperes (jalons)
    var cSel = css('--sel');
    (d.reperes || []).forEach(function (r) {
      if (r.x < x0 || r.x > x1) return;
      var x = Math.round(X(r.x)) + 0.5;
      c.save(); c.strokeStyle = cSel; c.setLineDash([4, 4]); c.globalAlpha = .8;
      c.beginPath(); c.moveTo(x, h0); c.lineTo(x, h0 + h); c.stroke(); c.restore();
      if (!o.nu) { c.fillStyle = cSel; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(r.texte, x, 1); }
    });
    // series
    c.save(); c.beginPath(); c.rect(g, h0 - 2, w, h + 4); c.clip();
    d.series.forEach(function (s) {
      var Y = s.axe === 'd' ? YD : YG;
      c.strokeStyle = css(s.couleur || '--trait'); c.lineWidth = s.largeur || 2; c.setLineDash(s.tirets || []);
      c.lineJoin = 'round'; c.beginPath();
      var enCours = false;
      for (var i = 0; i < s.x.length; i++) {
        if (s.y[i] == null) { enCours = false; continue; }
        var px = X(s.x[i]), py = Y(s.y[i]);
        if (!enCours) { c.moveTo(px, py); enCours = true; } else c.lineTo(px, py);
      }
      c.stroke();
    });
    c.restore(); c.setLineDash([]);
    // curseur
    if (this.cx != null && this.cx >= x0 && this.cx <= x1) {
      var xc = Math.round(X(this.cx)) + 0.5;
      c.strokeStyle = css('--ink'); c.globalAlpha = .55; c.lineWidth = 1;
      c.beginPath(); c.moveTo(xc, h0); c.lineTo(xc, h0 + h); c.stroke(); c.globalAlpha = 1;
      var moi = this;
      d.series.forEach(function (s) {
        var yv = interp(s.x, s.y, moi.cx); if (yv == null) return;
        var Y = s.axe === 'd' ? YD : YG;
        c.fillStyle = css(s.couleur || '--trait'); c.beginPath(); c.arc(xc, Y(yv), 4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = css('--card'); c.lineWidth = 1.5; c.stroke();
      });
    }
  };
  return { Courbe: Courbe, graduations: graduations, interp: interp, css: css };
})();
