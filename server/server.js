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
                dealerIntervalId: null // AJOUT : Pour la stabilité
            };
            // La première partie sera lancée par resetRoom plus bas
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

        // Si la salle était vide ou la partie finie, on la lance/relance
        if (room.players.length === 1 || room.gameState === 'finished') {
            resetRoom(roomCode);
        } else {
            // Si une partie est en cours, on envoie juste l'état (le joueur sera en attente)
            // Note: la logique de mise en attente n'est pas encore implémentée, mais la structure est prête.
            io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
        }
    });
    
    socket.on('playerAction', ({ roomCode, action }) => {
        const room = gameRooms[roomCode];
        if (!room || room.gameState !== 'players_turn') return;

        const player = room.players.find(p => p.id === socket.id);
        // On vérifie que le joueur peut jouer (pas de blackjack, pas bust, etc.)
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

        const allPlayersDone = room.players.every(p => p.status !== 'playing');
        if (allPlayersDone) {
            playDealerTurn(roomCode);
        } else {
            io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
        }
    });

    socket.on('restartGame', ({ roomCode }) => {
        if (gameRooms[roomCode] && gameRooms[roomCode].gameState === 'finished') {
            resetRoom(roomCode);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté : ${socket.id}`);
        for (const roomCode in gameRooms) {
            const room = gameRooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                // Si la salle est vide, on pourrait la supprimer. Pour l'instant, on envoie juste l'état.
                io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
                break;
            }
        }
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
    io.to(roomCode).emit('gameState', room);

    room.dealerIntervalId = setInterval(() => {
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

    // CORRECTION STABILITÉ : Nettoyer l'intervalle de la partie précédente
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

    // Distribuer les cartes
    room.players.forEach(player => {
        player.hand.push(room.deck.pop(), room.deck.pop());
        player.score = calculerScore(player.hand);
    });
    room.dealer.hand.push(room.deck.pop(), room.deck.pop());
    room.dealer.score = calculerScore(room.dealer.hand);

    // LOGIQUE BLACKJACK : Vérifier les blackjacks naturels
    room.players.forEach(player => {
        if (player.score === 21) {
            console.log(`Le joueur ${player.username} a un Blackjack !`);
            player.status = 'blackjack';
        }
    });
    // On vérifie aussi si le croupier a un blackjack naturel
    if (room.dealer.score === 21) {
        console.log("Le croupier a un Blackjack !");
    }


    room.gameState = 'players_turn';
    io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
}

server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
