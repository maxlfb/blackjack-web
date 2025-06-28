function creerPaquet() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function melangerPaquet(deck) {
    // Algorithme de mélange Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) {
        return 10;
    }
    if (card.value === 'A') {
        return 11;
    }
    return parseInt(card.value);
}

function calculerScore(hand) {
    let score = 0;
    let aceCount = 0;
    
    for (const card of hand) {
        if (card.value === 'A') {
            aceCount++;
        }
        score += getCardValue(card);
    }

    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }

    return score;
}

// Exporter les fonctions pour les utiliser dans server.js
module.exports = { creerPaquet, melangerPaquet, calculerScore };
