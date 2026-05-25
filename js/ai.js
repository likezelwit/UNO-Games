// ==================== BOT AI ====================

async function botTurn() {
  if (state.isOver || !state.active) return;

  const player = state.players[state.turn];
  if (!player || !player.isBot) return;

  // Small human-like delay
  await sleep(600 + Math.random() * 600);

  // If there's a pending draw stack, try to stack or draw
  if (state.drawStack > 0 && gameSettings.stacking) {
    const stackIdx = player.hand.findIndex(c => canStackCard(c));
    if (stackIdx !== -1) {
      showGameMessage(player.name + ' stacks!');
      await playCard(state.turn, stackIdx);
    } else {
      const drawn = drawCards(state.drawStack);
      player.hand.push(...drawn);
      showGameMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      playSound('draw');
      state.drawStack = 0;
      state.stackType = null;
      await advanceTurn();
    }
    return;
  }

  // Find valid moves
  const validMoves = [];
  player.hand.forEach((card, index) => {
    if (checkValidPlay(card)) validMoves.push({ card, index });
  });

  if (validMoves.length > 0) {
    // Sort by priority: prefer action / wild cards
    validMoves.sort((a, b) => getCardPriority(b.card) - getCardPriority(a.card));
    await playCard(state.turn, validMoves[0].index);
  } else {
    // Draw one card
    const drawn = drawCards(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      showGameMessage(player.name + ' drew a card');
      playSound('draw');
      await sleep(400);

      if (checkValidPlay(drawn[0])) {
        // Play the just-drawn card if it's valid
        await playCard(state.turn, player.hand.length - 1);
      } else {
        await advanceTurn();
      }
    } else {
      // No cards left in deck either
      await advanceTurn();
    }
  }
}

function getCardPriority(card) {
  if (card.v === '+4') return 20;
  if (card.v === '+2') return 18;
  if (card.v === 'S')  return 15;
  if (card.v === 'R')  return 14;
  if (card.v === 'W')  return 10;
  return parseInt(card.v) || 5;
}

// Choose the color the bot has most of
function chooseColor(playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return 'red';
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  player.hand.forEach(c => { if (c.c !== 'black') counts[c.c]++; });
  return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
}
