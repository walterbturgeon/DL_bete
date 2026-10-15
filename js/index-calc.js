'use strict';
// COURSE A INDEX : le calcul du kit, en JavaScript. JUMEAU LIGNE POUR LIGNE de DRAGLOG_PT2_index.ino (PT2.1.60) :
// meme table de reference (tous les 10 pi depuis l'arret), meme projection « P2 », meme commande (zone morte, pleine
// avance, filtre du 1er ordre, pente maximale). Sert au kit de demonstration (kit.js) et aux essais sur PC
// (outils/essai_index.js). ⚠ Toute modification ici se reporte dans le firmware, et l'inverse.
//
// Unites : temps en ms depuis le declenchement (E), distance en pieds depuis l'arret, vitesse en km/h.
(function (racine) {
  var PAS_FT = 10, N_MAX = 137, N_MIN = 133, DEBUT_FT = 330, PROJ_FT = 150, FT_PAR_M = 3.28084;
  var B = { ARME: 0x01, COURSE: 0x02, FENETRE: 0x04, GPS: 0x08, REF: 0x10, CIBLE: 0x20, ACTIF: 0x40, PERMANENT: 0x80 };
  var DEFAUTS = { idxon: 0, idxc: 0, idxid: 0x406, idxz: 20, idxp: 150, idxf: 500, idxv: 1023, idxam: 0 };

  // ech = [[E ms, km/h, pieds, ...], ...] (format des runs de l'app). Rend null (et la raison) si le run ne convient pas.
  function construireRef(ech) {
    var e = [], v = [], k = 0, dP = -1, eP = 0, vP = 0;
    for (var i = 0; i < ech.length && k < N_MAX; i++) {
      var s = ech[i]; if (s[0] < 0) continue;
      var E = Math.round(s[0]), d = Math.round(s[2] * 10) / 10, V = Math.round(s[1] * 100);
      if (dP < 0) {
        while (k < N_MAX && k * PAS_FT <= d) { e[k] = E; v[k] = V; k++; }
      } else if (d > dP) {
        while (k < N_MAX && k * PAS_FT <= d) {
          var x = k * PAS_FT, fr = (x - dP) / (d - dP);
          e[k] = Math.round(eP + fr * (E - eP)); v[k] = Math.round(vP + fr * (V - vP)); k++;
        }
      }
      if (dP < 0 || d >= dP) { dP = d; eP = E; vP = V; }
    }
    if (k < N_MIN) return { erreur: 'le run s’arrete avant 1320 pi (' + k + ' points)' };
    return { n: k, pasFt: PAS_FT, e: e, v: v };
  }

  function refA(ref, dFt) {
    if (!ref || ref.n < 2 || dFt < 0) return null;
    var x = dFt / ref.pasFt, i = Math.floor(x);
    if (i >= ref.n - 1) {
      var j = ref.n - 1, vk = ref.v[j] / 100, reste = dFt - j * ref.pasFt;
      if (vk < 5 || reste > 30) return null;
      return { e: ref.e[j] + (reste / FT_PAR_M) / (vk / 3.6) * 1000, v: vk };
    }
    var fr = x - i;
    return { e: ref.e[i] + fr * (ref.e[i + 1] - ref.e[i]), v: (ref.v[i] + fr * (ref.v[i + 1] - ref.v[i])) / 100 };
  }

  // m = { eNow, dist, kmh, tRoll, corrMs, jalFt } ; rend l'avance sur la cible (ms) ou null
  function projeter(ref, cibleMs, m) {
    var a = refA(ref, m.dist), f = refA(ref, 1320 + m.jalFt);
    if (!a || !f) return null;
    var vNow = m.kmh < 1 ? 1 : m.kmh;
    var eFin = m.eNow + (f.e - a.e) * a.v / vNow;
    if (eFin <= 0) return null;
    var tPred = Math.round(eFin) - m.tRoll + m.corrMs;
    return cibleMs - tPred;
  }

  function etatNeuf() { return { uf: 0, ue: 0, cmd: 0, avance: null, etat: 0, dernier: 0, cmdMax: 0 }; }

  // Un pas du calcul (comme idxTick). c = reglages (cles du JSON du kit), arme = booleen, m = mesure du run :
  // { course, gotRoll, dist, kmh, eNow, tRoll, corrMs, jalFt, gpsOk }. dt en ms (borne a 200 comme le kit).
  function pas(st, ref, c, arme, m, dt) {
    if (!Number(c.idxon)) { st.uf = st.ue = 0; st.cmd = 0; st.avance = null; st.etat = 0; return st; }
    dt = Math.min(200, Math.max(0, dt));
    var permanent = Number(c.idxam) === 1; arme = permanent || arme;
    var fen = m.course && m.gotRoll && m.dist >= DEBUT_FT && m.dist < 1320 + m.jalFt;
    var e = 0;
    if (arme) e |= B.ARME; if (m.course) e |= B.COURSE; if (fen) e |= B.FENETRE; if (m.gpsOk) e |= B.GPS;
    if (ref) e |= B.REF; if (Number(c.idxc)) e |= B.CIBLE; if (permanent) e |= B.PERMANENT;
    var av = (m.course && m.gotRoll && ref && Number(c.idxc) && m.dist >= PROJ_FT) ? projeter(ref, Number(c.idxc), m) : null;
    if (av != null) av = Math.max(-32767, Math.min(32767, av));
    st.avance = av;
    var uBrut = 0;
    if (arme && fen && m.gpsOk && av != null) {
      e |= B.ACTIF;
      var u = (av - c.idxz) / (c.idxp - c.idxz);
      uBrut = Math.max(0, Math.min(1, u)) * 1023;
    }
    if (Number(c.idxf) === 0) st.uf = uBrut; else st.uf += (uBrut - st.uf) * dt / (Number(c.idxf) + dt);
    var p = Number(c.idxv) * dt / 1000, du = Math.max(-p, Math.min(p, st.uf - st.ue));
    st.ue = Math.max(0, Math.min(1023, st.ue + du));
    st.cmd = Math.round(st.ue); st.etat = e;
    if (m.course && st.cmd > st.cmdMax) st.cmdMax = st.cmd;
    return st;
  }

  // La trame 0x406 (8 octets, gros-boutiste), pour l'affichage et les essais
  function trame(st, dist) {
    var a = st.avance == null ? 0x8000 : (st.avance & 0xFFFF), d = Math.max(0, Math.min(65535, Math.round(dist || 0)));
    return [st.cmd >> 8, st.cmd & 255, st.etat, 0, a >> 8, a & 255, d >> 8, d & 255];
  }

  racine.DLIndex = { construireRef: construireRef, refA: refA, projeter: projeter, etatNeuf: etatNeuf, pas: pas, trame: trame,
                     BITS: B, DEFAUTS: DEFAUTS, DEBUT_FT: DEBUT_FT };
})(typeof window !== 'undefined' ? window : globalThis);
