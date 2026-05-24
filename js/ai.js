async function botTurn() {
  if (state.isOver || !state.active) return;
  const player = state.players[state.turn];
  if (!player || !player.isBot) return;

  // Handle Stacking
  if (state.drawStack > 0 && gameSettings.stacking) {
    const stackCardIdx = player.hand.findIndex(c => Game.GameLogic.canStackCard(c));
    if (stackCardIdx !== -1) {
      GameUI.showMessage(player.name + ' stacks!');
      await Game.GameLogic.playCard(state.turn, stackCardIdx);
      return;
    } else {
      const drawn = Game.GameLogic.drawCards(state.drawStack);
      player.hand.push(...drawn);
      GameUI.showMessage(player.name + ' drew ' + state.drawStack + ' cards!');
      state.drawStack = 0; state.stackType = null;
      await Game.GameLogic.advanceTurn();
      return;
    }
  }

  // Normal Play
  let validMoves = [];
  player.hand.forEach((card, index) => {
    if (Game.GameLogic.checkValidPlay(card)) validMoves.push({ card, index });
  });

  if (validMoves.length > 0) {
    validMoves.sort((a, b) => getCardPriority(b.card) - getCardPriority(a.card));
    await sleep(300 + Math.random() * 400);
    await Game.GameLogic.playCard(state.turn, validMoves[0].index);
  } else {
    const drawn = Game.GameLogic.drawCards(1);
    if (drawn.length > 0) {
      player.hand.push(drawn[0]);
      GameUI.showMessage(player.name + ' drew a card');
      playSound('draw');
      if (Game.GameLogic.checkValidPlay(drawn[0])) {
        await sleep(400);
        await Game.GameLogic.playCard(state.turn, player.hand.length - 1);
      } else {
        await Game.GameLogic.advanceTurn();
      }
    } else {
      await Game.GameLogic.advanceTurn();
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
