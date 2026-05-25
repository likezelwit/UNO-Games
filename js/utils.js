// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_VALUES = ['S', 'R', '+2'];
const WILD_VALUES = ['W', '+4'];
const BOT_NAMES = ['Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Flynn'];
const TURN_TIME = 15;
const GAME_TIME = 300;
const AFK_TIMEOUT = 30000;
const RECONNECT_TIMEOUT = 60000;
const EMOTES = {
  angry: '😠',
  laugh: '😂',
  cry:   '😢',
  fire:  '🔥',
  cool:  '😎',
  think: '🤔'
};

// ==================== GAME SETTINGS ====================
const gameSettings = {
  stacking: true,
  timer: true,
  sound: true
};

// ==================== PLAYER STATS ====================
const playerStats = {
  name: 'Player',
  level: 12,
  xp: 2450,
  xpNeeded: 3000,
  coins: 1250
};

// ==================== GAME STATE ====================
let state = {
  deck: [],
  discard: [],
  players: [],
  turn: 0,
  direction: 1,
  activeColor: 'red',
  isOver: false,
  active: false,
  saidUno: new Set(),
  pendingWild: null,
  drawStack: 0,
  stackType: null,
  timer: TURN_TIME,
  timerInterval: null,
  gameTime: GAME_TIME,
  gameTimerInterval: null,
  discardRotation: 0,
  sortMode: null,
  dragCard: null,
  drawnCard: null,
  drawnCardPlayable: false,
  comboCount: 0,
  lastPlayTime: 0
};

// ==================== MULTIPLAYER STATE ====================
let multiplayerState = {
  isHost: false,
  lobbyId: null,
  playerId: null,
  playerName: 'Player_' + Math.random().toString(36).substr(2, 6),
  playerIndex: 0,
  maxPlayers: 4,
  gameMode: 'classic',
  isPrivate: false,
  isQuickMatch: false,
  lobbyRef: null,
  gameRef: null,
  presenceRef: null,
  playerPresenceRef: null,
  lastActivity: Date.now(),
  afkTimer: null,
  reconnectTimer: null,
  playerPositions: {},
  isSearching: false,
  searchRef: null,
  callbacks: {}
};

// ==================== AUDIO ====================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Audio not supported');
    }
  }
}

function playSound(type) {
  if (!audioCtx || !gameSettings.sound) return;

  try {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.connect(g);
    g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    const sounds = {
      card:    { type: 'triangle', freq: [800, 400],            dur: 0.10, vol: 0.08 },
      win:     { type: 'sine',     freq: [523, 659, 784, 1047], dur: 0.80, vol: 0.10 },
      lose:    { type: 'sawtooth', freq: [200, 100],            dur: 0.50, vol: 0.06 },
      draw:    { type: 'sine',     freq: [500, 400],            dur: 0.08, vol: 0.05 },
      tick:    { type: 'sine',     freq: [900, 900],            dur: 0.06, vol: 0.04 },
      deal:    { type: 'triangle', freq: [600, 700],            dur: 0.08, vol: 0.05 },
      skip:    { type: 'square',   freq: [350, 450, 350],       dur: 0.35, vol: 0.06 },
      reverse: { type: 'sine',     freq: [450, 550, 450],       dur: 0.30, vol: 0.06 },
      wild:    { type: 'sine',     freq: [350, 500, 700, 900],  dur: 0.50, vol: 0.08 },
      combo:   { type: 'sine',     freq: [700, 900, 1100],      dur: 0.25, vol: 0.06 },
      uno:     { type: 'sine',     freq: [523, 659, 784],       dur: 0.60, vol: 0.10 },
      emote:   { type: 'sine',     freq: [600, 800],            dur: 0.15, vol: 0.05 },
      join:    { type: 'sine',     freq: [400, 600, 800],       dur: 0.30, vol: 0.08 },
      start:   { type: 'sine',     freq: [600, 800, 1000],      dur: 0.40, vol: 0.10 }
    };

    const s = sounds[type];
    if (!s) return;

    osc.type = s.type;

    if (Array.isArray(s.freq) && s.freq.length > 1) {
      const noteLen = s.dur / s.freq.length;
      s.freq.forEach((f, i) => {
        const st = t + i * noteLen;
        osc.frequency.setValueAtTime(Math.max(1, f), st);
        if (i < s.freq.length - 1) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.freq[i + 1]), st + noteLen);
        }
      });
    } else {
      osc.frequency.setValueAtTime(Array.isArray(s.freq) ? s.freq[0] : s.freq, t);
    }

    g.gain.setValueAtTime(s.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    osc.start(t);
    osc.stop(t + s.dur);
  } catch (e) { /* silent fail */ }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ==================== UTILITY FUNCTIONS ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UNO-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getPlayerColor(idx) {
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  return colors[idx % colors.length];
}

