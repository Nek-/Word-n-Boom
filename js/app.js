

var socket   = io('http://nantes.nekland.fr:8888'),
    gameData = {
        idents: {
            pseudo:   null,
            email:    null,
            gravatar: null
        }
    };

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

    gameData.idents.pseudo   = pseudo;
    gameData.idents.email    = email;
    gameData.idents.gravatar = 'http://www.gravatar.com/avatar/' + md5(email) + '.jpg?s=' + '80&d=' + encodeURI('http://nantes.nekland.fr:8000/images/avatar_normal.png');

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

    new GameApp($('#game'));
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

        e.stopPropagation();
    }.bind(this));

    socket.on('chat.message', function (data) {
        self.addMessage(data);
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
    this.$buttons  = $game.find('#buttons');
    this.$letters  = $game.find('#letters');
    this.$me       = null;
    this.templates = {
        player: '\
    <div class="player inactive">\
        <img src="images/avatar_normal.png" alt="" />\
        <p class="nickname"></p>\
        <p class="word"><span class="text"></span><span class="blinker">_</span></p>\
    </div>',
        letters: '<p>Trouvez un mot composé de ces lettres:<br /><span class="big"></span></p>'
    };

    this.timeout      = null;
    this.timeoutRound = null;
    this.clock        = 0;
    this.clockRound   = 0;
    this.places       = [
        'pos7',
        'pos3',
        'pos8',
        'pos5',
        'pos1',
        'pos4',
        'pos6',
        'pos2'
    ];
    this.currentPlayer = null;
    this.players       = [];

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
        this.$buttons.html('');
    };

    /**
     * Is executed after people are registered in a game
     *
     * Cette méthode est exécutée lorsque le compteur de temps permettant
     * de rejoindre la partie est arrivé à expiration
     */
    this.realStart = function (data) {
        this.$buttons.html('');
        this.players = data.players;

        $.each(data.players, function (i, value) {
            this.addPlayer(value, i);
        }.bind(this));
    };

    this.addPlayer = function (player, position) {
        var $template = $(this.templates.player);
        $template.addClass(this.places[position]);
        $template.find('.nickname').html(player);

        if (player === gameData.idents.pseudo) {

            this.$me = $template;
        }

        this.$game.append($template);
    };

    /**
     * Cette méthode est appelée lorsqu'un joueur a perdu et qu'on démarre un nouveau tour
     */
    this.newRound = function (data) {
        this.turn(data);
    };

    this.turn = function (data) {
        this.currentPlayer = data.player;
        this.$letters.html(this.templates.letters);
        this.$letters.find('.big').html(data.letters);

        // Retire la classe inactive
        // Au joueur qui joue
        this.$game.find('.player:not(.inactive)').addClass('inactive');
        this.$game.find('.player.'+this.places[this.players.indexOf(data.player)]).removeClass('inactive');
    };

    this.myTurn = function () {
    };

    this.isMyTurn = function () {
        return this.currentPlayer == gameData.idents.pseudo;
    };

    this.onKeyPressed = function (e) {
        if (this.isMyTurn()) {

            if (e.which === 13) {
                socket.emit('game.answer', { answer: this.$me.find('.text').html() });
            } else {
                this.$me.removeClass('fail');
                this.$me.find('.text').append(String.fromCharCode(e.charCode));
            }
        }
    };

    this.end = function() {
        this.$game.find('.player').remove();
        this.$buttons.html('<button>Lancer une nouvelle partie</button>');
        this.$buttons.find('button').click(this.emitStart.bind(this));
        this.$letters.html('');
    };

    this.winner = function (data) {
        alert(data.pseudo + ' a remporté la partie :) ');
        this.end();
    };

    this.tryAgain = function () {
        this.$me.addClass('fail');
    };


    ///////////////////////////////////////
    // Countdowns (inutiles finalement :'))
    ///////////////////////////////////////

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


    socket.on('game.start', this.start.bind(this));
    socket.on('game.realStart', this.realStart.bind(this));
    socket.on('game.cantStart', this.end.bind(this));
    socket.on('game.round', this.newRound.bind(this));
    socket.on('game.winner', this.winner.bind(this));
    socket.on('game.tryAgain', this.tryAgain.bind(this));

    $(document).keypress(this.onKeyPressed.bind(this));
    
    this.end();
};