var app = require('http').createServer(handler);
var io  = require('socket.io')(app);
var fs  = require('fs');
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


var messages = [],
    players  = []
    game     = null,
    dictionary;

io.on('connection', function (socket) {
    var user = null;

    socket.emit('game.players', { players: players });
    
    socket.on('game.connection', function (data) {
        players.push(data.pseudo);
        user = data.pseudo;
        console.log(user + ' vient de se connecter');
        
        // events on game connection
        socket.emit('chat.lastMessages', { messages: messages });

        socket.on('chat.message', function(data) {
            if (messages.length >= 30) {
                messages.shift();
            }
            messages.push(data);
            socket.to('other').emit('chat.message');
        });

        socket.on('game.start', function(){
            if (game !== null) {
                socket.emit('message', {type: 'error', content: 'Une partie est déjà en cours !'});
            } else {
                game = new Game();
                game.start();
            }
        });

        socket.on('game.iWantToPlay', function () {
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
                game.userTypes(data, socket);
            }
        })
    });

    socket.on('disconnect', function() {
        players.removeValue(user);
        socket.to('other').emit('chat.leave', { user: user });
        console.log(user + ' vient de se déconnecter');
    });
});

function Game () {

    this.players      = [];
    this.roundTimeout = null;

    this.start = function () {
        io.emit('game.start', {});
        setTimeout(this.realStart.bind(this), 30000);
    };

    this.addPlayer = function (pseudo) {
        this.players.push(pseudo);
    };

    this.realStart = function () {
        if (this.players.length < 2) {
            io.emit('game.cantStart', {});
            io.emit('message', {type: 'info', content: 'La partie ne peut pas démarrer car un seul joueur est connecté.'});
            this.end();
        } else {
            io.emit('game.realStart', {players: this.players});

            this.currentPlayer = this.players[0];
            this.startRound();
        }
    };

    this.startRound = function () {
        io.emit('game.round', { player: this.currentPlayer, letters: this.generateLetters() });

        // 30min chaque tour dure 30s
        this.roundTimeout = setTimeout(this.endRound.bind(this), 30000);
    };

    this.answer = function(data, socket) {
        if (isValidAnswer(data.answer)) {
            this.nextPlayer();
            io.emit('game.turn', { player: this.currentPlayer, letters: this.generateLetters() })
        } else {
            socket.emit('game.tryAgain', {});
        }
    };

    this.userTypes = function (data, socket, user) {
        if (user == this.currentPlayer) {
            socket.to('other').emit('game.types', { user: data.letter });
        }
    };

    this.endRound = function () {
        io.emit('game.endRound', { pseudo: this.currentPlayer });
        this.players.removeValue(this.currentPlayer);

        if (this.player.length < 2) {
            io.emit('game.winner', {pseudo: this.player[0]});
        } else {
            this.currentPlayer = this.player[0];
            this.startRound();
        }
    };

    this.generateLetters = function () {
        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            letterLength = letters.length,
            imax = Math.floor(Math.random()*2) + 1,
            res  = '';

        for (var i = 0; i <= imax; i++) {
            res += letters.charAt(Math.floor(Math.random() * letterLength));
        }

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
        if (dictionary.indexOf(answer) !== -1) {
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
