// Fichier : client/client.js (Copiez et remplacez tout le contenu)

const socket = io();

// Zones de l'interface
const loginArea = document.getElementById('login-area');
const gameArea = document.getElementById('game-area');

// Inputs et boutons
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const restartBtn = document.getElementById('restart-btn');

// Affichages
const roomCodeDisplay = document.getElementById('room-code-display');
const myHandDiv = document.getElementById('my-hand');
const playersAreaDiv = document.getElementById('players-area');
const gameStatusP = document.getElementById('game-status');

// Croupier
const dealerHandDiv = document.getElementById('dealer-hand');
const dealerScoreSpan = document.getElementById('dealer-score');

let currentRoomCode = '';

// --- GESTION DES EVENEMENTS ---

joinRoomBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const username = usernameInput.value.trim();

    if (roomCode && username) {
        currentRoomCode = roomCode;
        socket.emit('joinRoom', { roomCode, username });

        loginArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        roomCodeDisplay.textContent = roomCode;
    } else {
        alert("Veuillez entrer un nom et un code de salle.");
    }
});

hitBtn.addEventListener('click', () => {
    socket.emit('playerAction', { roomCode: currentRoomCode, action: 'hit' });
});

standBtn.addEventListener('click', () => {
    socket.emit('playerAction', { roomCode: currentRoomCode, action: 'stand' });
});

restartBtn.addEventListener('click', () => {
    console.log("Demande de relance de la partie...");
    socket.emit('restartGame', { roomCode: currentRoomCode });
});


// --- ECOUTE DU SERVEUR ---

socket.on('gameState', (room) => {
    console.log("Mise à jour de l'état du jeu:", room);

    if (room.dealer) {
        renderHand(dealerHandDiv, room.dealer.hand);
        dealerScoreSpan.textContent = room.dealer.score;
    }
    
    const me = room.players.find(p => p.id === socket.id);
    if (!me) return;

    renderHand(myHandDiv, me.hand);

    playersAreaDiv.innerHTML = '';
    room.players
        .filter(p => p.id !== socket.id)
        .forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.classList.add('player-hand-area');
            playerDiv.innerHTML = `<h3>${player.username} - Score: ${player.score}</h3>`;
            const handDiv = document.createElement('div');
            handDiv.classList.add('hand');
            renderHand(handDiv, player.hand);
            playerDiv.appendChild(playerDiv);
        });
      
    const myAreaHeader = document.querySelector('#my-area h3');
    if(myAreaHeader) {
        myAreaHeader.innerHTML = `${me.username} (vous) - Score: <span id="my-score">${me.score}</span>`;
        document.getElementById('my-score').textContent = me.score;
    }

    // --- LOGIQUE D'AFFICHAGE MISE À JOUR ---
    hitBtn.disabled = true;
    standBtn.disabled = true;
    restartBtn.classList.add('hidden');

    if (me.status === 'blackjack') {
        gameStatusP.textContent = "BLACKJACK !";
    } else if (me.status === 'bust') {
        gameStatusP.textContent = "Dépassé ! Vous avez perdu.";
    } else if (me.status === 'stand') {
        gameStatusP.textContent = "Vous restez. En attente...";
    }

    if (room.gameState === 'players_turn' && me.status === 'playing') {
        gameStatusP.textContent = "C'est votre tour.";
        hitBtn.disabled = false;
        standBtn.disabled = false;
    } else if (room.gameState === 'dealer_turn') {
        gameStatusP.textContent = "Tour du croupier...";
    } else if (room.gameState === 'finished') {
        restartBtn.classList.remove('hidden');

        // --- SECTION MODIFIÉE : Logique de victoire/défaite améliorée ---
        const dealerHasBlackjack = room.dealer.score === 21 && room.dealer.hand.length === 2;

        if (me.status === 'blackjack') {
            if (dealerHasBlackjack) {
                gameStatusP.textContent = "Égalité, le croupier a aussi un Blackjack.";
            } else {
                gameStatusP.textContent = "BLACKJACK ! Vous avez gagné !";
            }
        } else if (dealerHasBlackjack) {
            gameStatusP.textContent = "Le croupier a un Blackjack, vous avez perdu.";
        } else if (me.status === 'bust') {
            gameStatusP.textContent = "Vous avez perdu.";
        } else if (room.dealer.score > 21) {
            gameStatusP.textContent = "Le croupier dépasse, vous avez gagné !";
        } else if (me.score > room.dealer.score) {
            gameStatusP.textContent = "Vous avez gagné !";
        } else if (me.score < room.dealer.score) {
            gameStatusP.textContent = "Le croupier gagne.";
        } else {
            gameStatusP.textContent = "Égalité.";
        }
    }
});

// --- FONCTION D'AFFICHAGE ---

function renderHand(handContainer, hand) {
    if(!handContainer) return;
    handContainer.innerHTML = '';
    hand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        if (card.suit === 'hidden') {
            cardDiv.classList.add('card-back');
        } else {
            cardDiv.classList.add(`suit-${card.suit}`);
            cardDiv.textContent = card.value;
        }
        handContainer.appendChild(cardDiv);
    });
}
