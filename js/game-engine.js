// ==================== DECK CREATION ====================
function createDeck() {
  let deck = [];
  COLORS.forEach(color => {
    deck.push({ c: color, v: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ c: color, v: String(i) });
      deck.push({ c: color, v: String(i) });
    }
    SPECIAL_VALUES.forEach(v => {
      deck.push({ c: color, v });
      deck.push({ c: color, v });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ c: 'black', v: 'W' });
    deck.push({ c: 'black', v: '+4' });
  }
  return shuffle(deck);
}

// ==================== GAME RULES ====================
function checkValidPlay(card) {
  if (!state.discard.length) return true;
  const top = state.discard[state.discard.length - 1];
  if (card.c === 'black')          return true;
  if (card.c === state.activeColor) return true;
  if (card.v === top.v)            return true;
  return false;
}

function canStackCard(card) {
  if (!gameSettings.stacking) return false;
  if (state.stackType === '+2') return card.v === '+2' || card.v === '+4';
  if (state.stackType === '+4') return card.v === '+4';
  return false;
}

function drawCards(count) {
  count = Math.max(0, Math.floor(count));
  const drawn = [];

  for (let i = 0; i < count; i++) {
    // Reshuffle discard into deck if needed
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard.pop();
      state.deck = shuffle([...state.discard]);
      state.discard = [top];
    }
    if (state.deck.length > 0) drawn.push(state.deck.pop());
  }
  return drawn;
}

// ==================== PLAY A CARD ====================
async function playCard(playerIndex, cardIndex) {
  if (!state.active || state.isOver) return;

  const player = state.players[playerIndex];
  if (!player || cardIndex < 0 || cardIndex >= player.hand.length) return;

  const card = player.hand.splice(cardIndex, 1)[0];
  state.discard.push(card);

  // Handle stacking counters
  if (gameSettings.stacking) {
    if (card.v === '+2') {
      state.drawStack += 2;
      state.stackType  = '+2';
    } else if (card.v === '+4') {
      state.drawStack += 4;
      state.stackType  = '+4';
    } else {
      state.drawStack = 0;
      state.stackType = null;
    }
  }

  // Wild card — human player picks colour, bot picks automatically
  if (card.c === 'black') {
    if (playerIndex === multiplayerState.playerIndex && !player.isBot) {
      state.pendingWild = card;
      showColorPicker3D();
      updateUI();
      renderHand();
      return; // Wait for colour selection before advancing turn
    } else {
      // Bot picks colour
      state.activeColor = chooseColor(playerIndex);
      if (multiplayerState.gameRef) {
        await multiplayerState.gameRef.update({ activeColor: state.activeColor });
      }
    }
  } else {
    state.activeColor = card.c;
  }

  // Sound / visual effects
  if (card.v === 'S') {
    playSound('skip');
    showActionFlash('skip');
    const skippedIdx = getNextPlayerIndex();
    setTimeout(() => showSkipSymbol(skippedIdx), 200);
  } else if (card.v === 'R') {
    playSound('reverse');
    showActionFlash('reverse');
    showReverseSymbol();
  } else if (card.v === 'W' || card.v === '+4') {
    playSound('wild');
    showActionFlash('wild');
    createWildExplosion();
  } else {
    playSound('card');
  }

  vibrate(50);

  // Check win
  if (player.hand.length === 0) {
    await endMultiplayerGame(playerIndex);
    return;
  }

  // Auto-set UNO flag
  if (player.hand.length === 1) {
    state.saidUno.add(playerIndex);
  }

  await applyCardEffect(card, playerIndex);
  await advanceTurn();

  // Broadcast action
  await sendGameAction('playCard', { card, cardIndex });

  updateUI();
  renderHand();
}

// ==================== APPLY CARD EFFECTS ====================
async function applyCardEffect(card, currentPlayerIndex) {
  const nextIdx    = getNextPlayerIndex();
  const nextPlayer = state.players[nextIdx];
  if (!nextPlayer) return;

  // Skip and Reverse only apply immediately when NOT being stacked
  if (state.drawStack === 0 || !gameSettings.stacking) {
    if (card.v === 'S') {
      showGameMessage(nextPlayer.name + ' Skipped!');
      state.turn = nextIdx; // Will be advanced again in advanceTurn
    } else if (card.v === 'R') {
      state.direction *= -1;
      showGameMessage('Direction Reversed!');
      if (state.players.length === 2) state.turn = nextIdx;
    }
  }

  // Force draw if the next player can't stack
  if (state.drawStack > 0 && gameSettings.stacking) {
    const canStack = nextPlayer.hand.some(c => canStackCard(c));
    if (!canStack) {
      const drawn = drawCards(state.drawStack);
      nextPlayer.hand.push(...drawn);
      showGameMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
      await sendGameAction('drawStack', { count: drawn.length });
      state.drawStack = 0;
      state.stackType = null;
      // skip the next player's turn (they had to draw)
      state.turn = nextIdx;
    }
  }
}

function getNextPlayerIndex() {
  let next = state.turn + state.direction;
  if (next >= state.players.length) next = 0;
  if (next < 0) next = state.players.length - 1;
  return next;
}

