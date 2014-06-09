var app        = require('http').createServer(handler);
var io         = require('socket.io')(app);
var fs         = require('fs');
var lineReader = require('line-reader');

app.listen(8888);

function handler (req, res) {}
Array.prototype.removeValue = function(val) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === val) {
            this.splice(i, 1);
            i--;
        }
    }
    return this;
}


var messages   = [],
    players    = [],
    avatars    = [],
    game       = null,
    dictionary = [];

io.on('connection', function (socket) {
    var user = null;

    socket.emit('game.players', { players: players });
    
    socket.on('game.connection', function (data) {
        players.push(data.pseudo);
        avatars.push(data.avatar);
        user = data.pseudo;
        console.log(user + ' vient de se connecter');
        
        // events on game connection
        socket.emit('chat.lastMessages', { messages: messages });

        socket.on('chat.message', function(data) {
            if (messages.length >= 30) {
                messages.shift();
            }
            messages.push(data);
            socket.broadcast.emit('chat.message', { pseudo: user, message: data.message });
        });

        socket.on('game.start', function(){
            if (game !== null) {
                socket.emit('message', {type: 'error', content: 'Une partie est déjà en cours !'});
            } else {
                console.log('Création d\'une nouvelle partie.');
                game = new Game();
                game.start();
            }
        });

        socket.on('game.iWantToPlay', function () {
            console.log(user + ' a rejoint la partie.');
            if (game) {
                game.addPlayer(user);
            }
        });

        socket.on('game.answer', function(data) {
            if (game) {
                game.answer(data, socket);
            }
        });

        socket.on('game.type', function(data) {
            if (game) {
                game.userTypes(data, socket, user);
            }
        });

        if (game !== null) {
            if (game.canJoin()) {
                socket.emit('game.start', {});
            } else {
                socket.emit('game.inProgress', { players: game.getPlayers(), avatars: game.getAvatars() });
            }
        }
    });

    socket.on('disconnect', function() {
        if (user !== null) {
            avatars.removeValue(avatars[players.indexOf(user)]);
            players.removeValue(user);
            socket.broadcast.emit('chat.leave', { user: user });
            console.log(user + ' vient de se déconnecter.');
        }
    });
});

function Game () {

    this.avatars           = [];
    this.players           = [];
    this.roundTimeout      = null;
    this.letters           = '';
    this.waitingForPlayers = false;

    this.start = function () {
        io.emit('game.start', {});
        this.waitingForPlayers = true;
        setTimeout(this.realStart.bind(this), 30000);
    };

    this.canJoin = function () {
        return this.waitingForPlayers;
    };

    this.addPlayer = function (pseudo) {
        this.players.push(pseudo);
        this.avatars.push(avatars[players.indexOf(pseudo)]);
    };

    this.realStart = function () {
        this.waitingForPlayers = false;
        if (this.players.length < 2) {
            io.emit('game.cantStart', {});
            io.emit('message', {type: 'info', content: 'La partie ne peut pas démarrer car un seul joueur est connecté.'});
            this.end();
        } else {
            io.emit('game.realStart', {players: this.players, avatars: this.avatars});

            this.currentPlayer = this.players[0];
            this.startRound();
        }
    };

    this.startRound = function () {
        io.emit('game.round', { player: this.currentPlayer, letters: this.generateLetters() });

        // 30min chaque tour dure 30s
        this.roundTimeout = setTimeout(this.endRound.bind(this), 120000);
    };

    this.answer = function(data, socket) {
        console.log('Réponse: '+ data.answer);
        if (isValidAnswer(data.answer)) {
            console.log('... qui est valide');
            this.nextPlayer();
            io.emit('game.turn', { player: this.currentPlayer, letters: this.generateLetters() })
        } else {
            socket.emit('game.tryAgain', {});
        }
    };

    this.userTypes = function (data, socket, user) {
        if (user == this.currentPlayer) {
            socket.broadcast.emit('game.type', { word: data.word });
        }
    };

    this.endRound = function () {
        io.emit('game.endRound', { pseudo: this.currentPlayer });
        this.avatars.removeValue(this.avatars[this.players.indexOf(this.currentPlayer)]);
        this.players.removeValue(this.currentPlayer);

        if (this.players.length < 2) {
            io.emit('game.winner', {pseudo: this.players[0]});
            this.end();
        } else {
            this.currentPlayer = this.players[0];
            this.startRound();
        }
    };

    function areValidLetters (letters) {
        var res = 0;

        dictionary.forEach(function (value) {
            if (value.indexOf(letters) > -1) {
                res++;
            }
        });

        return res > 40;
    }

    this.generateLetters = function () {
        var letters = 'abcdefghijklmnopqrstuvwxyz',
            letterLength = letters.length,
            imax = Math.floor(Math.random()*2) + 1,
            res  = '';

        do {
            res = '';
            for (var i = 0; i <= imax; i++) {
                res += letters.charAt(Math.floor(Math.random() * letterLength));
            }
        } while (!areValidLetters(res));

        this.letters = res;

        return res;
    };

    this.nextPlayer = function () {
        var index = this.players.indexOf(this.currentPlayer);

        if (++index == this.players.length) {
            this.currentPlayer = this.players[0];
        } else {
            this.currentPlayer = this.players[index];
        }
    };

    function isValidAnswer (answer) {
        if (dictionary.indexOf(answer.trim().toLowerCase()) !== -1) {
            return true;
        }

        return false;
    }

    /**
     * Nettoie la mémoire
     */
    this.end = function() {
        game = null;
    };

    this.getPlayers = function () {
        return this.players;
    };

    this.getAvatars = function () {
        return this.avatars;
    };

}

///////////////////////////////////////////
//                                       //
// Préchargement du dictionnaire         //
// en mémoire pour un accès plus rapide  //
//                                       //
///////////////////////////////////////////

lineReader.eachLine('dictionary', function (line, last) {
    var word = line.trim();
    if (word !== '') {
        dictionary.push(word);
    }
});
