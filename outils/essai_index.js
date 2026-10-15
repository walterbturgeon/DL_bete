'use strict';
// Essai du calcul de la course a index (js/index-calc.js, jumeau du firmware PT2.1.60) sur des runs ENREGISTRES.
// Les runs sont des fichiers texte du kit (lignes « R, », comme sur la carte SD de la E3B4) : ils restent HORS du depot.
//   node outils/essai_index.js <run_reference.txt> <run_essai.txt> [cible_ms] [zone] [pleine] [filtre] [pente]
// Sans cible : cible = ET officiel du run d'essai + 50 ms (l'avance doit alors rester pres de -50 ms).
const fs = require('fs');
require('../js/index-calc.js');
const I = globalThis.DLIndex;

function lire(chemin) {
  const t = fs.readFileSync(chemin, 'utf8');
  const ech = t.split(/\r?\n/).filter(l => l.startsWith('R,')).map(l => { const c = l.split(','); return [+c[1], +c[2] / 100, +c[3]]; });
  const cms = +((/corr_ms=(-?\d+)/.exec(t) || [0, 0])[1]);
  const jpo = +((/jalons_po=(-?\d+)/.exec(t) || [0, 12])[1]);
  const t1320 = +((/J1320 t_ms=(\d+)/.exec(t) || [0, 0])[1]);
  return { nom: chemin.split(/[\\/]/).pop(), ech, cms, jalFt: jpo / 12, t1320 };
}
// T0 du run : le passage interpole a 1 pi (roll-out 12 po), comme perfCross
function tAt(ech, d) {
  for (let i = 1; i < ech.length; i++) if (ech[i - 1][0] >= 0 && ech[i - 1][2] < d && ech[i][2] >= d)
    return ech[i - 1][0] + (ech[i][0] - ech[i - 1][0]) * (d - ech[i - 1][2]) / (ech[i][2] - ech[i - 1][2]);
  return null;
}

const [, , fRef, fEss, cibleArg, z, p, f, v] = process.argv;
if (!fRef || !fEss) { console.error('usage : node outils/essai_index.js <reference.txt> <essai.txt> [cible_ms] [zone] [pleine] [filtre] [pente]'); process.exit(1); }
const ref = lire(fRef), ess = lire(fEss);
const table = I.construireRef(ref.ech);
if (table.erreur) { console.error('!!! reference refusee :', table.erreur); process.exit(1); }
const tRoll = tAt(ess.ech, 1.0), vrai = Math.round(tAt(ess.ech, 1320 + ess.jalFt) - tRoll + ess.cms);
const cible = cibleArg ? +cibleArg : vrai + 50;
const c = { idxon: 1, idxc: cible, idxz: +(z || 20), idxp: +(p || 150), idxf: +(f || 500), idxv: +(v || 1023), idxam: 1 };
console.log(`reference ${ref.nom} (${table.n} points) -> essai ${ess.nom} : ET officiel ${vrai} ms (kit ${ess.t1320}) | cible ${cible} ms`);
console.log(`reglages : zone ${c.idxz} ms, pleine ${c.idxp} ms, filtre ${c.idxf} ms, pente ${c.idxv}/s`);
const st = I.etatNeuf();
let avant = null, reperes = [330, 500, 660, 800, 1000, 1100, 1200, 1300], vitMax = 0, sens = 0, acoups = 0;
for (const s of ess.ech) {
  if (s[0] < 0) continue;
  const dt = avant == null ? 40 : s[0] - avant; avant = s[0];
  const cmdAvant = st.cmd;
  I.pas(st, table, c, true, { course: true, gotRoll: s[2] >= 1, dist: s[2], kmh: s[1], eNow: s[0], tRoll, corrMs: ess.cms, jalFt: ess.jalFt, gpsOk: true }, dt);
  const d = st.cmd - cmdAvant;
  if (dt > 0) vitMax = Math.max(vitMax, Math.abs(d) / dt * 1000);
  const sg = Math.sign(d); if (sg && sens && sg !== sens) acoups++; if (sg) sens = sg;
  while (reperes.length && s[2] >= reperes[0]) {
    const r = reperes.shift();
    console.log(`  ${String(r).padStart(4)} pi : avance ${st.avance == null ? '  --' : String(Math.round(st.avance)).padStart(5)} ms`
      + ` (erreur de projection ${st.avance == null ? '--' : String(Math.round(cible - vrai - st.avance)).padStart(4)} ms) | commande ${String(st.cmd).padStart(4)}`
      + ` | trame ${I.trame(st, s[2]).map(x => x.toString(16).padStart(2, '0')).join(' ')}`);
  }
}
console.log(`commande max ${st.cmdMax} | variation max ${Math.round(vitMax)} comptes/s | changements de sens ${acoups}`);
