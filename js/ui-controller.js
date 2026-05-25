// ==================== CARD RENDERING ====================
function renderCard(card, isBack = false) {
  const el = document.createElement('div');
  el.className = 'uno-card';

  if (isBack) {
    el.classList.add('card-back');
    const randId = Math.random().toString(36).substr(2, 9);
    el.innerHTML = `
      <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
        <defs>
          <linearGradient id="cbg${randId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF3B5C"/>
            <stop offset="100%" stop-color="#E6194B"/>
          </linearGradient>
        </defs>
        <rect width="240" height="360" rx="18" fill="#1a1a2e"/>
        <rect x="10" y="10" width="220" height="340" rx="12" fill="none" stroke="#ffffff" stroke-width="6"/>
        <ellipse cx="120" cy="180" rx="80" ry="140" fill="url(#cbg${randId})" transform="rotate(20 120 180)"/>
        <text x="120" y="195" font-family="Bebas Neue, Arial Black, sans-serif" font-size="60"
              font-weight="900" fill="#FFD43B" text-anchor="middle" dominant-baseline="middle"
              transform="rotate(-15 120 190)">UNO</text>
      </svg>`;
    return el;
  }

  // Determine fill
  let fill   = '#1a1a2e';
  let isWild = false;
  if (card.c === 'red')    fill = 'url(#unoRed)';
  else if (card.c === 'blue')   fill = 'url(#unoBlue)';
  else if (card.c === 'green')  fill = 'url(#unoGreen)';
  else if (card.c === 'yellow') fill = 'url(#unoYellow)';
  else isWild = true;

  let centerContent  = '';
  let cornerValue    = card.v;
  let centerFontSize = 180;

  if (card.v === 'S') {
    cornerValue = '⊘';
    centerFontSize = 120;
    centerContent = `
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text>
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;

  } else if (card.v === 'R') {
    cornerValue = '⟲';
    centerFontSize = 120;
    centerContent = `
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${cornerValue}</text>
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle" x="120">${cornerValue}</text>`;

  } else if (card.v === '+2') {
    centerFontSize = 120;
    centerContent = `
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">+2</text>
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle" x="120">+2</text>`;

  } else if (card.v === 'W') {
    cornerValue = 'W';
    centerContent = '';

  } else if (card.v === '+4') {
    cornerValue = '+4';
    centerContent = `
      <g transform="skewX(-10)">
        <text stroke-width="10" stroke="#000" dominant-baseline="middle" text-anchor="middle"
              fill="#000" font-weight="900" font-size="100" font-family="Arial Black,sans-serif"
              y="186" x="152">+4</text>
        <text dominant-baseline="middle" text-anchor="middle"
              fill="#fff" font-weight="900" font-size="100" font-family="Arial Black,sans-serif"
              y="179" x="145">+4</text>
      </g>`;

  } else {
    centerContent = `
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#000" text-anchor="middle" dominant-baseline="middle" x="128" dy="8">${card.v}</text>
      <text y="196" font-family="Arial Black,sans-serif" font-size="${centerFontSize}"
            font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle" x="120">${card.v}</text>`;
  }

  const wildPattern = isWild ? `
    <g transform="rotate(-50 120 180)">
      <path fill="#4DABF7" d="m120,180l0,-85a145,85 0 0 1 145,85l-145,0z"/>
      <path fill="#51CF66" d="m120,180l145,0a145,85 0 0 1 -145,85l0,-85z"/>
      <path fill="#FFD43B" d="m120,180l0,85a145,85 0 0 1 -145,-85l145,0z"/>
      <path fill="#FF3B5C" d="m120,180l-145,0a145,85 0 0 1 145,-85l0,85z"/>
      <ellipse stroke-width="4" stroke="#fff" fill="none" ry="85" rx="145" cy="180" cx="120"/>
    </g>` : '';

  const centerEllipse = !isWild ? `
    <ellipse transform="rotate(-60.409 117.875 181.408)" stroke="#fff"
             cx="117.875" cy="181.408" rx="159.199" ry="82.076" fill="none" stroke-width="6"/>` : '';

  el.innerHTML = `
    <svg width="240" height="360" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">
      <rect x="0" y="0" width="240" height="360" rx="25" ry="25" fill="${fill}"/>
      <rect x="10" y="10" width="220" height="340" rx="20" ry="20" fill="none" stroke="#fff" stroke-width="8"/>
      ${centerEllipse}
      ${wildPattern}
      ${centerContent}
      <g>
        <text font-family="Arial Black,sans-serif" font-size="50" font-weight="900"
              fill="#000" text-anchor="middle" x="44" y="61">${cornerValue}</text>
        <text font-family="Arial Black,sans-serif" font-size="50" font-weight="900"
              fill="#fff" text-anchor="middle" y="58" x="41">${cornerValue}</text>
      </g>
      <g transform="rotate(180 162 238)">
        <text font-family="Arial Black,sans-serif" font-size="50" font-weight="900"
              fill="#000" text-anchor="middle" x="45" y="61">${cornerValue}</text>
        <text font-family="Arial Black,sans-serif" font-size="50" font-weight="900"
              fill="#fff" text-anchor="middle" y="58" x="42">${cornerValue}</text>
      </g>
    </svg>`;

  return el;
}

