// ==================== LOBBY MANAGEMENT ====================
let currentLobby = null;
let currentPlayer = null;
let lobbyRef = null;
let lobbyListeners = [];

function createLobby() {
  const nameInput = document.getElementById('host-name');
  const name = nameInput ? nameInput.value.trim() : 'Host';

  if (!name) {
    showToast('Please enter your name');
    return;
  }

  const maxPlayers = parseInt(document.querySelector('.count-btn.active')?.dataset.count || '4');
  const mode = document.querySelector('.mode-btn.active')?.dataset.mode || 'classic';
  const isPrivate = document.getElementById('private-toggle')?.classList.contains('active') || false;

  const roomCode = generateRoomCode();

  currentPlayer = {
    id: generateId(),
    name: name,
    isHost: true,
    isReady: false,
    joinedAt: Date.now()
  };

  currentLobby = {
    code: roomCode,
    hostId: currentPlayer.id,
    maxPlayers: maxPlayers,
    mode: mode,
    isPrivate: isPrivate,
    players: [currentPlayer],
    status: 'waiting',
    createdAt: Date.now(),
    chat: []
  };

  // Save to local storage for persistence
  saveToStorage('currentLobby', currentLobby);
  saveToStorage('currentPlayer', currentPlayer);

  // Try to sync with Firebase
  if (isFirebaseReady()) {
    const db = getDb();
    lobbyRef = db.ref('lobbies/' + roomCode);
    lobbyRef.set(currentLobby);
    setupLobbyListeners();
  }

  showLobbyRoom();
  showToast('Lobby created!');
}

function joinLobbyByCode() {
  const codeInput = document.getElementById('room-code-input');
  const nameInput = document.getElementById('join-name');

  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
  const name = nameInput ? nameInput.value.trim() : 'Player';

  if (!code) {
    showToast('Please enter a room code');
    return;
  }

  if (!name) {
    showToast('Please enter your name');
    return;
  }

  // Check local storage first
  const storedLobby = loadFromStorage('lobby_' + code);

  if (storedLobby) {
    joinLobby(storedLobby, name);
  } else if (isFirebaseReady()) {
    const db = getDb();
    db.ref('lobbies/' + code).once('value', snapshot => {
      const lobby = snapshot.val();
      if (lobby) {
        joinLobby(lobby, name);
      } else {
        showToast('Room not found');
      }
    });
  } else {
    showToast('Offline mode - creating local lobby');
    // Create a local lobby for testing
    currentPlayer = {
      id: generateId(),
      name: name,
      isHost: false,
      isReady: false,
      joinedAt: Date.now()
    };

    currentLobby = {
      code: code,
      hostId: 'host_' + generateId(),
      maxPlayers: 4,
      mode: 'classic',
      isPrivate: false,
      players: [
        {
          id: currentLobby.hostId,
          name: 'Host',
          isHost: true,
          isReady: true,
          joinedAt: Date.now()
        },
        currentPlayer
      ],
      status: 'waiting',
      createdAt: Date.now(),
      chat: []
    };

    showLobbyRoom();
  }
}

function joinLobby(lobby, playerName) {
  if (lobby.players.length >= lobby.maxPlayers) {
    showToast('Lobby is full');
    return;
  }

  if (lobby.status !== 'waiting') {
    showToast('Game already started');
    return;
  }

  currentPlayer = {
    id: generateId(),
    name: playerName,
    isHost: false,
    isReady: false,
    joinedAt: Date.now()
  };

  currentLobby = lobby;
  currentLobby.players.push(currentPlayer);

  saveToStorage('currentLobby', currentLobby);
  saveToStorage('currentPlayer', currentPlayer);

  if (isFirebaseReady() && lobbyRef) {
    lobbyRef.child('players').set(currentLobby.players);
  }

  showLobbyRoom();
  showToast('Joined lobby!');
}

function leaveLobby() {
  if (!currentLobby || !currentPlayer) {
    backToMenu();
    return;
  }

  currentLobby.players = currentLobby.players.filter(p => p.id !== currentPlayer.id);

  if (currentLobby.players.length === 0) {
    // Delete empty lobby
    if (isFirebaseReady() && lobbyRef) {
      lobbyRef.remove();
    }
  } else if (currentPlayer.isHost && currentLobby.players.length > 0) {
    // Transfer host
    currentLobby.players[0].isHost = true;
    currentLobby.hostId = currentLobby.players[0].id;
    if (isFirebaseReady() && lobbyRef) {
      lobbyRef.update({
        hostId: currentLobby.hostId,
        players: currentLobby.players
      });
    }
  }

  // Cleanup listeners
  lobbyListeners.forEach(unsub => unsub && unsub());
  lobbyListeners = [];

  currentLobby = null;
  currentPlayer = null;
  lobbyRef = null;

  localStorage.removeItem('uno_currentLobby');
  localStorage.removeItem('uno_currentPlayer');

  backToMenu();
}

