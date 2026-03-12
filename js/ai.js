// ==================== BOT AI ====================
async function botTurn() {
  if (state.isOver || !state.active) return;

  const player = state.players[state.turn];
  if (!player || !player.isBot) return;

  if (state.drawStack > 0 && gameSettings.stacking) {
    const stackCardIdx = player.hand.findIndex(c => canStackCard(c));
    if (stackCardIdx !== -1) {
      showGameMessage(player.name + ' stacks!');
      await playCard(state.turn, stackCardIdx);
      return;
    } else {
      const drawn = drawCards(state.drawStack);
      player.hand.push(...drawn);
      showGameMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0;
      state.stackType = null;
      await advanceTurn();
      return;
    }
  }

  let validMoves = [];
  player.hand.forEach((card, index) => {
    if (checkValidPlay(card)) validMoves.push({ card, index });
  });

  if (validMoves.length > 0) {
    validMoves.sort((a, b) => getCardPriority(b.card) - getCardPriority(a.card));

    await sleep(300 + Math.random() * 400);
    await playCard(state.turn, validMoves[0].index);
  } else {
    const drawn = drawCards(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      showGameMessage(player.name + ' drew a card');
      playSound('draw');

      if (checkValidPlay(drawn[0])) {
        await sleep(400);
        await playCard(state.turn, player.hand.length - 1);
      } else {
        await advanceTurn();
      }
    } else {
      await advanceTurn();
    }
  }
}

function getCardPriority(card) {
  if (card.v === '+4') return 20;
  if (card.v === '+2') return 18;
  if (card.v === 'S') return 15;
  if (card.v === 'R') return 14;
  if (card.v === 'W') return 10;
  return parseInt(card.v) || 5;
}

function chooseColor(playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return 'red';
  let counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  player.hand.forEach(c => { if (c.c !== 'black') counts[c.c]++; });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}
