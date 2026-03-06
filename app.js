// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyDU0rqDjPdMsjhS_7MmvCYaoPoXpqeqyRE",
  authDomain: "unno-f3338.firebaseapp.com",
  databaseURL: "https://unno-f3338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "unno-f3338",
  storageBucket: "unno-f3338.firebasestorage.app",
  messagingSenderId: "925580365013",
  appId: "1:925580365013:web:651b38e0dc0383b28e265c",
  measurementId: "G-976XGC3C0F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==================== CONSTANTS ====================
const COLORS = ['red', 'blue', 'green', 'yellow'];
const SPECIAL_VALUES = ['S', 'R', '+2'];
const WILD_VALUES = ['W', '+4'];
const BOT_NAMES = ['Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Flynn'];
const TURN_TIME = 15;
const GAME_TIME = 300;
const AFK_TIMEOUT = 30000;
const EMOTES = {
  angry: '😠', laugh: '😂', cry: '😢', fire: '🔥', cool: '😎', think: '🤔'
};

// Game Settings
const gameSettings = {
  stacking: true,
  timer: true,
  sound: true
};

// Game State
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
  drawnCardPlayable: false
};

// Multiplayer State
let multiplayerState = {
  isHost: false,
  lobbyId: null,
  playerId: 'player_' + Math.random().toString(36).substr(2, 9),
  playerName: 'Player',
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
  afkTimer: null
};

let audioCtx = null;

// ==================== INITIALIZATION ====================
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
}

function playSound(type) {
  if (!audioCtx || !gameSettings.sound) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    
    const sounds = {
      card: { type: 'triangle', freq: [800, 400], dur: 0.1, vol: 0.08 },
      win: { type: 'sine', freq: [523, 659, 784, 1047], dur: 0.8, vol: 0.1 },
      lose: { type: 'sawtooth', freq: [200, 100], dur: 0.5, vol: 0.06 },
      draw: { type: 'sine', freq: [500, 400], dur: 0.08, vol: 0.05 },
      tick: { type: 'sine', freq: [900], dur: 0.06, vol: 0.04 },
      skip: { type: 'square', freq: [350, 450], dur: 0.35, vol: 0.06 },
      reverse: { type: 'sine', freq: [450, 550], dur: 0.3, vol: 0.06 },
      wild: { type: 'sine', freq: [350, 500, 700], dur: 0.5, vol: 0.08 },
      uno: { type: 'sine', freq: [523, 659, 784], dur: 0.6, vol: 0.1 },
      join: { type: 'sine', freq: [400, 600, 800], dur: 0.3, vol: 0.08 },
      start: { type: 'sine', freq: [600, 800, 1000], dur: 0.4, vol: 0.1 }
    };
    
    const s = sounds[type];
    if (!s) return;

    osc.type = s.type;
    if (Array.isArray(s.freq)) {
      const noteLength = s.dur / s.freq.length;
      s.freq.forEach((f, i) => {
        osc.frequency.setValueAtTime(Math.max(1, f), t + (i * noteLength));
      });
    } else {
      osc.frequency.setValueAtTime(s.freq, t);
    }
    
    g.gain.setValueAtTime(s.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);
    
    osc.start(t);
    osc.stop(t + s.dur);
  } catch (e) {}
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ==================== UTILITY FUNCTIONS ====================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'UNO-';
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function getPlayerColor(idx) {
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];
  return colors[idx % colors.length];
}

function getPositionClass(idx, totalPlayers) {
  if (totalPlayers === 2) return idx === 0 ? 'bottom' : 'top';
  if (totalPlayers === 3) {
    const positions = ['bottom', 'right', 'left']; // P1, P2(bot), P3(bot) mapping for 3 players
    return positions[idx];
  }
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
  setTimeout(() => { msgEl.style.display = 'none'; }, duration);
}

function showToast(message, duration = 2500) {
  let toast = document.getElementById('toast-message');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-message';
    toast.className = 'toast'; // Uses CSS class from provided CSS
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
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
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = (Math.random() * 100) + '%';
    particle.style.top = (Math.random() * 100) + '%';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDelay = (Math.random() * 15) + 's';
    container.appendChild(particle);
  }
}

// ==================== LOADING SCREEN ====================
async function runLoadingScreen() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');
  const loadingScreen = document.getElementById('loading-screen');
  
  const steps = [
    { progress: 25, text: "Connecting to server..." },
    { progress: 50, text: "Loading assets..." },
    { progress: 75, text: "Preparing game..." },
    { progress: 100, text: "Ready!" }
  ];
  
  for (const step of steps) {
    if (loadingBar) loadingBar.style.width = step.progress + '%';
    if (loadingText) loadingText.textContent = step.text;
    await sleep(400);
  }
  
  await sleep(500);
  if (loadingScreen) loadingScreen.classList.add('hidden');
  showScreen('menu-screen');
  setupConnectionMonitor();
}

// ==================== CONNECTION STATUS ====================
function setupConnectionMonitor() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    const connected = snap.val() === true;
    updateConnectionStatus(connected);
    if (connected && multiplayerState.playerId && multiplayerState.lobbyId) setupPresence();
    if (!connected && state.active) showToast('Connection lost! Reconnecting...');
  });
}

function updateConnectionStatus(connected) {
  let statusEl = document.getElementById('connection-status');
  if (!statusEl) return;

  if (connected) {
    statusEl.className = 'connection-status connected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Connected</span>';
  } else {
    statusEl.className = 'connection-status disconnected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Disconnected</span>';
  }
}