function toggleReady() {
  if (!currentPlayer || !currentLobby) return;

  currentPlayer.isReady = !currentPlayer.isReady;

  const player = currentLobby.players.find(p => p.id === currentPlayer.id);
  if (player) player.isReady = currentPlayer.isReady;

  if (isFirebaseReady() && lobbyRef) {
    lobbyRef.child('players').set(currentLobby.players);
  }

  updateLobbyUI();

  const btn = document.getElementById('ready-btn');
  if (btn) {
    btn.textContent = currentPlayer.isReady ? 'Not Ready' : 'Ready Up';
    btn.classList.toggle('active', currentPlayer.isReady);
  }
}

function startMultiplayerGame() {
  if (!currentLobby || !currentPlayer.isHost) return;

  const readyPlayers = currentLobby.players.filter(p => p.isReady || p.isHost);
  if (readyPlayers.length < 2) {
    showToast('Need at least 2 ready players');
    return;
  }

  currentLobby.status = 'playing';

  if (isFirebaseReady() && lobbyRef) {
    lobbyRef.child('status').set('playing');
  }

  // Initialize game
  const gamePlayers = currentLobby.players.map(p => ({
    id: p.id,
    name: p.name,
    isBot: false,
    hand: [],
    saidUno: false,
    score: 0
  }));

  initGame(gamePlayers, currentLobby.mode, { sound: true, timer: true, stacking: true });
  showScreen('game-app');
  renderGame();

  // Start turn timer
  startTurnTimer();
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !currentLobby || !currentPlayer) return;

  const text = input.value.trim();
  if (!text) return;

  const message = {
    sender: currentPlayer.name,
    text: text,
    timestamp: Date.now()
  };

  currentLobby.chat.push(message);
  if (currentLobby.chat.length > 50) currentLobby.chat.shift();

  if (isFirebaseReady() && lobbyRef) {
    lobbyRef.child('chat').push(message);
  }

  input.value = '';
  updateChatUI();
}

// ==================== LOBBY UI UPDATES ====================
function updateLobbyUI() {
  if (!currentLobby) return;

  // Update room code
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = currentLobby.code;

  // Update mode
  const modeEl = document.getElementById('lobby-mode-display');
  if (modeEl) modeEl.textContent = currentLobby.mode.charAt(0).toUpperCase() + currentLobby.mode.slice(1) + ' Mode';

  // Update player count
  const countEl = document.getElementById('lobby-player-count');
  const maxEl = document.getElementById('lobby-max-players');
  if (countEl) countEl.textContent = currentLobby.players.length;
  if (maxEl) maxEl.textContent = currentLobby.maxPlayers;

  // Update players grid
  const grid = document.getElementById('lobby-players-grid');
  if (grid) {
    grid.innerHTML = '';

    for (let i = 0; i < currentLobby.maxPlayers; i++) {
      const player = currentLobby.players[i];
      const slot = document.createElement('div');
      slot.className = 'lobby-player-slot';

      if (player) {
        slot.classList.add('filled');
        if (player.isHost) slot.classList.add('host');
        if (player.id === currentPlayer?.id) slot.classList.add('you');

        slot.innerHTML = `
          <div class="slot-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">${player.name}</span>
          <span class="slot-status">${player.isReady ? '✅ Ready' : '⏳ Waiting'}</span>
          ${player.isHost ? '<span class="slot-host-badge">HOST</span>' : ''}
        `;
      } else {
        slot.innerHTML = `
          <div class="slot-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <span class="slot-name">Empty</span>
        `;
      }

      grid.appendChild(slot);
    }
  }

  // Update start button
  const startBtn = document.getElementById('start-game-btn');
  if (startBtn && currentPlayer) {
    const canStart = currentPlayer.isHost && 
      currentLobby.players.filter(p => p.isReady || p.isHost).length >= 2;
    startBtn.disabled = !canStart;
  }

  // Update ready button
  const readyBtn = document.getElementById('ready-btn');
  if (readyBtn && currentPlayer) {
    readyBtn.textContent = currentPlayer.isReady ? 'Not Ready' : 'Ready Up';
  }
}

function updateChatUI() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages || !currentLobby) return;

  chatMessages.innerHTML = '';

  currentLobby.chat.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `
      <span class="chat-message-sender">${msg.sender}:</span>
      <span class="chat-message-text">${msg.text}</span>
    `;
    chatMessages.appendChild(div);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==================== LOBBY LISTENERS ====================
