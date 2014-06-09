Word n Boom
===========

Jeu très simple utilisant socket.io développé dans le cadre de l'université.

*Le jeu est encore en cours de développement pour le moment.*

Installer l'application
-----------------------

```bash
git clone git@github.com:Nek-/Word-n-Boom.git wordnboom
cd wordnboom/
npm install
bower install
```

Il faudra modifier le fichier `config.js` pour que tout fonctionne bien, une configuration classique de test peut être la suivante:

```
var Config = {
    host: 'localhost',
    port: 8000,
    portSockets: 8888
};
```


Lancer l'application
--------------------

```bash
cd wordnboom
# N'importe quel serveur web fera l'affaire, j'utilise habituellement le serveur de PHP
php -S localhost:8000 &
node js/server.js
```

Il ne vous reste plus qu'à ouvrir un navigateur et à consulter l'adresse http://localhost:8000/index.html !