// ==================== MENU FUNCTIONS ====================
function showMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.add('active');
  initAudio();
}

function closeMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.remove('active');
}

function showSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('active');
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('active');
}

function toggleSetting(setting) {
  gameSettings[setting] = !gameSettings[setting];
  const toggle = document.getElementById('toggle-' + setting);
  if (toggle) toggle.classList.toggle('active', gameSettings[setting]);
}

function showLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.add('active');
  loadLeaderboard();
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('active');
}

function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  // Mock data for now
  list.innerHTML = [
    { name: 'Champion', score: 5200 },
    { name: 'ProPlayer', score: 4800 },
    { name: 'CardMaster', score: 4100 },
    { name: multiplayerState.playerName, score: 2450 }
  ].sort((a, b) => b.score - a.score).map((p, i) => `
    <div class="leaderboard-item ${p.name === multiplayerState.playerName ? 'current-player' : ''}">
      <div class="leaderboard-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</div>
      <div class="leaderboard-name">${p.name}</div>
      <div class="leaderboard-score">${p.score} XP</div>
    </div>
  `).join('');
}

// ==================== CREATE LOBBY ====================
function showCreateLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('create-lobby-modal');
  if (modal) modal.classList.add('active');
  
  // Attach listeners for mode/count buttons inside the modal
  document.querySelectorAll('#create-lobby-modal .mode-btn, #create-lobby-modal .count-btn').forEach(btn => {
    btn.onclick = function() {
      this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    };
  });
}

function closeCreateLobby() {
  const modal = document.getElementById('create-lobby-modal');
  if (modal) modal.classList.remove('active');
}

function togglePrivate() {
  const toggle = document.getElementById('private-toggle');
  if (toggle) toggle.classList.toggle('active');
}

async function createLobby() {
  const nameInput = document.getElementById('host-name');
  const activeMode = document.querySelector('#create-lobby-modal .mode-btn.active');
  const activeCount = document.querySelector('#create-lobby-modal .count-btn.active');
  const privateToggle = document.getElementById('private-toggle');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  multiplayerState.gameMode = activeMode?.dataset.mode || 'classic';
  multiplayerState.maxPlayers = parseInt(activeCount?.dataset.count) || 4;
  multiplayerState.isPrivate = privateToggle?.classList.contains('active') || false;
  multiplayerState.isHost = true;
  
  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;
  
  closeCreateLobby();
  showScreen('lobby-room'); // ID from HTML
  
  // Create lobby in Firebase
  const lobbyRef = database.ref('lobbies/' + roomCode);
  multiplayerState.lobbyRef = lobbyRef;
  
  const lobbyData = {
    hostId: multiplayerState.playerId,
    hostName: multiplayerState.playerName,
    gameMode: multiplayerState.gameMode,
    maxPlayers: multiplayerState.maxPlayers,
    isPrivate: multiplayerState.isPrivate,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    status: 'waiting',
    players: {
      [multiplayerState.playerId]: {
        name: multiplayerState.playerName,
        isHost: true,
        isReady: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        isBot: false,
        isConnected: true
      }
    },
    playerOrder: [multiplayerState.playerId]
  };
  
  try {
    await lobbyRef.set(lobbyData);
    multiplayerState.playerIndex = 0;
    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Lobby created: ' + roomCode);
  } catch (error) {
    console.error('Error creating lobby:', error);
    showToast('Failed to create lobby.');
    showScreen('menu-screen');
  }
}

// ==================== JOIN LOBBY ====================
function showJoinLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('join-lobby-modal');
  if (modal) modal.classList.add('active');
  refreshPublicLobbies();
}

function closeJoinLobby() {
  const modal = document.getElementById('join-lobby-modal');
  if (modal) modal.classList.remove('active');
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById('room-code-input');
    if (input) input.value = text;
  }).catch(err => showToast('Failed to paste'));
}

async function refreshPublicLobbies() {
  const listEl = document.getElementById('public-lobby-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="lobby-empty">Searching...</div>';
  
  try {
    const snapshot = await database.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value');
    const lobbies = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers) {
          lobbies.push({ id: child.key, ...data, playerCount });
        }
      }
    });
    
    if (lobbies.length === 0) {
      listEl.innerHTML = '<div class="lobby-empty">No public lobbies found</div>';
      return;
    }
    
    listEl.innerHTML = lobbies.map(lobby => `
      <div class="lobby-item" onclick="joinLobbyById('${lobby.id}')">
        <div class="lobby-item-info">
          <div class="lobby-item-name">${lobby.id}</div>
          <div class="lobby-item-host">Host: ${lobby.hostName}</div>
        </div>
        <div class="lobby-item-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
      </div>
    `).join('');
    
  } catch (error) {
    listEl.innerHTML = '<div class="lobby-empty">Error loading lobbies</div>';
  }
}

async function joinLobbyByCode() {
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('room-code-input');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  const roomCode = codeInput?.value?.toUpperCase().trim();
  
  if (!roomCode) {
    showToast('Please enter a room code');
    return;
  }
  
  await joinLobbyById(roomCode);
}

