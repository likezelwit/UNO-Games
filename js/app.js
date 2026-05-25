// ==================== APP STATE ====================
let currentScreen = 'menu-screen';
let gameMode = 'classic';
let settings = {
  stacking: true,
  timer: true,
  sound: true
};

// ==================== MENU FUNCTIONS ====================
function showMultiplayerOptions() {
  showModal('multiplayer-options-modal');
}

function closeMultiplayerOptions() {
  closeModal('multiplayer-options-modal');
}

function showCreateLobby() {
  closeMultiplayerOptions();
  showModal('create-lobby-modal');
}

function closeCreateLobby() {
  closeModal('create-lobby-modal');
}

function showJoinLobby() {
  closeMultiplayerOptions();
  showModal('join-lobby-modal');
  loadPublicLobbies();
}

function closeJoinLobby() {
  closeModal('join-lobby-modal');
}

function showSettings() {
  // Update toggle states
  document.getElementById('toggle-stacking')?.classList.toggle('active', settings.stacking);
  document.getElementById('toggle-timer')?.classList.toggle('active', settings.timer);
  document.getElementById('toggle-sound')?.classList.toggle('active', settings.sound);
  showModal('settings-modal');
}

function closeSettings() {
  closeModal('settings-modal');
}

function showLeaderboard() {
  showModal('leaderboard-modal');
  loadLeaderboardData();
}

function closeLeaderboard() {
  closeModal('leaderboard-modal');
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  const toggle = document.getElementById('toggle-' + key);
  if (toggle) toggle.classList.toggle('active', settings[key]);
  saveToStorage('settings', settings);
}

// ==================== GAME MODE SELECTION ====================
document.addEventListener('DOMContentLoaded', () => {
  const themeCards = document.querySelectorAll('.theme-card');
  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      themeCards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      gameMode = card.dataset.mode;
    });
  });

  // Count buttons
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    });
  });

  // Mode buttons in create lobby
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    });
  });

  // Leaderboard tabs
  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      loadLeaderboardData(tab.dataset.tab);
    });
  });

  // Chat input enter key
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  // Landscape button
  const landscapeBtn = document.getElementById('landscape-btn');
  if (landscapeBtn) {
    landscapeBtn.addEventListener('click', () => {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    });
  }

  // Initialize
  initApp();
});

// ==================== APP INITIALIZATION ====================
function initApp() {
  // Load saved settings
  const savedSettings = loadFromStorage('settings');
  if (savedSettings) {
    settings = { ...settings, ...savedSettings };
  }

  // Load player name
  const savedName = loadFromStorage('playerName');
  if (savedName) {
    const nameEl = document.getElementById('player-name');
    if (nameEl) nameEl.textContent = savedName;
  }

  // Load player stats
  const stats = loadFromStorage('stats', { level: 1, xp: 0, gamesPlayed: 0, wins: 0 });
  const levelEl = document.getElementById('player-level');
  const xpFill = document.getElementById('xp-fill');
  const currentXp = document.getElementById('current-xp');
  const maxXp = document.getElementById('max-xp');

  if (levelEl) levelEl.textContent = stats.level;
  if (xpFill) {
    const max = stats.level * 250;
    const pct = Math.min((stats.xp / max) * 100, 100);
    xpFill.style.width = pct + '%';
  }
  if (currentXp) currentXp.textContent = stats.xp.toLocaleString();
  if (maxXp) maxXp.textContent = (stats.level * 250).toLocaleString();

  // Check for saved lobby
  const savedLobby = loadFromStorage('currentLobby');
  const savedPlayer = loadFromStorage('currentPlayer');
  if (savedLobby && savedPlayer) {
    currentLobby = savedLobby;
    currentPlayer = savedPlayer;
    // Don't auto-join, let user decide
  }

  // Simulate loading
  let progress = 0;
  const loadingInterval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadingInterval);
      setTimeout(hideLoading, 500);
    }
    showLoading('Loading game...', progress);
  }, 300);

  // Initialize Firebase
  setTimeout(() => {
    initFirebase();
  }, 1000);
}

