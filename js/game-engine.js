// ==================== DECK MANAGEMENT ====================
function createDeck() {
  const deck = [];

  // Number and action cards for each color
  COLORS.forEach(color => {
    // One zero per color
    deck.push({ id: generateId(), type: '0', color: color, value: 0 });

    // Two of each 1-9 and action cards
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), type: String(i), color: color, value: i });
      deck.push({ id: generateId(), type: String(i), color: color, value: i });
    }

    // Two of each action card
    ['skip', 'reverse', '+2'].forEach(type => {
      deck.push({ id: generateId(), type: type, color: color, value: type === '+2' ? 20 : 20 });
      deck.push({ id: generateId(), type: type, color: color, value: type === '+2' ? 20 : 20 });
    });
  });

  // Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), type: 'wild', color: 'wild', value: 50 });
    deck.push({ id: generateId(), type: '+4', color: 'wild', value: 50 });
  }

  return shuffleArray(deck);
}

function drawCards(deck, count) {
  const cards = [];
  for (let i = 0; i < count && deck.length > 0; i++) {
    cards.push(deck.pop());
  }
  return cards;
}

function reshuffleDiscardPile(discardPile, keepTop = true) {
  const topCard = keepTop ? discardPile.pop() : null;
  const shuffled = shuffleArray(discardPile);
  if (topCard) shuffled.push(topCard);
  return shuffled;
}

// ==================== GAME STATE ====================
let gameState = null;

function initGame(players, mode = 'classic', settings = {}) {
  const deck = createDeck();
  const hands = {};

  players.forEach(player => {
    hands[player.id] = drawCards(deck, 7);
  });

  // Draw first card
  let discardPile = [];
  let firstCard = deck.pop();

  // If first card is wild or action, draw another
  while (firstCard.type === 'wild' || firstCard.type === '+4' || firstCard.type === '+2') {
    deck.unshift(firstCard);
    firstCard = deck.pop();
  }

  discardPile.push(firstCard);

  gameState = {
    players: players,
    hands: hands,
    deck: deck,
    discardPile: discardPile,
    currentPlayerIndex: 0,
    direction: 1, // 1 = clockwise, -1 = counter-clockwise
    currentColor: firstCard.color,
    wildColor: null,
    mode: mode,
    settings: {
      stacking: settings.stacking !== false,
      timer: settings.timer !== false,
      sound: settings.sound !== false,
      ...settings
    },
    drawStack: 0,
    gameOver: false,
    winner: null,
    unoCalled: {},
    turnStartTime: Date.now(),
    turnTimeLimit: 10000 // 10 seconds
  };

  soundEnabled = gameState.settings.sound;

  return gameState;
}

// ==================== GAME RULES ====================
function isPlayable(card, gameState) {
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const currentColor = gameState.wildColor || gameState.currentColor;

  // Wild cards are always playable
  if (card.type === 'wild' || card.type === '+4') return true;

  // Match color
  if (card.color === currentColor) return true;

  // Match number/type
  if (card.type === topCard.type) return true;

  return false;
}

function getPlayableCards(hand, gameState) {
  return hand.filter(card => isPlayable(card, gameState));
}