async function joinLobbyById(lobbyId) {
  multiplayerState.lobbyId = lobbyId;
  multiplayerState.isHost = false;
  
  closeJoinLobby();
  showScreen('lobby-room');
  
  const lobbyRef = database.ref('lobbies/' + lobbyId);
  multiplayerState.lobbyRef = lobbyRef;
  
  try {
    const snapshot = await lobbyRef.once('value');
    const lobbyData = snapshot.val();
    
    if (!lobbyData) { showToast('Lobby not found!'); showScreen('menu-screen'); return; }
    if (lobbyData.status !== 'waiting') { showToast('Game already in progress!'); showScreen('menu-screen'); return; }
    
    const currentCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
    if (currentCount >= lobbyData.maxPlayers) { showToast('Lobby is full!'); showScreen('menu-screen'); return; }
    
    // Add player
    const updates = {};
    updates['/players/' + multiplayerState.playerId] = {
      name: multiplayerState.playerName,
      isHost: false,
      isReady: false,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      isBot: false,
      isConnected: true
    };
    
    const newOrder = [...(lobbyData.playerOrder || []), multiplayerState.playerId];
    updates['/playerOrder'] = newOrder;
    
    await lobbyRef.update(updates);
    
    multiplayerState.playerIndex = newOrder.indexOf(multiplayerState.playerId);
    multiplayerState.gameMode = lobbyData.gameMode || 'classic';
    multiplayerState.maxPlayers = lobbyData.maxPlayers || 4;
    
    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Joined lobby: ' + lobbyId);
    
  } catch (error) {
    showToast('Failed to join lobby');
    showScreen('menu-screen');
  }
}

// ==================== QUICK MATCH ====================
function startQuickMatch() {
  closeMultiplayerOptions();
  showScreen('quick-match-screen');
  performQuickMatch();
}

async function performQuickMatch() {
  multiplayerState.playerName = 'Player'; // Default for quick match
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  try {
    const snapshot = await database.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value');
    let foundLobby = null;
    
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers && playerCount > 0) foundLobby = { id: child.key, ...data };
      }
    });
    
    if (foundLobby) {
      showScreen('lobby-room'); // Switch screen before joining logic updates UI
      await joinLobbyById(foundLobby.id);
    } else {
      // Create new quick match lobby
      multiplayerState.isHost = true;
      multiplayerState.isPrivate = false;
      multiplayerState.gameMode = 'classic';
      multiplayerState.maxPlayers = 4;
      multiplayerState.playerName = 'Player';
      
      const roomCode = generateRoomCode();
      multiplayerState.lobbyId = roomCode;
      showScreen('lobby-room');
      
      const lobbyRef = database.ref('lobbies/' + roomCode);
      multiplayerState.lobbyRef = lobbyRef;
      
      const lobbyData = {
        hostId: multiplayerState.playerId,
        hostName: multiplayerState.playerName,
        gameMode: 'classic',
        maxPlayers: 4,
        isPrivate: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'waiting',
        isQuickMatch: true,
        players: {
          [multiplayerState.playerId]: {
            name: multiplayerState.playerName, isHost: true, isReady: true, isBot: false, isConnected: true
          }
        },
        playerOrder: [multiplayerState.playerId]
      };
      
      await lobbyRef.set(lobbyData);
      multiplayerState.playerIndex = 0;
      updateLobbyUI();
      setupLobbyListeners();
      setupPresence();
      playSound('join');
    }
  } catch (error) {
    showToast('Quick match failed');
    showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

// ==================== LOBBY UI & LOGIC ====================
function updateLobbyUI() {
  const codeEl = document.getElementById('display-room-code');
  const miniCodeEl = document.getElementById('room-code-mini');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId;
  if (miniCodeEl) miniCodeEl.textContent = multiplayerState.lobbyId;
}

function copyRoomCode() {
  navigator.clipboard.writeText(multiplayerState.lobbyId).then(() => {
    showToast('Room code copied!');
    playSound('card');
  }).catch(() => showToast('Failed to copy'));
}

function renderLobbyPlayers(players, playerOrder) {
  const grid = document.getElementById('lobby-players-grid');
  if (!grid) return;
  
  const maxPlayers = multiplayerState.maxPlayers;
  const orderedPlayers = playerOrder || Object.keys(players);
  let html = '';
  
  for (let i = 0; i < maxPlayers; i++) {
    const playerId = orderedPlayers[i];
    const player = playerId ? players[playerId] : null;
    
    if (player) {
      const isYou = playerId === multiplayerState.playerId;
      const statusClass = player.isReady ? 'ready' : 'not-ready';
      
      html += `
        <div class="lobby-player-slot filled ${isYou ? 'you' : ''} ${player.isHost ? 'host' : ''}">
          <div class="slot-avatar" style="background: ${getPlayerColor(i)}">
             <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="white"/></svg>
          </div>
          <span class="slot-name">${player.name}${isYou ? ' (You)' : ''}</span>
          <span class="slot-status">${player.isReady ? 'Ready' : 'Waiting...'}</span>
          ${!isYou && multiplayerState.isHost ? `<button class="kick-btn" onclick="kickPlayer('${playerId}')">×</button>` : ''}
        </div>`;
    } else {
      html += `
        <div class="lobby-player-slot empty">
          <div class="slot-avatar empty">
             <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </div>
          <span class="slot-name">Waiting...</span>
          <span class="slot-status">Empty Slot</span>
        </div>`;
    }
  }
  grid.innerHTML = html;
}

function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;
  
  multiplayerState.lobbyRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    
    multiplayerState.maxPlayers = data.maxPlayers;
    multiplayerState.gameMode = data.gameMode;
    
    const modeDisplay = document.getElementById('lobby-mode-display');
    if (modeDisplay) modeDisplay.textContent = data.gameMode.charAt(0).toUpperCase() + data.gameMode.slice(1) + ' Mode';
    
    const countDisplay = document.getElementById('lobby-player-count');
    const maxDisplay = document.getElementById('lobby-max-players');
    if (countDisplay) countDisplay.textContent = data.playerOrder ? data.playerOrder.length : 0;
    if (maxDisplay) maxDisplay.textContent = data.maxPlayers;
    
    if (data.players) {
      renderLobbyPlayers(data.players, data.playerOrder);
      updateStartButton(data.players);
    }
    
    if (data.status === 'playing') startGameFromLobby();
  });
  
  // Chat listener
  multiplayerState.lobbyRef.child('chat').limitToLast(50).on('child_added', (snap) => {
    const msg = snap.val();
    if (msg) displayChatMessage(msg);
  });
}

