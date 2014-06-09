function notify (message, type, time) {
    var $element = $('<div class="notification"></div>');

    $element.append(message);

    if (type) {
        $element.addClass(type);
    }

    $('body').append($element);

    setTimeout(function() {
        $element.fadeOut(function() { $element.remove(); });
    }, time || 5000);
}

var socket   = null,
    gameData = {
        idents: {
            pseudo:   null,
            email:    null,
            gravatar: null
        }
    };



$(document).ready(function () {

    $.getScript('http://' + Config.host +':' + Config.portSockets + '/socket.io/socket.io.js', function() {
        
        socket = io('http://'+ Config.host + ':' + Config.portSockets);
        socket.on('game.players', function (data) {
            gameData.players = data.players;
        });


        $('#login-form').submit(function (e) {
            e.preventDefault();

            var $pseudo = $('#pseudo'),
                pseudo  = $pseudo.val(),
                $email  = $('#email'),
                email   = $email.val()
            ;

            if (pseudo.trim().length === 0 && gameData.players.indexOf(pseudo) !== '-1') {
                notify('Pseudo invalide.', 'error');
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
    //$('head').append('<script type="text/javascript" src=""></script>');
});

function launchApp (pseudo, email) {

    gameData.idents.pseudo   = pseudo;
    gameData.idents.email    = email;
    gameData.idents.gravatar = 'http://www.gravatar.com/avatar/' + md5(email) + '.jpg?s=' + '80&d=' + encodeURI('http://file.nekland.fr/dev/avatar_normal.png');

    var $login = $('#login');
    $login.addClass('closed');
    setTimeout(function () { $login.remove(); }, 1500);


    var chat = new ChatApp($('#message-box input'), $('#messages-list'));

    socket.on('disconnect', function () { alert('Une erreur s\'est produite sur le serveur, tu dois recharger ta page, désolé !'); });
    socket.emit('game.connection', { pseudo: pseudo, email: email, avatar: gameData.idents.gravatar });

    // Lorsqu'un message doit être affiché
    socket.on('message', function(data) {

        // Le type du message peut être
        //   - info
        //   - error
        var messageType    = data.type,
            messageContent = data.content;

        // ça serait certainement mieux de l'ajouter dans le dom avec une box, un truc comme as
        notify(messageContent, messageType);
    });

    new GameApp($('#game'));
}


var ChatApp = function ($input, $messages) {
    this.$input    = $input;
    this.$messages = $messages;
    var self       = this;

    $input.bind('keydown', function (e) {
        if (e.which === 13) {
            var message = { pseudo: gameData.idents.pseudo, message: $input.val() };

            if (message.message !== '') {
                socket.emit('chat.message', message);
                this.addMessage(message);
                this.$input.val('');
            }
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
        this.$messages.animate({
            scrollTop: this.$messages.prop("scrollHeight") - this.$messages.height()
        }, 100);
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
    this.avatars       = [];

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
        this.$buttons.html('<p>En attente d\'autres joueurs...<p>');
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
        this.avatars = data.avatars;
        this.showPlayers();
    };

    this.showPlayers = function () {
        $.each(this.players, function (i, value) {
            this.addPlayer(value, i);
        }.bind(this));
    };

    this.addPlayer = function (player, position) {
        var $template = $(this.templates.player);
        $template.addClass(this.places[position]);
        $template.find('.nickname').html(player);
        $template.find('img').attr('src', this.avatars[position]);

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

    this.endRound = function (data) {
        this.$game.find('.nickname:contains('+data.pseudo+')').css('color', '#c0392b');
    };

    /**
     * Chaque fois que quelqu'un trouve la bonne réponse
     * cette méthode est appelée pour passer à la personne suivante
     */
    this.turn = function (data) {
        this.currentPlayer = data.player;
        this.$letters.html(this.templates.letters);
        this.$letters.find('.big').html(data.letters);
        this.$game.find('.word .text').html('');

        // Retire la classe inactive
        // Au joueur qui joue
        this.$game
            .find('.player:not(.inactive)')
            .addClass('inactive');
        this.getCurrentPlayerDom()
            .removeClass('inactive');

        if (this.isMyTurn()) {
            this.$buttons.html('<p>Appuyez sur entrée pour valider</p>');
        } else {
            this.$buttons.html('');
        }
    };

    this.isMyTurn = function () {
        return this.currentPlayer == gameData.idents.pseudo;
    };

    this.getCurrentPlayerDom = function () {
        return this.$game.find('.player.'+this.places[this.players.indexOf(this.currentPlayer)]);
    };

    this.onKeyPressed = function (e) {
        if (e.which === 8) {
            e.preventDefault();
        }

        if (this.isMyTurn()) {
            var $text = this.$me.find('.text');

            if (e.which === 13) {
                socket.emit('game.answer', { answer: $text.html() });
            } else if (e.which === 8) {
                var text = $text.html();
                $text.html(text.substring(0, text.length-1));
            } else {
                this.$me.removeClass('fail');
                var letter = String.fromCharCode(e.which);

                if (letterExists(letter)) {
                    $text.html($text.html() + letter);
                }
            }

            socket.emit('game.type', { word: $text.html() });
        }
    };

    this.end = function() {
        this.$game.find('.player').remove();
        this.$buttons.html('<button>Lancer une nouvelle partie</button>');
        this.$buttons.find('button').click(this.emitStart.bind(this));
        this.$letters.html('');
    };

    this.winner = function (data) {
        notify(data.pseudo + ' a remporté la partie :) ');
        this.end();
    };

    this.tryAgain = function () {
        this.$me.addClass('fail');
    };

    this.showGame = function (data) {
        this.$buttons.html('<p>Une partie est en cours merci de patienter :)</p>');
        this.players = data.players;
        this.showPlayers();
    };

    this.currentPlayerTypes = function (data) {
        this.getCurrentPlayerDom().find('.text').html(data.word);
    };

    function letterExists(letter) {
        var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        if(alphabet.indexOf(letter) > -1) {
            return true;
        }

        return false;
    }


    socket.on('game.start', this.start.bind(this));
    socket.on('game.realStart', this.realStart.bind(this));
    socket.on('game.cantStart', this.end.bind(this));
    socket.on('game.round', this.newRound.bind(this));
    socket.on('game.turn', this.turn.bind(this));
    socket.on('game.winner', this.winner.bind(this));
    socket.on('game.tryAgain', this.tryAgain.bind(this));
    socket.on('game.inProgress', this.showGame.bind(this));
    socket.on('game.type', this.currentPlayerTypes.bind(this));
    socket.on('game.endRound', this.endRound.bind(this));

    $(document).unbind('keydown').bind('keydown', this.onKeyPressed.bind(this));
    
    this.end();
};