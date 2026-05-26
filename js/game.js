// ============================================
// UNO GAME - Complete JavaScript
// ============================================

// ===== CONFIG =====
const CONFIG = {
  COLORS: ['red', 'blue', 'green', 'yellow'],
  VALUES: ['0','1','2','3','4','5','6','7','8','9','skip','reverse','+2'],
  SPECIAL: ['wild', '+4'],
  CARD_SCORES: { '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'skip':20,'reverse':20,'+2':20,'wild':50,'+4':50 },
  BOT_NAMES: ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'],
  INITIAL_CARDS: 7,
  TURN_TIME: 15000
};

// ===== FIREBASE CONFIG =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD3d4f9X9v9v9v9v9v9v9v9v9v9v9v9v9v",
  authDomain: "uno-game-12345.firebaseapp.com",
  databaseURL: "https://uno-game-12345-default-rtdb.firebaseio.com",
  projectId: "uno-game-12345",
  storageBucket: "uno-game-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};

// ===== STATE =====
let db = null;
let gameState = null;
let currentPlayer = null;
let roomCode = null;
let settings = { sound: true, timer: true, stack: true };
let selectedMode = 'classic';
let pendingWildCard = null;
let turnTimer = null;
let isProcessing = false;

// ===== AUDIO =====
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!settings.sound || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    switch(type) {
      case 'play':
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(784, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case 'draw':
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      case 'uno':
        [523, 659, 784].forEach((f, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(f, now + i * 0.12);
          g.gain.setValueAtTime(0.12, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.2);
          o.start(now + i * 0.12);
          o.stop(now + i * 0.12 + 0.2);
        });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.connect(g);
          g.connect(audioCtx.destination);
          o.frequency.setValueAtTime(f, now + i * 0.15);
          g.gain.setValueAtTime(0.1, now + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
          o.start(now + i * 0.15);
          o.stop(now + i * 0.15 + 0.3);
        });
        break;
      case 'penalty':
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
    }
  } catch(e) {}
}

// ===== UTILITIES =====
function $(id) { return document.getElementById(id); }

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'UNO-' + code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
}