function updateStartButton(players) {
  const startBtn = document.getElementById('start-game-btn');
  const changeTeamBtn = document.getElementById('change-team-btn');
  if (!startBtn) return;
  
  const playerCount = Object.keys(players).length;
  const allReady = Object.values(players).every(p => p.isReady);
  const canStart = multiplayerState.isHost && playerCount >= 1 && allReady; // For testing, allow 1 player start
  
  startBtn.disabled = !canStart;
  
  // Logic for team mode if needed
  if (multiplayerState.gameMode === 'team') {
    changeTeamBtn.style.display = 'block';
  } else {
    changeTeamBtn.style.display = 'none';
  }
}

async function toggleReady() {
  if (!multiplayerState.lobbyRef || !multiplayerState.playerId) return;
  const playerRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId);
  const snap = await playerRef.once('value');
  if (snap.val()) await playerRef.update({ isReady: !snap.val().isReady });
}

function changeTeam() {
  showToast("Team switching coming soon!");
}

async function kickPlayer(playerId) {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  await multiplayerState.lobbyRef.child('players/' + playerId).remove();
  showToast('Player kicked');
}

async function leaveLobby() {
  cleanupLobby();
  showScreen('menu-screen');
}

function cleanupLobby() {
  if (multiplayerState.lobbyRef && multiplayerState.playerId) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
    // If host leaves and lobby empty, it will clean up or reassign host logic needed
    multiplayerState.lobbyRef.off();
  }
  if (multiplayerState.playerPresenceRef) {
    multiplayerState.playerPresenceRef.remove();
    multiplayerState.playerPresenceRef.off();
  }
  
  multiplayerState.lobbyRef = null;
  multiplayerState.lobbyId = null;
  multiplayerState.isHost = false;
}

// ==================== CHAT ====================
function displayChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<span class="chat-message-sender">${msg.sender}:</span> <span class="chat-message-text">${msg.text}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !multiplayerState.lobbyRef) return;
  const text = input.value.trim();
  if (!text) return;
  
  await multiplayerState.lobbyRef.child('chat').push({
    sender: multiplayerState.playerName,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

// ==================== PRESENCE ====================
function setupPresence() {
  if (!multiplayerState.lobbyId || !multiplayerState.playerId) return;
  
  const presenceRef = database.ref('presence/' + multiplayerState.lobbyId + '/' + multiplayerState.playerId);
  multiplayerState.playerPresenceRef = presenceRef;
  
  presenceRef.set({
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    name: multiplayerState.playerName
  });
  
  presenceRef.onDisconnect().update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
  
  if (multiplayerState.lobbyRef) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').set(true);
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').onDisconnect().set(false);
  }
}

// ==================== GAME FLOW ====================
async function startMultiplayerGame() {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  
  const snapshot = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  if (!lobbyData || lobbyData.status !== 'waiting') return;
  
  // Create deck and initial state
  const deck = createDeck();
  const startCard = deck.pop();
  
  const playerHands = {};
  lobbyData.playerOrder.forEach(pid => {
    playerHands[pid] = [];
    for (let i = 0; i < 7; i++) playerHands[pid].push(deck.pop());
  });
  
  const gameData = {
    deck: deck,
    discard: [startCard],
    activeColor: startCard.c === 'black' ? 'red' : startCard.c, // Fallback for wild start
    turn: 0,
    direction: 1,
    drawStack: 0,
    stackType: null,
    playerOrder: lobbyData.playerOrder,
    playerHands: playerHands,
    playerData: lobbyData.players,
    status: 'playing',
    startedAt: firebase.database.ServerValue.TIMESTAMP
  };
  
  await multiplayerState.lobbyRef.update({ status: 'playing' });
  await multiplayerState.lobbyRef.child('game').set(gameData);
  playSound('start');
}

function startGameFromLobby() {
  showScreen('game-app');
  initAudio();
  multiplayerState.gameRef = multiplayerState.lobbyRef.child('game');
  setupGameListeners();
  startAfkTimer();
  document.addEventListener('click', updateActivity);
}

function createDeck() {
  let deck = [];
  COLORS.forEach(color => {
    deck.push({ c: color, v: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ c: color, v: i.toString() });
      deck.push({ c: color, v: i.toString() });
    }
    SPECIAL_VALUES.forEach(value => {
      deck.push({ c: color, v: value });
      deck.push({ c: color, v: value });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ c: 'black', v: 'W' });
    deck.push({ c: 'black', v: '+4' });
  }
  return shuffle(deck);
}

// ==================== GAME SYNC ====================
function setupGameListeners() {
  if (!multiplayerState.gameRef) return;
  multiplayerState.gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (!gameData) return;
    syncGameState(gameData);
  });
}

