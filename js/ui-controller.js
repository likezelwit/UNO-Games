// ==================== CARD RENDERING ====================
function createCardElement(card, isPlayable = false, isBack = false) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.cardId = card.id;

  if (isBack) {
    div.classList.add('card-back');
    return div;
  }

  if (isPlayable) div.classList.add('playable');

  const colorClass = card.color === 'wild' ? 'card-color-wild' : `card-color-${card.color}`;
  div.classList.add(colorClass);

  const value = CARD_EMOJIS[card.type] || card.type;

  div.innerHTML = `
    <span class="card-small-value top-left">${value}</span>
    <span class="card-value">${value}</span>
    <span class="card-small-value bottom-right">${value}</span>
  `;

  return div;
}

// ==================== GAME RENDERING ====================
function renderGame() {
  if (!gameState) return;

  renderPlayerHand();
  renderBotCards();
  renderDiscardPile();
  renderPlayerInfo();
  renderDeckCount();
  updateTurnIndicator();
  updateColorIndicator();
  updateDirectionIndicator();
}

function renderPlayerHand() {
  const container = document.getElementById('player-hand');
  if (!container || !gameState) return;

  container.innerHTML = '';

  const playerId = gameState.players.find(p => !p.isBot)?.id || 'player';
  const hand = gameState.hands[playerId] || [];

  hand.forEach(card => {
    const isPlayable = gameState.players[gameState.currentPlayerIndex].id === playerId && 
      isPlayableCheck(card, gameState);
    const cardEl = createCardElement(card, isPlayable);

    if (isPlayable) {
      cardEl.onclick = () => handleCardClick(card);
    }

    container.appendChild(cardEl);
  });
}

function isPlayableCheck(card, state) {
  const topCard = state.discardPile[state.discardPile.length - 1];
  const currentColor = state.wildColor || state.currentColor;

  if (card.type === 'wild' || card.type === '+4') return true;
  if (card.color === currentColor) return true;
  if (card.type === topCard.type && !['wild', '+4'].includes(card.type)) return true;
  return false;
}

function renderBotCards() {
  const botPlayers = gameState.players.filter(p => p.isBot);

  botPlayers.forEach((bot, index) => {
    const zones = ['player-top', 'player-left', 'player-right'];
    const zone = document.querySelector(`.${zones[index]}`);
    if (!zone) return;

    const hand = gameState.hands[bot.id] || [];

    // Update card count
    const countEl = zone.querySelector('.card-count');
    if (countEl) countEl.textContent = hand.length + ' cards';

    // Render bot cards (backs)
    const isHorizontal = index === 0;
    const container = zone.querySelector(isHorizontal ? '.bot-cards-horizontal' : '.bot-cards-vertical');
    if (!container) return;

    container.innerHTML = '';

    const maxVisible = Math.min(hand.length, isHorizontal ? 8 : 5);
    for (let i = 0; i < maxVisible; i++) {
      const cardEl = createCardElement({ id: 'bot_' + i, color: 'wild', type: '0' }, false, true);
      container.appendChild(cardEl);
    }

    if (hand.length > maxVisible) {
      const more = document.createElement('div');
      more.className = 'card card-back';
      more.style.opacity = '0.5';
      more.innerHTML = `<span style="color:white;font-size:0.7rem;">+${hand.length - maxVisible}</span>`;
      container.appendChild(more);
    }
  });
}

function renderDiscardPile() {
  const container = document.getElementById('discard-pile');
  if (!container || !gameState || gameState.discardPile.length === 0) return;

  container.innerHTML = '';

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const cardEl = createCardElement(topCard);
  container.appendChild(cardEl);
}

function renderPlayerInfo() {
  gameState.players.forEach((player, index) => {
    const zones = ['player-bottom', 'player-top', 'player-left', 'player-right'];
    const zone = document.querySelector(`.${zones[index]}`);
    if (!zone) return;

    const info = zone.querySelector('.player-info');
    if (!info) return;

    // Update active state
    if (index === gameState.currentPlayerIndex) {
      info.classList.add('active');
    } else {
      info.classList.remove('active');
    }

    // Update name
    const nameEl = info.querySelector('.player-name');
    if (nameEl) nameEl.textContent = player.name;
  });
}

function renderDeckCount() {
  const countEl = document.getElementById('deck-count');
  if (countEl && gameState) {
    countEl.textContent = gameState.deck.length;
  }
}

// ==================== UI UPDATES ====================
function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  const text = document.getElementById('turn-text');
  if (!indicator || !text || !gameState) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isPlayerTurn = !currentPlayer.isBot;

  if (isPlayerTurn) {
    indicator.classList.add('active');
    text.textContent = 'Your Turn';
  } else {
    indicator.classList.remove('active');
    text.textContent = currentPlayer.name + "'s Turn";
  }
}