// ==================== UI UPDATES ====================
function updateUI() {
  // Discard pile
  const discardPile = document.getElementById('discard-pile');
  if (discardPile && state.discard.length > 0) {
    const topCard = state.discard[state.discard.length - 1];
    discardPile.innerHTML = '';
    const cardEl = renderCard(topCard);
    state.discardRotation = ((state.discardRotation || 0) + (Math.random() * 20 - 10));
    cardEl.style.transform = 'rotate(' + state.discardRotation + 'deg)';
    cardEl.style.animation  = 'none';
    discardPile.appendChild(cardEl);
  }

  // Color indicator
  const colorIndicator = document.getElementById('color-indicator');
  if (colorIndicator) {
    colorIndicator.className = 'color-indicator ' + (state.activeColor || 'red');
  }

  // Deck count
  const deckCount = document.getElementById('deck-count');
  if (deckCount) deckCount.textContent = state.deck.length;

  // Direction indicator
  const directionIndicator = document.getElementById('direction-indicator');
  if (directionIndicator) {
    directionIndicator.classList.add('active');
    directionIndicator.classList.toggle('clockwise', state.direction === 1);
    directionIndicator.classList.toggle('counter',   state.direction !== 1);
  }

  // UNO button visibility
  const unoBtn = document.getElementById('uno-btn');
  if (unoBtn) {
    const isMyTurn = state.turn === multiplayerState.playerIndex;
    const myPlayer = state.players[multiplayerState.playerIndex];
    const shouldShow = isMyTurn && myPlayer && myPlayer.hand.length === 2
                       && state.active && !state.saidUno.has(multiplayerState.playerIndex);
    unoBtn.classList.toggle('active', !!shouldShow);
  }

  updateTurnIndicator();
}

function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  const turnText  = document.getElementById('turn-text');
  if (!indicator) return;

  if (state.active && !state.isOver) {
    indicator.style.display = 'flex';
    const currentPlayer = state.players[state.turn];
    const isMyTurn = state.turn === multiplayerState.playerIndex;
    const dot = indicator.querySelector('.dot');

    if (isMyTurn) {
      if (turnText) turnText.textContent = 'Your Turn';
      if (dot) dot.style.background = 'var(--uno-green)';
    } else {
      if (turnText) turnText.textContent = (currentPlayer ? currentPlayer.name : '?') + "'s Turn";
      if (dot) dot.style.background = getPlayerColor(state.turn);
    }
  } else {
    indicator.style.display = 'none';
  }
}

function updatePlayerZones() {
  state.players.forEach((player, idx) => {
    const posClass = getPositionClass(idx, state.players.length);
    const zone = document.querySelector('.player-zone.player-' + posClass);
    if (!zone) return;

    const info    = zone.querySelector('.player-info');
    const nameEl  = zone.querySelector('.player-name');
    const countEl = zone.querySelector('.card-count');
    const avatar  = zone.querySelector('.player-avatar');

    if (nameEl) {
      if (player.isBot || player.isConnected === false) {
        nameEl.innerHTML = player.name + ' <span class="bot-indicator">🤖</span>';
      } else {
        nameEl.textContent = player.name;
      }
    }
    if (countEl) countEl.textContent = player.hand.length + ' cards';

    // Active / warning highlight
    if (info) {
      info.classList.remove('active', 'warning');
      if (state.turn === idx) {
        info.classList.add('active');
        if (state.timer <= 3 && gameSettings.timer) info.classList.add('warning');
      }
    }

    // Per-player timer badge
    let timerEl = info ? info.querySelector('.player-turn-timer') : null;
    if (!timerEl && info) {
      timerEl = document.createElement('div');
      timerEl.className = 'player-turn-timer';
      info.appendChild(timerEl);
    }
    if (timerEl) {
      timerEl.classList.remove('show', 'warning', 'danger');
      if (state.turn === idx && state.active && !state.isOver) {
        timerEl.textContent = state.timer;
        timerEl.classList.add('show');
        if (state.timer <= 3)       timerEl.classList.add('danger');
        else if (state.timer <= 5)  timerEl.classList.add('warning');
      }
    }

    // Avatar color glow
    if (avatar) {
      avatar.style.background = getPlayerColor(idx);
    }

    // UNO alert badge
    let unoAlert = zone.querySelector('.uno-alert');
    if (player.hand.length === 1) {
      if (!unoAlert && info) {
        unoAlert = document.createElement('div');
        unoAlert.className = 'uno-alert';
        unoAlert.textContent = 'UNO!';
        info.appendChild(unoAlert);
      }
    } else if (unoAlert) {
      unoAlert.remove();
    }

    // Opponent cards (back faces)
    if (idx !== multiplayerState.playerIndex) {
      const cardsContainer = zone.querySelector('.bot-cards-horizontal, .bot-cards-vertical');
      if (cardsContainer) {
        cardsContainer.innerHTML = '';
        const displayCount = Math.min(player.hand.length, 7);
        for (let i = 0; i < displayCount; i++) {
          cardsContainer.appendChild(renderCard(null, true));
        }
      }
    }
  });
}

