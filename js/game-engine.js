const GameEngine = {
    createDeck: () => {
        let deck = [];
        COLORS.forEach(color => {
            deck.push({ c: color, v: '0' });
            for (let i = 1; i <= 9; i++) {
                deck.push({ c: color, v: i.toString() });
                deck.push({ c: color, v: i.toString() });
            }
            SPECIAL_VALUES.forEach(value => {
                deck.push({ c: color, v: value });
                deck.push({ c: color, v: value });
            });
        });
        for (let i = 0; i < 4; i++) {
            deck.push({ c: 'black', v: 'W' });
            deck.push({ c: 'black', v: '+4' });
        }
        return shuffle(deck);
    },

    checkValidPlay: (card) => {
        const top = state.discard[state.discard.length - 1];
        if (!top) return true;
        if (card.c === 'black') return true;
        if (card.c === state.activeColor) return true;
        if (card.v === top.v) return true;
        return false;
    },

    canStackCard: (card) => {
        if (!gameSettings.stacking) return false;
        if (state.stackType === '+2') return card.v === '+2' || card.v === '+4';
        if (state.stackType === '+4') return card.v === '+4';
        return false;
    },

    drawCards: (count) => {
        count = Math.max(0, Math.floor(count));
        let drawn = [];
        for (let i = 0; i < count; i++) {
            if (state.deck.length === 0) {
                if (state.discard.length <= 1) break;
                const topCard = state.discard.pop();
                state.deck = shuffle(state.discard);
                state.discard = [topCard];
            }
            if (state.deck.length > 0) drawn.push(state.deck.pop());
        }
        return drawn;
    },

    playCard: async (playerIndex, cardIndex) => {
        const player = state.players[playerIndex];
        if (!player) return;

        // Hapus kartu dari tangan
        const card = player.hand.splice(cardIndex, 1)[0];
        state.discard.push(card);

        // Logika Stacking
        if (gameSettings.stacking) {
            if (card.v === '+2') {
                state.drawStack += 2;
                state.stackType = '+2';
            } else if (card.v === '+4') {
                state.drawStack += 4;
                state.stackType = '+4';
            } else {
                state.drawStack = 0;
                state.stackType = null;
            }
        }

        // Logika Wild Card
        if (card.c === 'black') {
            if (playerIndex === multiplayerState.playerIndex) {
                state.pendingWild = card;
                GameUI.showColorPicker(); // Panggil UI
                GameUI.updateBoard();
                return; // Stop di sini, tunggu user pilih warna
            } else {
                // Bot pilih warna otomatis
                // Kita butuh fungsi helper, kita panggil langsung logic simple di sini
                const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
                player.hand.forEach(c => { if (c.c !== 'black') counts[c.c]++; });
                const bestColor = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                state.activeColor = bestColor;
                GameUI.showMessage(player.name + " chose " + bestColor.toUpperCase());
            }
        } else {
            state.activeColor = card.c;
        }

        // Cek Menang
        if (player.hand.length === 0) {
            await GameEngine.endGame(playerIndex);
            return;
        }

        if (player.hand.length === 1) state.saidUno.add(playerIndex);

        // Efek Kartu (Skip, Reverse)
        await GameEngine.applyCardEffect(card, playerIndex);

        // Lanjut Giliran
        await GameEngine.advanceTurn();

        // Update UI
        GameUI.updateBoard();
    },

    applyCardEffect: async (card, currentPlayerIndex) => {
        const nextIdx = GameEngine.getNextPlayerIndex();
        const nextPlayer = state.players[nextIdx];

        if (state.drawStack === 0 || !gameSettings.stacking) {
            if (card.v === 'S') {
                GameUI.showMessage(nextPlayer.name + ' Skipped!');
                state.turn = nextIdx;
            } else if (card.v === 'R') {
                state.direction *= -1;
                GameUI.showMessage('Reversed!');
                if (state.players.length === 2) state.turn = nextIdx;
            }
        }

        // Cek apakah pemain berikutnya bisa nge-stack
        if (state.drawStack > 0 && gameSettings.stacking) {
            const canStack = nextPlayer.hand.some(c => GameEngine.canStackCard(c));
            if (!canStack) {
                const drawn = GameEngine.drawCards(state.drawStack);
                nextPlayer.hand.push(...drawn);
                GameUI.showMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
                state.drawStack = 0;
                state.stackType = null;
                state.turn = nextIdx;
            }
        }
    },

    getNextPlayerIndex: () => {
        let next = state.turn + state.direction;
        if (next >= state.players.length) next = 0;
        if (next < 0) next = state.players.length - 1;
        return next;
    },

    advanceTurn: async () => {
        state.turn = GameEngine.getNextPlayerIndex();

        // Simpan state ke Firebase jika ada
        if (multiplayerState.gameRef) {
            const updates = {
                turn: state.turn,
                direction: state.direction,
                discard: state.discard,
                deck: state.deck,
                activeColor: state.activeColor,
                drawStack: state.drawStack,
                stackType: state.stackType,
                playerHands: {}
            };
            state.players.forEach(p => updates.playerHands[p.id] = p.hand);
            await multiplayerState.gameRef.update(updates);
        }

        GameUI.updateBoard();

        const currentPlayer = state.players[state.turn];
        if (currentPlayer && currentPlayer.isBot) {
            setTimeout(botTurn, 800 + Math.random() * 500);
        } else if (state.turn === multiplayerState.playerIndex) {
            GameUI.startTimer();
            vibrate(100);
        } else {
            GameUI.stopTimer();
        }
    },

    selectWildColor: async (color) => {
        state.activeColor = color;
        GameUI.hideColorPicker();
        
        if (multiplayerState.gameRef) {
            await multiplayerState.gameRef.update({ activeColor: color });
        }

        // Lanjutkan efek kartu wild yang tertunda
        await GameEngine.applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
        state.pendingWild = null;
        await GameEngine.advanceTurn();
        
        playSound('wild');
    },

    endGame: async (winnerIndex) => {
        state.isOver = true;
        state.active = false;
        GameUI.stopTimer();

        const isWin = winnerIndex === multiplayerState.playerIndex;

        if (multiplayerState.lobbyRef) {
            await multiplayerState.lobbyRef.update({ status: 'finished' });
        }

        GameUI.showGameOver(winnerIndex, isWin);
    }
};