function showModal(id) {
  const el = $(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}

function saveStorage(key, val) {
  try { localStorage.setItem('uno_' + key, JSON.stringify(val)); } catch(e) {}
}

function loadStorage(key, def) {
  try { const v = localStorage.getItem('uno_' + key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}

// ===== DECK =====
function createDeck() {
  const deck = [];
  CONFIG.COLORS.forEach(color => {
    deck.push({ id: generateId(), type: '0', color, value: 0 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), type: String(i), color, value: i });
      deck.push({ id: generateId(), type: String(i), color, value: i });
    }
    ['skip', 'reverse', '+2'].forEach(type => {
      deck.push({ id: generateId(), type, color, value: 20 });
      deck.push({ id: generateId(), type, color, value: 20 });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), type: 'wild', color: 'wild', value: 50 });
    deck.push({ id: generateId(), type: '+4', color: 'wild', value: 50 });
  }
  return shuffle(deck);
}

function drawFromDeck(count) {
  if (!gameState) return [];
  const cards = [];
  for (let i = 0; i < count && gameState.deck.length > 0; i++) {
    cards.push(gameState.deck.pop());
  }
  if (gameState.deck.length < 5 && gameState.discard.length > 1) {
    const top = gameState.discard.pop();
    gameState.deck = shuffle(gameState.discard);
    gameState.discard = [top];
  }
  return cards;
}

// ===== GAME INIT =====
function initGame(players, mode) {
  const deck = createDeck();
  const hands = {};

  players.forEach(p => {
    hands[p.id] = drawFromDeck(CONFIG.INITIAL_CARDS);
  });

  // First card
  let firstCard = deck.pop();
  while (['wild', '+4', '+2', 'skip', 'reverse'].includes(firstCard.type)) {
    deck.unshift(firstCard);
    firstCard = deck.pop();
  }

  gameState = {
    players,
    hands,
    deck,
    discard: [firstCard],
    currentIndex: 0,
    direction: 1,
    currentColor: firstCard.color,
    wildColor: null,
    mode,
    settings: { ...settings },
    gameOver: false,
    winner: null,
    unoCalled: {},
    turnStart: Date.now()
  };

  // Ensure human player gets cards
  const human = players.find(p => !p.isBot);
  if (human && (!hands[human.id] || hands[human.id].length === 0)) {
    hands[human.id] = drawFromDeck(CONFIG.INITIAL_CARDS);
  }

  return gameState;
}

// ===== RULES =====
function isPlayable(card) {
  if (!gameState) return false;
  const top = gameState.discard[gameState.discard.length - 1];
  const currentColor = gameState.wildColor || gameState.currentColor;

  if (card.type === 'wild' || card.type === '+4') return true;
  if (card.color === currentColor) return true;
  if (card.type === top.type && !['wild', '+4'].includes(card.type)) return true;
  return false;
}

function getPlayableCards(hand) {
  return hand.filter(isPlayable);
}

// ===== ACTIONS =====
function playCard(playerId, cardId, chosenColor) {
  if (!gameState || gameState.gameOver || isProcessing) return { success: false };

  const player = gameState.players[gameState.currentIndex];
  if (player.id !== playerId) return { success: false, error: 'Not your turn' };

  const hand = gameState.hands[playerId];
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return { success: false, error: 'Card not found' };

  const card = hand[idx];
  if (!isPlayable(card)) return { success: false, error: 'Cannot play this card' };

  isProcessing = true;

  // Remove and place
  hand.splice(idx, 1);
  gameState.discard.push(card);
  gameState.unoCalled[playerId] = false;

  // Handle wild
  if (card.type === 'wild' || card.type === '+4') {
    if (!chosenColor) {
      isProcessing = false;
      return { success: false, error: 'Choose color' };
    }
    gameState.wildColor = chosenColor;
    gameState.currentColor = chosenColor;
  } else {
    gameState.currentColor = card.color;
    gameState.wildColor = null;
  }

  // Effects
  let skip = false;
  let drawCount = 0;

  switch(card.type) {
    case 'skip': skip = true; break;
    case 'reverse':
      gameState.direction *= -1;
      if (gameState.players.length === 2) skip = true;
      break;
    case '+2': drawCount = 2; break;
    case '+4': drawCount = 4; break;
  }

  // Check win
  if (hand.length === 0) {
    gameState.gameOver = true;
    gameState.winner = playerId;
    playSound('win');
    isProcessing = false;
    return { success: true, action: 'win', card };
  }

  // Next player
  let next = gameState.currentIndex + gameState.direction;
  if (next >= gameState.players.length) next = 0;
  if (next < 0) next = gameState.players.length - 1;

  if (skip) {
    next += gameState.direction;
    if (next >= gameState.players.length) next = 0;
    if (next < 0) next = gameState.players.length - 1;
  }

  // Draw penalty
  if (drawCount > 0) {
    const nextPlayer = gameState.players[next];
    const drawn = drawFromDeck(drawCount);
    gameState.hands[nextPlayer.id].push(...drawn);
    showToast(`${nextPlayer.name} draws ${drawCount} cards!`);
    playSound('penalty');

    if (!settings.stack) {
      next += gameState.direction;
      if (next >= gameState.players.length) next = 0;
      if (next < 0) next = gameState.players.length - 1;
    }
  }

  gameState.currentIndex = next;
  gameState.turnStart = Date.now();
  playSound('play');
  isProcessing = false;

  return { success: true, action: 'play', card, nextPlayer: gameState.players[next] };
}

function drawCardAction(playerId) {
  if (!gameState || gameState.gameOver || isProcessing) return { success: false };

  const player = gameState.players[gameState.currentIndex];
  if (player.id !== playerId) return { success: false };

  const hand = gameState.hands[playerId];
  if (getPlayableCards(hand).length > 0) {
    return { success: false, error: 'You have playable cards' };
  }

  const drawn = drawFromDeck(1);
  if (drawn.length === 0) return { success: false, error: 'No cards left' };

  gameState.hands[playerId].push(...drawn);
  playSound('draw');

  return { success: true, card: drawn[0], canPlay: isPlayable(drawn[0]) };
}

function passTurn(playerId) {
  if (!gameState || gameState.gameOver) return { success: false };
  const player = gameState.players[gameState.currentIndex];
  if (player.id !== playerId) return { success: false };

  let next = gameState.currentIndex + gameState.direction;
  if (next >= gameState.players.length) next = 0;
  if (next < 0) next = gameState.players.length - 1;

  gameState.currentIndex = next;
  gameState.turnStart = Date.now();
  gameState.unoCalled[playerId] = false;

  return { success: true };
}

function callUnoAction(playerId) {
  if (!gameState) return { success: false };
  const hand = gameState.hands[playerId];
  if (!hand || hand.length !== 1) return { success: false };

  gameState.unoCalled[playerId] = true;
  playSound('uno');
  showToast('UNO!');
  return { success: true };
}

// ===== BOT AI =====
function botChooseCard(bot) {
  const hand = gameState.hands[bot.id];
  const playable = getPlayableCards(hand);
  if (playable.length === 0) return null;

  // Smart-ish: prefer action cards, save wilds
  const sorted = [...playable].sort((a, b) => {
    const pa = CONFIG.CARD_SCORES[a.type] || 0;
    const pb = CONFIG.CARD_SCORES[b.type] || 0;
    if (hand.length <= 2) return pa - pb; // Save wilds when low
    return pb - pa; // Play high value
  });

  return sorted[0];
}

function botChooseColor(bot) {
  const hand = gameState.hands[bot.id];
  const counts = {};
  hand.forEach(c => {
    if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1;
  });
  const colors = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return colors.length > 0 ? colors[0][0] : CONFIG.COLORS[0];
}

function processBotTurn() {
  if (!gameState || gameState.gameOver) return;

  const player = gameState.players[gameState.currentIndex];
  if (!player.isBot) return;

  setTimeout(() => {
    const card = botChooseCard(player);

    if (card) {
      let color = null;
      if (card.type === 'wild' || card.type === '+4') {
        color = botChooseColor(player);
      }

      const result = playCard(player.id, card.id, color);
      if (result.success) {
        renderGame();
        if (result.action === 'win') {
          endGame();
        } else {
          checkBotTurn();
        }
      }
    } else {
      // Draw
      const drawResult = drawCardAction(player.id);
      renderGame();

      if (drawResult.success && drawResult.canPlay) {
        setTimeout(() => {
          const playResult = playCard(player.id, drawResult.card.id);
          if (playResult.success) {
            renderGame();
            if (playResult.action === 'win') endGame();
            else checkBotTurn();
          }
        }, 600);
      } else {
        setTimeout(() => {
          passTurn(player.id);
          renderGame();
          checkBotTurn();
        }, 600);
      }
    }

    // Call UNO
    const hand = gameState.hands[player.id];
    if (hand && hand.length === 1 && Math.random() > 0.1) {
      setTimeout(() => callUnoAction(player.id), 400);
    }
  }, 1000 + Math.random() * 800);
}

function checkBotTurn() {
  if (!gameState || gameState.gameOver) return;
  const current = gameState.players[gameState.currentIndex];
  if (current.isBot) processBotTurn();
  else startTurnTimer();
}

// ===== RENDERING =====
function createCardEl(card, isPlayable = false, isBack = false) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.cardId = card.id;

  if (isBack) {
    div.classList.add('card-back');
    return div;
  }

  if (isPlayable) div.classList.add('playable');
  div.classList.add(`card-${card.color}`);

  const val = card.type === 'skip' ? '⊘' : card.type === 'reverse' ? '⇄' : card.type;
  div.innerHTML = `
    <span class="card-corner top-left">${val}</span>
    <span class="card-value">${val}</span>
    <span class="card-corner bottom-right">${val}</span>
  `;

  return div;
}

