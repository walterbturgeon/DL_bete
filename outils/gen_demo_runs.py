# -*- coding: utf-8 -*-
# Genere js/demo-runs.js : 3 runs de DEMONSTRATION SYNTHETIQUES (aucune donnee de piste reelle, aucun nom).
# Modele physique simple d'une voiture de drag fictive : adherence (montee sur 150 ms), puissance, trainee.
# Le meme format qu'un run du kit DLPT2 :
#   ech = [temps depuis le declenchement (ms), vitesse (km/h), distance depuis l'arret (pi), G longitudinal (g)], ~25 Hz
#   jalons = temps du kit (ms) : t(D + 1 pi) - t(1 pi), roll-out 12 po ; vitesse au jalon (km/h), aucune au 60 pi
# Graine fixe : la sortie est la meme a chaque execution. Tickets fictifs imprimes pour js/commun.js (TICKETS_DEMO).
#   python outils/gen_demo_runs.py
import json, math, os, random

G = 9.80665
FT = 0.3048
ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', 'js', 'demo-runs.js')

# Voiture fictive. puissance = a la roue ; trainee = 0,5 rho CdA / m ; frein = deceleration pied leve (g)
VOITURE = dict(masse=1150.0, puissance=820e3, adherence=1.85, trainee=0.5 * 1.2 * 0.62 / 1150.0, roulement=0.015, frein=0.38)

RUNS = [
    # id, quand (fictif), genre, part de puissance, part d'adherence, leve a (pi) ou None
    ('demo-1', '2026-06-13T14:05:22', 'plein', 1.00, 1.00, None),
    ('demo-2', '2026-06-13T15:47:09', 'leve', 0.97, 0.98, 520),
    ('demo-3', '2026-06-13T13:12:40', 'lent', 0.22, 0.45, None),
]


def simuler(part_p, part_a, leve_pi, rnd):
    v = VOITURE
    dt = 0.0005
    t, x, s = 0.0, 0.0, 0.0
    reaction = 0.045                               # le transbrake relache, la voiture bouge 45 ms plus tard
    trace = []                                     # (t s, vitesse m/s, distance m, acceleration m/s2)
    fin_x = None
    while True:
        if t < reaction:
            a = 0.0
        else:
            monte = min(1.0, (t - reaction) / 0.15)
            a_adh = v['adherence'] * part_a * G * monte
            a_pui = (v['puissance'] * part_p / v['masse']) / max(s, 0.5)
            a = min(a_adh, a_pui) - v['trainee'] * s * s - v['roulement'] * G
            if leve_pi is not None and x / FT >= leve_pi:
                a = -v['frein'] * G - v['trainee'] * s * s
        s = max(0.0, s + a * dt)
        x += s * dt
        trace.append((t, s, x, a))
        if fin_x is None and x / FT >= 1321.0:
            fin_x = t
        if fin_x is not None and t >= fin_x + 0.30:
            break
        t += dt
    return trace


def a_l_instant(trace, t):
    i = min(range(len(trace)), key=lambda k: abs(trace[k][0] - t)) if len(trace) < 50 else int(round(t / 0.0005))
    i = max(0, min(len(trace) - 1, i))
    return trace[i]


def t_a_distance(trace, d_pi):
    d = d_pi * FT
    for (t0, _, x0, _), (t1, _, x1, _) in zip(trace, trace[1:]):
        if x0 < d <= x1:
            return t0 + (t1 - t0) * (d - x0) / (x1 - x0)
    raise SystemExit('!!! distance %s pi jamais atteinte' % d_pi)


