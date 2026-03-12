// ==================== LOADING SCREEN & CONNECTION ====================
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
  let statusEl = document.getElementById('connection-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'connection-status';
    statusEl.className = 'connection-status';
    document.body.appendChild(statusEl);
  }
  
  if (connected) {
    statusEl.className = 'connection-status connected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Connected</span>';
  } else {
    statusEl.className = 'connection-status disconnected';
    statusEl.innerHTML = '<div class="connection-dot"></div><span>Disconnected</span>';
  }
}

// ==================== MENU & MODAL FUNCTIONS ====================
function showMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.add('active');
}

function closeMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.remove('active');
}

function showCreateLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('create-lobby-modal');
  if (modal) {
    modal.classList.add('active');
    const nameInput = document.getElementById('host-name');
    if (nameInput) nameInput.value = multiplayerState.playerName;
    setupModalButtons(modal);
  }
}

function setupModalButtons(modal) {
    modal.querySelectorAll('.mode-btn').forEach(btn => {
      if (!btn.dataset.initialized) {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        btn.dataset.initialized = "true";
      }
    });
    
    modal.querySelectorAll('.count-btn').forEach(btn => {
      if (!btn.dataset.initialized) {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
        btn.dataset.initialized = "true";
      }
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

// ==================== CREATE & JOIN LOBBY ====================
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
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;
  
  closeCreateLobby();
  showScreen('lobby-room');
  
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
    showToast('Failed to create lobby. Please try again.');
    showScreen('menu-screen');
  }
}

function showJoinLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('join-lobby-modal');
  if (modal) {
    modal.classList.add('active');
    const nameInput = document.getElementById('join-name');
    if (nameInput) nameInput.value = multiplayerState.playerName;
    refreshPublicLobbies();
  }
}

function closeJoinLobby() {
  const modal = document.getElementById('join-lobby-modal');
  if (modal) modal.classList.remove('active');
}