function renderGame() {
  if (!gameState) return;

  renderHand();
  renderDiscard();
  renderOpponents();
  renderUI();
}

function renderHand() {
  const container = $('player-hand');
  if (!container) return;
  container.innerHTML = '';

  const human = gameState.players.find(p => !p.isBot);
  if (!human) return;

  const hand = gameState.hands[human.id] || [];
  const isMyTurn = gameState.players[gameState.currentIndex].id === human.id;
  const playable = isMyTurn && !gameState.gameOver ? getPlayableCards(hand) : [];

  hand.forEach(card => {
    const canPlay = playable.some(c => c.id === card.id);
    const el = createCardEl(card, canPlay);
    if (canPlay && !gameState.gameOver) {
      el.onclick = () => handleCardClick(card);
    }
    container.appendChild(el);
  });
}

function renderDiscard() {
  const container = $('top-card');
  if (!container || gameState.discard.length === 0) return;

  container.innerHTML = '';
  const top = gameState.discard[gameState.discard.length - 1];
  container.appendChild(createCardEl(top));

  // Color indicator
  const indicator = $('color-indicator');
  if (indicator) {
    const color = gameState.wildColor || gameState.currentColor;
    indicator.className = 'color-indicator ' + color;
  }
}

function renderOpponents() {
  const bots = gameState.players.filter(p => p.isBot);
  const positions = ['opponent-top', 'opponent-left', 'opponent-right'];

  bots.forEach((bot, i) => {
    const el = $(positions[i]);
    if (!el) return;

    const hand = gameState.hands[bot.id] || [];
    const nameEl = el.querySelector('.opponent-name');
    const countEl = el.querySelector('.card-count');

    if (nameEl) nameEl.textContent = bot.name;
    if (countEl) countEl.textContent = hand.length + ' cards';

    // Highlight active
    const isActive = gameState.players[gameState.currentIndex].id === bot.id;
    el.style.opacity = isActive ? '1' : '0.6';
    el.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
  });
}

