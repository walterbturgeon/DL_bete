'use strict';
// LE CHRONO DU KIT, REFAIT DANS L'APP (kit PT2.1.64). Sert au CALAGE AUTOMATIQUE : quand le pilote compare un ticket,
// l'app cherche le depart (par demi-pouce) qui donne les temps du ticket, avec les jalons du type de vehicule.
//
// ⚠ CE CALCUL DOIT RESTER IDENTIQUE A CELUI DU FIRMWARE (perfOrigineArret + perfTick) :
//   - la distance s'integre sur la VITESSE (trapeze, dt en ms ; un trou de 500 ms ou plus n'est pas integre). La
//     colonne « distance » du run est arrondie au dixieme de pied : au depart, elle decale T0 de quelques ms ;
//   - avant le declenchement : au plus 1500 ms d'echantillons. Avec un type de vehicule, si le DERNIER echantillon
//     d'avant roule (>= 1,1 km/h, le seuil de depart GPS du kit), la distance part du dernier echantillon A L'ARRET
//     (trapeze jusqu'au dernier echantillon, puis sa vitesse jusqu'au declenchement). Un vehicule qui roule deja au
//     declenchement (2-step lu sur le CAN, par exemple) ne perd plus ses premiers pouces ;
//   - apres le declenchement : 1er segment depuis l'instant 0 a la vitesse du dernier echantillon d'avant ;
//   - T0 = le passage du depart (interpolation lineaire), chaque jalon D au passage de D + jalons du type ;
//     temps = jalon - T0, arrondi a la ms.
// Sur un run d'un kit, l'app refait les temps AVEC LES REGLAGES DU RUN et les compare a ceux du kit (controleKit) :
// plus de 3 ms d'ecart = le calcul a diverge, le calage est refuse et l'ecran le dit.
window.DLChrono = (function () {
  var FT_PAR_M = 3.28084, ARRET_KMH = 1.1, AVANT_MS = 1500, TROU_MS = 500;
  // le type de vehicule : jalons (pouces depuis l'arret) et depart par defaut (demi-pouces) -- memes valeurs que le firmware
  var TYPES = { 1: { nom: 'voiture', jal: -50, dep2: 16 }, 2: { nom: 'moto', jal: 6, dep2: 20 } };
  var CIBLE = { '60': 0.020, '330': 0.015, '660': 0.015, '1320': 0.015 };
  var JALONS = ['60', '330', '660', '1320'];
  var ECART_KIT_MS = 3;

  function pieds(kmh, dtMs) { return kmh / 3.6 * dtMs / 1000 * FT_PAR_M; }

  // ech : [[t ms depuis le declenchement, km/h, ...], ...] dans l'ordre. Rend [[t, km/h, pieds], ...] depuis l'origine.
  function points(ech, depuisArret) {
    var avant = ech.filter(function (e) { return e[0] < 0 && e[0] >= -AVANT_MS; });
    var apres = ech.filter(function (e) { return e[0] >= 0; });
    var P = [], d = 0, vDer = avant.length ? avant[avant.length - 1][1] : 0;
    if (depuisArret && avant.length && vDer >= ARRET_KMH) {
      var o = -1;
      for (var k = avant.length - 1; k >= 0; k--) if (avant[k][1] < ARRET_KMH) { o = k; break; }
      if (o >= 0) {
        P.push([avant[o][0], avant[o][1], 0]);
        for (var i = o; i < avant.length - 1; i++) {
          var a = avant[i], b = avant[i + 1], dt = b[0] - a[0];
          if (dt > 0 && dt < TROU_MS) d += pieds((a[1] + b[1]) / 2, dt);
          P.push([b[0], b[1], d]);
        }
        var dt0 = 0 - avant[avant.length - 1][0];
        if (dt0 > 0 && dt0 < TROU_MS) d += pieds(vDer, dt0);
      }
    }
    P.push([0, vDer, d]);
    var tPrec = 0, vPrec = vDer;
    apres.forEach(function (e) {
      var dt = e[0] - tPrec;
      if (dt > 0 && dt < TROU_MS) d += pieds((vPrec + e[1]) / 2, dt);
      P.push([e[0], e[1], d]); tPrec = e[0]; vPrec = e[1];
    });
    return P;
  }
  function tDist(P, x) {
    for (var i = 1; i < P.length; i++) {
      var a = P[i - 1], b = P[i];
      if (a[2] < x && x <= b[2]) return a[0] + (b[0] - a[0]) * (x - a[2]) / (b[2] - a[2]);
    }
    return null;
  }
  // r = { depPo (pouces, demi-pouce permis), jal (po), cms (ms), d60 (po), depuisArret } -> { '60': ms, ... }
  function temps(run, r, P) {
    P = P || points(run.ech || [], r.depuisArret);
    var t0 = tDist(P, r.depPo / 12), out = {};
    if (t0 == null) return null;
    JALONS.forEach(function (k) {
      var x = tDist(P, +k + r.jal / 12 + (k === '60' ? (r.d60 || 0) / 12 : 0));
      if (x != null) out[k] = Math.max(0, Math.round(x - t0 + (r.cms || 0)));
    });
    return out;
  }
  // les reglages DU RUN (en-tete du kit) : avec un type, le depart au demi-pouce et la distance depuis l'arret
  function reglagesDuRun(run) {
    var g = run.reglages || {};
    return { depPo: +g.rpo, jal: +g.jpo, cms: +g.cms || 0, d60: +g.d60 || 0, depuisArret: !!g.veh };
  }
  // l'app refait les temps du kit : le plus grand ecart (ms), ou null si rien a comparer
  function controleKit(run) {
    if (!run || !run.ech || !run.ech.length || !run.jalons) return null;
    var t = temps(run, reglagesDuRun(run)), pire = null;
    if (!t) return null;
    JALONS.forEach(function (k) {
      var j = run.jalons[k];
      if (j && j.t != null && t[k] != null) pire = Math.max(pire || 0, Math.abs(t[k] - j.t));
    });
    return pire;
  }
  // ecarts temps - ticket (s) ; tk = { '60': s, ... } (null = absent)
  function ecarts(t, tk) {
    var e = {};
    JALONS.forEach(function (k) { if (t && t[k] != null && tk[k] != null) e[k] = t[k] / 1000 - tk[k]; });
    return e;
  }
  function bilan(e) {
    var hors = 0, pire = 0, n = 0;
    Object.keys(e).forEach(function (k) { n++; pire = Math.max(pire, Math.abs(e[k])); if (Math.abs(e[k]) > CIBLE[k] + 1e-9) hors++; });
    return { hors: hors, pire: pire, n: n };
  }
  // LE CALAGE : le depart (demi-pouces 1..72) qui colle le mieux au ticket, jalons du type. { dep2, ecarts, hors, pire, n }
  function caler(run, tk, veh) {
    var ty = TYPES[veh]; if (!ty) return null;
    var P = points(run.ech || [], true), best = null;
    for (var d2 = 1; d2 <= 72; d2++) {
      var t = temps(run, { depPo: d2 / 2, jal: ty.jal, depuisArret: true }, P);
      if (!t) continue;
      var e = ecarts(t, tk), b = bilan(e);
      if (!b.n) continue;
      if (!best || b.hors < best.hors || (b.hors === best.hors && b.pire < best.pire)) best = { dep2: d2, ecarts: e, hors: b.hors, pire: b.pire, n: b.n };
    }
    return best;
  }
  // la valeur du milieu de plusieurs departs (demi-pouces) ; deux valeurs du milieu : leur moyenne, arrondie au-dessus
  function mediane(l) {
    if (!l.length) return null;
    var s = l.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }
  return { TYPES: TYPES, CIBLE: CIBLE, ECART_KIT_MS: ECART_KIT_MS, points: points, tDist: tDist, temps: temps,
           reglagesDuRun: reglagesDuRun, controleKit: controleKit, ecarts: ecarts, bilan: bilan, caler: caler, mediane: mediane };
})();