function syncGameState(gameData) {
  const playerOrder = gameData.playerOrder;
  const myIndex = playerOrder.indexOf(multiplayerState.playerId);
  multiplayerState.playerIndex = myIndex;
  
  // Build players array
  state.players = playerOrder.map((pid, idx) => {
    const pData = gameData.playerData[pid];
    const hand = gameData.playerHands[pid] || [];
    return {
      id: pid,
      name: pData.name,
      hand: hand,
      isBot: pData.isBot || false,
      isConnected: pData.isConnected !== false
    };
  });
  
  state.deck = gameData.deck || [];
  state.discard = gameData.discard || [];
  state.activeColor = gameData.activeColor || 'red';
  state.turn = gameData.turn || 0;
  state.direction = gameData.direction || 1;
  state.drawStack = gameData.drawStack || 0;
  state.stackType = gameData.stackType || null;
  state.active = true;
  state.isOver = false;
  
  renderHand();
  updateUI();
  updatePlayerZones();
  
  // My turn logic
  if (state.turn === myIndex && !state.players[myIndex].isBot) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
  
  // Bot turn check (host handles bots)
  const currentPlayer = state.players[state.turn];
  if (currentPlayer && (currentPlayer.isBot || !currentPlayer.isConnected) && multiplayerState.isHost) {
    setTimeout(botTurn, 1000);
  }
}

