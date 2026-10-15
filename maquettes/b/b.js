'use strict';
// MAQUETTE B « GUIDEE » : accueil a 4 tuiles, etapes 1-2-3, courir, runs, comparaison au ticket, reglages par etapes.
// [B v0.2] (7 oct. : retour a la B) la langue est SEULEMENT dans Regler ; l'en-tete montre la connexion ;
// repris de la maquette C : fiche du kit (calibration, mise a jour), ticket garde par run avec sa pastille n/m.
(function () {
  var VERSION = '0.9.0';   // = MARKETING_VERSION de l'app iPhone (ios/App/App.xcodeproj)
  var $ = DLC.$, T = DLI18n.T;
  // les textes de B sont dans b-textes.js (charge avant ce fichier)
  // [B v0.2] les tickets de demonstration et la comparaison viennent du noyau commun (DLC) ; les tickets tapes
  // sont gardes dans l'appareil, par run (jamais envoyes)
  var TICKETS_DEMO = DLC.TICKETS_DEMO;
  var TK_CLE = 'dlxB_tickets', tickets = {};
  try { tickets = JSON.parse(localStorage.getItem(TK_CLE) || '{}'); } catch (e) {}
  function garderTickets() { try { localStorage.setItem(TK_CLE, JSON.stringify(tickets)); } catch (e) {} }
  var prefs = new DLC.Prefs('dlxB_prefs', { langue: null, unite: null, theme: 'auto', texte: 'n', vue: 'accueil', numero: '' });
  DLC.brancher(prefs);
  DLI18n.choisir(prefs.v.langue);
  DLC.poserTheme(prefs.v.theme, prefs.v.texte === 'g');

  var VUES = ['accueil', 'courir', 'runs', 'ticket', 'regler'];
  function vue(v) {
    prefs.v.vue = v; prefs.garder();
    document.querySelectorAll('.vue').forEach(function (s) { s.hidden = s.id !== 'v-' + v; });
    var barre = v === 'ticket' ? 'runs' : v;
    document.querySelectorAll('.b-barre [data-vue]').forEach(function (b) { b.classList.toggle('actif', b.getAttribute('data-vue') === barre); });
    window.scrollTo(0, 0); dessinerDirect(); if (v === 'runs') rendreDetail();
  }
  document.querySelectorAll('.b-barre [data-vue]').forEach(function (b) { b.addEventListener('click', function () { vue(b.getAttribute('data-vue')); }); });

  var feuille = DLC.feuilleConnexion([$('bPilule')]);
  $('tKit').addEventListener('click', function () { feuille.ouvrir(true); });
  $('tCourir').addEventListener('click', function () { vue('courir'); });
  $('tRuns').addEventListener('click', function () { vue('runs'); });
  $('tTicket').addEventListener('click', function () { vue('ticket'); preparerTicket(); });

  var runs = [], cfg = null, live = {}, enCourse = false, buf = [], dernierTelem = null, ticketFait = false;
  DLKit.sur('etat', function (e) {
    $('bPilule').className = 'b-pilule ' + (e.connecte ? 'on' : 'off');
    $('bPiluleTxt').setAttribute('data-i18n', e.connecte ? 'connecte' : 'bConnecter');
    $('bPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    $('bCourirVide').hidden = e.connecte; $('bRejouer').disabled = !e.connecte;
    // [B v0.5] « Rejouer un run » = kit de demo seulement ; la course simulee du VRAI kit est rangee sous « Banc d'essai »
    $('bRejouer').hidden = e.connecte && e.mode !== 'demo';
    $('bBanc').hidden = !(e.connecte && e.mode === 'ble');
    if (!e.connecte) { runs = []; cfg = null; buf = []; dernierTelem = null; rendreAccueil(); rendreListe(); rendreRegl(); rendreFiche(); majCourir(null); return; }
    DLKit.lireConfig().then(function (c) { cfg = c; rendreRegl(); rendreFiche(); rendreAccueil(); }, erreurKit);
    chargerRuns(vitrine);
  });
  // [B v0.3] le vrai kit envoie ses runs en ~2-3 s par run : on le dit pendant la lecture, et un echec se voit
  function chargerRuns(apres) {
    if (DLKit.etat().mode === 'ble') { $('tRunsSous').textContent = T('b_runsLecture'); $('bRunsVide').textContent = T('b_runsLecture'); }
    DLKit.listerRuns().then(function (l) {
      runs = DLC.trier(l); $('bRunsVide').textContent = T('b_aucunRun');
      rendreListe(); rendreAccueil(); preparerTicket(); if (idxConnu()) idxListeRuns(); if (apres) apres();
      // [B v0.4] le kit annonce plus de runs qu'il n'en envoie : on le dit (vu sur un kit : 8 annonces, 0 recu)
      if (l.manque) {
        var txt = T('b_runsManque', { n: l.manque, a: l.annonce }) + (l.refus && l.refus.length ? ' ' + l.refus.join(' ; ') : '');
        $('tRunsSous').textContent = txt; $('bRunsVide').textContent = txt; $('bRunsVide').hidden = false;
      }
    }, function (err) {
      $('tRunsSous').textContent = T('b_runsErr', { x: err.message }); $('bRunsVide').textContent = T('b_runsErr', { x: err.message });
      $('bRunsVide').hidden = false;
    });
  }
  function erreurKit(err) { $('bKitMsg').textContent = err.message; console.error('[B]', err); }
  // [kit graphique] ?apercu=1 : l'ecran se montre rempli, sans rien ecrire dans l'appareil
  //   courir -> un run de demo rejoue toutes les 20 s ; ticket -> le ticket de demo du run du 3 oct. compare
  var vitrineFaite = false;
  function vitrine() {
    if (!prefs.apercu || vitrineFaite) return;
    vitrineFaite = true;
    if (prefs.v.vue === 'courir') {
      var rejouer = function () { DLKit.commande('rejouer:demo-1'); };
      rejouer(); setInterval(rejouer, 20000);
    }
    if (prefs.v.vue === 'ticket') {
      var r = runs.filter(function (x) { return x.id === 'demo-1'; })[0]; if (!r) return;
      $('bTRun').value = r.id; remplirSaisie(TICKETS_DEMO[r.id]); montrerResultat(DLC.comparerTicket(r, TICKETS_DEMO[r.id]));
    }
  }

  // ---- accueil
  function meilleur() { var b = null; runs.forEach(function (r) { var f = r.jalons['1320']; if (f && (!b || f.t < b.t)) b = f; }); return b; }
  function rendreAccueil() {
    var e = DLKit.etat();
    $('tKit').className = 'b-tuile ' + (e.connecte ? 'ok' : 'att');
    $('tKitSous').textContent = e.connecte ? T('b_kitOn', { nom: e.nom.replace('DRAGLOG_', ''), s: dernierTelem ? dernierTelem.sats : (cfg ? cfg.sats : '--') }) : T('b_kitOff');
    var f = runs[0] && runs[0].jalons['1320'];
    $('tCourirSous').textContent = !e.connecte ? T('b_pretOff') : (f ? T('b_dernier', { t: DLC.sec(f.t) }) : T('etatArme'));
    var b = meilleur();
    $('tRunsSous').textContent = runs.length ? T('b_nbRuns', { n: runs.length, t: DLC.sec(b && b.t) }) : T('b_aucunRun');
    $('e1').classList.toggle('fait', e.connecte); $('e2').classList.toggle('fait', runs.length > 0); $('e3').classList.toggle('fait', ticketFait);
  }

  // ---- courir
  function listeJal(id, jal, vient) {
    $(id).innerHTML = DLC.JALONS.map(function (k) {
      var j = jal && jal[k];
      return '<li' + (vient === k ? ' class="vient"' : '') + '><span class="l">' + T('j' + k) + '</span><span class="v num">' +
             (j && j.v ? DLC.nf(DLC.vit(j.v), 1) + ' ' + DLC.unite() : '') + '</span><span class="t num">' + (j ? DLC.sec(j.t) : '--') + '</span></li>';
    }).join('');
  }
  var courbe = new DLGraph.Courbe($('cvB'), { hauteur: 190, curseur: false, xFmt: function (v) { return DLC.nf(v, 0) + ' s'; },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G' });
  // [B v0.5] le bandeau dit l'etat REEL du kit (7 oct. : « ajuste l'ecran Courir ») :
  //   pas de position GPS = pas pret (orange) ; en course = temps ecoule (bleu) ; fini = temps final (vert) ;
  //   abandon (20 s) et attente du reset = il faut rearmer (orange). Avant : « Pret a courir » avec 0 satellite.
  function dernierTemps() { var k = ['1320', '660', '330', '60'].filter(function (x) { return live[x]; })[0]; return k ? live[k].t : null; }
  function majCourir(t) {
    $('bU').textContent = DLC.unite();
    $('bVit').textContent = t ? DLC.nf(DLC.vit(t.kmh), 0) : '--';
    // [B v0.6] « −0,00 » s'affiche « 0,00 » : un zero n'a pas de signe
    $('bG').textContent = t ? DLC.nf(Math.abs(t.g) < 0.005 ? 0 : t.g, 2) : '--';
    var b = $('bBandeau'), cl = '', txt, gpsOk = !!(t && t.fix >= 3);
    if (!t) txt = T('b_pretOff');
    else if (t.etat === 'COURSE') { cl = 'course'; txt = T(t.sim ? 'b_etatSim' : 'b_etatCourse', { t: DLC.nf((t.el || 0) / 1000, 1) }); }
    else if (t.etat === 'FINI') { cl = 'fini'; var ft = dernierTemps(); txt = ft != null ? T('b_etatFini', { t: DLC.sec(ft) }) : T('etatFini'); }
    else if (t.etat === 'ABANDON') { cl = 'att'; txt = T('b_etatAbandon'); }
    else if (t.etat === 'ATTENTE') { cl = 'att'; txt = T('b_etatAttente'); }
    else if (!gpsOk) { cl = 'att'; txt = T('b_etatSansGps'); }
    else { cl = 'pret'; txt = T('b_etatPret'); }
    b.className = 'b-bandeau' + (cl ? ' ' + cl : ''); b.textContent = txt;
    // la ligne d'etat : le GPS, et le transbrake quand le kit l'envoie (mode Holley seulement)
    $('bEtatKit').hidden = !t;
    if (t) {
      $('bGps').className = 'b-gps ' + (gpsOk ? 'on' : 'off');
      $('bGpsTxt').textContent = gpsOk ? T('b_gpsOk', { s: t.sats != null ? t.sats : '--', hz: t.hz != null ? t.hz : '--' })
                                       : T('b_gpsNon', { s: t.sats != null ? t.sats : 0 });
      var tb = $('bTb'); tb.hidden = t.tb == null;
      if (t.tb != null) { tb.className = 'b-chip' + (!t.tbs ? '' : t.tb ? ' sel' : ' ok'); tb.textContent = T(!t.tbs ? 'b_tbAttente' : t.tb ? 'b_tbEngage' : 'b_tbRelache'); }
    }
    // Rearmer : quand le kit attend un reset, jamais pendant une course
    $('bRearmer').hidden = !(t && (t.etat === 'FINI' || t.etat === 'ABANDON' || t.etat === 'ATTENTE'));
    majIdxCourir(t);   // [B v0.9] la course a index
  }
  $('bRearmer').addEventListener('click', function () {
    $('bRearmer').disabled = true;
    DLKit.commande('rearmer').then(function () { live = {}; listeJal('bJal', live); }, function (err) { $('bCourirVide').hidden = false; $('bCourirVide').textContent = err.message; })
      .then(function () { $('bRearmer').disabled = false; });
  });
  // [B v0.6] LE GRAPHIQUE DE COURIR (proposition acceptee le 7 oct.) :
  //   pendant et apres un run : TOUT le run depuis le declenchement (vitesse + G), jalons en reperes, fige jusqu'a
  //   « Rearmer » (ou jusqu'au run suivant) ; au repos : la vitesse seule sur 10 s, echelle d'au moins 0-20.
  //   Avant : 10 s glissantes, vitesse + G meme a l'arret (deux lignes plates, echelle 0-1), le run sortait de l'ecran.
  var runG = null;   // { trig : ms du kit au declenchement, x[] (s depuis le declenchement), v[], g[], marques[], fini }
  DLKit.sur('telem', function (t) {
    if (t.etat === 'COURSE' && !enCourse) { enCourse = true; live = {}; listeJal('bJal', live); }
    if (t.etat === 'ARME') enCourse = false;
    var premier = !dernierTelem; dernierTelem = t; if (premier) rendreAccueil();
    majCourir(t);
    if (t.etat === 'COURSE') {
      if (!runG || runG.fini) runG = { trig: t.ms - (t.el || 0), x: [], v: [], g: [], marques: [], fini: false };
      runG.x.push((t.ms - runG.trig) / 1000); runG.v.push(t.kmh); runG.g.push(t.g);
    } else if (runG && !runG.fini && (t.etat === 'FINI' || t.etat === 'ABANDON')) runG.fini = true;
    else if (t.etat === 'ARME' && runG && runG.fini) runG = null;   // rearme : retour au direct
    buf.push([t.ms, t.kmh, t.g]); while (buf.length && buf[0][0] < t.ms - 11000) buf.shift();
    dessinerDirect();
  });
  DLKit.sur('jalon', function (j) {
    live[String(j.d)] = { t: j.t, v: j.v }; listeJal('bJal', live, String(j.d));
    // le repere se pose quand le kit annonce le jalon (a une trame pres) ; le temps exact est dans la liste.
    // ⚠ horloge du kit (ms), pas « el » : a l'arrivee, le 1/4 vient dans la trame DONE ou el vaut 0
    if (runG && j.ms != null) { runG.marques.push({ x: (j.ms - runG.trig) / 1000, texte: T('j' + j.d) }); dessinerDirect(); }
  });
  DLKit.sur('run', function (r) { if (r.fini) chargerRuns(); });
  function dessinerDirect() {
    if ($('v-courir').hidden) return;
    courbe.o.gTitre = DLC.unite();
    var legG = document.querySelector('#v-courir .legende .l-g'); if (legG) legG.hidden = !runG;
    if (runG && runG.x.length) {
      var fin = runG.x[runG.x.length - 1];
      courbe.donnees({ xMin: -0.3, xMax: Math.max(2, fin + 0.3), gMin: 0, dSym: true, reperes: runG.marques,
        series: [{ x: runG.x, y: runG.v.map(DLC.vit), axe: 'g', couleur: '--trait', largeur: 2.2 },
                 { x: runG.x, y: runG.g, axe: 'd', couleur: '--gcol', largeur: 1.5 }] });
      return;
    }
    if (!buf.length) return;
    var now = buf[buf.length - 1][0], x = [], v = [];
    buf.forEach(function (p) { if (p[0] >= now - 10000) { x.push((p[0] - now) / 1000); v.push(DLC.vit(p[1])); } });
    var vmax = v.reduce(function (a, b) { return Math.max(a, b); }, 0);
    courbe.donnees({ xMin: -10, xMax: 0, gMin: 0, gMax: vmax > 18 ? null : 20, series: [{ x: x, y: v, axe: 'g', couleur: '--trait', largeur: 2.2 }] });
  }
  var iRejeu = 0;
  $('bRejouer').addEventListener('click', function () {
    var l = window.DL_DEMO_RUNS || []; if (l.length) DLKit.commande('rejouer:' + l[iRejeu++ % l.length].id);
  });
  // [B v0.5] la course simulee du vrai kit : elle s'enregistre comme un run et efface le plus ancien des 8 -> on demande
  $('bSim').addEventListener('click', function () {
    if (!window.confirm(T('b_simConfirme'))) return;
    DLKit.commande('sim').catch(function (err) { $('bCourirVide').hidden = false; $('bCourirVide').textContent = err.message; });
  });

  // ---- runs
  var choisi = null, runA = null, runB = null, axe = 't';
  function rendreListe() {
    $('bRunsVide').hidden = runs.length > 0;
    $('bListe').innerHTML = runs.map(function (r, i) {
      var f = r.jalons['1320'];
      return '<button type="button" class="b-ligne' + (r.id === choisi ? ' choisi' : '') + '" data-id="' + r.id + '"><span class="q">' + (runs.length - i) + ' · ' + DLC.quand(r.quand) +
             '<span class="b-pastille" data-pastille="' + r.id + '" hidden></span></span><span class="vf num">' + (f && f.v ? DLC.nf(DLC.vit(f.v), 1) + ' ' + DLC.unite() : '') + '</span><span class="et num">' + DLC.sec(f && f.t) + '</span></button>';
    }).join('');
    $('bListe').querySelectorAll('.b-ligne').forEach(function (b) { b.addEventListener('click', function () { choisir(b.getAttribute('data-id')); }); });
    runs.forEach(function (r) { pastille($('bListe').querySelector('[data-pastille="' + r.id + '"]'), r); });
    if (!runs.length) { choisi = null; runA = null; $('bDetail').hidden = true; return; }
    if (!choisi || !runs.some(function (r) { return r.id === choisi; })) choisir(runs[0].id);
  }
  function choisir(id) {
    choisi = id;
    $('bListe').querySelectorAll('.b-ligne').forEach(function (b) { b.classList.toggle('choisi', b.getAttribute('data-id') === id); });
    var h = '<option value="">' + T('cmpAucun') + '</option>';
    runs.forEach(function (r, k) { if (r.id !== id) h += '<option value="' + r.id + '">' + T('b_run') + ' ' + (runs.length - k) + '</option>'; });
    $('bCmp').innerHTML = h; runB = null;
    DLKit.lireRun(id).then(function (r) { runA = r; rendreDetail(); });
  }
  $('bCmp').addEventListener('change', function () { var v = $('bCmp').value; (v ? DLKit.lireRun(v) : Promise.resolve(null)).then(function (b) { runB = b; rendreDetail(); }); });
  DLC.segment('bAxe', axe, function (v) { axe = v; rendreDetail(); });
  var courbeRun = new DLGraph.Courbe($('cvBRun'), { hauteur: 260, xFmt: function (v) { return DLC.nf(v, axe === 't' ? 1 : 0); },
    gFmt: function (v) { return DLC.nf(v, 0); }, dFmt: function (v) { return DLC.nf(v, 1); }, dTitre: 'G',
    surCurseur: function (info) { $('bLecture').textContent = DLC.lecture(info, axe, !!runB); } });
  function rendreDetail() {
    if (!runA || $('v-runs').hidden) return;
    $('bDetail').hidden = false;
    var i = runs.findIndex(function (r) { return r.id === choisi; });
    $('bDetailTitre').textContent = T('b_run') + ' ' + (runs.length - i) + ' · ' + DLC.quand(runA.quand);
    listeJal('bDJal', runA.jalons);
    $('bLgCmp').hidden = !runB;
    courbeRun.o.gTitre = DLC.unite(); courbeRun.o.xTitre = T(axe === 't' ? 'xTitreT' : 'xTitreD');
    courbeRun.donnees(DLC.donneesRun(runA, runB, axe));
    $('bLecture').textContent = T('lectureAide');
    pastille($('bTicketPastille'), runA);
  }
  // [B v0.2] la pastille « n/m » d'un run qui a un ticket : vert si tous les jalons sont dans la cible, orange sinon
  function pastille(el, run) {
    if (!el) return;
    var tk = run && tickets[run.id];
    if (!tk) { el.hidden = true; return; }
    var c = DLC.comparerTicket(run, tk);
    el.hidden = !c.nTot; el.textContent = T('b_tkPastille', { n: c.nOk, m: c.nTot });
    el.className = 'b-pastille ' + (c.nOk === c.nTot ? 'ok' : 'hors');
  }
  $('bVersTicket').addEventListener('click', function () { vue('ticket'); preparerTicket(choisi); });

  // ---- ticket  [B v0.2] comparaison du noyau commun (DLC.comparerTicket) ; le ticket tape est garde par run
  var CHAMPS_TK = ['60', '330', '660', '1320', 'v660', 'v1320'];
  function decimal(v, dec) { return DLC.nf(v, dec).replace(/\s/g, ''); }
  function remplirSaisie(tk) { CHAMPS_TK.forEach(function (k) { $('tk' + k).value = tk && tk[k] != null ? decimal(tk[k], k.charAt(0) === 'v' ? 2 : 3) : ''; }); }
  function preparerTicket(id) {
    $('bTicketVide').hidden = runs.length > 0; $('bTicketCorps').hidden = runs.length === 0;
    var sel = $('bTRun'), avant = id || sel.value;
    sel.innerHTML = runs.map(function (r, k) { return '<option value="' + r.id + '">' + T('b_run') + ' ' + (runs.length - k) + ' · ' + DLC.quand(r.quand) + '</option>'; }).join('');
    if (avant && runs.some(function (r) { return r.id === avant; })) sel.value = avant;
    montrerTicketRun();
  }
  // le run choisi : son ticket garde (s'il existe) et son resultat ; le bouton de demo seulement avec le kit de demo
  function montrerTicketRun() {
    var r = runs.filter(function (x) { return x.id === $('bTRun').value; })[0];
    remplirSaisie(r && tickets[r.id]);
    $('bRemplirDemo').hidden = !(r && DLKit.etat().mode === 'demo' && TICKETS_DEMO[r.id]);
    if (r && tickets[r.id]) montrerResultat(DLC.comparerTicket(r, tickets[r.id])); else $('bResultat').hidden = true;
    afficherPhoto(r);
  }
  $('bTRun').addEventListener('change', montrerTicketRun);

  // ---- [B v0.7] LA PHOTO DU TICKET (7 oct.) : appareil photo ou image, gardee DANS l'appareil avec son run
  //   (IndexedDB « dlxB », magasin « photos », cle = id du run). Jamais envoyee. Reduite a 1600 px (JPEG 0,82,
  //   ~150-300 ko) : une photo brute de 3-5 Mo remplirait vite le stockage du navigateur. Un echec se dit.
  var Photos = (function () {
    var db = null;
    function ouvrir() {
      if (db) return Promise.resolve(db);
      return new Promise(function (ok, ko) {
        var r = indexedDB.open('dlxB', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('photos'); };
        r.onsuccess = function () { db = r.result; ok(db); };
        r.onerror = function () { ko(r.error || new Error('IndexedDB')); };
      });
    }
    function tx(mode, f) {
      return ouvrir().then(function (d) {
        return new Promise(function (ok, ko) {
          var t = d.transaction('photos', mode), req = f(t.objectStore('photos'));
          t.oncomplete = function () { ok(req ? req.result : undefined); };
          t.onerror = t.onabort = function () { ko(t.error || new Error('IndexedDB')); };
        });
      });
    }
    return {
      lire: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
      ecrire: function (id, v) { return tx('readwrite', function (s) { return s.put(v, id); }); },
      retirer: function (id) { return tx('readwrite', function (s) { return s.delete(id); }); },
      toutEffacer: function () { return tx('readwrite', function (s) { return s.clear(); }); }
    };
  })();
  function reduirePhoto(fichier) {
    return new Promise(function (ok, ko) {
      var lecteur = new FileReader();
      lecteur.onerror = function () { ko(lecteur.error || new Error('lecture')); };
      lecteur.onload = function () {
        var img = new Image();
        img.onerror = function () { ko(new Error(T('b_photoIllisible'))); };
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);   // le navigateur applique deja l'orientation EXIF
          var data = c.toDataURL('image/jpeg', 0.82);
          // une image deja petite (capture d'ecran) peut grossir au reencodage : on garde la plus legere des deux
          if (k === 1 && /^data:image\/(jpeg|png|webp);/.test(lecteur.result) && lecteur.result.length < data.length) data = lecteur.result;
          ok({ data: data, w: c.width, h: c.height, quand: new Date().toISOString() });
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }
  function runTicket() { return runs.filter(function (x) { return x.id === $('bTRun').value; })[0]; }
  function afficherPhoto(r, puis) {
    $('bPhotoFig').hidden = true; $('bPhotoFig').classList.remove('grand'); $('bPhotoMsg').textContent = T('b_photoAide');
    $('bOcr').hidden = true; oublierOcr();
    if (!r) return;
    Photos.lire(r.id).then(function (p) {
      if (!p || runTicket() !== r) return;
      $('bPhotoImg').src = p.data; $('bPhotoImg').alt = T('b_photoAlt');
      $('bPhotoFig').hidden = false; $('bOcr').hidden = false;
      if (puis) puis();
    }, function (e) { $('bPhotoMsg').textContent = T('b_photoErr', { x: e.message }); });
  }
  function surFichier(ev) {
    var f = ev.target.files && ev.target.files[0], r = runTicket();
    ev.target.value = '';   // le meme fichier peut etre choisi une 2e fois
    if (!f || !r) return;
    $('bPhotoMsg').textContent = T('b_photoTraite');
    reduirePhoto(f).then(function (p) { return Photos.ecrire(r.id, p).then(function () { return p; }); }).then(function (p) {
      // [B v0.8] une photo neuve : on la lit tout de suite
      afficherPhoto(r, function () { $('bPhotoMsg').textContent = T('b_photoGardee', { ko: Math.round(p.data.length * 0.75 / 1024) }); lancerOcr(); });
    }, function (e) { $('bPhotoMsg').textContent = T('b_photoErr', { x: e.message }); });
  }

  // ---- [B v0.8] LA LECTURE AUTOMATIQUE DU TICKET (7 oct.) : DLOcr (js/ocr-ticket.js), hors ligne.
  //   Remplit les cases du ticket ; vert = lu pareil par plusieurs lectures ; orange = a verifier (une seule lecture,
  //   point remis, lectures en desaccord). Rien n'est compare sans « Comparer » : l'utilisateur confirme toujours.
  var OCR_CASES = { '60': 't60', '330': 't330', '660': 't660', '1320': 't1320', 'v660': 'v660', 'v1320': 'v1320' };
  var ocrRes = null, ocrEnCours = false;
  function oublierOcr() {
    ocrRes = null; $('bOcrCoteL').hidden = true; $('bOcrMsg').textContent = '';
    Object.keys(OCR_CASES).forEach(function (c) { var el = $('tk' + c); el.classList.remove('ocr-sur', 'ocr-verif'); el.removeAttribute('title'); });
  }
  function remplirOcr(cote) {
    var res = ocrRes; if (!res || !cote) return;
    var lu = res.couloirs[cote], nSur = 0, nVerif = 0, nRien = 0;
    Object.keys(OCR_CASES).forEach(function (c) {
      var el = $('tk' + c), x = lu.champs[OCR_CASES[c]];
      el.classList.remove('ocr-sur', 'ocr-verif'); el.removeAttribute('title');
      if (!x) { nRien++; return; }
      el.value = decimal(parseFloat(x.v), c.charAt(0) === 'v' ? 2 : 3);
      var raisons = [];
      if (x.repare) raisons.push(T('b_ocrRepare'));
      if (x.conflit) raisons.push(T('b_ocrConflit', { x: x.conflit }));
      if (x.sur && !x.repare) { el.classList.add('ocr-sur'); nSur++; el.title = T('b_ocrSur'); }
      else { el.classList.add('ocr-verif'); nVerif++; el.title = raisons.length ? raisons.join(' ; ') : T('b_ocrVerif'); }
    });
    var msg = T('b_ocrFini', { s: DLC.nf(res.duree / 1000, 0), sur: nSur, verif: nVerif });
    if (nRien) msg += ' ' + T('b_ocrPasLus', { n: nRien });
    if (res.date) msg += ' ' + T('b_ocrDate', { d: res.date });
    if (lu.retires.length) msg += ' ' + T('b_ocrRetire', { x: lu.retires.join(', ') });
    if (!nSur && !nVerif) msg = T('b_ocrRien');
    $('bOcrMsg').textContent = msg;
  }
  function lancerOcr() {
    if (ocrEnCours) return;
    var img = $('bPhotoImg'), r = runTicket(); if (!r || $('bPhotoFig').hidden) return;
    var numero = $('bNumero').value.trim().toUpperCase();
    prefs.v.numero = numero; prefs.garder();
    ocrEnCours = true; $('bOcrLire').disabled = true; oublierOcr();
    $('bOcrMsg').textContent = T('b_ocrEnCours', { n: 0, m: '…' });
    (img.complete ? Promise.resolve() : new Promise(function (ok) { img.onload = ok; })).then(function () {
      return DLOcr.lire(img, { base: '../../lib/tesseract/', numero: numero,
        progres: function (n, m) { $('bOcrMsg').textContent = T('b_ocrEnCours', { n: n, m: m }); } });
    }).then(function (res) {
      if (runTicket() !== r) return;   // l'utilisateur a change de run pendant la lecture
      ocrRes = res;
      $('bOcrCoteL').hidden = false;
      DLC.segment('bOcrCote', res.cote || '', function (v) { remplirOcr(v); });
      if (res.cote) remplirOcr(res.cote); else $('bOcrMsg').textContent = T('b_ocrCoteInconnu');
    }, function (e) {
      console.error('[B] lecture du ticket', e);
      $('bOcrMsg').textContent = e && e.message === 'ocr-absent' ? T('b_ocrAbsent') : T('b_ocrErr', { x: e && e.message || e });
    }).then(function () { ocrEnCours = false; $('bOcrLire').disabled = false; });
  }
  $('bOcrLire').addEventListener('click', lancerOcr);
  $('bNumero').value = prefs.v.numero || '';
  // une case corrigee a la main n'est plus « lue » : on retire sa marque
  Object.keys(OCR_CASES).forEach(function (c) { $('tk' + c).addEventListener('input', function () { this.classList.remove('ocr-sur', 'ocr-verif'); this.removeAttribute('title'); }); });
  $('bPhotoCam').addEventListener('change', surFichier);
  $('bPhotoFich').addEventListener('change', surFichier);
  $('bPhotoAgrandir').addEventListener('click', function () { $('bPhotoFig').classList.toggle('grand'); });
  $('bPhotoRetirer').addEventListener('click', function () {
    var r = runTicket(); if (!r) return;
    Photos.retirer(r.id).then(function () { afficherPhoto(r); }, function (e) { $('bPhotoMsg').textContent = T('b_photoErr', { x: e.message }); });
  });
  $('bRemplirDemo').addEventListener('click', function () { remplirSaisie(TICKETS_DEMO[$('bTRun').value]); });
  $('bComparer').addEventListener('click', function () {
    var r = runs.filter(function (x) { return x.id === $('bTRun').value; })[0]; if (!r) return;
    var tk = {}, faux = false, n = 0;
    CHAMPS_TK.forEach(function (k) {
      var v = DLC.lireNombre($('tk' + k).value);
      if (v !== null && isNaN(v)) faux = true;
      tk[k] = (v === null || isNaN(v)) ? null : v;
      if (tk[k] != null && k.charAt(0) !== 'v') n++;
    });
    if (faux || !n) { $('bResultat').hidden = false; $('bResCorps').innerHTML = ''; $('bBilan').textContent = T('b_saisieErr'); $('bConseil').textContent = ''; return; }
    tickets[r.id] = tk; garderTickets();
    montrerResultat(DLC.comparerTicket(r, tk));
    rendreListe(); if (runA && runA.id === r.id) pastille($('bTicketPastille'), runA);
    ticketFait = true; rendreAccueil();
  });
  var CONSEILS_B = { tk_conseil60: 'b_conseil60', tk_conseilTous: 'b_conseilTous', tk_conseilOk: 'b_conseilOk' };
  function montrerResultat(c) {
    $('bResCorps').innerHTML = c.temps.map(function (x) {
      return '<tr><td>' + T('j' + x.k) + '</td><td class="n num">' + DLC.nf(x.kit, 3) + '</td><td class="n num">' + DLC.nf(x.tk, 3) +
             '</td><td class="n num">' + (x.e >= 0 ? '+' : '−') + DLC.nf(Math.abs(x.e), 3) + '</td><td class="n"><span class="marque ' + x.cl + '">' + (x.cl === 'ok' ? '✓' : x.cl === 'proche' ? '≈' : '!') + '</span></td></tr>';
    }).concat(c.vitesses.map(function (x) {
      return '<tr><td>' + T('b_vitLab', { d: T('j' + x.k) }) + '</td><td class="n num">' + DLC.nf(x.kit, 2) + '</td><td class="n num">' + DLC.nf(x.tk, 2) +
             '</td><td class="n num">' + (x.pc >= 0 ? '+' : '−') + DLC.nf(Math.abs(x.pc), 1) + ' %</td><td></td></tr>';
    })).join('');
    $('bResultat').hidden = false;
    $('bBilan').textContent = c.nTot ? T('b_bilan', { n: c.nOk, m: c.nTot }) : '';
    $('bConseil').textContent = c.conseil ? T(CONSEILS_B[c.conseil]) : '';
  }

  // ---- regler
  DLC.brancherPas($('bForm'));
  function rendreRegl() { $('bRegVide').hidden = !!cfg; $('bRegCorps').hidden = !cfg; $('bFormMsg').textContent = ''; if (cfg) { DLC.remplirForm(cfg); ecuDepuisCfg(); idxDepuisCfg(); } }
  $('bForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    idxVersForm();   // [B v0.9] index + marge -> f-idxc, ID hexadecimal -> f-idxid (gardes dans l'appareil)
    DLC.envoyerForm($('bFormMsg'), function (c) { cfg = c; ecuDepuisCfg(); idxDepuisCfg(); rendreFiche(); majIdxCourir(dernierTelem); });
  });

  // ---- [B v0.9] LA COURSE A INDEX (kit PT2.1.60, 15 oct.) : la cible = index + marge (temps de la piste), le run de
  // reference, l'armement. Le kit envoie a l'ECU une commande 0-1023 (trame 0x406) qui ne fait que REDUIRE le papillon.
  // Le kit ne repond pas a ses commandes (idxref, idxarm) : l'ecran relit la config et dit si rien n'a change.
  var IDX_CLE = 'dlxB_idx';
  function idxPrefs() { try { return JSON.parse(localStorage.getItem(IDX_CLE)) || {}; } catch (e) { return {}; } }
  function idxGarder(p) { try { localStorage.setItem(IDX_CLE, JSON.stringify(p)); } catch (e) {} }
  function lireSec(el) { var v = parseFloat(String(el.value).replace(',', '.').replace(/\s/g, '')); return isFinite(v) ? v : NaN; }
  function idxConnu() { return !!(cfg && cfg.idxon != null); }
  function idxRefTexte(r) {
    if (!r) return T('b_idxRefAucune');
    var p = String(r).split(';');
    return T('b_idxRefActuelle', { h: p[1] || '?', t: p[2] ? DLC.sec(Number(p[2])) : '?' });
  }
  // le run choisi est-il celui que le kit a pris ? demo : « id;hh:mm:ss;t » ; vrai kit : « seq;hh:mm:ss;t » et l'id
  // du run porte l'heure (hhmmss) et le temps au 1/4 (voir analyserDump)
  function idxRefEst(id, r) {
    if (!r) return false;
    var p = String(r).split(';');
    return p[0] === id || (id.indexOf('_' + (p[1] || '').replace(/:/g, '') + '_') >= 0 && id.indexOf('_' + p[2] + '_') >= 0);
  }
  function idxMajCible() {
    var i = lireSec($('bIdxIndex')), m = lireSec($('bIdxMarge')), ok = isFinite(i) && isFinite(m) && i > 0 && m >= 0;
    $('f-idxc').value = ok ? Math.round((i + m) * 1000) : '';
    $('bIdxCible').textContent = ok ? T('b_idxCibleTxt', { c: DLC.sec(Math.round((i + m) * 1000)), i: DLC.sec(Math.round(i * 1000)) }) : T('b_idxCibleVide');
  }
  function idxMajId() {
    var h = $('bIdxId').value.trim().replace(/^0x/i, ''), v = /^[0-9a-f]{1,3}$/i.test(h) ? parseInt(h, 16) : NaN, ok = v >= 1 && v <= 0x7FF;
    $('f-idxid').value = ok ? v : '';
    $('bIdxMsg').className = ok || !h ? '' : 'msg-err'; $('bIdxMsg').textContent = ok || !h ? '' : T('b_idxIdErr');
  }
  function idxListeRuns() {
    var sel = $('bIdxRef'), avant = sel.value;
    var pleins = runs.filter(function (r) { return r.jalons && r.jalons['1320']; });
    sel.innerHTML = pleins.length ? pleins.map(function (r) {
      return '<option value="' + r.id + '">' + T('b_run') + ' ' + (runs.length - runs.indexOf(r)) + ' · ' + DLC.quand(r.quand) + ' · ' + DLC.sec(r.jalons['1320'].t) + ' s</option>';
    }).join('') : '<option value="">' + T('b_idxPasDeRun') + '</option>';
    if (avant && pleins.some(function (r) { return r.id === avant; })) sel.value = avant;
    else { var actuel = pleins.filter(function (r) { return idxRefEst(r.id, cfg && cfg.idxr); })[0]; if (actuel) sel.value = actuel.id; }
    $('bIdxRefBtn').disabled = !pleins.length;
  }
  function idxDepuisCfg() {
    $('bIdxEtape').hidden = !idxConnu();
    if (!idxConnu()) return;
    var p = idxPrefs(), c = Number(cfg.idxc) || 0;
    if (c && p.index != null && p.marge != null && Math.round((p.index + p.marge) * 1000) === c) {
      $('bIdxIndex').value = decimal(p.index, 3); $('bIdxMarge').value = decimal(p.marge, 3);
    } else if (c) { $('bIdxIndex').value = decimal((c - 100) / 1000, 3); $('bIdxMarge').value = decimal(0.1, 3); }
    else { $('bIdxIndex').value = p.index != null ? decimal(p.index, 3) : ''; $('bIdxMarge').value = decimal(p.marge != null ? p.marge : 0.1, 3); }
    $('bIdxId').value = (Number(cfg.idxid) || 0x406).toString(16).toUpperCase();
    idxMajCible(); idxMajId();
    $('bIdxRefTxt').textContent = idxRefTexte(cfg.idxr);
    idxListeRuns();
  }
  function idxVersForm() {
    if (!idxConnu()) return;
    idxMajCible(); idxMajId();
    var i = lireSec($('bIdxIndex')), m = lireSec($('bIdxMarge'));
    if (isFinite(i) && isFinite(m)) idxGarder({ index: i, marge: m });
  }
  ['bIdxIndex', 'bIdxMarge'].forEach(function (id) { $(id).addEventListener('input', idxMajCible); });
  $('bIdxId').addEventListener('input', idxMajId);
  function attendre(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  $('bIdxRefBtn').addEventListener('click', function () {
    var id = $('bIdxRef').value, msg = $('bIdxMsg'), btn = $('bIdxRefBtn'); if (!id) return;
    btn.disabled = true; msg.className = ''; msg.textContent = T('b_idxRefEnvoi');
    // le kit lit le run en flash dans sa boucle : on lui laisse 1,2 s avant de relire
    DLKit.commande('idxref:' + id).then(function () { return attendre(1200); }).then(function () { return DLKit.lireConfig(); })
      .then(function (c) {
        cfg = c; $('bIdxRefTxt').textContent = idxRefTexte(c.idxr);
        var pris = idxRefEst(id, c.idxr); msg.className = pris ? 'msg-ok' : 'msg-err'; msg.textContent = T(pris ? 'b_idxRefOk' : 'b_idxRefNon');
        majIdxCourir(dernierTelem);
      }).catch(function (e) { msg.className = 'msg-err'; msg.textContent = e.message; })
      .then(function () { btn.disabled = false; });
  });
  function majIdxCourir(t) {
    var on = idxConnu() && Number(cfg.idxon) === 1;
    $('bIdx').hidden = !on; if (!on) return;
    var ix = t && t.ix, arme = ix ? !!(ix[2] & 1) : !!Number(cfg.idxa), permanent = Number(cfg.idxam) === 1;
    $('bIdxChip').className = 'b-chip' + (arme ? ' sel' : ''); $('bIdxChip').textContent = T(arme ? 'b_idxArme' : 'b_idxPasArme');
    $('bIdxTxt').textContent = Number(cfg.idxc) ? T('b_idxCibleCourte', { c: DLC.sec(Number(cfg.idxc)) }) : T('b_idxCibleVide');
    $('bIdxArmer').hidden = permanent || !!(t && t.etat === 'COURSE');
    $('bIdxArmer').textContent = T(arme ? 'b_idxDesarmer' : 'b_idxArmer');
    $('bIdxDirect').textContent = (ix && (t.etat === 'COURSE' || ix[0] > 0))
      ? T('b_idxDirect', { a: ix[1] == null ? '--' : (ix[1] > 0 ? '+' : '') + ix[1], c: ix[0], p: Math.round(ix[0] / 10.23) }) : '';
  }
  $('bIdxArmer').addEventListener('click', function () {
    var b = $('bIdxArmer'), msg = $('bIdxCourirMsg'), vers = (dernierTelem && dernierTelem.ix ? (dernierTelem.ix[2] & 1) : Number(cfg && cfg.idxa)) ? 'idxoff' : 'idxarm';
    b.disabled = true; msg.textContent = '';
    DLKit.commande(vers).then(function () { return attendre(400); }).then(function () { return DLKit.lireConfig(); })
      .then(function (c) { cfg = c; if (Number(c.idxa) !== (vers === 'idxarm' ? 1 : 0)) msg.textContent = T('b_idxArmNon'); majIdxCourir(dernierTelem); })
      .catch(function (e) { msg.textContent = e.message; })
      .then(function () { b.disabled = false; });
  });

  // ---- [B v0.4] l'etape « Ton ECU » (7 oct.) : la marque pose le mode CAN, le debit et le depart
  //   Holley HP / Terminator X : HOLLEY, hecu 0 (transbrake canal 298), 1 Mbit/s automatique, ID de l'expander au choix
  //   Holley Dominator         : HOLLEY, hecu 1 (sortie 0 du canal 8), idem
  //   FuelTech FT450/550/600   : FUELTECH, 1 Mbit/s fixe, depart = 2-step du FuelTech, les 5 voies deja definies
  //   Link                     : LINK, debit au choix, Generic Dash ou Strada, ID lu (1000) et envoye (1200/1201)
  //   ECUMaster                : ECUMASTER, debit au choix, depart par la trame CAN d'embrayage (0x500)
  // f-mode et f-hecu sont des champs caches : seul ce bloc les pose. Rien ne part avant « Envoyer au kit ».
  var ANCIENS = ['LINK_AEM', 'FUELTECH_GPS', 'VAG_WHEELSPEED'];
  var TRAME_EMB = { scid: 1280, scext: 0, scby: 0, scmk: 1, sced: 2 };   // 0x500, octet 0, bit 0, front descendant (relache)
  function familleDe(c) {
    if (c.mode === 'HOLLEY') return Number(c.hecu) === 1 ? 'holley_dom' : 'holley_hp';
    return { FUELTECH: 'fueltech', LINK: 'link', ECUMASTER: 'ecumaster' }[c.mode] || 'autre';
  }
  function hex(v) { var n = Number(v); return v !== '' && Number.isInteger(n) && n >= 0 ? '0x' + n.toString(16).toUpperCase() : ''; }
  function fwAvant(fw, a, b, c) {   // « PT2.1.56 » avant 2.1.57 ?
    var m = /(\d+)\.(\d+)\.(\d+)/.exec(String(fw || '')); if (!m) return true;
    return (+m[1] - a || +m[2] - b || +m[3] - c) < 0;
  }
  function departTxt() {
    var id = Number($('f-scid').value), ed = Number($('f-sced').value);
    if (!id || !ed) return T('b_depAucun');
    return T('b_depTrame', { id: hex(id), o: $('f-scby').value, m: $('f-scmk').value, f: T(ed === 2 ? 'b_frDesc' : 'b_frMont') });
  }
  function majEcuTextes() {
    var f = $('bEcu').value;
    $('h-lid').textContent = hex($('f-lid').value);
    $('h-scid').textContent = hex($('f-scid').value);
    var e = Number($('f-eid').value); $('h-eid').textContent = e ? T('b_eidAide', { a: e, b: e + 1, h: hex(e) }) : '';
    $('bEcuResume').textContent = f === 'ecumaster' ? T('b_res_ecumaster', { base: hex(cfg && cfg.ecid != null ? cfg.ecid : 1024), dep: departTxt() }) : T('b_res_' + f);
    // ce que le firmware ne fait pas encore, et un depart CAN en plus du depart automatique : on le dit
    var av = [];
    if (f === 'link' && cfg && fwAvant(cfg.fw, 2, 1, 57)) av.push(T('b_avLink157', { fw: cfg.fw || '?' }));
    if (f !== 'ecumaster' && Number($('f-scid').value) && Number($('f-sced').value)) av.push(T('b_avTrameEnPlus', { dep: departTxt() }));
    $('bEcuAvert').hidden = !av.length; $('bEcuAvert').textContent = av.join(' ');
  }
  var CHAMPS_ECU = ['mode', 'hecu', 'cbr', 'hid', 'lect', 'lid', 'eid', 'scid', 'scext', 'scby', 'scmk', 'sced'];
  function montrerEcu(f, change) {
    if (!cfg) return;   // la config du kit n'est pas encore lue : rien a montrer ni a poser
    var holley = f === 'holley_hp' || f === 'holley_dom';
    // ⚠ a chaque changement de marque, on repart des valeurs DU KIT : sinon la marque d'avant laisse ses valeurs
    // (ex. la trame d'embrayage proposee en ECUMaster serait envoyee en Holley, ou le 1 Mbit/s du Holley resterait en Link)
    if (change) CHAMPS_ECU.forEach(function (k) { if (cfg[k] != null) $('f-' + k).value = cfg[k]; });
    $('bChAutre').hidden = f !== 'autre';
    $('bChCbr').hidden = !(f === 'link' || f === 'ecumaster' || f === 'autre');
    $('bChHid').hidden = !holley;
    $('bChLect').hidden = $('bChLid').hidden = $('bChEid').hidden = f !== 'link';
    $('bVoiesFt').hidden = f !== 'fueltech';
    if (holley) { $('f-mode').value = 'HOLLEY'; $('f-hecu').value = f === 'holley_dom' ? '1' : '0'; $('f-cbr').value = '1000000'; }
    if (f === 'fueltech') { $('f-mode').value = 'FUELTECH'; $('f-cbr').value = '1000000'; }
    if (f === 'link') {
      $('f-mode').value = 'LINK';
      // [B v0.4] en passant en Link, on part des DEFAUTS (7 oct. : « LINK_GD par defaut ») : Generic Dash,
      // ID lu 1000, ID envoye 1200/1201 -- pas d'un reste de TRACKLOGICS (un kit peut garder lect=LINK_STRADA)
      if (change && cfg.mode !== 'LINK') { $('f-cbr').value = '500000'; $('f-lect').value = 'LINK_GD'; $('f-lid').value = 1000; $('f-eid').value = 1200; }
      if (!$('f-lid').value) $('f-lid').value = 1000;
      if (!$('f-eid').value) $('f-eid').value = 1200;
    }
    if (f === 'ecumaster') {
      $('f-mode').value = 'ECUMASTER';
      if (change && cfg.mode !== 'ECUMASTER') {
        $('f-cbr').value = '1000000';   // le defaut du firmware pour ce mode
        // la trame d'embrayage, proposee (rien ne part avant « Envoyer au kit »)
        if (!Number($('f-scid').value)) { Object.keys(TRAME_EMB).forEach(function (k) { $('f-' + k).value = TRAME_EMB[k]; }); $('bDepartPlus').open = true; }
      }
    }
    if (f === 'autre') $('f-mode').value = $('bModeAutre').value;
    majEcuTextes();
  }
  function ecuDepuisCfg() {
    if (!cfg) return;
    var f = familleDe(cfg), oa = $('bEcu').querySelector('option[value="autre"]');
    oa.hidden = oa.disabled = f !== 'autre';
    if (f === 'autre') {
      var s = $('bModeAutre');
      if (!Array.prototype.some.call(s.options, function (o) { return o.value === cfg.mode; })) { var o = document.createElement('option'); o.value = o.textContent = cfg.mode; s.appendChild(o); }
      s.value = cfg.mode;
    }
    $('bVoiesFt').innerHTML = ['b_ftV1', 'b_ftV2', 'b_ftV3', 'b_ftV4', 'b_ftV5'].map(function (k) { return '<li>' + T(k) + '</li>'; }).join('');
    $('bEcu').value = f; montrerEcu(f, false);
  }
  $('bEcu').addEventListener('change', function () { montrerEcu($('bEcu').value, true); });
  $('bModeAutre').addEventListener('change', function () { $('f-mode').value = $('bModeAutre').value; });
  ['f-lid', 'f-eid', 'f-scid', 'f-scby', 'f-scmk'].forEach(function (id) { $(id).addEventListener('input', majEcuTextes); });
  ['f-sced', 'f-scext'].forEach(function (id) { $(id).addEventListener('change', majEcuTextes); });
  // [B v0.2] le kit : fiche, calibration, mise a jour
  function rendreFiche() {
    var e = DLKit.etat();
    $('bFicheVide').hidden = !!cfg; $('bFiche').hidden = !cfg; $('bCal').disabled = !cfg; $('bMaj').disabled = !cfg;
    if (!cfg) { $('bFiche').innerHTML = ''; return; }
    var l = [[T('fNom'), e.nom], [T('fFw'), cfg.fw], [T('fMode'), e.mode === 'demo' ? T('modeDemo') : 'Bluetooth'],
             [T('fGps'), T('gpsTxt', { s: cfg.sats != null ? cfg.sats : '--', hz: cfg.hz != null ? cfg.hz : '--' })], [T('fCal'), T(cfg.cal ? 'faite' : 'aFaire')]];
    $('bFiche').innerHTML = l.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('');
  }
  $('bCal').addEventListener('click', function () {
    $('bKitMsg').textContent = T('calEnCours'); $('bCal').disabled = true;
    // [B v0.3] un refus du vrai kit dit sa raison (vibrations, mouvement...) au lieu de « connecte un kit »
    DLKit.commande('calibrer').then(function () { $('bKitMsg').textContent = T('calOk'); },
      function (err) { $('bKitMsg').textContent = err.message === 'hors-ligne' ? T('horsLigneMsg') : err.message; })
      .then(function () { $('bCal').disabled = !cfg; });
  });
  $('bMaj').addEventListener('click', function () {
    // [B v0.3] avec le vrai kit : le kit quitte la piste pour sa mise a jour WiFi, on demande d'abord
    if (DLKit.etat().mode === 'ble' && !window.confirm(T('b_majConfirme'))) return;
    DLKit.commande('maj').then(function () { $('bKitMsg').textContent = T('b_majBle'); },
      function (err) { $('bKitMsg').textContent = err.message === 'maj-demo' ? T('majDemo') : err.message === 'hors-ligne' ? T('horsLigneMsg') : err.message; });
  });
  function prefsApp() {
    // [B v0.2] la langue : seulement ici, dans Regler (plus dans l'en-tete)
    DLC.segment('segLangue', prefs.v.langue, function (v) { prefs.v.langue = v; prefs.garder(); DLI18n.choisir(v); DLC.viderCache(); toutRendre(); });
    $('bVersion').textContent = T('b_version', { v: VERSION });
    DLC.segment('segUnite', prefs.v.unite, function (v) { prefs.v.unite = v; prefs.garder(); toutRendre(); });
    DLC.segment('segTheme', prefs.v.theme, function (v) { prefs.v.theme = v; prefs.garder(); DLC.poserTheme(v, prefs.v.texte === 'g'); toutRendre(); });
    DLC.segment('segTexte', prefs.v.texte, function (v) { prefs.v.texte = v; prefs.garder(); DLC.poserTheme(prefs.v.theme, v === 'g'); toutRendre(); });
  }
  $('bEffacer').addEventListener('click', function () {
    prefs.effacer(); tickets = {}; try { localStorage.removeItem(TK_CLE); } catch (e) {}
    Photos.toutEffacer().catch(function (e) { console.error('[B] photos pas effacees', e); });   // [B v0.7] les photos aussi
    $('bPriveMsg').textContent = T('priveOk'); rendreListe(); preparerTicket();
  });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { dessinerDirect(); rendreDetail(); }); }

  function toutRendre() {
    var e = DLKit.etat();
    $('bPiluleTxt').textContent = e.connecte ? e.nom.replace('DRAGLOG_', '') : T('bConnecter');
    prefsApp(); rendreAccueil(); majCourir(dernierTelem); listeJal('bJal', live); rendreListe(); preparerTicket(); rendreFiche();
    if (cfg) { DLC.remplirForm(cfg); ecuDepuisCfg(); }
    dessinerDirect(); rendreDetail();
  }
  prefsApp(); rendreAccueil(); majCourir(null); listeJal('bJal', null); rendreListe(); rendreRegl(); rendreFiche(); preparerTicket();
  $('bRejouer').disabled = true;
  vue(VUES.indexOf(prefs.v.vue) >= 0 ? prefs.v.vue : 'accueil');
})();