// ==================== HAND RENDERING ====================
function renderHand() {
  const handContainer = document.getElementById('player-hand');
  if (!handContainer) return;
  handContainer.innerHTML = '';

  const player   = state.players[multiplayerState.playerIndex];
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

    el.draggable = true;

    el.addEventListener('dragstart', (e) => {
      if (!isValid) {
        e.preventDefault();
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
        return;
      }
      state.dragCard = idx;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      state.dragCard = null;
    });

    el.addEventListener('click', async () => {
      if (!state.active || state.turn !== multiplayerState.playerIndex || player.isBot) return;
      if (isValid) {
        await playCard(multiplayerState.playerIndex, idx);
      } else if (isMyTurn) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
      }
    });

    handContainer.appendChild(el);
  });
}

// ==================== COLOR PICKER ====================
function showColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) {
    picker.classList.add('active');
    picker.querySelectorAll('.color-box-3d').forEach(box => {
      box.classList.remove('selected', 'fade-out');
    });
  }
}

function hideColorPicker3D() {
  const picker = document.getElementById('color-picker-3d');
  if (picker) picker.classList.remove('active');
}

async function selectWildColor(color) {
  state.activeColor = color;
  hideColorPicker3D();

  if (multiplayerState.gameRef) {
    await multiplayerState.gameRef.update({ activeColor: color });
  }

  if (state.pendingWild) {
    await applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
    state.pendingWild = null;
  }

  await advanceTurn();
  playSound('wild');
  showActionFlash('wild');
}

// ==================== SORT HAND ====================
function sortHand(mode) {
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;

  if (mode === 'color') {
    const colorOrder = { red: 1, blue: 2, green: 3, yellow: 4, black: 5 };
    player.hand.sort((a, b) => (colorOrder[a.c] || 5) - (colorOrder[b.c] || 5));
  } else {
    const valueOrder = { '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'S':10,'R':11,'+2':12,'W':13,'+4':14 };
    player.hand.sort((a, b) => (valueOrder[a.v] ?? 5) - (valueOrder[b.v] ?? 5));
  }

  renderHand();
  playSound('card');
}

// ==================== DRAW CARD ====================
async function handleDrawPile() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  const player = state.players[multiplayerState.playerIndex];
  if (!player || player.isBot) return;

  stopTimer();

  // Must draw the full stack if stacking is active and can't stack
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = player.hand.some(c => canStackCard(c));
    if (canStack) {
      showGameMessage('You have a card to stack!');
      startTimer();
      return;
    }
    const drawn = drawCards(state.drawStack);
    player.hand.push(...drawn);
    showGameMessage('You drew ' + state.drawStack + ' cards!');
    vibrate([50, 30, 50]);
    state.drawStack  = 0;
    state.stackType  = null;
    renderHand();
    updateUI();
    await advanceTurn();
    return;
  }

  // Normal draw
  const card = drawCards(1)[0];
  if (!card) { startTimer(); return; }

  player.hand.push(card);
  renderHand();
  updateUI();
  playSound('draw');

  if (checkValidPlay(card)) {
    showDrawnCardPopup(card, true);
  } else {
    showGameMessage('Cannot play this card');
    await sleep(500);
    await advanceTurn();
  }
}

function showDrawnCardPopup(card, canPlay) {
  const popup   = document.getElementById('drawn-card-popup');
  const display = document.getElementById('drawn-card-display');
  const playBtn = document.getElementById('play-btn');

  if (popup && display) {
    display.innerHTML = '';
    display.appendChild(renderCard(card));
    if (playBtn) playBtn.style.display = canPlay ? 'block' : 'none';
    popup.classList.add('active');
    state.drawnCard         = card;
    state.drawnCardPlayable = canPlay;
  }
}

function hideDrawnCardPopup() {
  const popup = document.getElementById('drawn-card-popup');
  if (popup) popup.classList.remove('active');
  state.drawnCard         = null;
  state.drawnCardPlayable = false;
}

async function handleKeepCard() {
  hideDrawnCardPopup();
  await advanceTurn();
}