async function sendGameAction(actionType, actionData) {
  if (!multiplayerState.gameRef) return;
  await multiplayerState.gameRef.child('lastAction').set({
    type: actionType,
    playerId: multiplayerState.playerId,
    data: actionData,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

// ==================== CARD RENDERING ====================
function renderCard(card, isBack = false) {
  const el = document.createElement('div');
  el.className = 'uno-card';

  if (isBack) {
    el.classList.add('card-back');
    el.innerHTML = `<svg viewBox="0 0 240 360"><rect width="240" height="360" rx="25" fill="#1a1a2e"/><rect x="10" y="10" width="220" height="340" rx="20" fill="none" stroke="#fff" stroke-width="4"/><text x="120" y="190" font-family="Bebas Neue" font-size="60" fill="var(--uno-red)" text-anchor="middle">UNO</text></svg>`;
    return el;
  }

  let fill = '';
  if (card.c === 'red') fill = 'url(#unoRed)';
  else if (card.c === 'blue') fill = 'url(#unoBlue)';
  else if (card.c === 'green') fill = 'url(#unoGreen)';
  else if (card.c === 'yellow') fill = 'url(#unoYellow)';
  else fill = '#222'; 

  const isWild = card.c === 'black';
  let displayValue = card.v;
  
  // Simplified SVG for readability in code, but matches CSS styles
  el.innerHTML = `
    <svg viewBox="0 0 240 360">
      <rect width="240" height="360" rx="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" fill="none" stroke="#fff" stroke-width="8"/>
      ${!isWild ? `<ellipse cx="120" cy="180" rx="100" ry="150" fill="none" stroke="#fff" stroke-width="10" transform="rotate(-30 120 180)"/>` : ''}
      <text x="120" y="200" font-family="Bebas Neue, sans-serif" font-size="${isWild ? 60 : 120}" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle" stroke="#000" stroke-width="2">${displayValue}</text>
      <text x="40" y="60" font-family="Bebas Neue" font-size="40" fill="#fff" stroke="#000" stroke-width="1">${displayValue}</text>
    </svg>`;
  return el;
}

function renderHand() {
  const handContainer = document.getElementById('player-hand');
  if (!handContainer) return;
  handContainer.innerHTML = '';
  
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  const isMyTurn = state.turn === multiplayerState.playerIndex;
  
  player.hand.forEach((card, idx) => {
    const el = renderCard(card);
    let isValid = false;
    
    if (isMyTurn && state.active && !player.isBot) {
      if (state.drawStack > 0 && gameSettings.stacking) {
        isValid = canStackCard(card);
      } else {
        isValid = checkValidPlay(card);
      }
    }
    
    if (isValid) el.classList.add('playable');
    
    el.onclick = async function() {
      if (!state.active || state.turn !== multiplayerState.playerIndex || player.isBot) return;
      if (isValid) await playCard(multiplayerState.playerIndex, idx);
      else {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
      }
    };
    
    handContainer.appendChild(el);
  });
}

function checkValidPlay(card) {
  const top = state.discard[state.discard.length - 1];
  if (!top) return true;
  if (card.c === 'black') return true;
  if (card.c === state.activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

function canStackCard(card) {
  if (!gameSettings.stacking) return false;
  if (state.stackType === '+2') return card.v === '+2' || card.v === '+4';
  if (state.stackType === '+4') return card.v === '+4';
  return false;
}

// ==================== GAME ACTIONS ====================
async function playCard(playerIndex, cardIndex) {
  const player = state.players[playerIndex];
  if (!player) return;
  
  const card = player.hand.splice(cardIndex, 1)[0];
  state.discard.push(card);
  
  // Stacking logic
  if (gameSettings.stacking) {
    if (card.v === '+2') { state.drawStack += 2; state.stackType = '+2'; }
    else if (card.v === '+4') { state.drawStack += 4; state.stackType = '+4'; }
    else { state.drawStack = 0; state.stackType = null; }
  }
  
  // Wild Logic
  if (card.c === 'black') {
    if (playerIndex === multiplayerState.playerIndex) {
      state.pendingWild = card;
      showColorPicker3D();
      updateUI();
      return;
    } else {
      // Bot or other player picked wild - handled by their logic
      // If we are host simulating bot, we choose color later
    }
  } else {
    state.activeColor = card.c;
  }
  
  // Win Check
  if (player.hand.length === 0) {
    await endMultiplayerGame(playerIndex);
    return;
  }
  
  // UNO Check
  if (player.hand.length === 1) state.saidUno.add(playerIndex);
  
  // Apply effects & Advance
  await applyCardEffect(card, playerIndex);
  await advanceTurn();
  
  // Sync to DB
  if (multiplayerState.gameRef) {
    const updates = {
      turn: state.turn, direction: state.direction, discard: state.discard,
      deck: state.deck, activeColor: state.activeColor, drawStack: state.drawStack,
      stackType: state.stackType, playerHands: {}
    };
    state.players.forEach(p => updates.playerHands[p.id] = p.hand);
    await multiplayerState.gameRef.update(updates);
  }
  
  // Effects
  playSound(card.v === 'S' ? 'skip' : card.v === 'R' ? 'reverse' : 'card');
  vibrate(50);
  updateUI();
  renderHand();
}

async function selectWildColor(color) {
  state.activeColor = color;
  hideColorPicker3D();
  
  if (multiplayerState.gameRef) await multiplayerState.gameRef.update({ activeColor: color });
  
  await applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
  state.pendingWild = null;
  await advanceTurn();
  
  playSound('wild');
  createWildExplosion();
}

async function applyCardEffect(card, currentPlayerIndex) {
  const nextIdx = getNextPlayerIndex();
  const nextPlayer = state.players[nextIdx];
  
  if (state.drawStack === 0 || !gameSettings.stacking) {
    if (card.v === 'S') {
      showGameMessage(nextPlayer.name + ' Skipped!');
      state.turn = nextIdx; // Skip doubles turn advance? No, advanceTurn handles it. Logic: Skip jumps over next.
      // Effectively: playCard -> advanceTurn moves to next. Skip needs to move one extra.
      // Simplified: state.turn becomes nextIdx. Then advanceTurn moves again.
      // But normally: current plays Skip. Next player is skipped.
      // We set state.turn = nextIdx (the skipped person) and then advanceTurn will move to the person after them? 
      // Or advanceTurn logic should handle this.
      // Standard logic: 
      // playCard -> ... -> advanceTurn.
      // If Skip: next player index = current + direction. 
      // Turn should become that skipped player, then advanceTurn moves again? 
      // Actually, easiest is: if Skip, state.turn = nextIdx (skipped). Then advanceTurn moves to next. 
      // But we must ensure advanceTurn logic doesn't skip the skipped person again.
      // Let's just modify advanceTurn to handle current player context? 
      // Better: `advanceTurn(skip=true)`.
    } else if (card.v === 'R') {
      state.direction *= -1;
      showGameMessage('Reversed!');
      if (state.players.length === 2) state.turn = currentPlayerIndex; // Acts as skip in 2 player
    }
  }
  
  // Draw stack logic (if next player cannot stack)
  if (state.drawStack > 0 && gameSettings.stacking) {
    // Check if next player can stack
    const canStack = nextPlayer.hand.some(c => canStackCard(c));
    if (!canStack) {
      const drawn = drawCards(state.drawStack);
      nextPlayer.hand.push(...drawn);
      showGameMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0;
      state.stackType = null;
      // Their turn is skipped essentially because they drew? Or do they play?
      // Rules vary. Usually +2/+4 skips the turn.
      state.turn = nextIdx; // They are the victim.
      // advanceTurn will move from them to next.
    }
  }
}

function getNextPlayerIndex() {
  let next = state.turn + state.direction;
  if (next >= state.players.length) next = 0;
  if (next < 0) next = state.players.length - 1;
  return next;
}

async function advanceTurn(skipCurrent = false) {
  // If we are handling skip/reverse logic inside playCard, this just moves normally.
  // But simpler: 
  let next = getNextPlayerIndex();
  
  // Check if we need to skip (from Skip card or +2/+4)
  // Actually, let's just compute next.
  state.turn = next;
  
  // Sync
  if (multiplayerState.gameRef) {
    // Partial update for turn change
    const updates = { turn: state.turn, direction: state.direction };
    state.players.forEach(p => updates['playerHands/' + p.id] = p.hand); // Sync hands just in case
    await multiplayerState.gameRef.update(updates);
  }
  
  updateUI();
  renderHand();
  
  const currentPlayer = state.players[state.turn];
  if (currentPlayer && (currentPlayer.isBot || !currentPlayer.isConnected) && multiplayerState.isHost) {
    setTimeout(botTurn, 1000);
  } else if (state.turn === multiplayerState.playerIndex) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
}

// ==================== DRAW CARD ====================
function drawCards(count) {
  let drawn = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard.pop();
      state.deck = shuffle(state.discard);
      state.discard = [top];
    }
    if (state.deck.length > 0) drawn.push(state.deck.pop());
  }
  return drawn;
}

async function handleDrawPile() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  
  stopTimer();
  const player = state.players[multiplayerState.playerIndex];
  
  if (state.drawStack > 0 && gameSettings.stacking) {
    // Must stack or draw
    const canStack = player.hand.some(c => canStackCard(c));
    if (canStack) {
      showGameMessage("You have a card to stack!");
      startTimer();
      return;
    }
    // Draw stack
    const drawn = drawCards(state.drawStack);
    player.hand.push(...drawn);
    showGameMessage('You drew ' + state.drawStack + ' cards!');
    vibrate([50, 30, 50]);
    state.drawStack = 0;
    state.stackType = null;
    renderHand();
    updateUI();
    await advanceTurn();
    return;
  }
  
  // Normal Draw
  const card = drawCards(1)[0];
  if (!card) return;
  
  player.hand.push(card);
  renderHand();
  updateUI();
  
  const isPlayable = checkValidPlay(card);
  
  if (isPlayable) {
    showDrawnCardPopup(card, true);
  } else {
    showGameMessage("Cannot play this card");
    await sleep(500);
    await advanceTurn();
  }
}

function showDrawnCardPopup(card, canPlay) {
  const popup = document.getElementById('drawn-card-popup');
  const display = document.getElementById('drawn-card-display');
  const playBtn = document.getElementById('play-btn');
  
  if (display) {
    display.innerHTML = '';
    display.appendChild(renderCard(card));
  }
  if (playBtn) playBtn.style.display = canPlay ? 'block' : 'none';
  if (popup) popup.classList.add('active');
  
  state.drawnCard = card;
}

function hideDrawnCardPopup() {
  const popup = document.getElementById('drawn-card-popup');
  if (popup) popup.classList.remove('active');
}

async function handleKeepCard() {
  hideDrawnCardPopup();
  await advanceTurn();
}

async function handlePlayDrawnCard() {
  if (!state.drawnCard) return;
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  const cardIndex = player.hand.length - 1; // Assuming it was added to end
  hideDrawnCardPopup();
  await playCard(multiplayerState.playerIndex, cardIndex);
}

// ==================== BOT AI ====================
async function botTurn() {
  if (state.isOver || !state.active) return;
  const player = state.players[state.turn];
  if (!player || !player.isBot) return;
  
  // Simple AI
  let validMoves = [];
  player.hand.forEach((card, index) => {
    if (state.drawStack > 0) {
      if (canStackCard(card)) validMoves.push({ card, index });
    } else {
      if (checkValidPlay(card)) validMoves.push({ card, index });
    }
  });
  
  await sleep(1000);
  
  if (validMoves.length > 0) {
    const move = validMoves[Math.floor(Math.random() * validMoves.length)]; // Random valid move
    await playCard(state.turn, move.index);
  } else {
    // Draw
    if (state.drawStack > 0) {
      const drawn = drawCards(state.drawStack);
      player.hand.push(...drawn);
      showGameMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0; state.stackType = null;
      await advanceTurn();
    } else {
      const card = drawCards(1)[0];
      if (card) {
        player.hand.push(card);
        showGameMessage(player.name + ' drew a card');
        playSound('draw');
        await sleep(500);
        if (checkValidPlay(card)) await playCard(state.turn, player.hand.length - 1);
        else await advanceTurn();
      } else await advanceTurn();
    }
  }
}

// ==================== UI UPDATES ====================
function updateUI() {
  // Discard Pile
  const pile = document.getElementById('discard-pile');
  if (pile) {
    const top = state.discard[state.discard.length - 1];
    if (top) {
      pile.innerHTML = '';
      const el = renderCard(top);
      el.style.transform = `rotate(${state.discardRotation}deg)`;
      pile.appendChild(el);
    }
  }
  
  // Color Indicator
  const indicator = document.getElementById('color-indicator');
  if (indicator) indicator.className = 'color-indicator ' + state.activeColor;
  
  // Deck Count
  const deckCount = document.getElementById('deck-count');
  if (deckCount) deckCount.textContent = state.deck.length;
  
  // UNO Button
  const unoBtn = document.getElementById('uno-btn');
  const p = state.players[multiplayerState.playerIndex];
  if (unoBtn && p) {
    const show = state.turn === multiplayerState.playerIndex && p.hand.length === 2 && state.active;
    unoBtn.classList.toggle('active', show);
  }
}

function updatePlayerZones() {
  state.players.forEach((player, idx) => {
    const zone = document.querySelector('.player-zone.player-' + getPositionClass(idx, state.players.length));
    if (!zone) return;
    
    const nameEl = zone.querySelector('.player-name');
    const countEl = zone.querySelector('.card-count');
    const infoEl = zone.querySelector('.player-info');
    
    if (nameEl) nameEl.textContent = player.name;
    if (countEl) countEl.textContent = player.hand.length + ' cards';
    
    if (infoEl) {
      infoEl.classList.remove('active', 'warning');
      if (state.turn === idx) {
        infoEl.classList.add('active');
        if (state.timer <= 3) infoEl.classList.add('warning');
      }
    }
    
    // Bot Cards
    if (idx !== multiplayerState.playerIndex) {
      const containerClass = (idx === 1 || idx === 3) ? '.bot-cards-vertical' : '.bot-cards-horizontal';
      const cardsContainer = zone.querySelector(containerClass);
      if (cardsContainer) {
        cardsContainer.innerHTML = '';
        const count = Math.min(player.hand.length, 7);
        for (let i = 0; i < count; i++) cardsContainer.appendChild(renderCard(null, true));
      }
    }
  });
}

// ==================== TIMERS ====================
function startTimer() {
  if (!gameSettings.timer) return;
  stopTimer();
  state.timer = TURN_TIME;
  updatePlayerZones();
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    updatePlayerZones();
    if (state.timer <= 3 && state.timer > 0) playSound('tick');
    if (state.timer <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
}

async function handleTimeout() {
  if (state.turn !== multiplayerState.playerIndex) return;
  showGameMessage('Time Out!');
  // Auto draw 1
  const card = drawCards(1)[0];
  if (card) state.players[multiplayerState.playerIndex].hand.push(card);
  renderHand();
  await advanceTurn();
}

function startAfkTimer() {
  multiplayerState.afkTimer = setInterval(() => {
    if (Date.now() - multiplayerState.lastActivity > 30000 && state.turn === multiplayerState.playerIndex) {
      showToast("You are AFK!");
      // Bot takes over? 
    }
  }, 5000);
}

function updateActivity() { multiplayerState.lastActivity = Date.now(); }

// ==================== EFFECTS ====================
function showColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.add('active');
}

function hideColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.remove('active');
}

function createWildExplosion() {
  let container = document.getElementById('wild-explosion');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wild-explosion';
    container.className = 'wild-explosion';
    document.body.appendChild(container);
  }
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'wild-particle';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.setProperty('--tx', (Math.random() * 200 - 100) + 'px');
    p.style.setProperty('--ty', (Math.random() * 200 - 100) + 'px');
    container.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

function createConfetti() {
  let container = document.getElementById('confetti-container');
  if (!container) return; // Should exist in HTML
  container.innerHTML = '';
  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDelay = Math.random() * 1 + 's';
    container.appendChild(c);
  }
}