function renderUI() {
  // Deck count
  const deckCount = $('deck-count');
  if (deckCount) deckCount.textContent = gameState.deck.length;

  // Direction
  const dir = $('direction-indicator');
  if (dir) {
    dir.textContent = gameState.direction === 1 ? '↻' : '↺';
    dir.classList.toggle('reverse', gameState.direction === -1);
  }

  // Room code
  const code = $('game-room-code');
  if (code) code.textContent = roomCode || 'LOCAL';

  // UNO button
  const unoBtn = $('uno-btn');
  if (unoBtn) {
    const human = gameState.players.find(p => !p.isBot);
    if (human) {
      const hand = gameState.hands[human.id];
      unoBtn.style.display = (hand && hand.length === 1) ? 'block' : 'none';
      unoBtn.classList.remove('called');
    }
  }
}

// ===== UI HANDLERS =====
function handleCardClick(card) {
  if (!gameState || gameState.gameOver || isProcessing) return;

  const human = gameState.players.find(p => !p.isBot);
  if (!human) return;

  if (card.type === 'wild' || card.type === '+4') {
    pendingWildCard = card;
    showModal('color-picker');
    return;
  }

  executePlay(human.id, card.id);
}

function chooseColor(color) {
  closeModal('color-picker');
  if (!pendingWildCard) return;

  const human = gameState.players.find(p => !p.isBot);
  if (human) {
    executePlay(human.id, pendingWildCard.id, color);
  }
  pendingWildCard = null;
}

function executePlay(playerId, cardId, color) {
  const result = playCard(playerId, cardId, color);

  if (result.success) {
    renderGame();

    if (result.action === 'win') {
      endGame();
    } else {
      checkBotTurn();
    }
  } else if (result.error) {
    showToast(result.error);
    const el = document.querySelector(`[data-card-id="${cardId}"]`);
    if (el) {
      el.classList.add('card-anim-shake');
      setTimeout(() => el.classList.remove('card-anim-shake'), 300);
    }
  }
}

function drawCard() {
  if (!gameState || gameState.gameOver || isProcessing) return;

  const human = gameState.players.find(p => !p.isBot);
  if (!human) return;

  const result = drawCardAction(human.id);

  if (result.success) {
    renderGame();

    if (result.canPlay) {
      // Auto-highlight or let player choose
      showToast('Card drawn - you can play it!');
      renderGame(); // Re-render to show playable
    } else {
      setTimeout(() => {
        passTurn(human.id);
        renderGame();
        checkBotTurn();
      }, 500);
    }
  } else if (result.error) {
    showToast(result.error);
  }
}

function callUno() {
  const human = gameState.players.find(p => !p.isBot);
  if (!human) return;

  const result = callUnoAction(human.id);
  if (result.success) {
    const btn = $('uno-btn');
    if (btn) btn.classList.add('called');
  }
}

function sortHand(criteria) {
  const human = gameState.players.find(p => !p.isBot);
  if (!human || !gameState) return;

  const hand = gameState.hands[human.id];
  if (criteria === 'color') {
    const order = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    hand.sort((a, b) => (order[a.color] || 99) - (order[b.color] || 99));
  } else {
    hand.sort((a, b) => (a.value || 0) - (b.value || 0));
  }
  renderHand();
}