function updateColorIndicator() {
  const indicator = document.getElementById('color-indicator');
  if (!indicator || !gameState) return;

  const color = gameState.wildColor || gameState.currentColor;
  indicator.className = 'color-indicator ' + color;
}

function updateDirectionIndicator() {
  const indicator = document.getElementById('direction-indicator');
  if (!indicator || !gameState) return;

  if (gameState.direction === 1) {
    indicator.classList.add('clockwise');
    indicator.classList.remove('counter-clockwise');
  } else {
    indicator.classList.add('counter-clockwise');
    indicator.classList.remove('clockwise');
  }
}

// ==================== CARD INTERACTION ====================
let selectedCard = null;
let pendingWildColor = null;

function handleCardClick(card) {
  if (!gameState || gameState.gameOver) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer.isBot) return;

  // Check if it's wild card
  if (card.type === 'wild' || card.type === '+4') {
    selectedCard = card;
    showColorPicker();
    return;
  }

  playSelectedCard(card);
}

function showColorPicker() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.add('active');
}

function selectWildColor(color) {
  pendingWildColor = color;
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.remove('active');

  if (selectedCard) {
    playSelectedCard(selectedCard, color);
    selectedCard = null;
  }
}

function playSelectedCard(card, wildColor = null) {
  const playerId = gameState.players.find(p => !p.isBot)?.id || 'player';
  const result = playCard(playerId, card.id, wildColor);

  if (result.success) {
    // Animate card play
    const cardEl = document.querySelector(`[data-card-id="${card.id}"]`);
    if (cardEl) {
      cardEl.classList.add('card-anim-play');
      setTimeout(() => cardEl.remove(), 400);
    }

    // Flash effect
    const flash = document.getElementById('action-flash-overlay');
    if (flash) {
      flash.className = 'action-flash-overlay ' + (wildColor || card.color);
      flash.classList.add('active');
      setTimeout(() => flash.classList.remove('active'), 300);
    }

    // Wild explosion
    if (card.type === 'wild' || card.type === '+4') {
      const explosion = document.getElementById('wild-explosion');
      if (explosion) {
        explosion.classList.add('active');
        setTimeout(() => explosion.classList.remove('active'), 800);
      }
    }

    renderGame();

    if (result.action === 'win') {
      handleGameOver();
    } else if (gameState.players[gameState.currentPlayerIndex].isBot) {
      setTimeout(processBotTurn, 1000);
    }
  } else {
    // Shake animation for invalid play
    const cardEl = document.querySelector(`[data-card-id="${card.id}"]`);
    if (cardEl) {
      cardEl.classList.add('card-anim-shake');
      setTimeout(() => cardEl.classList.remove('card-anim-shake'), 300);
    }
    showToast(result.error || 'Cannot play this card');
  }
}

// ==================== DRAW CARD ====================
function handleDrawCard() {
  if (!gameState || gameState.gameOver) return;

  const playerId = gameState.players.find(p => !p.isBot)?.id || 'player';
  const result = drawCard(playerId);

  if (result.success) {
    // Show drawn card popup
    const popup = document.getElementById('drawn-card-popup');
    const display = document.getElementById('drawn-card-display');
    const keepBtn = document.getElementById('keep-btn');
    const playBtn = document.getElementById('play-btn');

    if (popup && display) {
      display.innerHTML = '';
      const cardEl = createCardElement(result.card);
      display.appendChild(cardEl);

      popup.classList.add('active');

      if (keepBtn) {
        keepBtn.onclick = () => {
          popup.classList.remove('active');
          passTurn(playerId);
          renderGame();
          if (gameState.players[gameState.currentPlayerIndex].isBot) {
            setTimeout(processBotTurn, 1000);
          }
        };
      }

      if (playBtn) {
        if (result.canPlay) {
          playBtn.style.display = 'block';
          playBtn.onclick = () => {
            popup.classList.remove('active');
            if (result.card.type === 'wild' || result.card.type === '+4') {
              selectedCard = result.card;
              showColorPicker();
            } else {
              playSelectedCard(result.card);
            }
          };
        } else {
          playBtn.style.display = 'none';
        }
      }
    }

    renderGame();
  } else {
    showToast(result.error || 'Cannot draw');
  }
}

// ==================== UNO BUTTON ====================
let unoPressed = false;

