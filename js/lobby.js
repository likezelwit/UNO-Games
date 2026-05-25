// ==================== MULTIPLAYER OPTIONS ====================
function showMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.add('active');
}

function closeMultiplayerOptions() {
  const modal = document.getElementById('multiplayer-options-modal');
  if (modal) modal.classList.remove('active');
}

// ==================== CREATE LOBBY ====================
function showCreateLobby() {
  closeMultiplayerOptions();
  const modal = document.getElementById('create-lobby-modal');
  if (modal) {
    modal.classList.add('active');
    const nameInput = document.getElementById('host-name');
    if (nameInput) nameInput.value = multiplayerState.playerName;
    initModalButtons(modal);
  }
}

function initModalButtons(modal) {
  modal.querySelectorAll('.mode-btn').forEach(btn => {
    if (!btn.dataset.init) {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.mode-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      });
      btn.dataset.init = '1';
    }
  });

  modal.querySelectorAll('.count-btn').forEach(btn => {
    if (!btn.dataset.init) {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.count-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      });
      btn.dataset.init = '1';
    }
  });
}

function closeCreateLobby() {
  const modal = document.getElementById('create-lobby-modal');
  if (modal) modal.classList.remove('active');
}

function togglePrivate() {
  const toggle = document.getElementById('private-toggle');
  if (!toggle) return;
  const isActive = toggle.classList.toggle('active');
  toggle.setAttribute('aria-pressed', String(isActive));
}

async function createLobby() {
  const nameInput     = document.getElementById('host-name');
  const activeMode    = document.querySelector('#create-lobby-modal .mode-btn.active');
  const activeCount   = document.querySelector('#create-lobby-modal .count-btn.active');
  const privateToggle = document.getElementById('private-toggle');

  multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
  multiplayerState.gameMode   = activeMode?.dataset.mode  || 'classic';
  multiplayerState.maxPlayers = parseInt(activeCount?.dataset.count) || 4;
  multiplayerState.isPrivate  = privateToggle?.classList.contains('active') || false;
  multiplayerState.isHost     = true;
  multiplayerState.playerId   = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;

  closeCreateLobby();
  showScreen('lobby-room');

  const lobbyRef = database.ref('lobbies/' + roomCode);
  multiplayerState.lobbyRef = lobbyRef;

  const lobbyData = {
    hostId:      multiplayerState.playerId,
    hostName:    multiplayerState.playerName,
    gameMode:    multiplayerState.gameMode,
    maxPlayers:  multiplayerState.maxPlayers,
    isPrivate:   multiplayerState.isPrivate,
    createdAt:   firebase.database.ServerValue.TIMESTAMP,
    status:      'waiting',
    players: {
      [multiplayerState.playerId]: {
        name:        multiplayerState.playerName,
        isHost:      true,
        isReady:     true,
        isBot:       false,
        isConnected: true,
        joinedAt:    firebase.database.ServerValue.TIMESTAMP
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
  } catch (err) {
    console.error('Error creating lobby:', err);
    showToast('Failed to create lobby. Please try again.');
    showScreen('menu-screen');
  }
}

// ==================== JOIN LOBBY ====================
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
    snapshot.forEach(child => {
      const data = child.val();
      if (data.status === 'waiting') {
        const pc = data.playerOrder ? data.playerOrder.length : 0;
        if (pc < data.maxPlayers) {
          lobbies.push({ id: child.key, ...data, playerCount: pc });
        }
      }
    });

    if (!lobbies.length) {
      listEl.innerHTML = '<div class="lobby-empty">No public lobbies available</div>';
      return;
    }

    listEl.innerHTML = lobbies.map(l => `
      <div class="lobby-item" onclick="joinLobbyById('${l.id}')">
        <div class="lobby-item-info">
          <div class="lobby-item-name">${l.id}</div>
          <div class="lobby-item-host">Host: ${l.hostName || '?'}</div>
        </div>
        <div class="lobby-item-players">${l.playerCount}/${l.maxPlayers}</div>
      </div>`).join('');
  } catch (err) {
    console.error('Error fetching lobbies:', err);
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
  multiplayerState.lobbyId  = lobbyId;
  multiplayerState.isHost   = false;

  closeJoinLobby();
  showScreen('lobby-room');

  const lobbyRef = database.ref('lobbies/' + lobbyId);
  multiplayerState.lobbyRef = lobbyRef;

  try {
    const snapshot  = await lobbyRef.once('value');
    const lobbyData = snapshot.val();

    if (!lobbyData) { showToast('Lobby not found!'); showScreen('menu-screen'); return; }
    if (lobbyData.status !== 'waiting') { showToast('Game already in progress!'); showScreen('menu-screen'); return; }

    const currentCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
    if (currentCount >= lobbyData.maxPlayers) { showToast('Lobby is full!'); showScreen('menu-screen'); return; }

    const newOrder = [...(lobbyData.playerOrder || []), multiplayerState.playerId];
    const updates  = {
      ['/players/' + multiplayerState.playerId]: {
        name:        multiplayerState.playerName,
        isHost:      false,
        isReady:     false,
        isBot:       false,
        isConnected: true,
        joinedAt:    firebase.database.ServerValue.TIMESTAMP
      },
      '/playerOrder': newOrder
    };

    await lobbyRef.update(updates);

    multiplayerState.playerIndex = newOrder.indexOf(multiplayerState.playerId);
    multiplayerState.gameMode    = lobbyData.gameMode  || 'classic';
    multiplayerState.maxPlayers  = lobbyData.maxPlayers || 4;

    updateLobbyUI();
    setupLobbyListeners();
    setupPresence();
    playSound('join');
    showToast('Joined lobby: ' + lobbyId);
  } catch (err) {
    console.error('Error joining lobby:', err);
    showToast('Failed to join lobby');
    showScreen('menu-screen');
  }
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById('room-code-input');
    if (input) input.value = text.toUpperCase().trim();
  }).catch(() => showToast('Failed to paste'));
}

