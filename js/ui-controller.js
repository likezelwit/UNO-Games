const GameUI = {
  // --- Modal & Navigation ---
  showMultiplayerOptions: () => document.getElementById('multiplayer-options-modal').classList.add('active'),
  closeMultiplayerOptions: () => document.getElementById('multiplayer-options-modal').classList.remove('active'),
  showCreateLobby: () => {
    GameUI.closeMultiplayerOptions();
    document.getElementById('create-lobby-modal').classList.add('active');
  },
  closeCreateLobby: () => document.getElementById('create-lobby-modal').classList.remove('active'),
  showJoinLobby: () => {
    GameUI.closeMultiplayerOptions();
    document.getElementById('join-lobby-modal').classList.add('active');
  },
  closeJoinLobby: () => document.getElementById('join-lobby-modal').classList.remove('active'),
  showSettings: () => document.getElementById('settings-modal').classList.add('active'),
  closeSettings: () => document.getElementById('settings-modal').classList.remove('active'),
  showLeaderboard: () => showToast('Leaderboard coming soon!'),

  // --- Form Helpers ---
  selectMode: (btn) => {
    btn.parentElement.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },
  selectCount: (btn) => {
    btn.parentElement.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },
  toggleSetting: (setting) => {
    gameSettings[setting] = !gameSettings[setting];
    document.getElementById('toggle-' + setting).classList.toggle('active');
  },
  pasteCode: async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.getElementById('room-code-input').value = text;
    } catch (e) { showToast('Failed to paste'); }
  },
  copyRoomCode: async () => {
    try {
      await navigator.clipboard.writeText(multiplayerState.lobbyId);
      showToast('Code copied!');
    } catch (e) { showToast('Failed to copy'); }
  },

  // --- Lobby UI ---
  updateLobbyUI: () => {
    document.getElementById('display-room-code').textContent = multiplayerState.lobbyId;
    document.getElementById('room-code-mini').textContent = multiplayerState.lobbyId;
    document.getElementById('lobby-mode-display').textContent = multiplayerState.gameMode.charAt(0).toUpperCase() + multiplayerState.gameMode.slice(1) + " Mode";
  },
  renderLobbyPlayers: (players, order) => {
    const grid = document.getElementById('lobby-players-grid');
    if(!grid) return;
    let html = '';
    for(let i=0; i<multiplayerState.maxPlayers; i++) {
      const pid = order[i];
      const p = pid ? players[pid] : null;
      if(p) {
        html += `<div class="lobby-player-slot filled ${pid === multiplayerState.playerId ? 'you' : ''} ${p.isHost ? 'host' : ''}">
          <div class="slot-avatar"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div>
          <span class="slot-name">${p.name}</span>
        </div>`;
      } else {
        html += `<div class="lobby-player-slot"><div class="slot-avatar"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div><span class="slot-name">Waiting...</span></div>`;
      }
    }
    grid.innerHTML = html;
    document.getElementById('lobby-player-count').textContent = order ? order.length : Object.keys(players).length;
    document.getElementById('lobby-max-players').textContent = multiplayerState.maxPlayers;
  },
  updateStartButton: (players, order) => {
    const btn = document.getElementById('start-game-btn');
    const count = order ? order.length : Object.keys(players).length;
    if (btn) btn.disabled = !(multiplayerState.isHost && count >= 2);
  },

  // --- Game Board Rendering ---
  renderCard: (card, isBack = false) => {
    const el = document.createElement('div');
    el.className = 'uno-card';
    if (isBack) {
      el.classList.add('card-back');
      el.innerHTML = `<svg width="240" height="360" viewBox="0 0 240 360"><rect width="240" height="360" rx="25" fill="#1a1a2e"/><rect x="10" y="10" width="220" height="340" rx="20" fill="none" stroke="#fff" stroke-width="6"/><ellipse cx="120" cy="180" rx="80" ry="140" fill="#FF3B5C" transform="rotate(20 120 180)"/><text x="120" y="195" font-family="Arial Black" font-size="60" fill="#FFD43B" text-anchor="middle" transform="rotate(-15 120 190)">UNO</text></svg>`;
      return el;
    }
    let fill = card.c === 'black' ? '#1a1a2e' : `url(#uno${card.c.charAt(0).toUpperCase() + card.c.slice(1)})`;
    let center = card.v;
    let isWild = card.c === 'black';
    
    let centerSvg = '';
    if (card.v === 'S') center = '⊘';
    if (card.v === 'R') center = '⟲';
    
    // Center design
    centerSvg = `<text y="196" font-family="Arial Black" font-size="180" font-weight="900" fill="#000" text-anchor="middle" x="128">${center}</text>
                 <text y="196" font-family="Arial Black" font-size="180" font-weight="900" fill="#fff" text-anchor="middle" x="120">${center}</text>`;
    
    if (isWild) {
        centerSvg = `<g transform="rotate(-50 120 180)">
            <path fill="#4DABF7" d="m120,180l0,-85a145,85 0 0 1 145,85l-145,0z"/>
            <path fill="#51CF66" d="m120,180l145,0a145,85 0 0 1 -145,85l0,-85z"/>
            <path fill="#FFD43B" d="m120,180l0,85a145,85 0 0 1 -145,-85l145,0z"/>
            <path fill="#FF3B5C" d="m120,180l-145,0a145,85 0 0 1 145,-85l0,85z"/>
            <ellipse stroke="#fff" fill="none" ry="85" rx="145" cy="180" cx="120" stroke-width="4"/>
        </g>`;
    }

    el.innerHTML = `<svg width="240" height="360" viewBox="0 0 240 360">
      <rect x="0" y="0" width="240" height="360" rx="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" fill="none" stroke="#fff" stroke-width="8"/>
      ${centerSvg}
      <text font-family="Arial Black" font-size="50" font-weight="900" fill="#000" text-anchor="middle" x="45" y="61">${card.v === 'W' ? 'W' : center}</text>
      <text font-family="Arial Black" font-size="50" font-weight="900" fill="#fff" text-anchor="middle" x="42" y="58">${card.v === 'W' ? 'W' : center}</text>
      <g transform="rotate(180 162 238)">
         <text font-family="Arial Black" font-size="50" font-weight="900" fill="#000" text-anchor="middle" x="45" y="61">${card.v === 'W' ? 'W' : center}</text>
         <text font-family="Arial Black" font-size="50" font-weight="900" fill="#fff" text-anchor="middle" x="42" y="58">${card.v === 'W' ? 'W' : center}</text>
      </g>
    </svg>`;
    return el;
  },

  updateBoard: () => {
    // Discard Pile
    const discardPile = document.getElementById('discard-pile');
    if (discardPile && state.discard.length > 0) {
      discardPile.innerHTML = '';
      const topCard = state.discard[state.discard.length - 1];
      const cardEl = GameUI.renderCard(topCard);
      state.discardRotation = (state.discardRotation || 0) + (Math.random() * 20 - 10);
      cardEl.style.transform = `rotate(${state.discardRotation}deg)`;
      discardPile.appendChild(cardEl);
    }

    // Color Indicator
    const colorInd = document.getElementById('color-indicator');
    if (colorInd) colorInd.className = `color-indicator ${state.activeColor}`;

    // Direction
    const dirInd = document.getElementById('direction-indicator');
    if (dirInd) {
      dirInd.classList.add('active');
      dirInd.classList.remove('clockwise', 'counter');
      dirInd.classList.add(state.direction === 1 ? 'clockwise' : 'counter');
    }

    // Render Players & Zones
    const zonesContainer = document.getElementById('player-zones-container');
    zonesContainer.innerHTML = '';
    
    state.players.forEach((p, idx) => {
      const posClass = getPositionClass(idx, state.players.length);
      const isMe = idx === multiplayerState.playerIndex;
      
      const zone = document.createElement('div');
      zone.className = `player-zone player-${posClass}`;
      
      let infoClass = 'player-info glass-panel';
      if (state.turn === idx) infoClass += ' active';
      if (state.timer <= 3) infoClass += ' warning';

      zone.innerHTML = `
        <div class="${infoClass}">
          <div class="player-avatar" style="background:${getPlayerColor(idx)}">
             <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <div class="player-details">
             <div class="player-name">${p.name} ${p.isBot ? '🤖' : ''}</div>
             <div class="card-count">${p.hand.length} cards</div>
          </div>
        </div>
      `;
      
      // Render Opponent Cards (Miniature)
      if (!isMe && p.hand.length > 0) {
         const cardContainer = document.createElement('div');
         cardContainer.className = posClass === 'top' || posClass === 'bottom' ? 'bot-cards-horizontal' : 'bot-cards-vertical';
         for(let i=0; i<Math.min(p.hand.length, 5); i++) {
            cardContainer.appendChild(GameUI.renderCard(null, true));
         }
         zone.appendChild(cardContainer);
      }

      zonesContainer.appendChild(zone);
    });

    // Render My Hand
    const handContainer = document.getElementById('player-hand');
    if (handContainer) {
      handContainer.innerHTML = '';
      const myHand = state.players[multiplayerState.playerIndex]?.hand || [];
      myHand.forEach((card, idx) => {
        const el = GameUI.renderCard(card);
        const isPlayable = state.turn === multiplayerState.playerIndex && Game.GameLogic.checkValidPlay(card);
        if (isPlayable) el.classList.add('playable');
        
        el.onclick = async () => {
           if (state.turn !== multiplayerState.playerIndex) return;
           if (isPlayable) await Game.GameLogic.playCard(multiplayerState.playerIndex, idx);
           else { el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'), 500); }
        };
        handContainer.appendChild(el);
      });
    }

    // UNO Button
    const unoBtn = document.getElementById('uno-btn');
    if(unoBtn) {
       const myHand = state.players[multiplayerState.playerIndex]?.hand || [];
       const showUno = state.turn === multiplayerState.playerIndex && myHand.length === 2 && !state.saidUno.has(multiplayerState.playerIndex);
       unoBtn.classList.toggle('active', showUno);
    }

    // Turn Text
    const turnText = document.getElementById('turn-text');
    if(turnText) turnText.textContent = state.turn === multiplayerState.playerIndex ? "Your Turn" : state.players[state.turn].name + "'s Turn";
    
    // Deck Count
    document.getElementById('deck-count').textContent = state.deck.length;
  },

  // --- Game Actions ---
  drawCard: async () => {
    if (state.turn !== multiplayerState.playerIndex || !state.active) return;
    
    // Stack Check
    if (state.drawStack > 0 && gameSettings.stacking) {
      const myHand = state.players[multiplayerState.playerIndex].hand;
      const canStack = myHand.some(c => Game.GameLogic.canStackCard(c));
      if (canStack) { GameUI.showMessage("You must stack or play!"); return; }
      
      const drawn = Game.GameLogic.drawCards(state.drawStack);
      myHand.push(...drawn);
      GameUI.showMessage(`Drew ${state.drawStack} cards!`);
      state.drawStack = 0; state.stackType = null;
      GameUI.updateBoard();
      await Game.GameLogic.advanceTurn();
      return;
    }

    const card = Game.GameLogic.drawCards(1)[0];
    state.players[multiplayerState.playerIndex].hand.push(card);
    GameUI.updateBoard();
    
    if (Game.GameLogic.checkValidPlay(card)) {
       state.drawnCard = card; state.drawnCardPlayable = true;
       document.getElementById('drawn-card-display').innerHTML = '';
       document.getElementById('drawn-card-display').appendChild(GameUI.renderCard(card));
       document.getElementById('drawn-card-popup').classList.add('active');
    } else {
       GameUI.showMessage("Cannot play this card");
       await sleep(500);
       await Game.GameLogic.advanceTurn();
    }
  },
  
  keepDrawnCard: async () => {
    document.getElementById('drawn-card-popup').classList.remove('active');
    await Game.GameLogic.advanceTurn();
  },
  
  playDrawnCard: async () => {
    document.getElementById('drawn-card-popup').classList.remove('active');
    const idx = state.players[multiplayerState.playerIndex].hand.length - 1;
    await Game.GameLogic.playCard(multiplayerState.playerIndex, idx);
  },

  callUno: async () => {
    if (state.players[multiplayerState.playerIndex].hand.length === 2) {
      state.saidUno.add(multiplayerState.playerIndex);
      playSound('uno');
      GameUI.showMessage("UNO!");
    }
  },
  
  sendEmote: (key) => {
     // Emote logic (simplified)
     showToast(EMOTES[key]);
  },
  
  sortHand: (mode) => {
     const hand = state.players[multiplayerState.playerIndex].hand;
     if (mode === 'color') {
        const order = { red:1, blue:2, green:3, yellow:4, black:5 };
        hand.sort((a,b) => order[a.c] - order[b.c]);
     } else {
        const order = { '0':0, '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, 'S':10, 'R':11, '+2':12, 'W':13, '+4':14 };
        hand.sort((a,b) => order[a.v] - order[b.v]);
     }
     GameUI.updateBoard();
  },

  // --- Overlays & Helpers ---
  showColorPicker: () => document.getElementById('color-picker-3d').classList.add('active'),
  hideColorPicker: () => document.getElementById('color-picker-3d').classList.remove('active'),
  showMessage: (msg) => {
    const el = document.getElementById('game-message');
    el.textContent = msg; el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 1500);
  },
  showGameOver: (winnerIdx, isWin) => {
    const modal = document.getElementById('game-over');
    const title = document.getElementById('winner-text');
    const icon = document.getElementById('result-icon');
    
    title.textContent = isWin ? "YOU WIN!" : "YOU LOSE";
    icon.className = `result-icon ${isWin ? 'win' : 'lose'}`;
    icon.innerHTML = isWin ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
    
    document.getElementById('xp-value').textContent = isWin ? "+250" : "+50";
    modal.classList.add('active');
  },

  // Timer
  startTimer: () => {
    GameUI.stopTimer();
    state.timer = TURN_TIME;
    const timerEl = document.getElementById('game-timer-value');
    state.timerInterval = setInterval(() => {
      state.timer--;
      if(timerEl) timerEl.textContent = state.timer;
      if (state.timer <= 3) playSound('tick');
      if (state.timer <= 0) {
        GameUI.stopTimer();
        // Force draw on timeout
        GameUI.drawCard();
      }
    }, 1000);
  },
  stopTimer: () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
  }
};

// Attach AI helper
Game.AI = { chooseColor: (idx) => {
  const hand = state.players[idx].hand;
  let counts = { red:0, blue:0, green:0, yellow:0 };
  hand.forEach(c => { if(c.c !== 'black') counts[c.c]++; });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}};