def run(rid, quand, genre, part_p, part_a, leve_pi, rnd):
    tr = simuler(part_p, part_a, leve_pi, rnd)
    t_fin = tr[-1][0]
    ech = []
    t = -0.59
    while t <= t_fin:
        if t < 0:
            kmh, pi, g = abs(rnd.gauss(0.3, 0.15)), 0.0, rnd.gauss(0.0, 0.06)        # a l'arret : bruit du GPS et du capteur
        else:
            _, s, x, a = a_l_instant(tr, t)
            kmh = max(0.0, s * 3.6 + rnd.gauss(0, 0.12))
            pi = x / FT
            g = a / G + rnd.gauss(0, 0.04)
        ech.append([int(round(t * 1000)), round(kmh, 2), round(pi, 1), round(g, 3)])
        t += 0.040 + rnd.uniform(-0.002, 0.002)                                           # GPS 25 Hz, un peu de gigue
    t1 = t_a_distance(tr, 1.0)
    jalons = {}
    for D in (60, 330, 660, 1320):
        tD = t_a_distance(tr, D + 1.0)
        v = None if D == 60 else round(a_l_instant(tr, tD)[1] * 3.6, 2)
        jalons[str(D)] = {'t': int(round((tD - t1) * 1000)), 'v': v}
    # vitesses du ticket : moyenne sur les 66 pi avant le jalon (piege de la piste), en mph
    def piege(D):
        ta, tb = t_a_distance(tr, D - 66 + 1.0), t_a_distance(tr, D + 1.0)
        return 66 * FT / (tb - ta) * 3600 / 1609.344
    r = {'id': rid, 'quand': quand, 'genre': genre, 'src': 'TRANSBRAKE',
         'reglages': {'rpo': 12, 'jpo': 12, 'cms': 0, 'd60': 0}, 'jalons': jalons,
         'colonnes': ['t_ms', 'kmh', 'pi', 'g_long'], 'ech': ech}
    return r, {'v660': piege(660), 'v1320': piege(1320)}


def main():
    rnd = random.Random(20260613)
    runs, tickets = [], {}
    # ecart ticket - kit (s) : fictif, pour montrer la comparaison (demo-1 : le 60 pi seul est en retard)
    ECARTS = {'demo-1': (0.031, 0.008, -0.004, 0.012), 'demo-2': (0.006, -0.009, 0.011, 0.004), 'demo-3': (0.012, 0.010, 0.014, 0.009)}
    for rid, quand, genre, pp, pa, lv in RUNS:
        r, pg = run(rid, quand, genre, pp, pa, lv, rnd)
        runs.append(r)
        e = ECARTS[rid]
        tickets[rid] = {str(D): round(r['jalons'][str(D)]['t'] / 1000 + e[i], 3) for i, D in enumerate((60, 330, 660, 1320))}
        tickets[rid].update({'v660': round(pg['v660'], 2), 'v1320': round(pg['v1320'], 2)})
        print('%s %-5s n=%d  60=%d 330=%d 660=%d 1320=%d ms  v660=%s v1320=%s km/h' % (
            rid, genre, len(r['ech']), *[r['jalons'][k]['t'] for k in ('60', '330', '660', '1320')],
            r['jalons']['660']['v'], r['jalons']['1320']['v']))
    entete = ("// Jeu de demonstration : 3 runs SYNTHETIQUES (modele physique d'une voiture fictive, aucune donnee reelle).\n"
              "// Genere par outils/gen_demo_runs.py (graine fixe). Colonnes de ech : temps depuis le declenchement (ms),\n"
              "// vitesse (km/h), distance depuis l'arret (pi), G longitudinal (g). Temps des jalons = comme le kit (ms).\n"
              "'use strict';\n")
    with open(SORTIE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(entete + 'window.DL_DEMO_RUNS = ' + json.dumps(runs, separators=(',', ':')) + ';\n')
    print('ecrit', os.path.normpath(SORTIE))
    print('TICKETS_DEMO (fictifs) :')
    for rid, tk in tickets.items():
        print("    '%s': { 60: %.3f, 330: %.3f, 660: %.3f, 1320: %.3f, v660: %.2f, v1320: %.2f }," % (
            rid, tk['60'], tk['330'], tk['660'], tk['1320'], tk['v660'], tk['v1320']))


main()