// ==================== QUICK MATCH ====================
function startQuickMatch() {
  showScreen('quick-match-screen');
  performQuickMatch();
}

async function performQuickMatch() {
  multiplayerState.playerId     = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  multiplayerState.isQuickMatch = true;

  try {
    const snapshot = await database.ref('lobbies')
      .orderByChild('isPrivate').equalTo(false).once('value');

    let foundLobby = null;
    snapshot.forEach(child => {
      const data = child.val();
      if (data.status === 'waiting') {
        const pc = data.playerOrder ? data.playerOrder.length : 0;
        if (pc < data.maxPlayers && pc > 0) {
          foundLobby = { id: child.key, ...data };
        }
      }
    });

    if (foundLobby) {
      await joinLobbyById(foundLobby.id);
    } else {
      await createQuickMatchLobby();
    }
  } catch (err) {
    console.error('Quick match error:', err);
    showToast('Failed to find match. Please try again.');
    showScreen('menu-screen');
  }
}

function cancelQuickMatch() {
  showScreen('menu-screen');
}

async function createQuickMatchLobby() {
  multiplayerState.isHost     = true;
  multiplayerState.playerName = 'Player_' + Math.random().toString(36).substr(2, 4).toUpperCase();

  const roomCode = generateRoomCode();
  multiplayerState.lobbyId = roomCode;

  showScreen('lobby-room');

  const lobbyRef = database.ref('lobbies/' + roomCode);
  multiplayerState.lobbyRef = lobbyRef;

  const lobbyData = {
    hostId:      multiplayerState.playerId,
    hostName:    multiplayerState.playerName,
    gameMode:    'classic',
    maxPlayers:  4,
    isPrivate:   false,
    isQuickMatch: true,
    createdAt:   firebase.database.ServerValue.TIMESTAMP,
    status:      'waiting',
    players: {
      [multiplayerState.playerId]: {
        name:        multiplayerState.playerName,
        isHost:      true,
        isReady:     true,
        isBot:       false,
        isConnected: true,
        joinedAt:    firebase.database.ServerValue.TIMESTAMP
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
  } catch (err) {
    console.error('Error creating quick match:', err);
    showToast('Failed to create match');
    showScreen('menu-screen');
  }
}

// ==================== LOBBY UI ====================
function updateLobbyUI() {
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = multiplayerState.lobbyId || '';

  const miniEl = document.getElementById('room-code-mini');
  if (miniEl) miniEl.textContent = multiplayerState.lobbyId || '';

  const modeEl = document.getElementById('lobby-mode-display');
  if (modeEl) {
    const m = multiplayerState.gameMode;
    modeEl.textContent = m.charAt(0).toUpperCase() + m.slice(1) + ' Mode';
  }
}

function copyRoomCode() {
  if (!multiplayerState.lobbyId) return;
  navigator.clipboard.writeText(multiplayerState.lobbyId)
    .then(() => { showToast('Room code copied!'); playSound('card'); })
    .catch(() => showToast('Failed to copy'));
}

function renderLobbyPlayers(players, playerOrder) {
  const grid = document.getElementById('lobby-players-grid');
  if (!grid) return;

  const max = multiplayerState.maxPlayers;
  const ordered = playerOrder || Object.keys(players);
  let html = '';

  for (let i = 0; i < max; i++) {
    const pid    = ordered[i];
    const player = pid ? players[pid] : null;

    const avatarSVG = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10
      10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3
      1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0
      5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;

    if (player) {
      const isYou  = pid === multiplayerState.playerId;
      let cls = 'lobby-player-slot filled';
      if (player.isHost) cls += ' host';
      if (isYou)         cls += ' you';

      html += `
        <div class="${cls}" role="listitem">
          <div class="slot-avatar">${avatarSVG}</div>
          <span class="slot-name">${player.name}</span>
          ${player.isHost ? '<div class="slot-host-badge">HOST</div>' : ''}
          <div class="slot-status">${player.isReady ? '✓ Ready' : 'Waiting...'}</div>
        </div>`;
    } else {
      html += `
        <div class="lobby-player-slot" role="listitem">
          <div class="slot-avatar">${avatarSVG}</div>
          <span class="slot-name">Waiting...</span>
        </div>`;
    }
  }

  grid.innerHTML = html;
}

function updateStartButton(players, playerOrder) {
  const startBtn = document.getElementById('start-game-btn');
  if (!startBtn) return;

  const count    = playerOrder ? playerOrder.length : Object.keys(players).length;
  const allReady = Object.values(players).every(p => p.isReady || p.isBot);
  const minPlayers = multiplayerState.gameMode === 'team' ? 4 : 2;
  const canStart = multiplayerState.isHost && count >= minPlayers && allReady;

  startBtn.disabled = !canStart;
}

function updatePlayerCountDisplay(players, playerOrder) {
  const count = playerOrder ? playerOrder.length : Object.keys(players).length;
  const countEl = document.getElementById('lobby-player-count');
  const maxEl   = document.getElementById('lobby-max-players');
  if (countEl) countEl.textContent = count;
  if (maxEl)   maxEl.textContent   = multiplayerState.maxPlayers;
}

// ==================== LOBBY LISTENERS ====================
function setupLobbyListeners() {
  if (!multiplayerState.lobbyRef) return;

  // Players
  multiplayerState.lobbyRef.child('players').on('value', snapshot => {
    const players = snapshot.val();
    if (!players) return;
    multiplayerState.lobbyRef.child('playerOrder').once('value', orderSnap => {
      const order = orderSnap.val() || Object.keys(players);
      renderLobbyPlayers(players, order);
      updateStartButton(players, order);
      updatePlayerCountDisplay(players, order);
    });
  });

  // Status
  multiplayerState.lobbyRef.child('status').on('value', snapshot => {
    if (snapshot.val() === 'playing') startGameFromLobby();
  });

  // Lobby deleted
  multiplayerState.lobbyRef.on('value', snapshot => {
    if (!snapshot.exists()) { showToast('Lobby has been closed'); leaveLobby(); }
  });

  // Chat
  multiplayerState.lobbyRef.child('chat').limitToLast(50).on('child_added', snapshot => {
    const msg = snapshot.val();
    if (msg) displayChatMessage(msg);
  });
}

// ==================== READY & LEAVE ====================
async function toggleReady() {
  if (!multiplayerState.lobbyRef || !multiplayerState.playerId) return;

  const playerRef = multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId);
  const snapshot  = await playerRef.once('value');
  const data      = snapshot.val();
  if (!data) return;

  const newReady = !data.isReady;
  await playerRef.update({ isReady: newReady });
  playSound('card');

  const btn = document.getElementById('ready-btn');
  if (btn) btn.textContent = newReady ? 'Cancel' : 'Ready Up';
}

async function leaveLobby() {
  cleanupLobby();
  showScreen('menu-screen');
}

function cleanupLobby() {
  if (multiplayerState.lobbyRef && multiplayerState.playerId) {
    multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();

    multiplayerState.lobbyRef.child('playerOrder').once('value', snapshot => {
      const order    = snapshot.val() || [];
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

  multiplayerState.lobbyRef            = null;
  multiplayerState.lobbyId             = null;
  multiplayerState.isHost              = false;
  multiplayerState.playerIndex         = 0;
  multiplayerState.playerPresenceRef   = null;
}

// ==================== CHAT ====================
function displayChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'chat-message' + (msg.playerId === multiplayerState.playerId ? ' own' : '');
  el.innerHTML = `
    <span class="chat-message-sender" style="color:${getPlayerColor(msg.playerIndex || 0)}">${msg.sender}:</span>
    <span class="chat-message-text">${msg.text}</span>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !multiplayerState.lobbyRef) return;
  const text = input.value.trim();
  if (!text) return;

  await multiplayerState.lobbyRef.child('chat').push({
    sender:      multiplayerState.playerName,
    playerId:    multiplayerState.playerId,
    playerIndex: multiplayerState.playerIndex,
    text,
    timestamp:   firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

// ==================== START MULTIPLAYER GAME ====================
async function startMultiplayerGame() {
  if (!multiplayerState.isHost || !multiplayerState.lobbyRef) return;

  const snapshot  = await multiplayerState.lobbyRef.once('value');
  const lobbyData = snapshot.val();
  if (!lobbyData || lobbyData.status !== 'waiting') return;

  const playerCount = lobbyData.playerOrder ? lobbyData.playerOrder.length : 0;
  const minPlayers  = lobbyData.gameMode === 'team' ? 4 : 2;

  if (playerCount < minPlayers) {
    showToast('Need at least ' + minPlayers + ' players');
    return;
  }

  // Build deck and hands
  let deck = createDeck();
  let startCard = deck.pop();
  while (startCard.c === 'black' || ['S', 'R', '+2'].includes(startCard.v)) {
    deck.unshift(startCard);
    deck = shuffle(deck);
    startCard = deck.pop();
  }

  const playerHands = {};
  lobbyData.playerOrder.forEach(pid => {
    playerHands[pid] = [];
    for (let i = 0; i < 7; i++) playerHands[pid].push(deck.pop());
  });

  const gameData = {
    deck,
    discard:     [startCard],
    activeColor: startCard.c,
    turn:        0,
    direction:   1,
    drawStack:   0,
    stackType:   null,
    playerOrder: lobbyData.playerOrder,
    playerHands,
    playerData:  lobbyData.players,
    status:      'playing',
    startedAt:   firebase.database.ServerValue.TIMESTAMP,
    gameMode:    lobbyData.gameMode,
    lastAction:  null
  };

  await multiplayerState.lobbyRef.update({ status: 'playing' });
  await multiplayerState.lobbyRef.child('game').set(gameData);
  playSound('start');
}

function startGameFromLobby() {
  if (!multiplayerState.lobbyRef) return;
  showScreen('game-app');
  initAudio();

  multiplayerState.gameRef = multiplayerState.lobbyRef.child('game');
  setupGameListeners();
  startAfkTimer();

  document.addEventListener('click',      updateActivity, { passive: true });
  document.addEventListener('keydown',    updateActivity, { passive: true });
  document.addEventListener('touchstart', updateActivity, { passive: true });
}