async function refreshPublicLobbies() {
  const listEl = document.getElementById('public-lobby-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="lobby-empty">Searching...</div>';
  
  try {
    const snapshot = await database.ref('lobbies')
      .orderByChild('isPrivate')
      .equalTo(false)
      .once('value');
    
    const lobbies = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers) {
          lobbies.push({
            id: child.key,
            ...data,
            playerCount: playerCount
          });
        }
      }
    });
    
    if (lobbies.length === 0) {
      listEl.innerHTML = '<div class="lobby-empty">No public lobbies available</div>';
      return;
    }
    
    listEl.innerHTML = lobbies.map(lobby => `
      <div class="lobby-item" onclick="joinLobbyById('${lobby.id}')">
        <div class="lobby-item-info">
          <div class="lobby-item-name">${lobby.id}</div>
          <div class="lobby-item-host">${lobby.hostName}</div>
        </div>
        <div class="lobby-item-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    listEl.innerHTML = '<div class="lobby-empty">Failed to load lobbies</div>';
  }
}

async function joinLobbyByCode() {
  const nameInput = document.getElementById('join-name');
  const codeInput = document.getElementById('room-code-input');
  
  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  const roomCode = codeInput?.value?.toUpperCase().trim();
  
  if (!roomCode || roomCode.length < 8) {
    showToast('Please enter a valid room code');
    return;
  }
  
  await joinLobbyById(roomCode);
}

async function joinLobbyById(lobbyId) {
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.lobbyId = lobbyId;
  multiplayerState.isHost = false;
  
  closeJoinLobby();
  showScreen('lobby-room');
  
  const lobbyRef = database.ref('lobbies/' + lobbyId);
  multiplayerState.lobbyRef = lobbyRef;
  
  try {
    const snapshot = await lobbyRef.once('value');
    const lobbyData = snapshot.val();
    
    if (!lobbyData) {
      showToast('Lobby not found!');
      showScreen('menu-screen');
      return;
    }
    
    if (lobbyData.status !== 'waiting') {
      showToast('Game already in progress!');
      showScreen('menu-screen');
      return;
    }
    
    const currentCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
    if (currentCount >= lobbyData.maxPlayers) {
      showToast('Lobby is full!');
      showScreen('menu-screen');
      return;
    }
    
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
    console.error('Error joining lobby:', error);
    showToast('Failed to join lobby');
    showScreen('menu-screen');
  }
}

// ==================== QUICK MATCH ====================
function startQuickMatch() {
  showScreen('quick-match-screen');
  performQuickMatch();
}

async function performQuickMatch() {
  multiplayerState.playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.isQuickMatch = true;
  
  try {
    const snapshot = await database.ref('lobbies')
      .orderByChild('isPrivate')
      .equalTo(false)
      .once('value');
    
    let foundLobby = null;
    
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.status === 'waiting') {
        const playerCount = data.playerOrder ? data.playerOrder.length : 0;
        if (playerCount < data.maxPlayers && playerCount > 0) {
          foundLobby = { id: child.key, ...data };
        }
      }
    });
    
    if (foundLobby) {
      await joinLobbyById(foundLobby.id);
    } else {
      await createQuickMatchLobby();
    }
    
  } catch (error) {
    console.error('Quick match error:', error);
    showToast('Failed to find match. Please try again.');
    showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

async function createQuickMatchLobby() {
  multiplayerState.isHost = true;
  multiplayerState.playerName = 'Player_' + Math.random().toString(36).substr(2, 4);
  
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
        name: multiplayerState.playerName,
        isHost: true,
        isReady: true,
        isBot: false,
        isConnected: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP
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
  } catch (error) {
    console.error('Error creating quick match:', error);
    showToast('Failed to create match');
    showScreen('menu-screen');
  }
}

// ==================== LOBBY UI & LISTENERS ====================
function updateLobbyUI() {
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId;
  
  const codeEl2 = document.getElementById('room-code-mini');
  if (codeEl2) codeEl2.textContent = multiplayerState.lobbyId;

  const modeEl = document.getElementById('lobby-mode-display');
  if (modeEl) modeEl.textContent = multiplayerState.gameMode.charAt(0).toUpperCase() + multiplayerState.gameMode.slice(1) + " Mode";
}

function copyRoomCode() {
  navigator.clipboard.writeText(multiplayerState.lobbyId).then(() => {
    showToast('Room code copied!');
    playSound('card');
  }).catch(() => {
    showToast('Failed to copy');
  });
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById('room-code-input');
    if (input) input.value = text;
  }).catch(err => {
    showToast('Failed to paste');
  });
}

function changeTeam() {
  showToast("Team changing not implemented in this mode.");
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
      let slotClass = "lobby-player-slot filled";
      if (player.isHost) slotClass += " host";
      if (isYou) slotClass += " you";
      
      html += `
        <div class="${slotClass}">
          <div class="slot-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">${player.name}</span>
          ${player.isHost ? '<div class="slot-host-badge">HOST</div>' : ''}
          <div class="slot-status">${player.isReady ? 'Ready' : 'Waiting...'}</div>
        </div>
      `;
    } else {
      html += `
        <div class="lobby-player-slot">
          <div class="slot-avatar">
             <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">Waiting...</span>
        </div>
      `;
    }
  }
  
  grid.innerHTML = html;
}

function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;
  
  multiplayerState.lobbyRef.child('players').on('value', (snapshot) => {
    const players = snapshot.val();
    if (!players) return;
    
    multiplayerState.lobbyRef.child('playerOrder').once('value', (orderSnap) => {
      const playerOrder = orderSnap.val() || Object.keys(players);
      renderLobbyPlayers(players, playerOrder);
      updateStartButton(players, playerOrder);
      updatePlayerCountDisplay(players, playerOrder);
    });
  });
  
  multiplayerState.lobbyRef.child('playerOrder').on('value', (snapshot) => {
    const playerOrder = snapshot.val();
    multiplayerState.lobbyRef.child('players').once('value', (playersSnap) => {
      const players = playersSnap.val();
      if (players) {
        renderLobbyPlayers(players, playerOrder);
        updateStartButton(players, playerOrder);
      }
    });
  });
  
  multiplayerState.lobbyRef.child('status').on('value', (snapshot) => {
    const status = snapshot.val();
    if (status === 'playing') {
      startGameFromLobby();
    }
  });
  
  multiplayerState.lobbyRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
      showToast('Lobby has been closed');
      leaveLobby();
    }
  });
  
  multiplayerState.lobbyRef.child('chat').limitToLast(50).on('child_added', (snapshot) => {
    const msg = snapshot.val();
    if (msg) displayChatMessage(msg);
  });
}

function updateStartButton(players, playerOrder) {
  const startBtn = document.getElementById('start-game-btn');
  if (!startBtn) return;
  
  const playerCount = playerOrder ? playerOrder.length : Object.keys(players).length;
  const allReady = Object.values(players).every(p => p.isReady || p.isBot);
  const minPlayers = multiplayerState.gameMode === 'team' ? 4 : 2;
  
  const canStart = multiplayerState.isHost && playerCount >= minPlayers && allReady;
  startBtn.disabled = !canStart;
}

function updatePlayerCountDisplay(players, playerOrder) {
  const countEl = document.getElementById('lobby-player-count');
  const maxEl = document.getElementById('lobby-max-players');
  const count = playerOrder ? playerOrder.length : Object.keys(players).length;
  
  if (countEl) countEl.textContent = count;
  if (maxEl) maxEl.textContent = multiplayerState.maxPlayers;
}

async function toggleReady() {
  if (!multiplayerState.lobbyRef || !multiplayerState.playerId) return;
  
  const playerRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId);
  const snapshot = await playerRef.once('value');
  const playerData = snapshot.val();
  
  if (playerData) {
    await playerRef.update({ isReady: !playerData.isReady });
    playSound('card');
    
    const btn = document.getElementById('ready-btn');
    if(btn) btn.textContent = !playerData.isReady ? "Cancel" : "Ready Up";
  }
}

async function leaveLobby() {
  cleanupLobby();
  showScreen('menu-screen');
}

function cleanupLobby() {
  if (multiplayerState.lobbyRef && multiplayerState.playerId) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
    
    multiplayerState.lobbyRef.child('playerOrder').once('value', (snapshot) => {
      const order = snapshot.val() || [];
      const newOrder = order.filter(id => id !== multiplayerState.playerId);
      
      if (newOrder.length === 0) {
        multiplayerState.lobbyRef.remove();
      } else {
        multiplayerState.lobbyRef.child('playerOrder').set(newOrder);
        if (multiplayerState.isHost) {
          const newHostId = newOrder[0];
          multiplayerState.lobbyRef.child('hostId').set(newHostId);
          multiplayerState.lobbyRef.child('players/' + newHostId + '/isHost').set(true);
        }
      }
    });
    multiplayerState.lobbyRef.off();
  }
  
  if (multiplayerState.playerPresenceRef) {
    multiplayerState.playerPresenceRef.remove();
    multiplayerState.playerPresenceRef.off();
  }
  
  multiplayerState.lobbyRef = null;
  multiplayerState.lobbyId = null;
  multiplayerState.isHost = false;
  multiplayerState.playerIndex = 0;
}

// ==================== CHAT SYSTEM ====================
function displayChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  if (msg.playerId === multiplayerState.playerId) msgEl.classList.add('own');
  
  msgEl.innerHTML = `
    <span class="chat-message-sender" style="color: ${getPlayerColor(msg.playerIndex || 0)}">${msg.sender}:</span>
    <span class="chat-message-text">${msg.text}</span>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !multiplayerState.lobbyRef) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  const msgData = {
    sender: multiplayerState.playerName,
    playerId: multiplayerState.playerId,
    playerIndex: multiplayerState.playerIndex,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  await multiplayerState.lobbyRef.child('chat').push(msgData);
  input.value = '';
}