// ===== TIMER =====
function startTurnTimer() {
  if (turnTimer) clearInterval(turnTimer);
  if (!settings.timer || !gameState || gameState.gameOver) return;

  const timerEl = $('turn-timer');

  turnTimer = setInterval(() => {
    if (!gameState || gameState.gameOver) {
      clearInterval(turnTimer);
      return;
    }

    const elapsed = Date.now() - gameState.turnStart;
    const remaining = Math.max(0, CONFIG.TURN_TIME - elapsed);
    const seconds = Math.ceil(remaining / 1000);

    if (timerEl) {
      timerEl.textContent = `⏱️ ${seconds}s`;
      timerEl.classList.toggle('warning', seconds <= 3);
    }

    if (remaining <= 0) {
      clearInterval(turnTimer);
      const human = gameState.players.find(p => !p.isBot);
      if (human && gameState.players[gameState.currentIndex].id === human.id) {
        drawCardAction(human.id);
        passTurn(human.id);
        renderGame();
        checkBotTurn();
      }
    }
  }, 100);
}

// ===== GAME FLOW =====
function startQuickMatch() {
  const name = loadStorage('playerName', 'You');
  const players = [
    { id: 'p_' + generateId(), name, isBot: false },
    { id: 'b1_' + generateId(), name: CONFIG.BOT_NAMES[0], isBot: true },
    { id: 'b2_' + generateId(), name: CONFIG.BOT_NAMES[1], isBot: true },
    { id: 'b3_' + generateId(), name: CONFIG.BOT_NAMES[2], isBot: true }
  ];

  initGame(players, selectedMode);
  roomCode = null;

  showScreen('game-screen');
  renderGame();
  startTurnTimer();
}

