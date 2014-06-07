var app = require('http').createServer(handler);
var io  = require('socket.io')(app);
var fs  = require('fs');

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
    players  = [];

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
            console.log (data.pseudo + ' a écrit "' + data.message + '"');
            if (messages.length >= 30) {
                messages.shift();
            }
            messages.push(data);
            socket.to('other').emit('chat.message');
        });
    });

    socket.on('disconnect', function() {
        players.removeValue(user);
        socket.to('other').emit('chat.leave', { user: user });
        console.log(user + ' vient de se déconnecter');
    });
});