// ==================== END GAME ====================
async function endMultiplayerGame(winnerIndex) {
  state.isOver = true; state.active = false;
  stopTimer(); clearInterval(multiplayerState.afkTimer);
  
  const isWin = winnerIndex === multiplayerState.playerIndex;
  if (multiplayerState.lobbyRef) await multiplayerState.lobbyRef.update({ status: 'finished' });
  
  if (isWin) { createConfetti(); playSound('win'); }
  else playSound('lose');
  
  const modal = document.getElementById('game-over');
  const icon = document.getElementById('result-icon');
  const text = document.getElementById('winner-text');
  const xp = document.getElementById('xp-value');
  
  if (icon) icon.innerHTML = isWin 
    ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="white"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" fill="white"/></svg>';
  if (icon) icon.className = 'result-icon ' + (isWin ? 'win' : 'lose');
  if (text) text.textContent = isWin ? 'YOU WIN!' : 'YOU LOSE';
  if (xp) xp.textContent = '+' + (isWin ? 250 : 50);
  if (modal) modal.classList.add('active');
}

function rematch() {
  document.getElementById('game-over')?.classList.remove('active');
  if (multiplayerState.isHost) multiplayerState.lobbyRef?.update({ status: 'waiting' });
  showScreen('lobby-room');
  updateLobbyUI();
}