async function handlePlayDrawnCard() {
  if (!state.drawnCard || !state.drawnCardPlayable) return;
  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;
  const cardIndex = player.hand.length - 1;
  hideDrawnCardPopup();
  await playCard(multiplayerState.playerIndex, cardIndex);
}

// ==================== UNO BUTTON ====================
async function handleUnoButton() {
  if (state.turn !== multiplayerState.playerIndex || !state.active) return;
  const player = state.players[multiplayerState.playerIndex];
  if (!player || player.hand.length !== 2) return;

  state.saidUno.add(multiplayerState.playerIndex);
  playSound('uno');
  vibrate(100);
  showGameMessage('UNO!');
  await sendGameAction('uno', {});
  updateUI();
}

// ==================== EMOTE SYSTEM ====================
function toggleEmotePanel() {
  const panel = document.getElementById('emote-panel');
  if (panel) panel.classList.toggle('active');
}

async function sendEmote(emoteKey) {
  const emote = EMOTES[emoteKey];
  if (!emote) return;

  showEmote(multiplayerState.playerIndex, emote);
  playSound('emote');
  await sendGameAction('emote', { emote });

  const panel = document.getElementById('emote-panel');
  if (panel) panel.classList.remove('active');
}

function showEmote(playerIndex, emote) {
  const posClass = getPositionClass(playerIndex, state.players.length);
  const zone = document.querySelector('.player-zone.player-' + posClass);
  if (!zone) return;

  let bubble = zone.querySelector('.emote-bubble');
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'emote-bubble';
    zone.appendChild(bubble);
  }

  bubble.textContent = emote;
  bubble.classList.add('show');
  clearTimeout(bubble._timer);
  bubble._timer = setTimeout(() => bubble.classList.remove('show'), 2500);
}

// ==================== EFFECTS ====================
function showActionFlash(type) {
  const overlay = document.getElementById('action-flash-overlay');
  if (!overlay) return;
  overlay.className = 'action-flash-overlay ' + type;
  void overlay.offsetWidth; // reflow
  overlay.classList.add('active');
  setTimeout(() => overlay.classList.remove('active'), 500);
}

function showSkipSymbol(playerIndex) {
  const posClass = getPositionClass(playerIndex, state.players.length);
  const zone = document.querySelector('.player-zone.player-' + posClass);
  if (!zone) return;

  let sym = zone.querySelector('.skip-symbol');
  if (!sym) {
    sym = document.createElement('div');
    sym.className = 'skip-symbol';
    sym.innerHTML = `<svg viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/></svg>`;
    zone.appendChild(sym);
  }
  sym.classList.add('show');
  setTimeout(() => sym.classList.remove('show'), 1200);
}

function showReverseSymbol() {
  let sym = document.getElementById('reverse-symbol');
  if (!sym) {
    sym = document.createElement('div');
    sym.id = 'reverse-symbol';
    sym.className = 'reverse-symbol';
    sym.innerHTML = `<svg viewBox="0 0 24 24" fill="white"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    document.body.appendChild(sym);
  }
  sym.classList.remove('show');
  void sym.offsetWidth;
  sym.classList.add('show');
  setTimeout(() => sym.classList.remove('show'), 800);
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
  const count  = 30;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'wild-particle';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    const angle    = (Math.PI * 2 * i) / count;
    const distance = 100 + Math.random() * 100;
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    container.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

function createConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  const colors = ['#FF3B5C', '#4DABF7', '#51CF66', '#FFD43B', '#a55eea'];

  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    const size = 6 + Math.random() * 10;
    c.style.cssText = `
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random()}s;
      width:${size}px; height:${size}px;
      border-radius:${Math.random() > 0.5 ? '50%' : '0'};
    `;
    container.appendChild(c);
  }

  setTimeout(() => container.innerHTML = '', 4000);
}

// ==================== GAME RESULTS ====================
function showGameResults(winnerIndex, isWin) {
  const modal = document.getElementById('game-over');
  if (!modal) return;
  modal.classList.add('active');

  const resultIcon  = document.getElementById('result-icon');
  const resultsList = document.getElementById('results-container');
  const xpValue     = document.getElementById('xp-value');

  if (resultIcon) {
    resultIcon.className = 'result-icon ' + (isWin ? 'win' : 'lose');
    resultIcon.innerHTML = isWin
      ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
  }

  if (resultsList) {
    const results = state.players
      .map((p, idx) => ({ name: p.name, cards: p.hand.length, isWinner: idx === winnerIndex }))
      .sort((a, b) => a.cards - b.cards);

    resultsList.innerHTML = results.map((r, i) => `
      <div class="result-item ${r.isWinner ? 'winner' : ''}">
        <div class="result-rank">${i + 1}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-cards">${r.cards} cards</div>
      </div>`).join('');
  }

  if (xpValue) xpValue.textContent = '+' + (isWin ? 250 : 50);
}