function handleUnoButton() {
  if (!gameState || gameState.gameOver) return;

  const playerId = gameState.players.find(p => !p.isBot)?.id || 'player';
  const hand = gameState.hands[playerId];

  if (hand.length === 1) {
    const result = callUno(playerId);
    if (result.success) {
      unoPressed = true;
      const btn = document.getElementById('uno-btn');
      if (btn) btn.classList.add('pressed');
      showGameMessage('UNO!');
      playSound('uno');
    }
  } else if (hand.length > 1) {
    showToast('You can only call UNO with 1 card left!');
  }
}

// ==================== EMOTES ====================
let emotePanelVisible = false;

function toggleEmotePanel() {
  const panel = document.getElementById('emote-panel');
  if (!panel) return;

  emotePanelVisible = !emotePanelVisible;
  if (emotePanelVisible) {
    panel.classList.add('active');
  } else {
    panel.classList.remove('active');
  }
}

function sendEmote(emote) {
  const emotes = {
    'angry': '😠', 'laugh': '😂', 'cry': '😢',
    'fire': '🔥', 'cool': '😎', 'think': '🤔'
  };

  showGameMessage(emotes[emote] || emote);
  toggleEmotePanel();
}

// ==================== SORT HAND ====================
function sortHand(criteria) {
  const playerId = gameState.players.find(p => !p.isBot)?.id || 'player';
  const hand = gameState.hands[playerId];
  if (!hand) return;

  if (criteria === 'color') {
    const colorOrder = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    hand.sort((a, b) => {
      const colorDiff = (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
      if (colorDiff !== 0) return colorDiff;
      return (a.value || 0) - (b.value || 0);
    });
  } else if (criteria === 'value') {
    hand.sort((a, b) => (a.value || 0) - (b.value || 0));
  }

  renderPlayerHand();
}

// ==================== TURN TIMER ====================
let turnTimerInterval = null;

function startTurnTimer() {
  if (turnTimerInterval) clearInterval(turnTimerInterval);

  const timerDisplay = document.getElementById('game-timer-display');
  const timerValue = document.getElementById('game-timer-value');

  if (!gameState.settings.timer) {
    if (timerDisplay) timerDisplay.style.display = 'none';
    return;
  }

  if (timerDisplay) timerDisplay.style.display = 'flex';

  turnTimerInterval = setInterval(() => {
    if (!gameState || gameState.gameOver) {
      clearInterval(turnTimerInterval);
      return;
    }

    const elapsed = Date.now() - gameState.turnStartTime;
    const remaining = Math.max(0, gameState.turnTimeLimit - elapsed);
    const seconds = Math.ceil(remaining / 1000);

    if (timerValue) {
      timerValue.textContent = `00:${seconds.toString().padStart(2, '0')}`;
    }

    if (timerDisplay && seconds <= 3) {
      timerDisplay.classList.add('warning');
    } else if (timerDisplay) {
      timerDisplay.classList.remove('warning');
    }

    // Auto-pass on timeout
    if (remaining <= 0) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isBot) {
        const playerId = currentPlayer.id;
        drawCard(playerId);
        passTurn(playerId);
        renderGame();
        if (gameState.players[gameState.currentPlayerIndex].isBot) {
          setTimeout(processBotTurn, 1000);
        }
      }
    }
  }, 100);
}

// ==================== GAME OVER ====================
function handleGameOver() {
  if (!gameState || !gameState.gameOver) return;

  playSound('win');
  triggerConfetti();

  const results = getGameResults();
  if (!results) return;

  const modal = document.getElementById('game-over');
  const resultsContainer = document.getElementById('results-container');
  const resultIcon = document.getElementById('result-icon');
  const xpValue = document.getElementById('xp-value');

  if (resultIcon) {
    const isWinner = results.winner && !results.winner.isBot;
    resultIcon.className = 'result-icon ' + (isWinner ? 'win' : 'lose');
    resultIcon.textContent = isWinner ? '🏆' : '🎮';
  }

  if (resultsContainer) {
    resultsContainer.innerHTML = '';
    results.results.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'leaderboard-item' + (r.isWinner ? ' current-player' : '');
      div.innerHTML = `
        <span class="leaderboard-rank">${i + 1}</span>
        <span class="leaderboard-name">${r.name}</span>
        <span class="leaderboard-score">${r.score} pts</span>
      `;
      resultsContainer.appendChild(div);
    });
  }

  if (xpValue) {
    const isWinner = results.winner && !results.winner.isBot;
    xpValue.textContent = '+' + (isWinner ? 250 : 100);
  }

  if (modal) modal.classList.add('active');
}

// ==================== DECK CLICK ====================
function setupDeckClick() {
  const deck = document.getElementById('draw-pile');
  if (deck) {
    deck.onclick = handleDrawCard;
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  setupDeckClick();

  // UNO button
  const unoBtn = document.getElementById('uno-btn');
  if (unoBtn) {
    unoBtn.onclick = handleUnoButton;
  }
});