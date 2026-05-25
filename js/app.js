// ==================== SETTINGS ====================
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
  if (toggle) {
    toggle.classList.toggle('active', gameSettings[setting]);
    toggle.setAttribute('aria-pressed', String(gameSettings[setting]));
  }
}

// ==================== LEADERBOARD ====================
function showLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.classList.add('active');

  const list = document.getElementById('leaderboard-list');
  if (list) {
    list.innerHTML = `
      <div class="leaderboard-item current-player" role="listitem">
        <div class="leaderboard-rank gold">1</div>
        <div class="leaderboard-name">You</div>
        <div class="leaderboard-score">2,450</div>
      </div>
      <div class="leaderboard-item" role="listitem">
        <div class="leaderboard-rank silver">2</div>
        <div class="leaderboard-name">Bot Alex</div>
        <div class="leaderboard-score">2,100</div>
      </div>
      <div class="leaderboard-item" role="listitem">
        <div class="leaderboard-rank bronze">3</div>
        <div class="leaderboard-name">Bot Blake</div>
        <div class="leaderboard-score">1,870</div>
      </div>`;
  }
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('active');
}

// ==================== REMATCH / NAVIGATION ====================
async function rematch() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');

  if (multiplayerState.isHost && multiplayerState.lobbyRef) {
    await multiplayerState.lobbyRef.update({ status: 'waiting', game: null }).catch(() => {});
  }

  showScreen('lobby-room');
  updateLobbyUI();
}

function backToMenu() {
  const modal = document.getElementById('game-over');
  if (modal) modal.classList.remove('active');
  cleanupLobby();
  showScreen('menu-screen');
}

// ==================== THEME CARD SELECTION ====================
function initThemeCards() {
  const cards = document.querySelectorAll('.theme-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      multiplayerState.gameMode = card.dataset.mode || 'classic';
    });
  });
}

// ==================== DOM READY ====================
document.addEventListener('DOMContentLoaded', () => {

  // Particles & loading
  createParticles();
  runLoadingScreen();

  // Theme card selection
  initThemeCards();

  // Draw pile click
  document.getElementById('draw-pile')?.addEventListener('click', handleDrawPile);

  // UNO button
  document.getElementById('uno-btn')?.addEventListener('click', handleUnoButton);

  // Color picker boxes
  document.querySelectorAll('.color-box-3d').forEach(box => {
    box.addEventListener('click',  () => selectWildColor(box.dataset.color));
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selectWildColor(box.dataset.color);
    });
  });

  // Drawn card popup buttons
  document.getElementById('keep-btn')?.addEventListener('click', handleKeepCard);
  document.getElementById('play-btn')?.addEventListener('click', handlePlayDrawnCard);

  // Drag-and-drop onto discard pile
  const discardPile = document.getElementById('discard-pile');
  if (discardPile) {
    discardPile.addEventListener('dragover', e => {
      e.preventDefault();
      if (state.dragCard !== null) discardPile.classList.add('drop-target');
    });

    discardPile.addEventListener('dragleave', () => {
      discardPile.classList.remove('drop-target');
    });

    discardPile.addEventListener('drop', async e => {
      e.preventDefault();
      discardPile.classList.remove('drop-target');

      if (state.dragCard !== null && state.turn === multiplayerState.playerIndex && state.active) {
        const player = state.players[multiplayerState.playerIndex];
        const card   = player?.hand[state.dragCard];
        if (card && checkValidPlay(card)) {
          await playCard(multiplayerState.playerIndex, state.dragCard);
        }
      }
      state.dragCard = null;
    });
  }

  // Keyboard shortcuts (only active during game)
  document.addEventListener('keydown', e => {
    if (state.isOver || !state.active) return;

    switch (e.key.toLowerCase()) {
      case 'u': handleUnoButton(); break;
      case 'd': handleDrawPile();  break;
      case 'escape':
        hideColorPicker3D();
        hideDrawnCardPopup();
        break;
    }

    // Number keys 1-6 → emotes
    if (e.key >= '1' && e.key <= '6') {
      const keys = ['angry', 'laugh', 'cry', 'fire', 'cool', 'think'];
      sendEmote(keys[parseInt(e.key) - 1]);
    }
  });

  // Chat: send on Enter
  document.getElementById('chat-input')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Leaderboard tab switching
  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      // Optionally load different data here
    });
  });
});

// ==================== VISIBILITY & UNLOAD ====================
document.addEventListener('visibilitychange', () => {
  if (document.hidden && multiplayerState.playerPresenceRef) {
    multiplayerState.playerPresenceRef.update({
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
  }
});

window.addEventListener('beforeunload', () => {
  cleanupLobby();
});
