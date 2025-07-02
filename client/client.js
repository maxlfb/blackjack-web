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
const myScoreSpan = document.getElementById('my-score');
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

    // Mettre à jour la main du croupier
    if (room.dealer) {
        // Pour une vraie partie, on cacherait une carte. Pour l'instant, on affiche tout.
        renderHand(dealerHandDiv, room.dealer.hand);
        dealerScoreSpan.textContent = room.dealer.score;
    }
    
    // Trouver le joueur actuel (moi)
    const me = room.players.find(p => p.id === socket.id);
    if (!me) return;

    // Mettre à jour ma main et mon score
    myScoreSpan.textContent = me.score;
    renderHand(myHandDiv, me.hand);

    // Mettre à jour les autres joueurs
    playersAreaDiv.innerHTML = ''; // Vider la zone
    room.players
        .filter(p => p.id !== socket.id)
        .forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.classList.add('player-hand-area');
            playerDiv.innerHTML = `<h3>Joueur (${player.username}) - Score: ${player.score}</h3>`;
            const handDiv = document.createElement('div');
            handDiv.classList.add('hand');
            renderHand(handDiv, player.hand);
            playerDiv.appendChild(handDiv);
            playersAreaDiv.appendChild(playerDiv);
        });
      
    // Affichage de son propre nom
    const myAreaHeader = document.querySelector('#my-area h3');
    if(myAreaHeader) {
        myAreaHeader.innerHTML = `${me.username} (vous) - Score: <span id="my-score">${me.score}</span>`;
    }

    // Mettre à jour l'état du jeu et des boutons
    hitBtn.disabled = true;
    standBtn.disabled = true;
    restartBtn.classList.add('hidden');

    if (room.gameState === 'players_turn' && me.status === 'playing') {
        gameStatusP.textContent = "C'est votre tour.";
        hitBtn.disabled = false;
        standBtn.disabled = false;
    } else if (me.status === 'bust') {
        gameStatusP.textContent = "Dépassé ! Vous avez perdu.";
    } else if (me.status === 'stand') {
        gameStatusP.textContent = "Vous restez. En attente...";
    }

    if (room.gameState === 'dealer_turn') {
        gameStatusP.textContent = "Tour du croupier...";
    } else if (room.gameState === 'finished') {
        // On affiche le bouton Relancer
        restartBtn.classList.remove('hidden');

        // Logique de victoire/défaite
        if (me.status === 'bust') {
            gameStatusP.textContent = "Vous avez perdu.";
        } else if (room.dealer.score > 21 || me.score > room.dealer.score) {
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
    handContainer.innerHTML = ''; // Vider la main
    hand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');

        if (card.suit === 'hidden') {
            cardDiv.classList.add('card-back'); // Classe spéciale pour le dos de la carte
        } else {
            cardDiv.classList.add(`suit-${card.suit}`);
            cardDiv.textContent = card.value;
        }
        handContainer.appendChild(cardDiv);
    });
}
