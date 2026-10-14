'use strict';
// LA LECTURE AUTOMATIQUE DU TICKET DE PISTE (B v0.8, 7 oct. 2026) -- hors ligne, rien ne sort de l'appareil.
// Methode MESUREE sur 7 photos de tickets de piste (outils/ocr_essai : 40/50 justes, 0 fausse, 0 inventee) :
//   redressement (0, +-3, +-6, +-9 deg) -> 4 lectures (image et « polarite egalisee » x PSM 4 et 6) -> vote ->
//   bornes par champ -> ordre des temps (60' < 330' < 1/8 < E.T.). Chaque valeur est « sure » (2 lectures ou plus,
//   sans contradiction) ou « a verifier » ; « reparee » = point decimal remis. L'utilisateur confirme TOUJOURS.
// ⚠ Tesseract.js (lib/tesseract, ~15 Mo, Apache-2.0, outils/installer_tesseract.sh) n'est charge qu'au premier usage.
// ⚠ PSM 6 seul perdait une rangee sur deux (les claires) : ne pas revenir a une lecture unique.
window.DLOcr = (function () {
  var CHAMPS = ['rt', 't60', 't330', 't660', 'v660', 't1000', 't1320', 'v1320'];
  var BORNES = { rt: [0, 2], t60: [0.8, 3.5], t330: [2, 9], t660: [3, 14], v660: [30, 260], t1000: [0.2, 1.5], t1320: [4, 25], v1320: [30, 300] };

  // ---- le chargement paresseux de la bibliotheque
  var promesseLib = null;
  function chargerLib(base) {
    if (window.Tesseract) return Promise.resolve();
    if (!promesseLib) promesseLib = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = base + 'tesseract.min.js';
      s.onload = function () { window.Tesseract ? ok() : ko(new Error('Tesseract absent apres chargement')); };
      s.onerror = function () { promesseLib = null; ko(new Error('ocr-absent')); };
      document.head.appendChild(s);
    });
    return promesseLib;
  }

  // ---- preparation de l'image
  function enCanvas(img) {
    var c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0); return c;
  }
  // POLARITE EGALISEE : on n'inverse que ce qui est sur fond fonce (moyenne sur 81 x 15 px, les rangees sont horizontales)
  function polariteEgalisee(src) {
    var W = src.width, H = src.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    var d = g.getImageData(0, 0, W, H), p = d.data, L = new Float32Array(W * H), I = new Float64Array((W + 1) * (H + 1)), i, x, y;
    for (i = 0; i < W * H; i++) L[i] = 0.299 * p[4 * i] + 0.587 * p[4 * i + 1] + 0.114 * p[4 * i + 2];
    for (y = 0; y < H; y++) { var s = 0; for (x = 0; x < W; x++) { s += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + s; } }
    for (y = 0; y < H; y++) {
      var y0 = Math.max(0, y - 7), y1 = Math.min(H - 1, y + 7);
      for (x = 0; x < W; x++) {
        var x0 = Math.max(0, x - 40), x1 = Math.min(W - 1, x + 40), n = (y1 - y0 + 1) * (x1 - x0 + 1);
        var fond = (I[(y1 + 1) * (W + 1) + x1 + 1] - I[y0 * (W + 1) + x1 + 1] - I[(y1 + 1) * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / n;
        var l = L[y * W + x], o = 4 * (y * W + x);
        p[o] = p[o + 1] = p[o + 2] = fond < 128 ? 255 - l : l;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function tourner(src, deg) {
    if (!deg) return src;
    var W = src.width, H = src.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2); g.rotate(deg * Math.PI / 180); g.drawImage(src, -W / 2, -H / 2);
    return c;
  }

  // ---- l'analyse d'une lecture
  function propre(t) { return String(t).replace(/[’‘`´"“”″]/g, "'").replace(/'+/g, "'").replace(/\s+/g, '').toUpperCase(); }
  function nombre(t, k) {
    var s = String(t).replace(/[^\d.,]/g, '').replace(',', '.'), v = null, repare = false, m, vit = k.charAt(0) === 'v';
    if ((m = /^\d{1,3}\.\d{2,3}$/.exec(s))) v = m[0];
    else if (/^\d{4,5}$/.test(s)) { repare = true; v = vit ? s.slice(0, -2) + '.' + s.slice(-2) : s.slice(0, -3) + '.' + s.slice(-3); }
    else if ((m = /^(\d{1,3}\.\d{3})1$/.exec(s)) && !vit) { repare = true; v = m[1]; }   // bord de case lu « 1 »
    else if ((m = /^(\d{1,3}\.\d{2})1$/.exec(s)) && vit) { repare = true; v = m[1]; }
    if (v == null) return null;
    var b = BORNES[k], x = parseFloat(v);
    return (x < b[0] || x > b[1]) ? null : { v: v, repare: repare };
  }
  function trouver(l) {
    var c = l.mots.map(function (w) { return w.c; }), i;
    for (i = 0; i < c.length; i++) {
      var suiv = c[i + 1] || '', prec = c[i - 1] || '';
      if (/^R[\/I1L|!]?T$/.test(c[i])) return { k: 'rt', a: i, b: i };
      if (/^60'?$/.test(c[i])) return { k: 't60', a: i, b: i };
      if (/^330'?$/.test(c[i])) return { k: 't330', a: i, b: i };
      if (/^1000'?$/.test(c[i])) return { k: 't1000', a: i, b: i };
      if (/^1\/8$/.test(c[i]) && /^E\.?T\.?$/.test(suiv)) return { k: 't660', a: i, b: i + 1 };
      if (/^1\/8$/.test(c[i]) && /^MPH$/.test(suiv)) return { k: 'v660', a: i, b: i + 1 };
      if (/^1\/8E\.?T\.?$/.test(c[i])) return { k: 't660', a: i, b: i };
      if (/^1\/8MPH$/.test(c[i])) return { k: 'v660', a: i, b: i };
      if (/^E[.,]?[TQ][.,]?$/.test(c[i]) && !/^1\/8$/.test(prec)) return { k: 't1320', a: i, b: i };
      if (/^MPH$/.test(c[i]) && !/^1\/8$/.test(prec)) return { k: 'v1320', a: i, b: i };
    }
    return null;
  }
  function analyser(data, largeur, numero) {
    var lignes = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pa) { (pa.lines || []).forEach(function (l) {
      lignes.push({ mots: (l.words || []).map(function (w) { return { t: w.text, c: propre(w.text), x0: w.bbox.x0, x1: w.bbox.x1 }; }) });
    }); }); });
    var res = { date: null, cote: null, champs: {} };
    var md = /(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})/.exec(data.text || ''); if (md) res.date = md[1] + ' ' + md[2];
    var xs = [];
    lignes.forEach(function (l) { l.mots.forEach(function (w) { if (/^(R[\/I1L|!]?T|DIALIN|MOV|1ST|E\.?T\.?|MPH|60'?|330'?|1000'?)$/.test(w.c)) xs.push((w.x0 + w.x1) / 2); }); });
    xs.sort(function (a, b) { return a - b; });
    var centre = xs.length ? xs[Math.floor(xs.length / 2)] : largeur / 2, ecart = 0.12 * largeur;
    if (numero) lignes.forEach(function (l) { l.mots.forEach(function (w) {   // le numero, loin de la case bleue du milieu
      var xc = (w.x0 + w.x1) / 2;
      if (w.c.indexOf(numero) >= 0 && Math.abs(xc - centre) > ecart && !res.cote) res.cote = xc < centre ? 'gauche' : 'droite';
    }); });
    lignes.forEach(function (l) {
      var e = trouver(l); if (!e || res.champs[e.k]) return;
      var xa = l.mots[e.a].x0, xb = l.mots[e.b].x1, g = null, d = null;
      l.mots.forEach(function (w, j) {
        if (j >= e.a && j <= e.b) return;
        var n = nombre(w.t, e.k); if (!n) return;
        if (w.x1 <= xa) g = n; else if (w.x0 >= xb && !d) d = n;
      });
      res.champs[e.k] = { g: g, d: d };
    });
    return res;
  }
  function nbEtiquettes(r) { return CHAMPS.filter(function (k) { return r.champs[k]; }).length; }
  // le vote pour UN couloir, puis l'ordre des temps
  function voteCouloir(liste, cote) {
    var champs = {}, retires = [];
    CHAMPS.forEach(function (k) {
      var vu = {};
      liste.forEach(function (r) {
        var c = r.champs[k], x = c ? (cote === 'gauche' ? c.g : c.d) : null; if (!x) return;
        vu[x.v] = vu[x.v] || { n: 0, repare: true }; vu[x.v].n++; if (!x.repare) vu[x.v].repare = false;
      });
      var cles = Object.keys(vu).sort(function (a, b) { return vu[b].n - vu[a].n || (vu[a].repare - vu[b].repare); });
      champs[k] = cles.length ? { v: cles[0], n: vu[cles[0]].n, sur: vu[cles[0]].n >= 2 && cles.length === 1, repare: vu[cles[0]].repare,
                                  conflit: cles.length > 1 ? cles.join(' / ') : null } : null;
    });
    var ordre = ['t60', 't330', 't660', 't1320'];
    for (var i = 1; i < ordre.length; i++) for (var j = 0; j < i; j++) {
      var a = champs[ordre[j]], b = champs[ordre[i]];
      if (!a || !b || parseFloat(b.v) > parseFloat(a.v)) continue;
      // meme valeur = la meme rangee lue deux fois : on retire la plus loin ; sinon la moins votee
      var r = parseFloat(b.v) === parseFloat(a.v) || b.n <= a.n ? ordre[i] : ordre[j];
      retires.push(r + '=' + champs[r].v); champs[r] = null;
    }
    return { champs: champs, retires: retires };
  }

  // ---- la lecture complete. source = Image ou canvas. opts : { base, numero, progres(n, total) }
  async function lire(source, opts) {
    opts = opts || {};
    var base = opts.base || 'lib/tesseract/', numero = propre(opts.numero || ''), t0 = performance.now(), etapes = 0, total = 10;
    var avance = function () { etapes++; if (opts.progres) opts.progres(Math.min(etapes, total), total); };
    await chargerLib(base);
    var worker = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang',
                                                         workerBlobURL: false, cacheMethod: 'none' });
    try {
      var img = enCanvas(source), pol = polariteEgalisee(img);
      var passe = async function (src, psm) {
        // debug_file /dev/null : Tesseract ecrivait ~30 lignes par lecture (« Estimating resolution… ») en console.error,
        // assez pour noyer une vraie erreur
        await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1', debug_file: '/dev/null' });
        var r = analyser((await worker.recognize(src, {}, { blocks: true, text: true })).data, src.width, numero); avance(); return r;
      };
      // 1) l'angle qui redresse le mieux (polarite egalisee, PSM 4) ; on garde cette lecture pour le vote
      var meilleur = null;
      for (var deg of [0, -3, 3, -6, 6, -9, 9]) {
        var r = await passe(tourner(pol, deg), '4'), n = nbEtiquettes(r);
        if (!meilleur || n > meilleur.n) meilleur = { deg: deg, n: n, r: r };
        if (n >= 7) break;
      }
      total = etapes + 3;
      // 2) trois autres lectures a cet angle, puis le vote
      var imR = tourner(img, meilleur.deg), polR = tourner(pol, meilleur.deg);
      var liste = [meilleur.r, await passe(imR, '4'), await passe(imR, '6'), await passe(polR, '6')];
      // le couloir : le plus frequent ; sinon le seul cote qui porte des valeurs
      var nc = {}; liste.forEach(function (x) { if (x.cote) nc[x.cote] = (nc[x.cote] || 0) + 1; });
      var cote = nc.gauche > (nc.droite || 0) ? 'gauche' : nc.droite > (nc.gauche || 0) ? 'droite' : null, coteSur = !!cote;
      if (!cote) {
        var nv = { gauche: 0, droite: 0 };
        liste.forEach(function (x) { CHAMPS.forEach(function (k) { var c = x.champs[k]; if (c && c.g) nv.gauche++; if (c && c.d) nv.droite++; }); });
        if (nv.gauche && !nv.droite) cote = 'gauche'; else if (nv.droite && !nv.gauche) cote = 'droite';
      }
      var dates = {}; liste.forEach(function (x) { if (x.date) dates[x.date] = (dates[x.date] || 0) + 1; });
      return { duree: Math.round(performance.now() - t0), angle: meilleur.deg, cote: cote, coteSur: coteSur,
               date: Object.keys(dates).sort(function (a, b) { return dates[b] - dates[a]; })[0] || null,
               couloirs: { gauche: voteCouloir(liste, 'gauche'), droite: voteCouloir(liste, 'droite') } };
    } finally {
      await worker.terminate();
    }
  }
  return { lire: lire, CHAMPS: CHAMPS, _analyser: analyser, _voteCouloir: voteCouloir };
})();
