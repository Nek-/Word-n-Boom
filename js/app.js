

var socket   = io('http://localhost:8888'),
    gameData = {};

socket.on('game.players', function (data) {
    gameData.players = data.players;
});

$(document).ready(function () {

    $('#login-form').submit(function (e) {
        e.preventDefault();

        var $pseudo = $('#pseudo'),
            pseudo  = $pseudo.val(),
            $email  = $('#email'),
            email   = $email.val()
        ;

        if (pseudo.trim().length === 0 && gameData.players.indexOf(pseudo) !== '-1') {
            alert('Pseudo invalide.');
            return;
        }

        if (email.trim().length === 0) {
            if (!confirm('Attention, vous n\'avez pas précisé votre adresse email, vous n\'aurez pas d\'avatar. Voulez vous continuer ?')) {
                return;
            }
        }

        launchApp(pseudo, email);

        return false;
    });
});

function launchApp (pseudo, email) {

    gameData.idents = {
        pseudo: pseudo,
        email:  email
    };

    var $login = $('#login');
    $login.addClass('closed');
    setTimeout(function () { $login.remove(); }, 1500);


    var chat = new ChatApp($('#message-box input'), $('#messages-list'));

    socket.emit('game.connection', { pseudo: pseudo, email: email });
}


var ChatApp = function ($input, $messages) {
    this.$input    = $input;
    this.$messages = $messages;
    var self       = this;

    $input.keypress(function (e) {
        if (e.which === 13) {
            var message = { pseudo: gameData.idents.pseudo, message: $input.val() };

            socket.emit('chat.message', message);
            this.addMessage(message);
            this.$input.val('');
        }
    }.bind(this));

    socket.on('chat.message', function () {
        self.addMessage();
    });

    socket.on('chat.lastMessages', function (data) {
        $.each(data.messages, function (index, value) {
            self.addMessage(value);
        });
    });

    this.addMessage = function (message) {
        this.$messages.append('<p>&lt;' + message.pseudo + '&gt; ' + message.message + '</p>');
    };
};
