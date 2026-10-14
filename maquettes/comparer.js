'use strict';
// Page de comparaison : les trois maquettes cote a cote, au format telephone (390 x 844) ou tablette (800 x 1280,
// reduite), dans la meme langue et le meme theme. Chaque maquette se connecte seule au kit de demonstration.
(function () {
  var TXT = {
    fr: { titre: 'Trois maquettes DRAGLOGICS', sous: 'Chaque maquette est connectée au kit de démonstration. Touche, fais défiler, rejoue un run. Note ce que tu aimes dans chacune.',
          fTel: 'Téléphone', fTab: 'Tablette', thDef: 'Thème de la maquette', thClair: 'Clair', thSombre: 'Sombre', ouvrir: 'Ouvrir seule',
          aNom: 'Cockpit', bNom: 'Guidée', cNom: 'Une page',
          aPoints: ['Sombre, très gros chiffres : lisible dans la voiture', '3 boutons en bas : Direct, Runs, Réglages', 'Seulement l’essentiel ; le reste est replié', 'Détail d’un run en plein écran'],
          bPoints: ['Accueil à 4 grandes tuiles et étapes 1-2-3', 'Comparaison au ticket de la piste, avec un conseil', 'Réglages par étapes numérotées', 'Clair et doux'],
          cPoints: ['Tout sur une seule page qui défile', 'La barre du bas saute aux sections', 'Historique avec une mini-courbe par run ; cocher 2 runs = comparaison', 'Réglages dans une feuille'] },
    en: { titre: 'Three DRAGLOGICS mockups', sous: 'Each mockup is connected to the demo kit. Tap, scroll, replay a run. Note what you like in each one.',
          fTel: 'Phone', fTab: 'Tablet', thDef: 'Mockup theme', thClair: 'Light', thSombre: 'Dark', ouvrir: 'Open alone',
          aNom: 'Cockpit', bNom: 'Guided', cNom: 'One page',
          aPoints: ['Dark, very large numbers: readable in the car', '3 buttons at the bottom: Live, Runs, Settings', 'Only the essentials; the rest is folded', 'Full-screen run detail'],
          bPoints: ['Home with 4 large tiles and steps 1-2-3', 'Check against the time slip, with advice', 'Settings as numbered steps', 'Light and soft'],
          cPoints: ['Everything on one scrolling page', 'The bottom bar jumps to the sections', 'History with a mini chart per run; tick 2 runs = comparison', 'Settings in a sheet'] }
  };
  var etat = { lang: 'fr', format: 'tel', theme: '' };
  var TAILLES = { tel: [390, 844, 1], tab: [800, 1280, 0.5] };
  function $(id) { return document.getElementById(id); }
  function texte() {
    var t = TXT[etat.lang];
    document.documentElement.lang = etat.lang;
    ['titre', 'sous', 'fTel', 'fTab', 'thDef', 'thClair', 'thSombre'].forEach(function (k) { $(k).textContent = t[k]; });
    document.querySelectorAll('[data-t]').forEach(function (e) {
      var v = t[e.getAttribute('data-t')];
      if (Array.isArray(v)) { e.innerHTML = ''; v.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; e.appendChild(li); }); }
      else e.textContent = v;
    });
  }
  function charger() {
    var z = TAILLES[etat.format];
    ['a', 'b', 'c'].forEach(function (m) {
      var url = m + '/?demo=1&lang=' + etat.lang + (etat.theme ? '&theme=' + etat.theme : '');
      var f = $('if' + m.toUpperCase()), cadre = f.parentNode;
      f.style.width = z[0] + 'px'; f.style.height = z[1] + 'px'; f.style.transform = 'scale(' + z[2] + ')';
      cadre.style.width = Math.round(z[0] * z[2]) + 12 + 'px'; cadre.style.height = Math.round(z[1] * z[2]) + 12 + 'px';
      f.src = url; $('lien' + m.toUpperCase()).href = url;
    });
  }
  function seg(id, cle) {
    $(id).querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        etat[cle] = b.getAttribute('data-v'); texte(); charger();
      });
    });
  }
  seg('segLangue', 'lang'); seg('segFormat', 'format'); seg('segTheme', 'theme');
  texte(); charger();
})();
