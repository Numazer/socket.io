# Flip7 avec Socket.IO

Petit projet Node.js pour jouer a Flip7 dans une room en multijoueur avec Socket.IO.

## Installation

```bash
npm install
```

## Lancer le projet

```bash
node index.js
```

Ensuite, ouvre :

```text
http://localhost:3000
```

## Lancer les tests

```bash
npm test
```

## Ce que fait le projet

- rejoindre une room avec un nom
- lancer une manche
- jouer chacun son tour
- piocher ou s'arreter
- perdre la manche en cas de doublon
- faire un Flip7 avec 7 cartes differentes
- calculer les scores en fin de manche

## Fichiers utiles

- [index.js](/Users/saadiemmanuel/developpement/socket.io/index.js) : serveur Express + Socket.IO + gestion des rooms
- [index.html](/Users/saadiemmanuel/developpement/socket.io/index.html) : interface simple dans le navigateur
- [games/flip7.js](/Users/saadiemmanuel/developpement/socket.io/games/flip7.js) : regles du jeu
- [games/flip7.test.js](/Users/saadiemmanuel/developpement/socket.io/games/flip7.test.js) : tests Vitest

## Etat actuel

Le jeu est deja jouable a plusieurs dans une meme room.

Il reste possible d'ameliorer certaines choses :

- une vraie fin de partie sur plusieurs manches
- un chat par room au lieu d'un chat global
- une interface plus propre

## Note

Le coeur des regles Flip7 est teste avec Vitest.
