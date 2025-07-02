// Fichier : server/server.js (Copiez et remplacez tout le contenu)

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const { creerPaquet, melangerPaquet, calculerScore } = require('./gameLogic.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'client')));

const gameRooms = {};

io.on('connection', (socket) => {
    console.log(`Un joueur est connecté : ${socket.id}`);

    socket.on('joinRoom', (data) => {
        const { roomCode, username } = data;
        if (!roomCode || !username) return;

        socket.join(roomCode);
        console.log(`Le joueur ${username} (${socket.id}) a rejoint la salle ${roomCode}`);

        if (!gameRooms[roomCode]) {
            gameRooms[roomCode] = {
                players: [],
                deck: [],
                dealer: { hand: [], score: 0 },
                gameState: 'waiting',
                dealerIntervalId: null
            };
        }

        const room = gameRooms[roomCode];
        const player = {
            id: socket.id,
            username: username,
            hand: [],
            score: 0,
            status: 'playing'
        };
        room.players.push(player);

        if (room.players.length === 1 || room.gameState === 'finished') {
            resetRoom(roomCode);
        } else {
            io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
        }
    });
    
    socket.on('playerAction', ({ roomCode, action }) => {
        const room = gameRooms[roomCode];
        if (!room || room.gameState !== 'players_turn') return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.status !== 'playing') return;

        if (action === 'hit') {
            player.hand.push(room.deck.pop());
            player.score = calculerScore(player.hand);
            if(player.score > 21) {
                player.status = 'bust';
            }
        } else if (action === 'stand') {
            player.status = 'stand';
        }

        // CORRECTION DE LA LOGIQUE PRINCIPALE
        // On vérifie si TOUS les joueurs ont un statut autre que 'playing'.
        // Cela inclut 'stand', 'bust', ET 'blackjack'.
        const allPlayersDone = room.players.every(p => p.status !== 'playing');

        if (allPlayersDone) {
            // C'est seulement à ce moment qu'on lance le tour du croupier.
            playDealerTurn(roomCode);
        } else {
            // S'il reste des joueurs qui doivent jouer, on met juste à jour l'état.
            io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
        }
    });

    socket.on('restartGame', ({ roomCode }) => {
        if (gameRooms[roomCode] && gameRooms[roomCode].gameState === 'finished') {
            resetRoom(roomCode);
        }
    });

    socket.on('disconnect', () => {
        // ... (logique de déconnexion inchangée)
    });
});

function getRoomStateForPlayers(roomCode) {
    const room = { ...gameRooms[roomCode] };
    if (room.gameState === 'players_turn') {
        const visibleCard = room.dealer.hand[0];
        room.dealer = {
            ...room.dealer,
            hand: [visibleCard, { value: '?', suit: 'hidden' }],
            score: calculerScore([visibleCard])
        };
    }
    return room;
}

function playDealerTurn(roomCode) {
    const room = gameRooms[roomCode];
    if (!room) return;

    room.gameState = 'dealer_turn';
    io.to(roomCode).emit('gameState', room); // Révéler la carte du croupier

    room.dealerIntervalId = setInterval(() => {
        // Le croupier ne tire que s'il est derrière au moins un joueur non-bust
        const shouldHit = room.players.some(p => p.status !== 'bust' && room.dealer.score < p.score);
        
        if (room.dealer.score < 17) {
            room.dealer.hand.push(room.deck.pop());
            room.dealer.score = calculerScore(room.dealer.hand);
            io.to(roomCode).emit('gameState', room);
        } else {
            clearInterval(room.dealerIntervalId);
            room.dealerIntervalId = null;
            room.gameState = 'finished';
            io.to(roomCode).emit('gameState', room);
            console.log(`Fin de partie pour la salle ${roomCode}`);
        }
    }, 1000);
}

function resetRoom(roomCode) {
    const room = gameRooms[roomCode];
    if (!room) return;

    if (room.dealerIntervalId) {
        clearInterval(room.dealerIntervalId);
        room.dealerIntervalId = null;
    }

    console.log(`Réinitialisation de la salle ${roomCode}`);
    room.deck = melangerPaquet(creerPaquet());
    room.dealer.hand = [];
    room.players.forEach(player => {
        player.hand = [];
        player.status = 'playing';
    });

    // Distribution
    room.players.forEach(player => {
        player.hand.push(room.deck.pop(), room.deck.pop());
        player.score = calculerScore(player.hand);
    });
    room.dealer.hand.push(room.deck.pop(), room.deck.pop());
    room.dealer.score = calculerScore(room.dealer.hand);

    // Vérification des Blackjacks
    let allPlayersHaveBlackjack = true;
    room.players.forEach(player => {
        if (player.score === 21) {
            player.status = 'blackjack';
        } else {
            allPlayersHaveBlackjack = false;
        }
    });

    // const dealerHasBlackjack = room.dealer.score === 21;

    // Si le croupier a un blackjack, ou si tous les joueurs ont un blackjack, la partie se termine immédiatement.
    if (allPlayersHaveBlackjack) {
        // On saute directement au tour du croupier, qui se terminera instantanément
        // et passera le gameState à 'finished'.
        playDealerTurn(roomCode);
    } else {
        // Sinon, la partie commence normalement.
        room.gameState = 'players_turn';
        io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
    }
}

server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
