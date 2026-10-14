'use strict';
// ESSAI OCR DES TICKETS DE PISTE (7 oct. 2026) -- mesure, pas l'application.
// Tesseract.js 7 hors ligne (coeur 7.0.0, anglais 4.0.0_best_int).
// Passage 2 : le ticket alterne texte BLANC sur rouge et NOIR sur blanc, et Tesseract perd souvent une rangee sur
// deux. On lit donc l'image (A) ET son NEGATIF (B), puis on FUSIONNE rangee par rangee. « Sur » = A et B lisent la
// meme valeur ; une valeur dont le point decimal a ete remis est « reparee » : l'app la ferait confirmer.
(function () {
  // Les valeurs vraies des tickets (numero de voiture, temps, dates) sont des donnees de piste : HORS git, dans
  // photos/verite.js (window.OCR_VERITE), a cote des photos. Sans ce fichier, l'essai s'arrete en le disant.
  var V = window.OCR_VERITE || { cible: '', photos: [], vrai: {} };
  var CIBLE = V.cible, VRAI = V.vrai, PHOTOS = V.photos;
  var CHAMPS = ['rt', 't60', 't330', 't660', 'v660', 't1000', 't1320', 'v1320'];
  var NOMS = { rt: 'R/T', t60: "60'", t330: "330'", t660: '1/8 E.T.', v660: '1/8 Mph', t1000: "1000' (15 pi ?)", t1320: 'E.T.', v1320: 'Mph' };
  // bornes de vraisemblance : une valeur dehors est rejetee (dite), jamais gardee
  var BORNES = { rt: [0, 2], t60: [0.8, 3.5], t330: [2, 9], t660: [3, 14], v660: [30, 260], t1000: [0.2, 1.5], t1320: [4, 25], v1320: [30, 300] };

  function charger(url) { return new Promise(function (ok, ko) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = ko; i.src = url; }); }
  // B : POLARITE EGALISEE. Passage 2 (negatif) : les rangees claires restaient perdues, car le negatif les inverse
  // aussi. Ici on n'inverse QUE ce qui est sur fond fonce : fond = moyenne sur une fenetre ALLONGEE a l'horizontale
  // (81 x 15 px, les rangees sont horizontales), fond < 128 => on inverse. Tout devient texte fonce sur fond clair.
  function negatif(img) {
    var W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    var d = g.getImageData(0, 0, W, H), p = d.data, L = new Float32Array(W * H), I = new Float64Array((W + 1) * (H + 1));
    for (var i = 0; i < W * H; i++) L[i] = 0.299 * p[4 * i] + 0.587 * p[4 * i + 1] + 0.114 * p[4 * i + 2];
    for (var y = 0; y < H; y++) { var s = 0; for (var x = 0; x < W; x++) { s += L[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + s; } }
    var rx = 40, ry = 7;
    for (y = 0; y < H; y++) {
      var y0 = Math.max(0, y - ry), y1 = Math.min(H - 1, y + ry);
      for (x = 0; x < W; x++) {
        var x0 = Math.max(0, x - rx), x1 = Math.min(W - 1, x + rx), n = (y1 - y0 + 1) * (x1 - x0 + 1);
        var fond = (I[(y1 + 1) * (W + 1) + x1 + 1] - I[y0 * (W + 1) + x1 + 1] - I[(y1 + 1) * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / n;
        var l = L[y * W + x], o = 4 * (y * W + x);
        p[o] = p[o + 1] = p[o + 2] = fond < 128 ? 255 - l : l;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  function propre(t) { return String(t).replace(/[’‘`´"“”″]/g, "'").replace(/'+/g, "'").replace(/\s+/g, '').toUpperCase(); }
  // une valeur : decimale lue, ou point remis selon le format du champ (temps x.xxx / xx.xxx, vitesse xx.xx / xxx.xx)
  function nombre(t, k) {
    var s = String(t).replace(/[^\d.,]/g, '').replace(',', '.'), v = null, repare = false, m;
    if ((m = /^\d{1,3}\.\d{2,3}$/.exec(s))) v = m[0];
    else if (/^\d{4,5}$/.test(s)) { repare = true; v = k.charAt(0) === 'v' ? s.slice(0, -2) + '.' + s.slice(-2) : s.slice(0, -3) + '.' + s.slice(-3); }
    // passage 4 : un bord de case lu comme « 1 » a la fin (« 7.3061 ») : on retire le chiffre de trop, marque « reparee »
    else if ((m = /^(\d{1,3}\.\d{3})1$/.exec(s)) && k.charAt(0) !== 'v') { repare = true; v = m[1]; }
    else if ((m = /^(\d{1,3}\.\d{2})1$/.exec(s)) && k.charAt(0) === 'v') { repare = true; v = m[1]; }
    if (v == null) return null;
    var b = BORNES[k], x = parseFloat(v);
    if (x < b[0] || x > b[1]) return null;
    return { v: v, repare: repare };
  }
  function lignesDe(data) {
    var lignes = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pa) { (pa.lines || []).forEach(function (l) {
      lignes.push({ texte: l.text.trim(), mots: (l.words || []).map(function (w) { return { t: w.text, c: propre(w.text), x0: w.bbox.x0, x1: w.bbox.x1 }; }) });
    }); }); });
    return lignes;
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
      if (/^E[.,]?[TQ][.,]?$/.test(c[i]) && !/^1\/8$/.test(prec)) return { k: 't1320', a: i, b: i };   // « Eq » vu sur le 50
      if (/^MPH$/.test(c[i]) && !/^1\/8$/.test(prec)) return { k: 'v1320', a: i, b: i };
    }
    return null;
  }
  function analyser(data, largeur) {
    var lignes = lignesDe(data);
    var res = { date: null, cote: null, champs: {}, lignes: lignes.map(function (l) { return l.texte; }) };
    var md = /(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})/.exec(data.text || ''); if (md) res.date = md[1] + ' ' + md[2];
    // le milieu du ticket = la mediane des etiquettes centrees
    var xs = [];
    lignes.forEach(function (l) { l.mots.forEach(function (w) { if (/^(R[\/I1L|!]?T|DIALIN|MOV|1ST|E\.?T\.?|MPH|60'?|330'?|1000'?)$/.test(w.c)) xs.push((w.x0 + w.x1) / 2); }); });
    xs.sort(function (a, b) { return a - b; });
    var centre = xs.length ? xs[Math.floor(xs.length / 2)] : largeur / 2, ecart = 0.12 * largeur;
    res.centre = Math.round(centre);
    // le couloir : un mot qui CONTIENT le numero de voiture, loin du milieu (la case bleue du milieu ne compte pas)
    lignes.forEach(function (l) {
      l.mots.forEach(function (w) {
        if (w.c.indexOf(CIBLE) < 0) return;
        var xc = (w.x0 + w.x1) / 2;
        if (Math.abs(xc - centre) > ecart && !res.cote) res.cote = xc < centre ? 'gauche' : 'droite';
      });
    });
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
  // fusion de A et B : le couloir de l'un ou l'autre, puis chaque champ
  function fusion(ra, rb, vraiCote) {
    var cote = ra.cote || rb.cote;
    if (ra.cote && rb.cote && ra.cote !== rb.cote) cote = null;   // desaccord : on ne choisit pas
    if (!cote) {   // repli : le seul cote qui porte des valeurs
      var n = { gauche: 0, droite: 0 };
      [ra, rb].forEach(function (r) { CHAMPS.forEach(function (k) { var c = r.champs[k]; if (c && c.g) n.gauche++; if (c && c.d) n.droite++; }); });
      if (n.gauche && !n.droite) cote = 'gauche'; else if (n.droite && !n.gauche) cote = 'droite';
    }
    var f = { cote: cote, date: ra.date || rb.date, champs: {} };
    CHAMPS.forEach(function (k) {
      var pick = function (r) { var c = r.champs[k]; return c && cote ? (cote === 'gauche' ? c.g : c.d) : null; };
      var a = pick(ra), b = pick(rb), x = null;
      if (a && b) x = a.v === b.v ? { v: a.v, sur: true, repare: a.repare && b.repare } : { v: (a.repare && !b.repare ? b : a).v, sur: false, conflit: a.v + ' / ' + b.v, repare: a.repare || b.repare };
      else if (a || b) x = { v: (a || b).v, sur: false, repare: (a || b).repare };
      f.champs[k] = x;
    });
    return f;
  }
  // passage 4 : VOTE entre N lectures. Couloir = le plus frequent ; valeur = la plus frequente, « sure » si au moins
  // 2 lectures donnent la meme et qu'aucune autre ne la contredit ; sinon « a verifier » (avec le desaccord dit).
  function vote(liste) {
    var nc = {}; liste.forEach(function (r) { if (r.cote) nc[r.cote] = (nc[r.cote] || 0) + 1; });
    var cote = Object.keys(nc).sort(function (a, b) { return nc[b] - nc[a]; })[0] || null;
    if (cote && nc.gauche && nc.droite && nc.gauche === nc.droite) cote = null;   // egalite : on ne choisit pas
    if (!cote) {   // repli (photo 55) : le seul cote qui porte des valeurs, l'autre couloir n'a que « --- »
      var nv = { gauche: 0, droite: 0 };
      liste.forEach(function (r) { CHAMPS.forEach(function (k) { var c = r.champs[k]; if (c && c.g) nv.gauche++; if (c && c.d) nv.droite++; }); });
      if (nv.gauche && !nv.droite) cote = 'gauche'; else if (nv.droite && !nv.gauche) cote = 'droite';
    }
    var dates = {}; liste.forEach(function (r) { if (r.date) dates[r.date] = (dates[r.date] || 0) + 1; });
    var f = { cote: cote, date: Object.keys(dates).sort(function (a, b) { return dates[b] - dates[a]; })[0] || null, champs: {} };
    CHAMPS.forEach(function (k) {
      var vu = {};
      liste.forEach(function (r) {
        var c = r.champs[k], x = c && cote ? (cote === 'gauche' ? c.g : c.d) : null; if (!x) return;
        vu[x.v] = vu[x.v] || { n: 0, repare: true }; vu[x.v].n++; if (!x.repare) vu[x.v].repare = false;
      });
      var cles = Object.keys(vu).sort(function (a, b) { return vu[b].n - vu[a].n || (vu[a].repare - vu[b].repare); });
      if (!cles.length) { f.champs[k] = null; return; }
      var v = cles[0];
      f.champs[k] = { v: v, sur: vu[v].n >= 2 && cles.length === 1, repare: vu[v].repare, conflit: cles.length > 1 ? cles.join(' / ') : null, n: vu[v].n };
    });
    // L'ORDRE DES TEMPS : 60' < 330' < 1/8 < E.T. Une valeur qui casse l'ordre est retiree (la moins votee des deux)
    // et dite. Vu sur la 51 : le 1/8 (4.228) pris aussi pour l'E.T. vide, marque « sur ».
    var ordre = ['t60', 't330', 't660', 't1320'];
    for (var i = 1; i < ordre.length; i++) {
      for (var j = 0; j < i; j++) {
        var a = f.champs[ordre[j]], b = f.champs[ordre[i]];
        if (!a || !b || parseFloat(b.v) > parseFloat(a.v)) continue;
        // meme valeur = la meme rangee lue deux fois (« 1/8 ET. » pris aussi pour « E.T. ») : on retire le plus loin.
        // Sinon : le moins vote des deux.
        var retire = parseFloat(b.v) === parseFloat(a.v) || (b.n || 0) <= (a.n || 0) ? ordre[i] : ordre[j];
        f.retires = (f.retires || []).concat(retire + '=' + f.champs[retire].v + ' (ordre des temps)');
        f.champs[retire] = null;
      }
    }
    return f;
  }
  // redresser : rotation autour du centre, fond blanc
  function tourner(src, deg) {
    if (!deg) return src;
    var W = src.width || src.naturalWidth, H = src.height || src.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2); g.rotate(deg * Math.PI / 180); g.drawImage(src, -W / 2, -H / 2);
    return c;
  }
  function nbEtiquettes(r) { return CHAMPS.filter(function (k) { return r.champs[k]; }).length; }

  // ---- l'essai
  var sortie = document.getElementById('sortie'), etat = document.getElementById('etat');
  async function essai() {
    if (!window.OCR_VERITE || !CIBLE || !PHOTOS.length) throw new Error('photos/verite.js manque ou est vide (valeurs vraies des tickets, hors git) : voir LISEZMOI.md');
    var t0 = performance.now();
    var worker = await Tesseract.createWorker('eng', 1, {
      workerPath: 'lib/tesseract.js-7.0.0/dist/worker.min.js', corePath: 'lib/tesseract.js-core-7.0.0',
      langPath: 'lib/tesseract.js-data-eng-1.0.0/' + (/gros/.test(location.search) ? '4.0.0' : '4.0.0_best_int'), workerBlobURL: false, cacheMethod: 'none'
    });
    await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
    var tInit = performance.now() - t0, details = [];
    var bilan = { juste: 0, justeSur: 0, justeRepare: 0, faux: 0, fauxSur: 0, rien: 0, tot: 0, inventes: 0, cote: 0, date: 0, photos: PHOTOS.length };
    for (var n of PHOTOS) {
      etat.textContent = 'Photo ' + n + '…';
      var img = await charger('photos/ticket_' + n + '.jpg'), vrai = VRAI[n], tP = performance.now();
      var lire = async function (src, psm) {
        await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
        return analyser((await worker.recognize(src, {}, { blocks: true, text: true })).data, src.width || src.naturalWidth);
      };
      // 1) l'angle qui redresse le mieux : celui ou la polarite egalisee (PSM 4) trouve le plus d'etiquettes
      var neg0 = negatif(img), meilleur = { deg: 0, n: -1 };
      for (var deg of [0, -3, 3, -6, 6, -9, 9]) {
        var essaiR = await lire(tourner(neg0, deg), '4'), nE = nbEtiquettes(essaiR);
        if (nE > meilleur.n) meilleur = { deg: deg, n: nE };
        if (nE >= 7) break;   // presque tout trouve : inutile de tourner plus
      }
      // 2) quatre lectures a cet angle : image et polarite egalisee, en PSM 4 et 6 ; puis le vote
      var imR = tourner(img, meilleur.deg), negR = tourner(neg0, meilleur.deg);
      var ra = await lire(imR, '4'), rb = await lire(negR, '4'), rc = await lire(imR, '6'), rd = await lire(negR, '6');
      var f = vote([ra, rb, rc, rd]), tTot = Math.round(performance.now() - tP);
      var ligne = { photo: n, ms: [tTot, meilleur.deg], cote: [ra.cote, rb.cote, f.cote, vrai.cote], date: [f.date, vrai.date], champs: {} };
      if (f.cote === vrai.cote) bilan.cote++; if (f.date === vrai.date) bilan.date++;
      CHAMPS.forEach(function (k) {
        var x = f.champs[k], v = vrai[k];
        ligne.champs[k] = { lu: x, vrai: v };
        if (v == null) { if (x) bilan.inventes++; return; }
        bilan.tot++;
        if (!x) bilan.rien++;
        else if (x.v === v) { bilan.juste++; if (x.sur) bilan.justeSur++; if (x.repare) bilan.justeRepare++; }
        else { bilan.faux++; if (x.sur) bilan.fauxSur++; }
      });
      ligne.textesA = ra.lignes; ligne.textesB = rb.lignes;
      details.push(ligne); montrer(ligne);
    }
    await worker.terminate();
    var duree = Math.round(performance.now() - t0);
    window.__resultats = { bilan: bilan, details: details, initMs: Math.round(tInit), totalMs: duree };
    etat.textContent = 'Fini en ' + (duree / 1000).toFixed(1) + ' s. Justes ' + bilan.juste + '/' + bilan.tot + ' (dont sûrs ' + bilan.justeSur + ', réparés ' + bilan.justeRepare +
      ') ; faux ' + bilan.faux + ' (dont « sûrs » ' + bilan.fauxSur + ') ; rien lu ' + bilan.rien + ' ; inventés ' + bilan.inventes + ' ; couloir ' + bilan.cote + '/' + bilan.photos + ' ; date ' + bilan.date + '/' + bilan.photos;
  }
  function montrer(l) {
    var h = '<h2>Photo ' + l.photo + ' · ' + l.ms[0] + ' ms · redressée de ' + l.ms[1] + '°</h2><table><tr><th>Champ</th><th>Lu</th><th>État</th><th>Vrai</th></tr>';
    h += '<tr><td>Date</td><td>' + (l.date[0] || '—') + '</td><td></td><td>' + l.date[1] + '</td></tr>';
    h += '<tr><td>Couloir (A | B → retenu)</td><td>' + (l.cote[0] || '—') + ' | ' + (l.cote[1] || '—') + ' → ' + (l.cote[2] || '—') + '</td><td></td><td>' + l.cote[3] + '</td></tr>';
    CHAMPS.forEach(function (k) {
      var c = l.champs[k], x = c.lu, cl = c.vrai == null ? (x ? 'faux' : '') : !x ? 'vide' : x.v === c.vrai ? 'ok' : 'faux';
      var et = !x ? '' : (x.sur ? 'sûr' : 'à vérifier') + (x.repare ? ', point remis' : '') + (x.conflit ? ', A/B : ' + x.conflit : '');
      h += '<tr><td>' + NOMS[k] + '</td><td class="' + cl + '">' + (x ? x.v : '—') + '</td><td>' + et + '</td><td>' + (c.vrai || '—') + '</td></tr>';
    });
    h += '</table><pre>A : ' + l.textesA.join('\n') + '</pre><pre>B : ' + l.textesB.join('\n') + '</pre>';
    sortie.insertAdjacentHTML('beforeend', h);
  }
  essai().catch(function (e) { etat.textContent = 'ÉCHEC : ' + e.message; console.error(e); window.__resultats = { erreur: String(e && e.stack || e) }; });
})();
