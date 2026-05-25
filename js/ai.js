// ==================== BOT AI ====================
class BotAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  // Choose best card to play
  chooseCard(hand, topCard, currentColor, wildColor) {
    const playable = hand.filter(card => this.isPlayable(card, topCard, currentColor, wildColor));

    if (playable.length === 0) return null;

    switch(this.difficulty) {
      case 'easy':
        return playable[Math.floor(Math.random() * playable.length)];
      case 'hard':
        return this.chooseBestCard(playable, hand.length);
      case 'medium':
      default:
        return this.chooseMediumCard(playable, hand.length);
    }
  }

  isPlayable(card, topCard, currentColor, wildColor) {
    if (card.type === 'wild' || card.type === '+4') return true;
    if (card.color === currentColor) return true;
    if (topCard && card.color === topCard.color && card.type === topCard.type) return true;
    if (topCard && card.type === topCard.type && !['wild','+4'].includes(card.type)) return true;
    return false;
  }

  chooseBestCard(playable, handSize) {
    // Prioritize action cards, then high numbers, then matching color
    const priority = { '+4': 5, 'wild': 4, '+2': 3, 'skip': 3, 'reverse': 2 };

    playable.sort((a, b) => {
      const pa = priority[a.type] || (parseInt(a.type) || 0);
      const pb = priority[b.type] || (parseInt(b.type) || 0);
      return pb - pa;
    });

    // If hand is small, save wild cards
    if (handSize <= 2) {
      const nonWild = playable.filter(c => c.type !== 'wild' && c.type !== '+4');
      if (nonWild.length > 0) return nonWild[0];
    }

    return playable[0];
  }

  chooseMediumCard(playable, handSize) {
    // 70% chance to play best card, 30% random
    if (Math.random() < 0.7) {
      return this.chooseBestCard(playable, handSize);
    }
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // Choose color when playing wild
  chooseColor(hand) {
    const colorCounts = {};
    hand.forEach(card => {
      if (card.color && card.color !== 'wild') {
        colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
      }
    });

    if (Object.keys(colorCounts).length === 0) {
      return COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    // Return color with most cards
    return Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  // Decide whether to call UNO
  shouldCallUno(handSize) {
    if (handSize !== 1) return false;
    // 95% chance to call UNO
    return Math.random() < 0.95;
  }

  // Decide whether to challenge +4
  shouldChallenge(topCard, currentColor) {
    // Simple heuristic: challenge if we have many cards of current color
    return Math.random() < 0.3;
  }
}

// Create bot instances
function createBots(count, difficulty = 'medium') {
  const bots = [];
  for (let i = 0; i < count; i++) {
    bots.push({
      id: 'bot_' + i,
      name: BOT_NAMES[i % BOT_NAMES.length] + ' ' + (i + 1),
      avatar: BOT_AVATARS[i % BOT_AVATARS.length],
      isBot: true,
      ai: new BotAI(difficulty),
      hand: [],
      saidUno: false,
      score: 0
    });
  }
  return bots;
}