// ==================== LEADERBOARD ====================
function loadLeaderboardData(tab = 'global') {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;

  // Mock data
  const mockData = {
    global: [
      { name: 'ProPlayer1', score: 15000, rank: 1 },
      { name: 'CardMaster', score: 12500, rank: 2 },
      { name: 'UNOKing', score: 11000, rank: 3 },
      { name: 'Speedster', score: 9500, rank: 4 },
      { name: 'LuckyDraw', score: 8200, rank: 5 },
    ],
    friends: [
      { name: 'Bestie123', score: 7500, rank: 1 },
      { name: 'GamerBro', score: 6200, rank: 2 },
      { name: 'SisPlay', score: 4800, rank: 3 },
    ],
    weekly: [
      { name: 'ThisWeekStar', score: 3200, rank: 1 },
      { name: 'RisingFast', score: 2800, rank: 2 },
      { name: 'NewbiePro', score: 2100, rank: 3 },
    ]
  };

  const data = mockData[tab] || mockData.global;

  list.innerHTML = '';
  data.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'leaderboard-item';
    div.innerHTML = `
      <span class="leaderboard-rank">${item.rank}</span>
      <span class="leaderboard-name">${item.name}</span>
      <span class="leaderboard-score">${item.score.toLocaleString()}</span>
    `;
    list.appendChild(div);
  });
}

// ==================== GAME CONTROLS ====================
function rematch() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');

  if (currentLobby) {
    // Multiplayer rematch
    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: false,
      hand: [],
      saidUno: false,
      score: 0
    }));
    initGame(players, currentLobby.mode, settings);
  } else {
    // Single player with bots
    const playerName = loadFromStorage('playerName', 'You');
    const players = [
      { id: 'player', name: playerName, isBot: false, hand: [], saidUno: false, score: 0 },
      ...createBots(3, 'medium')
    ];
    initGame(players, gameMode, settings);
  }

  showScreen('game-app');
  renderGame();
  startTurnTimer();
}

function backToMenu() {
  // Stop any ongoing game
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }

  // Hide all modals
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

  // Reset game state
  gameState = null;

  showScreen('menu-screen');
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', (e) => {
  if (!gameState || gameState.gameOver) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer.isBot) return;

  switch(e.key) {
    case 'd':
    case 'D':
      handleDrawCard();
      break;
    case 'u':
    case 'U':
      handleUnoButton();
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
      const index = parseInt(e.key) - 1;
      const hand = gameState.hands[currentPlayer.id];
      if (hand && hand[index]) {
        handleCardClick(hand[index]);
      }
      break;
  }
});

// ==================== PWA ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Note: In production, register a real service worker
    // navigator.serviceWorker.register('sw.js');
  });
}

// ==================== BEFORE UNLOAD ====================
window.addEventListener('beforeunload', () => {
  if (currentLobby && currentPlayer) {
    saveToStorage('currentLobby', currentLobby);
    saveToStorage('currentPlayer', currentPlayer);
  }
});

// ==================== EXPORTS FOR GLOBAL ACCESS ====================
window.showMultiplayerOptions = showMultiplayerOptions;
window.closeMultiplayerOptions = closeMultiplayerOptions;
window.showCreateLobby = showCreateLobby;
window.closeCreateLobby = closeCreateLobby;
window.showJoinLobby = showJoinLobby;
window.closeJoinLobby = closeJoinLobby;
window.createLobby = createLobby;
window.joinLobbyByCode = joinLobbyByCode;
window.leaveLobby = leaveLobby;
window.toggleReady = toggleReady;
window.startMultiplayerGame = startMultiplayerGame;
window.sendChatMessage = sendChatMessage;
window.copyRoomCode = copyRoomCode;
window.pasteCode = pasteCode;
window.togglePrivate = togglePrivate;
window.startQuickMatch = startQuickMatch;
window.cancelQuickMatch = cancelQuickMatch;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.showLeaderboard = showLeaderboard;
window.closeLeaderboard = closeLeaderboard;
window.toggleSetting = toggleSetting;
window.selectWildColor = selectWildColor;
window.sortHand = sortHand;
window.toggleEmotePanel = toggleEmotePanel;
window.sendEmote = sendEmote;
window.rematch = rematch;
window.backToMenu = backToMenu;