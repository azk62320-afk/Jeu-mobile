# 🏝️ Îles Célestes

Un jeu de stratégie et de construction pour mobile, vu de dessus en 3D isométrique.
Tu es le gardien d'une île qui flotte dans les nuages : construis ton village, récolte
des ressources, entraîne une armée et pille les îles voisines.

## Jouer

Le jeu est en HTML/JavaScript pur, sans dépendances. Il se joue dans le navigateur du téléphone.

- **En local** : `python3 -m http.server 8000` dans ce dossier, puis ouvre `http://localhost:8000`
  (ou l'adresse IP de l'ordinateur depuis le téléphone, sur le même Wi-Fi).
- **En ligne** : active GitHub Pages sur la branche, puis ouvre le lien sur ton téléphone et
  choisis « Ajouter à l'écran d'accueil » : le jeu s'ouvre alors en plein écran comme une appli.

La partie est sauvegardée automatiquement sur l'appareil, et les ressources continuent d'être
produites quand le jeu est fermé.

## Ce qu'il y a dans le jeu

- **Ressources** : 💎 cristaux et ☁️ brume, produits par les mines et les puits, gardés dans les coffres et réservoirs.
- **11 bâtiments** sur 5 niveaux, débloqués en améliorant le 🔮 Cœur de l'île, avec 2 bâtisseurs.
- **5 troupes** : 🐦 Plumeur, 🏹 Archère des vents, 💣 Sapeur-nuage (casse les murs), 🗿 Golem de roc (vise les défenses), 🎈 Aéronef (vole au-dessus des murs).
- **3 défenses** : 🎯 Baliste (sol, longue portée), ⚡ Tour à éclairs (rebondit entre les ennemis), 🌀 Canon à vent (repousse les troupes), plus les murs.
- **Attaques** sur des îles générées au hasard, avec 3 étoiles, du butin et des trophées 🏆.
- **Le vent** 🌬️ (la particularité du jeu) : à chaque attaque il souffle dans une direction différente.
  Les troupes qui l'ont dans le dos vont plus vite, celles qui vont contre lui sont ralenties.

## Contrôles

- Glisser : déplacer la vue · Pincer / molette : zoomer
- Toucher un bâtiment : le sélectionner (puis le faire glisser pour le déplacer)
- En attaque : choisir une troupe en bas, toucher la carte pour la déposer, garder le doigt appuyé pour en déposer plusieurs

## Fichiers

- `index.html`, `style.css` : l'interface
- `game.js` : tout le jeu (données, économie, combat, rendu, contrôles)
- `manifest.json`, `sw.js`, `icon.svg` : installation sur l'écran d'accueil et jeu hors connexion
