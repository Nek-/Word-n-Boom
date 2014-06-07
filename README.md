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

Lancer l'application
--------------------

```bash
cd wordnboom
# any webserver will do the job, i usualy use the php one
php -S localhost:8000 &
node js/server.js
```

Then just open a browser and go to http://localhost:8000/index.html !