function setupLobbyListeners() {
  if (!isFirebaseReady() || !lobbyRef) return;

  // Listen for player changes
  const playersListener = lobbyRef.child('players').on('value', snapshot => {
    const players = snapshot.val();
    if (players) {
      currentLobby.players = players;
      updateLobbyUI();
    }
  });

  // Listen for status changes
  const statusListener = lobbyRef.child('status').on('value', snapshot => {
    const status = snapshot.val();
    if (status === 'playing' && currentLobby.status !== 'playing') {
      currentLobby.status = 'playing';
      // Start game for non-host players
      if (!currentPlayer.isHost) {
        showScreen('game-app');
      }
    }
  });

  // Listen for chat
  const chatListener = lobbyRef.child('chat').on('child_added', snapshot => {
    const msg = snapshot.val();
    if (msg && !currentLobby.chat.find(m => m.timestamp === msg.timestamp && m.sender === msg.sender)) {
      currentLobby.chat.push(msg);
      if (currentLobby.chat.length > 50) currentLobby.chat.shift();
      updateChatUI();
    }
  });

  lobbyListeners = [playersListener, statusListener, chatListener];
}

// ==================== PUBLIC LOBBIES ====================
function loadPublicLobbies() {
  const list = document.getElementById('public-lobby-list');
  if (!list) return;

  list.innerHTML = '<div class="lobby-empty">Searching for lobbies...</div>';

  if (isFirebaseReady()) {
    const db = getDb();
    db.ref('lobbies').orderByChild('isPrivate').equalTo(false).once('value', snapshot => {
      const lobbies = [];
      snapshot.forEach(child => {
        const lobby = child.val();
        if (lobby.status === 'waiting' && lobby.players.length < lobby.maxPlayers) {
          lobbies.push(lobby);
        }
      });

      renderLobbyList(lobbies);
    });
  } else {
    list.innerHTML = '<div class="lobby-empty">No lobbies available (offline mode)</div>';
  }
}

function renderLobbyList(lobbies) {
  const list = document.getElementById('public-lobby-list');
  if (!list) return;

  if (lobbies.length === 0) {
    list.innerHTML = '<div class="lobby-empty">No lobbies available</div>';
    return;
  }

  list.innerHTML = '';
  lobbies.forEach(lobby => {
    const item = document.createElement('div');
    item.className = 'lobby-item';
    item.onclick = () => {
      const nameInput = document.getElementById('join-name');
      const name = nameInput ? nameInput.value.trim() : 'Player';
      if (name) joinLobby(lobby, name);
    };

    item.innerHTML = `
      <div class="lobby-item-info">
        <span class="lobby-item-name">${lobby.code}</span>
        <span class="lobby-item-host">Host: ${lobby.players[0]?.name || 'Unknown'}</span>
      </div>
      <span class="lobby-item-players">${lobby.players.length}/${lobby.maxPlayers}</span>
    `;

    list.appendChild(item);
  });
}

// ==================== UTILITY FUNCTIONS ====================
function showLobbyRoom() {
  showScreen('lobby-room');
  updateLobbyUI();
  updateChatUI();
}

function copyRoomCode() {
  if (!currentLobby) return;

  navigator.clipboard.writeText(currentLobby.code).then(() => {
    showToast('Room code copied!');
  }).catch(() => {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = currentLobby.code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Room code copied!');
  });
}

function pasteCode() {
  navigator.clipboard.readText().then(text => {
    const input = document.getElementById('room-code-input');
    if (input) input.value = text.toUpperCase();
  }).catch(() => {
    showToast('Unable to paste');
  });
}

function togglePrivate() {
  const toggle = document.getElementById('private-toggle');
  if (toggle) toggle.classList.toggle('active');
}

// ==================== QUICK MATCH ====================
let quickMatchInterval = null;

function startQuickMatch() {
  showScreen('quick-match-screen');

  // Simulate finding players
  const slots = document.querySelectorAll('.player-found-slot');
  let found = 1;

  quickMatchInterval = setInterval(() => {
    if (found < 4) {
      slots[found].classList.add('filled');
      slots[found].querySelector('.slot-name').textContent = 'Bot ' + found;
      found++;
    } else {
      clearInterval(quickMatchInterval);
      // Start game with bots
      setTimeout(() => {
        const playerName = loadFromStorage('playerName', 'You');
        const players = [
          { id: 'player', name: playerName, isBot: false, hand: [], saidUno: false, score: 0 },
          ...createBots(3, 'medium')
        ];
        initGame(players, 'classic', { sound: true, timer: true, stacking: true });
        showScreen('game-app');
        renderGame();
      }, 1000);
    }
  }, 1500);
}

function cancelQuickMatch() {
  if (quickMatchInterval) {
    clearInterval(quickMatchInterval);
    quickMatchInterval = null;
  }
  backToMenu();
}