

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

    // Lorsqu'un message doit être affiché
    socket.on('message', function(data) {

        // Le type du message peut être
        //   - info
        //   - error
        var messageType    = data.type,
            messageContent = data.content;

        // ça serait certainement mieux de l'ajouter dans le dom avec une box, un truc comme as
        console.log(messageType, messageContent);
    });
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

var GameApp = function ($game) {
    this.$game     = $game;
    this.$button   = $game.find('#buttons');
    this.$letters  = $game.find('#letters');
    this.templates = {
        player: '\
    <div class="player inactive">\
        <img src="images/avatar_normal.png" alt="" />\
        <p class="nickname">Nek</p>\
        <p class="word">SOMET<span class="blinker">_</span></p>\
    </div>',
        letters: '<p>Trouvez un mot composé de ces lettres:<br /><span class="big"></span></p>'
    };

    this.timeout      = null;
    this.timeoutRound = null;
    this.clock        = 0;
    this.clockRound   = 0;

    socket.on('game.start', this.start.bind(this));
    socket.on('game.realStart', this.realStart.bind(this));

    /**
     * When the user click on a button, the server will start accepting
     * new guys in the game
     *
     * Cette méthode est exécutée lorsque l'utilisateur clique sur le bouton pour 
     * démarrer une partie
     */
    this.emitStart = function () {
        socket.emit('game.start', {});
    };

    /**
     * React to the socket that tell a game is started
     *
     * Cette méthode réagit au socket qui est envoyé par le serveur
     * pour démarrer le jeu
     */
    this.start = function () {
        this.$buttons.html('<button>Rejoindre la partie</button>');
        this.$buttons.find('button').click(this.addMe.bind(this));
    };

    /**
     * Cette méthode demande au serveur pour jouer dans la partie
     * qui vient de démarrer
     */
    this.addMe = function() {
        socket.emit('game.iWantToPlay', {});
    };

    /**
     * Is executed after people are registered in a game
     *
     * Cette méthode est exécutée lorsque le compteur de temps permettant
     * de rejoindre la partie est arrivé à expiration
     */
    this.realStart = function () {
        this.gameCountdown();
        this.newRound();
    };

    /**
     * Cette méthode est appelée lorsque le tour d'un joueur passe
     */
    this.newRound = function (data) {
        this.$letters.html(this.templates.letters);
        this.$letters.find('.big').html(this.generateLetters());
    };

    this.end = function() {

    };


    ///////////////////////
    // Countdowns
    ///////////////////////

    this.startCountdown = function() {
        if (this.clock === null) {
            this.clock = 30;
        } else {
            this.clock--;
        }

        // Place to show the countdown

        if (this.clock !== 0) {
            this.timeout = setTimeout(this.startCountdown.bind(this), 1000);
        } else {
            this.clock   = 0;
            this.timeout = null;
        }
    };

};