function endGame() {
  if (turnTimer) clearInterval(turnTimer);

  const modal = $('game-over-modal');
  const title = $('game-result-title');
  const results = $('game-results');

  if (!modal || !results) return;

  const human = gameState.players.find(p => !p.isBot);
  const isWinner = human && gameState.winner === human.id;

  if (title) title.textContent = isWinner ? '🎉 You Win!' : '🎮 Game Over';

  // Calculate scores
  const sorted = gameState.players.map(p => ({
    name: p.name,
    score: gameState.hands[p.id].reduce((s, c) => s + (CONFIG.CARD_SCORES[c.type] || 0), 0),
    isWinner: p.id === gameState.winner,
    isHuman: !p.isBot
  })).sort((a, b) => a.score - b.score);

  results.innerHTML = sorted.map((r, i) => `
    <div class="result-item ${r.isWinner ? 'winner' : ''}">
      <span class="result-rank">${i + 1}</span>
      <span class="result-name">${r.name} ${r.isHuman ? '(You)' : ''}</span>
      <span class="result-score">${r.score} pts</span>
    </div>
  `).join('');

  // Confetti for winner
  if (isWinner) {
    for (let i = 0; i < 50; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = ['#ff3b5c', '#4dabf7', '#51cf66', '#ffd43b'][Math.floor(Math.random() * 4)];
      c.style.animationDelay = Math.random() * 2 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  showModal('game-over-modal');

  // Save stats
  const stats = loadStorage('stats', { games: 0, wins: 0, xp: 0, level: 1 });
  stats.games++;
  if (isWinner) stats.wins++;
  stats.xp += isWinner ? 250 : 50;
  if (stats.xp >= stats.level * 300) {
    stats.level++;
    stats.xp = 0;
  }
  saveStorage('stats', stats);
}

function playAgain() {
  closeModal('game-over-modal');
  startQuickMatch();
}

function leaveGame() {
  if (turnTimer) clearInterval(turnTimer);
  gameState = null;
  backToMenu();
}

// ===== MENU FUNCTIONS =====
function selectMode(mode) {
  selectedMode = mode;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`)?.classList.add('active');
  saveStorage('mode', mode);
}

function showCreateLobby() {
  showModal('create-modal');
}

function showJoinLobby() {
  showModal('join-modal');
}

function createRoom() {
  const nameInput = $('create-name');
  const name = nameInput ? nameInput.value.trim() : 'Player';
  if (!name) { showToast('Enter your name'); return; }

  saveStorage('playerName', name);
  closeModal('create-modal');

  // For now, start local game (Firebase can be added later)
  roomCode = generateRoomCode();
  startQuickMatch();
  showToast('Room created: ' + roomCode);
}

function joinRoom() {
  const codeInput = $('join-code');
  const nameInput = $('join-name');
  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  const name = nameInput ? nameInput.value.trim() : 'Player';

  if (!code) { showToast('Enter room code'); return; }
  if (!name) { showToast('Enter your name'); return; }

  saveStorage('playerName', name);
  closeModal('join-modal');
  showToast('Joining ' + code + '...');

  // Placeholder - would connect to Firebase
  setTimeout(() => startQuickMatch(), 1000);
}

function showSettings() {
  const s = loadStorage('settings', settings);
  settings = { ...settings, ...s };

  $('sound-toggle')?.classList.toggle('active', settings.sound);
  $('timer-toggle')?.classList.toggle('active', settings.timer);
  $('stack-toggle')?.classList.toggle('active', settings.stack);

  showModal('settings-modal');
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  const btn = $(key + '-toggle');
  if (btn) {
    btn.classList.toggle('active', settings[key]);
    btn.textContent = settings[key] ? 'ON' : 'OFF';
  }
  saveStorage('settings', settings);
}

function showLeaderboard() {
  const list = $('leaderboard-list');
  if (list) {
    const stats = loadStorage('stats', { games: 0, wins: 0, xp: 0, level: 1 });
    list.innerHTML = `
      <div class="leaderboard-item">
        <span class="leaderboard-rank">🏆</span>
        <span class="leaderboard-name">Your Stats</span>
        <span class="leaderboard-score">${stats.wins}W / ${stats.games}G</span>
      </div>
      <div class="leaderboard-item">
        <span class="leaderboard-rank">⭐</span>
        <span class="leaderboard-name">Level ${stats.level}</span>
        <span class="leaderboard-score">${stats.xp} XP</span>
      </div>
    `;
  }
  showModal('leaderboard-modal');
}

function backToMenu() {
  if (turnTimer) clearInterval(turnTimer);
  showScreen('menu-screen');
}

function setPlayerCount(n) {
  document.querySelectorAll('#create-modal .count-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

// ===== INITIALIZATION =====
function initApp() {
  // Create particles
  const container = $('particles');
  if (container) {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.background = ['#ff3b5c', '#4dabf7', '#51cf66', '#ffd43b'][Math.floor(Math.random() * 4)];
      p.style.animationDelay = Math.random() * 20 + 's';
      p.style.animationDuration = (15 + Math.random() * 10) + 's';
      container.appendChild(p);
    }
  }

  // Load saved data
  const savedMode = loadStorage('mode', 'classic');
  selectMode(savedMode);

  const savedName = loadStorage('playerName', '');
  if (savedName) {
    const nameEl = $('menu-player-name');
    if (nameEl) nameEl.textContent = savedName;
  }

  const stats = loadStorage('stats', { level: 1, xp: 0 });
  const levelEl = $('player-level');
  const xpFill = $('xp-fill');
  if (levelEl) levelEl.textContent = stats.level;
  if (xpFill) {
    const max = stats.level * 300;
    xpFill.style.width = Math.min((stats.xp / max) * 100, 100) + '%';
  }

  // Loading animation
  let progress = 0;
  const bar = $('loading-progress');
  const text = $('loading-text');

  const interval = setInterval(() => {
    progress += Math.random() * 25 + 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      if (bar) bar.style.width = '100%';
      if (text) text.textContent = 'Ready!';

      setTimeout(() => {
        showScreen('menu-screen');
      }, 400);
    } else {
      if (bar) bar.style.width = progress + '%';
    }
  }, 200);

  // Init audio on first interaction
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });

  // Try Firebase
  try {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      console.log('Firebase connected');
    }
  } catch(e) {
    console.log('Firebase not available, running offline');
  }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (!gameState || gameState.gameOver) return;

  const human = gameState.players.find(p => !p.isBot);
  if (!human || gameState.players[gameState.currentIndex].id !== human.id) return;

  switch(e.key) {
    case 'd':
    case 'D':
      drawCard();
      break;
    case 'u':
    case 'U':
      callUno();
      break;
    case '1': case '2': case '3': case '4': case '5':
    case '6': case '7': case '8': case '9':
      const idx = parseInt(e.key) - 1;
      const hand = gameState.hands[human.id];
      if (hand && hand[idx]) handleCardClick(hand[idx]);
      break;
  }
});

// ===== START =====
document.addEventListener('DOMContentLoaded', initApp);