// ==================== PRESENCE SYSTEM ====================
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
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').set(true);
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId + '/isConnected').onDisconnect().set(false);
  }
  
  const lobbyPresenceRef = database.ref('presence/' + multiplayerState.lobbyId);
  lobbyPresenceRef.on('value', (snapshot) => {
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
  if (!player) return;
  
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

// ==================== AFK DETECTION ====================
function startAfkTimer() {
  stopAfkTimer();
  
  multiplayerState.afkTimer = setInterval(() => {
    const timeSinceActivity = Date.now() - multiplayerState.lastActivity;
    
    if (timeSinceActivity > AFK_TIMEOUT && state.turn === multiplayerState.playerIndex) {
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

// ==================== START MULTIPLAYER GAME ====================
async function startMultiplayerGame() {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;
  
  const snapshot = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  
  if (!lobbyData || lobbyData.status !== 'waiting') return;
  
  const playerCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
  const minPlayers = multiplayerState.gameMode === 'team' ? 4 : 2;
  
  if (playerCount < minPlayers) {
    showToast('Need at least ' + minPlayers + ' players');
    return;
  }
  
  const deck = createDeck();
  let startCard = deck.pop();
  
  while (startCard.c === 'black' || ['S', 'R', '+2'].includes(startCard.v)) {
    deck.unshift(startCard);
    shuffle(deck);
    startCard = deck.pop();
  }

  const playerHands = {};
  lobbyData.playerOrder.forEach(playerId => {
    playerHands[playerId] = [];
    for (let i = 0; i < 7; i++) {
      playerHands[playerId].push(deck.pop());
    }
  });
  
  const gameData = {
    deck: deck,
    discard: [startCard],
    activeColor: startCard.c,
    turn: 0,
    direction: 1,
    drawStack: 0,
    stackType: null,
    playerOrder: lobbyData.playerOrder,
    playerHands: playerHands,
    playerData: lobbyData.players,
    status: 'playing',
    startedAt: firebase.database.ServerValue.TIMESTAMP,
    gameMode: lobbyData.gameMode,
    lastAction: null
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
  document.addEventListener('keydown', updateActivity);
  document.addEventListener('touchstart', updateActivity);
}