function backToLobby() {
  document.getElementById('game-over')?.classList.remove('active');
  showScreen('lobby-room');
}

function backToMenu() {
  document.getElementById('game-over')?.classList.remove('active');
  cleanupLobby();
  showScreen('menu-screen');
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  runLoadingScreen();
  
  // Draw Pile
  document.getElementById('draw-pile')?.addEventListener('click', handleDrawPile);
  
  // UNO Button
  document.getElementById('uno-btn')?.addEventListener('click', () => {
    if (state.turn === multiplayerState.playerIndex && state.players[multiplayerState.playerIndex]?.hand.length === 2) {
      state.saidUno.add(multiplayerState.playerIndex);
      playSound('uno');
      showGameMessage('UNO!');
    }
  });
  
  // Color Picker
  document.querySelectorAll('.color-box-3d').forEach(box => {
    box.addEventListener('click', () => selectWildColor(box.dataset.color));
  });
  
  // Sort Buttons
  document.getElementById('sort-color')?.addEventListener('click', () => {
    state.sortMode = 'color';
    sortHand();
  });
  document.getElementById('sort-value')?.addEventListener('click', () => {
    state.sortMode = 'value';
    sortHand();
  });
  
  // Drawn Card Popup Buttons
  document.getElementById('keep-btn')?.addEventListener('click', handleKeepCard);
  document.getElementById('play-btn')?.addEventListener('click', handlePlayDrawnCard);
  
  // Chat
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  // Theme Selection
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
});

function sortHand() {
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  
  if (state.sortMode === 'color') {
    player.hand.sort((a, b) => {
      if (a.c === b.c) return a.v.localeCompare(b.v);
      return a.c.localeCompare(b.c);
    });
  } else {
    player.hand.sort((a, b) => a.v.localeCompare(b.v));
  }
  renderHand();
}

// Global function exposure for HTML onclick
window.showMultiplayerOptions = showMultiplayerOptions;
window.closeMultiplayerOptions = closeMultiplayerOptions;
window.startQuickMatch = startQuickMatch;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.toggleSetting = toggleSetting;
window.showLeaderboard = showLeaderboard;
window.closeLeaderboard = closeLeaderboard;
window.showCreateLobby = showCreateLobby;
window.closeCreateLobby = closeCreateLobby;
window.togglePrivate = togglePrivate;
window.createLobby = createLobby;
window.showJoinLobby = showJoinLobby;
window.closeJoinLobby = closeJoinLobby;
window.pasteCode = pasteCode;
window.joinLobbyByCode = joinLobbyByCode;
window.copyRoomCode = copyRoomCode;
window.leaveLobby = leaveLobby;
window.startMultiplayerGame = startMultiplayerGame;
window.toggleReady = toggleReady;
window.changeTeam = changeTeam;
window.kickPlayer = kickPlayer;
window.sendChatMessage = sendChatMessage;
window.rematch = rematch;
window.backToLobby = backToLobby;
window.backToMenu = backToMenu;
window.cancelQuickMatch = cancelQuickMatch;
window.toggleEmotePanel = (idx) => showToast("Emotes coming soon");
window.sendEmote = (key) => showToast("Emotes coming soon");
window.sortHand = sortHand;
window.joinLobbyById = joinLobbyById;
window.refreshPublicLobbies = refreshPublicLobbies;