// ==================== GAME ACTIONS ====================
function playCard(playerId, cardId, chosenColor = null) {
  if (!gameState || gameState.gameOver) return { success: false, error: 'Game not active' };

  const player = gameState.players[gameState.currentPlayerIndex];
  if (player.id !== playerId) return { success: false, error: 'Not your turn' };

  const hand = gameState.hands[playerId];
  const cardIndex = hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { success: false, error: 'Card not found' };

  const card = hand[cardIndex];

  if (!isPlayable(card, gameState)) {
    return { success: false, error: 'Card cannot be played' };
  }

  // Remove card from hand
  hand.splice(cardIndex, 1);
  gameState.discardPile.push(card);

  // Reset UNO call
  gameState.unoCalled[playerId] = false;

  // Handle wild cards
  if (card.type === 'wild' || card.type === '+4') {
    if (!chosenColor || !COLORS.includes(chosenColor)) {
      return { success: false, error: 'Must choose a color' };
    }
    gameState.wildColor = chosenColor;
    gameState.currentColor = chosenColor;
  } else {
    gameState.currentColor = card.color;
    gameState.wildColor = null;
  }

  // Handle card effects
  let skipNext = false;
  let drawCount = 0;
  let reverse = false;

  switch(card.type) {
    case 'skip':
      skipNext = true;
      break;
    case 'reverse':
      reverse = true;
      gameState.direction *= -1;
      // In 2-player game, reverse acts like skip
      if (gameState.players.length === 2) skipNext = true;
      break;
    case '+2':
      drawCount = 2;
      break;
    case '+4':
      drawCount = 4;
      break;
  }

  // Check for win
  if (hand.length === 0) {
    gameState.gameOver = true;
    gameState.winner = playerId;
    return { 
      success: true, 
      action: 'win',
      player: player,
      card: card,
      skipNext,
      drawCount,
      reverse
    };
  }

  // Move to next player
  let nextIndex = gameState.currentPlayerIndex + gameState.direction;
  if (nextIndex >= gameState.players.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gameState.players.length - 1;

  if (skipNext) {
    nextIndex += gameState.direction;
    if (nextIndex >= gameState.players.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = gameState.players.length - 1;
  }

  // Handle draw cards (stacking)
  if (drawCount > 0 && gameState.settings.stacking) {
    const nextPlayer = gameState.players[nextIndex];
    const nextHand = gameState.hands[nextPlayer.id];
    const stackable = nextHand.find(c => 
      (card.type === '+2' && c.type === '+2') || 
      (card.type === '+4' && c.type === '+4')
    );

    if (!stackable) {
      // Next player must draw
      const drawn = drawCards(gameState.deck, drawCount);
      gameState.hands[nextPlayer.id].push(...drawn);

      // Reshuffle if needed
      if (gameState.deck.length < 5) {
        gameState.deck = reshuffleDiscardPile(gameState.discardPile);
      }

      skipNext = true;
    }
  } else if (drawCount > 0) {
    const nextPlayer = gameState.players[nextIndex];
    const drawn = drawCards(gameState.deck, drawCount);
    gameState.hands[nextPlayer.id].push(...drawn);

    if (gameState.deck.length < 5) {
      gameState.deck = reshuffleDiscardPile(gameState.discardPile);
    }
  }

  gameState.currentPlayerIndex = nextIndex;
  gameState.turnStartTime = Date.now();

  playSound('play');

  return {
    success: true,
    action: 'play',
    player: player,
    card: card,
    nextPlayer: gameState.players[nextIndex],
    skipNext,
    drawCount,
    reverse
  };
}

function drawCard(playerId) {
  if (!gameState || gameState.gameOver) return { success: false };

  const player = gameState.players[gameState.currentPlayerIndex];
  if (player.id !== playerId) return { success: false };

  // Check if player has playable cards
  const hand = gameState.hands[playerId];
  const playable = getPlayableCards(hand, gameState);

  if (playable.length > 0) {
    return { success: false, error: 'You have playable cards' };
  }

  // Draw card
  if (gameState.deck.length === 0) {
    gameState.deck = reshuffleDiscardPile(gameState.discardPile);
  }

  const drawn = drawCards(gameState.deck, 1);
  if (drawn.length === 0) return { success: false, error: 'No cards left' };

  gameState.hands[playerId].push(...drawn);

  // Check if drawn card is playable
  const canPlay = isPlayable(drawn[0], gameState);

  playSound('draw');

  return {
    success: true,
    card: drawn[0],
    canPlay: canPlay,
    player: player
  };
}

function passTurn(playerId) {
  if (!gameState || gameState.gameOver) return { success: false };

  const player = gameState.players[gameState.currentPlayerIndex];
  if (player.id !== playerId) return { success: false };

  let nextIndex = gameState.currentPlayerIndex + gameState.direction;
  if (nextIndex >= gameState.players.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gameState.players.length - 1;

  gameState.currentPlayerIndex = nextIndex;
  gameState.turnStartTime = Date.now();
  gameState.unoCalled[playerId] = false;

  return { success: true, nextPlayer: gameState.players[nextIndex] };
}

function callUno(playerId) {
  if (!gameState) return { success: false };

  const hand = gameState.hands[playerId];
  if (hand.length !== 1) return { success: false };

  gameState.unoCalled[playerId] = true;
  playSound('uno');

  return { success: true };
}

function challengeUno(playerId) {
  if (!gameState) return { success: false };

  // Check if any player has 1 card but didn't call UNO
  for (const pid in gameState.hands) {
    if (pid !== playerId && gameState.hands[pid].length === 1 && !gameState.unoCalled[pid]) {
      // Penalty: draw 2 cards
      const drawn = drawCards(gameState.deck, 2);
      gameState.hands[pid].push(...drawn);
      playSound('penalty');
      return { success: true, target: pid, drawn: 2 };
    }
  }

  return { success: false };
}

// ==================== SCORING ====================
function calculateScore(hand) {
  return hand.reduce((sum, card) => sum + (card.value || 0), 0);
}

function getGameResults() {
  if (!gameState || !gameState.gameOver) return null;

  const winner = gameState.players.find(p => p.id === gameState.winner);
  const results = gameState.players.map(player => ({
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    hand: gameState.hands[player.id],
    score: calculateScore(gameState.hands[player.id]),
    isWinner: player.id === gameState.winner
  }));

  results.sort((a, b) => a.score - b.score);

  return {
    winner: winner,
    results: results,
    mode: gameState.mode
  };
}

// ==================== BOT TURN ====================
function processBotTurn() {
  if (!gameState || gameState.gameOver) return;

  const player = gameState.players[gameState.currentPlayerIndex];
  if (!player.isBot || !player.ai) return;

  const hand = gameState.hands[player.id];
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const currentColor = gameState.wildColor || gameState.currentColor;

  // Try to play a card
  const cardToPlay = player.ai.chooseCard(hand, topCard, currentColor, gameState.wildColor);

  if (cardToPlay) {
    let chosenColor = null;
    if (cardToPlay.type === 'wild' || cardToPlay.type === '+4') {
      chosenColor = player.ai.chooseColor(hand.filter(c => c.id !== cardToPlay.id));
    }

    // Small delay for realism
    setTimeout(() => {
      const result = playCard(player.id, cardToPlay.id, chosenColor);
      if (result.success) {
        renderGame();

        if (result.action === 'win') {
          handleGameOver();
        } else {
          // Continue to next turn
          if (gameState.players[gameState.currentPlayerIndex].isBot) {
            setTimeout(processBotTurn, 1000);
          }
        }
      }
    }, 800 + Math.random() * 800);
  } else {
    // Must draw
    setTimeout(() => {
      const result = drawCard(player.id);
      if (result.success && result.canPlay) {
        // Bot can play drawn card
        setTimeout(() => {
          const playResult = playCard(player.id, result.card.id);
          if (playResult.success) {
            renderGame();
            if (gameState.players[gameState.currentPlayerIndex].isBot) {
              setTimeout(processBotTurn, 1000);
            }
          }
        }, 500);
      } else {
        // Pass turn
        setTimeout(() => {
          passTurn(player.id);
          renderGame();
          if (gameState.players[gameState.currentPlayerIndex].isBot) {
            setTimeout(processBotTurn, 1000);
          }
        }, 500);
      }
    }, 800);
  }

  // Check UNO
  if (player.ai.shouldCallUno(hand.length - (cardToPlay ? 1 : 0))) {
    setTimeout(() => callUno(player.id), 600);
  }
}