// ==================== ADVANCE TURN ====================
async function advanceTurn() {
  state.turn = getNextPlayerIndex();

  // Sync to Firebase
  if (multiplayerState.gameRef) {
    const updates = {
      turn:        state.turn,
      direction:   state.direction,
      discard:     state.discard,
      deck:        state.deck,
      activeColor: state.activeColor,
      drawStack:   state.drawStack,
      stackType:   state.stackType,
      playerHands: {}
    };
    state.players.forEach(p => { updates.playerHands[p.id] = p.hand; });
    await multiplayerState.gameRef.update(updates);
  }

  updateUI();
  renderHand();
  updatePlayerZones();

  const currentPlayer = state.players[state.turn];
  if (currentPlayer && (currentPlayer.isBot || currentPlayer.isConnected === false)) {
    setTimeout(botTurn, 800 + Math.random() * 500);
  } else if (state.turn === multiplayerState.playerIndex) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
}

// ==================== TIMER ====================
function startTimer() {
  if (!gameSettings.timer) return;
  stopTimer();
  state.timer = TURN_TIME;
  updatePlayerZones();

  state.timerInterval = setInterval(() => {
    state.timer--;
    updatePlayerZones();

    if (state.timer <= 3 && state.timer > 0) {
      playSound('tick');
      vibrate(50);
    }

    if (state.timer <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

async function handleTimeout() {
  if (state.turn !== multiplayerState.playerIndex) return;

  showGameMessage('Time Out!');
  vibrate([100, 50, 100]);

  const player = state.players[multiplayerState.playerIndex];
  if (!player) return;

  if (state.drawStack > 0) {
    const drawn = drawCards(state.drawStack);
    player.hand.push(...drawn);
    state.drawStack = 0;
    state.stackType = null;
  } else {
    const card = drawCards(1)[0];
    if (card) player.hand.push(card);
  }

  renderHand();
  updateUI();
  await advanceTurn();
}

// ==================== GAME SYNC ====================
function setupGameListeners() {
  if (!multiplayerState.gameRef) return;

  multiplayerState.gameRef.on('value', snapshot => {
    const gameData = snapshot.val();
    if (!gameData) return;
    syncGameState(gameData);
  });

  multiplayerState.gameRef.child('lastAction').on('value', snapshot => {
    const action = snapshot.val();
    if (action && action.timestamp > Date.now() - 5000) {
      handleRemoteAction(action);
    }
  });
}

function syncGameState(gameData) {
  const playerOrder = gameData.playerOrder || [];
  const myIndex     = playerOrder.indexOf(multiplayerState.playerId);
  multiplayerState.playerIndex = myIndex;

  state.players = playerOrder.map(playerId => {
    const pData = (gameData.playerData || {})[playerId] || {};
    return {
      id:          playerId,
      name:        pData.name || 'Player',
      hand:        (gameData.playerHands || {})[playerId] || [],
      isBot:       !!pData.isBot,
      isConnected: pData.isConnected !== false,
      isHost:      !!pData.isHost
    };
  });

  state.deck        = gameData.deck        || [];
  state.discard     = gameData.discard     || [];
  state.activeColor = gameData.activeColor || 'red';
  state.turn        = gameData.turn        || 0;
  state.direction   = gameData.direction   || 1;
  state.drawStack   = gameData.drawStack   || 0;
  state.stackType   = gameData.stackType   || null;
  state.active      = true;
  state.isOver      = false;

  renderHand();
  updateUI();
  updatePlayerZones();

  if (state.turn === myIndex && myIndex >= 0 && !state.players[myIndex]?.isBot) {
    startTimer();
    vibrate(100);
  } else {
    stopTimer();
  }
}

async function sendGameAction(actionType, actionData) {
  if (!multiplayerState.gameRef) return;

  const action = {
    type:        actionType,
    playerId:    multiplayerState.playerId,
    playerIndex: multiplayerState.playerIndex,
    data:        actionData,
    timestamp:   firebase.database.ServerValue.TIMESTAMP
  };

  await multiplayerState.gameRef.child('lastAction').set(action);
}

function handleRemoteAction(action) {
  // Ignore own actions
  if (action.playerId === multiplayerState.playerId) return;

  switch (action.type) {
    case 'playCard':
      playSound('card');
      break;
    case 'drawCard':
      playSound('draw');
      break;
    case 'skip':
      playSound('skip');
      showActionFlash('skip');
      break;
    case 'reverse':
      playSound('reverse');
      showActionFlash('reverse');
      showReverseSymbol();
      break;
    case 'wild':
      playSound('wild');
      showActionFlash('wild');
      createWildExplosion();
      break;
    case 'drawStack':
      showGameMessage(
        (state.players[action.playerIndex]?.name || 'Player') +
        ' drew ' + (action.data?.count || '') + ' cards!'
      );
      break;
    case 'uno':
      playSound('uno');
      showGameMessage('UNO!');
      break;
    case 'emote':
      showEmote(action.playerIndex, action.data?.emote || '');
      break;
  }
}

// ==================== END GAME ====================
async function endMultiplayerGame(winnerIndex) {
  state.isOver = true;
  state.active = false;
  stopTimer();
  stopAfkTimer();

  const isWin = winnerIndex === multiplayerState.playerIndex;

  if (multiplayerState.lobbyRef) {
    await multiplayerState.lobbyRef.update({ status: 'finished' }).catch(() => {});
  }

  if (isWin) {
    createConfetti();
    playSound('win');
    vibrate([100, 50, 100, 50, 200]);
  } else {
    playSound('lose');
    vibrate([200, 100, 200]);
  }

  showGameResults(winnerIndex, isWin);
}
