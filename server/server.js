const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const { creerPaquet, melangerPaquet, calculerScore } = require('./gameLogic.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// MODIFICATION IMPORTANTE : Servir les fichiers statiques du dossier client
// Cela permet à notre serveur Node.js de livrer les fichiers index.html, style.css, etc.
// Le chemin est corrigé pour fonctionner DANS le conteneur Docker.
app.use(express.static(path.join(__dirname, 'client')));

const gameRooms = {};

io.on('connection', (socket) => {
    console.log(`Un joueur est connecté : ${socket.id}`);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`Le joueur ${socket.id} a rejoint la salle ${roomCode}`);

        if (!gameRooms[roomCode]) {
            const deck = melangerPaquet(creerPaquet());

            // Créer le croupier et lui donner ses cartes
            const dealerHand = [deck.pop(), deck.pop()];

            gameRooms[roomCode] = {
                players: [],
                deck: melangerPaquet(creerPaquet()),
                dealer: {
                    hand: dealerHand,
                    score: calculerScore(dealerHand)
                },
                gameState: 'players_turn', // 'players_turn', 'dealer_turn', 'finished'
            };
        }

        const player = {
            id: socket.id,
            hand: [],
            score: 0,
            status: 'playing' // 'playing', 'stand', 'bust'
        };
        gameRooms[roomCode].players.push(player);

        // Distribuer 2 cartes au nouveau joueur
        player.hand.push(gameRooms[roomCode].deck.pop());
        player.hand.push(gameRooms[roomCode].deck.pop());
        player.score = calculerScore(player.hand);

        // Envoyer l'état du jeu à tous les joueurs de la salle
        io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
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

        // On vérifie si le tour des joueurs est terminé
        const allPlayersDone = room.players.every(p => p.status === 'stand' || p.status === 'bust');

        if (allPlayersDone) {
            // Si oui, on lance le tour du croupier
            playDealerTurn(roomCode);
        } else {
            // Sinon, on envoie juste l'état mis à jour
            io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
        }
        
        // io.to(roomCode).emit('gameState', room);
    });

    socket.on('restartGame', ({ roomCode }) => {
        // On s'assure que la partie est bien finie avant de relancer
        if (gameRooms[roomCode] && gameRooms[roomCode].gameState === 'finished') {
            resetRoom(roomCode);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté : ${socket.id}`);
        // Logique pour retirer un joueur d'une salle et mettre à jour les autres
        for (const roomCode in gameRooms) {
            const room = gameRooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomCode).emit('gameState', room);
                break;
            }
        }
    });
});

// Fonction pour filtrer ce que les joueurs voient
function getRoomStateForPlayers(roomCode) {
    const room = { ...gameRooms[roomCode] }; // Crée une copie

    // Si c'est au tour des joueurs, on cache la deuxième carte du croupier
    if (room.gameState === 'players_turn') {
        const visibleCard = room.dealer.hand[0];
        room.dealer = {
            ...room.dealer,
            hand: [visibleCard, { value: '?', suit: 'hidden' }],
            score: calculerScore([visibleCard]) // On ne calcule que le score de la carte visible
        };
    }
    return room;
}

// Fonction pour gérer le tour du croupier
function playDealerTurn(roomCode) {
    const room = gameRooms[roomCode];
    if (!room) return;

    room.gameState = 'dealer_turn';
    // On envoie d'abord l'état avec la carte révélée
    io.to(roomCode).emit('gameState', room);

    // Le croupier tire des cartes avec un délai pour que ce soit visible
    const dealerInterval = setInterval(() => {
        if (room.dealer.score < 17) {
            room.dealer.hand.push(room.deck.pop());
            room.dealer.score = calculerScore(room.dealer.hand);
            // On envoie l'état mis à jour après chaque carte tirée
            io.to(roomCode).emit('gameState', room);
        } else {
            // Le croupier a fini de tirer
            clearInterval(dealerInterval);
            room.gameState = 'finished';
            // Ici, on pourrait ajouter la logique pour déterminer les gagnants
            io.to(roomCode).emit('gameState', room);
            console.log(`Fin de partie pour la salle ${roomCode}`);
        }
    }, 1500); // Délai de 1.5 seconde entre chaque action du croupier
}

// Fonction pour réinitialiser une salle 
function resetRoom(roomCode) {
    const room = gameRooms[roomCode];
    if (!room) return;

    console.log(`Réinitialisation de la salle ${roomCode}`);

    // 1. Créer un nouveau paquet de cartes mélangé
    room.deck = melangerPaquet(creerPaquet());

    // 2. Réinitialiser le croupier
    room.dealer.hand = [];
    room.dealer.score = 0;

    // 3. Réinitialiser chaque joueur
    room.players.forEach(player => {
        player.hand = [];
        player.score = 0;
        player.status = 'playing';
    });

    // 4. Distribuer les nouvelles cartes
    // Deux cartes pour chaque joueur
    room.players.forEach(player => {
        player.hand.push(room.deck.pop(), room.deck.pop());
        player.score = calculerScore(player.hand);
    });
    // Deux cartes pour le croupier
    room.dealer.hand.push(room.deck.pop(), room.deck.pop());
    room.dealer.score = calculerScore(room.dealer.hand);

    // 5. Remettre l'état du jeu au début
    room.gameState = 'players_turn';

    // 6. Envoyer le nouvel état de jeu à tous les joueurs (en cachant la carte du croupier)
    io.to(roomCode).emit('gameState', getRoomStateForPlayers(roomCode));
}

server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
