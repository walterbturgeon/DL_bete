# -*- coding: utf-8 -*-
# Genere js/demo-runs.js : 3 runs de DEMONSTRATION SYNTHETIQUES (aucune donnee de piste reelle, aucun nom).
# Modele physique simple d'une voiture de drag fictive : adherence (montee sur 150 ms), puissance, trainee.
# Le meme format qu'un run du kit DLPT2 :
#   ech = [temps depuis le declenchement (ms), vitesse (km/h), distance depuis l'arret (pi), G longitudinal (g)], ~25 Hz
#   jalons = temps du kit (ms) : comme un kit PT2.1.64 de type voiture (voir JAL_PO, DEP_KIT_PO plus bas) ;
#   vitesse au jalon (km/h), aucune au 60 pi
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


# [0.10.0] Le kit de demo est un kit PT2.1.64 de type VOITURE : jalons a D - 50 po, depart par defaut 8 po. Ses temps
# sortent du MEME calcul que le kit et l'app (js/chrono.js) : distance integree sur la vitesse des echantillons.
# La piste fictive part a 8,5 po : le calage automatique de la demo trouve donc 8,5 po.
JAL_PO, DEP_KIT_PO, DEP_PISTE_PO = -50, 8.0, 8.5
FT_PAR_M = 3.28084


def points_kit(ech):
    # la voiture est a l'arret au declenchement : la distance part du declenchement (voir js/chrono.js)
    avant = [e for e in ech if -1500 <= e[0] < 0]
    v_der = avant[-1][1] if avant else 0.0
    if v_der >= 1.1:
        raise SystemExit('!!! demo : la voiture roule au declenchement, cas pas prevu ici')
    pts, d, t_prec, v_prec = [(0, v_der, 0.0)], 0.0, 0, v_der
    for e in ech:
        if e[0] < 0:
            continue
        dt = e[0] - t_prec
        if 0 < dt < 500:
            d += (v_prec + e[1]) / 2 / 3.6 * dt / 1000 * FT_PAR_M
        pts.append((e[0], e[1], d))
        t_prec, v_prec = e[0], e[1]
    return pts


def t_pts(pts, x):
    for a, b in zip(pts, pts[1:]):
        if a[2] < x <= b[2]:
            return a[0] + (b[0] - a[0]) * (x - a[2]) / (b[2] - a[2])
    raise SystemExit('!!! distance %s pi jamais atteinte (kit)' % x)


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
    # les temps du KIT : depart 8 po, jalons a D - 50 po, sur ses propres echantillons
    pts = points_kit(ech)
    t0k = t_pts(pts, DEP_KIT_PO / 12)
    jalons = {}
    for D in (60, 330, 660, 1320):
        tD = t_pts(pts, D + JAL_PO / 12)
        v = None if D == 60 else round(a_l_instant(tr, tD / 1000)[1] * 3.6, 2)
        jalons[str(D)] = {'t': int(round(tD - t0k)), 'v': v}
    # les temps de la PISTE fictive (pour le ticket) : la vraie trajectoire, depart 8,5 po, memes jalons
    t0p = t_a_distance(tr, DEP_PISTE_PO / 12)
    piste = {D: t_a_distance(tr, D + JAL_PO / 12) - t0p for D in (60, 330, 660, 1320)}
    # vitesses du ticket : moyenne sur les 66 pi avant le jalon (piege de la piste), en mph
    def piege(D):
        ta, tb = t_a_distance(tr, D - 66 + JAL_PO / 12), t_a_distance(tr, D + JAL_PO / 12)
        return 66 * FT / (tb - ta) * 3600 / 1609.344
    r = {'id': rid, 'quand': quand, 'genre': genre, 'src': 'TRANSBRAKE',
         'reglages': {'rpo': DEP_KIT_PO, 'jpo': JAL_PO, 'cms': 0, 'd60': 0, 'veh': 1, 'dyn': 8}, 'jalons': jalons,
         'colonnes': ['t_ms', 'kmh', 'pi', 'g_long'], 'ech': ech}
    return r, {'v660': piege(660), 'v1320': piege(1320), 'piste': piste}


def main():
    rnd = random.Random(20260613)
    runs, tickets = [], {}
    # [0.10.0] le ticket = la piste fictive (depart 8,5 po) + un petit bruit de chronometrage fictif (s)
    BRUIT = {'demo-1': (0.002, -0.001, 0.001, -0.002), 'demo-2': (-0.001, 0.002, -0.002, 0.001), 'demo-3': (0.001, 0.001, -0.001, 0.002)}
    for rid, quand, genre, pp, pa, lv in RUNS:
        r, pg = run(rid, quand, genre, pp, pa, lv, rnd)
        runs.append(r)
        e = BRUIT[rid]
        tickets[rid] = {str(D): round(pg['piste'][D] + e[i], 3) for i, D in enumerate((60, 330, 660, 1320))}
        tickets[rid].update({'v660': round(pg['v660'], 2), 'v1320': round(pg['v1320'], 2)})
        print('%s %-5s n=%d  60=%d 330=%d 660=%d 1320=%d ms  v660=%s v1320=%s km/h' % (
            rid, genre, len(r['ech']), *[r['jalons'][k]['t'] for k in ('60', '330', '660', '1320')],
            r['jalons']['660']['v'], r['jalons']['1320']['v']))
    entete = ("// Jeu de demonstration : 3 runs SYNTHETIQUES (modele physique d'une voiture fictive, aucune donnee reelle).\n"
              "// Genere par outils/gen_demo_runs.py (graine fixe). Colonnes de ech : temps depuis le declenchement (ms),\n"
              "// vitesse (km/h), distance depuis l'arret (pi), G longitudinal (g). Temps des jalons = comme un kit PT2.1.64\n"
              "// de type voiture (depart 8 po, jalons a D - 50 po), en ms.\n"
              "'use strict';\n")
    with open(SORTIE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(entete + 'window.DL_DEMO_RUNS = ' + json.dumps(runs, separators=(',', ':')) + ';\n')
    print('ecrit', os.path.normpath(SORTIE))
    print('TICKETS_DEMO (fictifs) :')
    for rid, tk in tickets.items():
        print("    '%s': { 60: %.3f, 330: %.3f, 660: %.3f, 1320: %.3f, v660: %.2f, v1320: %.2f }," % (
            rid, tk['60'], tk['330'], tk['660'], tk['1320'], tk['v660'], tk['v1320']))


main()