function getPositionClass(idx, totalPlayers) {
  if (totalPlayers === 2) return idx === 0 ? 'bottom' : 'top';
  if (totalPlayers === 3) return ['bottom', 'right', 'left'][idx];
  return ['bottom', 'left', 'top', 'right'][idx];
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

function showGameMessage(text, duration = 1500) {
  const msgEl = document.getElementById('game-message');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.display = 'block';
  clearTimeout(msgEl._hideTimer);
  msgEl._hideTimer = setTimeout(() => { msgEl.style.display = 'none'; }, duration);
}

function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== PARTICLES ====================
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];

  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = 4 + Math.random() * 8;
    particle.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random() * 15}s;
    `;
    container.appendChild(particle);
  }
}

// ==================== LOADING SCREEN ====================
async function runLoadingScreen() {
  const loadingBar  = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const loadingScreen = document.getElementById('loading-screen');

  const steps = [
    { progress: 25,  text: 'Connecting to server...' },
    { progress: 50,  text: 'Loading assets...' },
    { progress: 75,  text: 'Preparing game...' },
    { progress: 100, text: 'Ready!' }
  ];

  for (const step of steps) {
    if (loadingBar)  loadingBar.style.width  = step.progress + '%';
    if (loadingText) loadingText.textContent = step.text;
    await sleep(400);
  }

  await sleep(500);
  if (loadingScreen) loadingScreen.classList.add('hidden');
  showScreen('menu-screen');
  setupConnectionMonitor();
}

// ==================== CONNECTION MONITOR ====================
function setupConnectionMonitor() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    const connected = snap.val() === true;
    updateConnectionStatus(connected);

    if (connected && multiplayerState.playerId && multiplayerState.lobbyId) {
      setupPresence();
    }
    if (!connected && state.active) {
      showToast('Connection lost! Reconnecting...');
    }
  });
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;

  if (connected) {
    statusEl.className = 'connection-status connected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Connected</span>';
  } else {
    statusEl.className = 'connection-status disconnected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Disconnected</span>';
  }
}

// ==================== AFK DETECTION ====================
function startAfkTimer() {
  stopAfkTimer();
  multiplayerState.afkTimer = setInterval(() => {
    const timeSince = Date.now() - multiplayerState.lastActivity;
    if (timeSince > AFK_TIMEOUT && state.turn === multiplayerState.playerIndex) {
      handleAfkTimeout();
    }
  }, 5000);
}

function stopAfkTimer() {
  if (multiplayerState.afkTimer) {
    clearInterval(multiplayerState.afkTimer);
    multiplayerState.afkTimer = null;
  }
}

function updateActivity() {
  multiplayerState.lastActivity = Date.now();
}

function handleAfkTimeout() {
  showGameMessage('You are AFK! Bot taking over...');
  const player = state.players[multiplayerState.playerIndex];
  if (player) {
    player.isBot = true;
    player.botReason = 'afk';
  }
  if (state.turn === multiplayerState.playerIndex) {
    botTurn();
  }
  updateUI();
}

// ==================== PRESENCE ====================
function setupPresence() {
  if (!multiplayerState.lobbyId || !multiplayerState.playerId) return;

  const presenceRef = database.ref('presence/' + multiplayerState.lobbyId + '/' + multiplayerState.playerId);
  multiplayerState.playerPresenceRef = presenceRef;

  presenceRef.set({
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    playerName: multiplayerState.playerName
  });

  presenceRef.onDisconnect().update({
    online: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP
  });

  if (multiplayerState.lobbyRef) {
    const connRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected');
    connRef.set(true);
    connRef.onDisconnect().set(false);
  }

  database.ref('presence/' + multiplayerState.lobbyId).on('value', (snapshot) => {
    handlePresenceChanges(snapshot.val());
  });
}

function handlePresenceChanges(presenceData) {
  if (!presenceData || !state.active) return;
  Object.keys(presenceData).forEach(playerId => {
    const presence = presenceData[playerId];
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1 && !presence.online) {
      handlePlayerDisconnect(playerId, playerIndex);
    }
  });
}

function handlePlayerDisconnect(playerId, playerIndex) {
  if (!state.active) return;
  const player = state.players[playerIndex];
  if (!player || player.isBot) return;

  player.isBot = true;
  player.isConnected = false;
  player.botReason = 'disconnected';

  showGameMessage(player.name + ' disconnected! Bot taking over...');
  updateUI();
  updatePlayerZones();

  if (state.turn === playerIndex) {
    setTimeout(botTurn, 1000);
  }
}
