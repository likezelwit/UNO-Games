const Game = {
  GameLogic: {
    createDeck: () => {
      let deck = [];
      COLORS.forEach(color => {
        deck.push({ c: color, v: '0' });
        for (let i = 1; i <= 9; i++) { deck.push({ c: color, v: i.toString() }); deck.push({ c: color, v: i.toString() }); }
        SPECIAL_VALUES.forEach(value => { deck.push({ c: color, v: value }); deck.push({ c: color, v: value }); });
      });
      for (let i = 0; i < 4; i++) { deck.push({ c: 'black', v: 'W' }); deck.push({ c: 'black', v: '+4' }); }
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
      if (!multiplayerState.gameRef && !multiplayerState.isHost && state.players[playerIndex].isBot) return; // Basic check
      const player = state.players[playerIndex];
      if (!player) return;
      const card = player.hand.splice(cardIndex, 1)[0];
      state.discard.push(card);

      // Stacking Logic
      if (gameSettings.stacking) {
        if (card.v === '+2') { state.drawStack += 2; state.stackType = '+2'; }
        else if (card.v === '+4') { state.drawStack += 4; state.stackType = '+4'; }
        else { state.drawStack = 0; state.stackType = null; }
      }

      // Wild Card Handling
      if (card.c === 'black') {
        if (playerIndex === multiplayerState.playerIndex) {
          state.pendingWild = card;
          GameUI.showColorPicker();
          GameUI.updateBoard(); return;
        } else {
          // Bot Wild Color
          const color = Game.AI.chooseColor(playerIndex);
          state.activeColor = color;
          GameUI.showMessage(player.name + " chose " + color.toUpperCase());
        }
      } else {
        state.activeColor = card.c;
      }

      // Win Condition
      if (player.hand.length === 0) {
        await Game.GameLogic.endGame(playerIndex);
        return;
      }

      if (player.hand.length === 1) state.saidUno.add(playerIndex);

      await Game.GameLogic.applyCardEffect(card, playerIndex);
      await Game.GameLogic.advanceTurn();
      GameUI.updateBoard();
    },

    applyCardEffect: async (card, currentPlayerIndex) => {
      const nextIdx = Game.GameLogic.getNextPlayerIndex();
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

      if (state.drawStack > 0 && gameSettings.stacking) {
        const canStack = nextPlayer.hand.some(c => Game.GameLogic.canStackCard(c));
        if (!canStack) {
          const drawn = Game.GameLogic.drawCards(state.drawStack);
          nextPlayer.hand.push(...drawn);
          GameUI.showMessage(nextPlayer.name + ' drew ' + state.drawStack + ' cards!');
          state.drawStack = 0; state.stackType = null; state.turn = nextIdx;
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
      state.turn = Game.GameLogic.getNextPlayerIndex();
      if (multiplayerState.gameRef) {
        const updates = {
          turn: state.turn, direction: state.direction, discard: state.discard,
          deck: state.deck, activeColor: state.activeColor, drawStack: state.drawStack,
          stackType: state.stackType, playerHands: {}
        };
        state.players.forEach(p => updates.playerHands[p.id] = p.hand);
        await multiplayerState.gameRef.update(updates);
      }
      GameUI.updateBoard();
      const currentPlayer = state.players[state.turn];
      if (currentPlayer && currentPlayer.isBot) {
        setTimeout(botTurn, 800 + Math.random() * 500);
      } else if (state.turn === multiplayerState.playerIndex) {
        GameUI.startTimer(); vibrate(100);
      } else {
        GameUI.stopTimer();
      }
    },

    selectWildColor: async (color) => {
      state.activeColor = color;
      GameUI.hideColorPicker();
      if (multiplayerState.gameRef) await multiplayerState.gameRef.update({ activeColor: color });
      await Game.GameLogic.applyCardEffect(state.pendingWild, multiplayerState.playerIndex);
      state.pendingWild = null;
      await Game.GameLogic.advanceTurn();
      playSound('wild');
    },

    endGame: async (winnerIndex) => {
      state.isOver = true; state.active = false; GameUI.stopTimer();
      const isWin = winnerIndex === multiplayerState.playerIndex;
      if (multiplayerState.lobbyRef) await multiplayerState.lobbyRef.update({ status: 'finished' });
      GameUI.showGameOver(winnerIndex, isWin);
    }
  },

  Lobby: {
    create: async () => {
      const nameInput = document.getElementById('host-name');
      const activeMode = document.querySelector('#create-lobby-modal .mode-btn.active');
      const activeCount = document.querySelector('#create-lobby-modal .count-btn.active');
      
      multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
      multiplayerState.gameMode = activeMode?.dataset.mode || 'classic';
      multiplayerState.maxPlayers = parseInt(activeCount?.dataset.count) || 4;
      multiplayerState.isHost = true;
      multiplayerState.playerId = 'player_' + Date.now();
      
      const roomCode = generateRoomCode();
      multiplayerState.lobbyId = roomCode;
      
      GameUI.closeCreateLobby();
      showScreen('lobby-room');
      
      const lobbyRef = database.ref('lobbies/' + roomCode);
      multiplayerState.lobbyRef = lobbyRef;
      
      const lobbyData = {
        hostId: multiplayerState.playerId,
        hostName: multiplayerState.playerName,
        gameMode: multiplayerState.gameMode,
        maxPlayers: multiplayerState.maxPlayers,
        status: 'waiting',
        players: {
          [multiplayerState.playerId]: {
            name: multiplayerState.playerName, isHost: true, isReady: true, isBot: false
          }
        },
        playerOrder: [multiplayerState.playerId]
      };
      
      try {
        await lobbyRef.set(lobbyData);
        multiplayerState.playerIndex = 0;
        GameUI.updateLobbyUI();
        Game.Lobby.setupListeners();
        playSound('join');
        showToast('Lobby created: ' + roomCode);
      } catch (error) {
        console.error(error); showToast('Failed to create lobby'); showScreen('menu-screen');
      }
    },

    joinByCode: async () => {
      const nameInput = document.getElementById('join-name');
      const codeInput = document.getElementById('room-code-input');
      multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
      const roomCode = codeInput?.value?.toUpperCase().trim();
      
      if (!roomCode || roomCode.length < 5) { showToast('Invalid code'); return; }
      
      await Game.Lobby.joinRoom(roomCode);
    },

    joinRoom: async (lobbyId) => {
      multiplayerState.playerId = 'player_' + Date.now();
      multiplayerState.lobbyId = lobbyId;
      multiplayerState.isHost = false;
      
      GameUI.closeJoinLobby();
      showScreen('lobby-room');
      
      const lobbyRef = database.ref('lobbies/' + lobbyId);
      multiplayerState.lobbyRef = lobbyRef;
      
      try {
        const snapshot = await lobbyRef.once('value');
        const data = snapshot.val();
        if (!data || data.status !== 'waiting') { showToast('Lobby not available'); showScreen('menu-screen'); return; }
        
        const updates = {};
        updates['/players/' + multiplayerState.playerId] = {
          name: multiplayerState.playerName, isHost: false, isReady: true, isBot: false
        };
        const newOrder = [...(data.playerOrder || []), multiplayerState.playerId];
        updates['/playerOrder'] = newOrder;
        
        await lobbyRef.update(updates);
        multiplayerState.playerIndex = newOrder.length - 1;
        multiplayerState.gameMode = data.gameMode;
        multiplayerState.maxPlayers = data.maxPlayers;
        
        GameUI.updateLobbyUI();
        Game.Lobby.setupListeners();
        playSound('join');
      } catch (e) { console.error(e); showToast('Failed to join'); showScreen('menu-screen'); }
    },

    setupListeners: () => {
      if (!multiplayerState.lobbyRef) return;
      multiplayerState.lobbyRef.child('players').on('value', (s) => {
        const players = s.val();
        if(players) multiplayerState.lobbyRef.child('playerOrder').once('value').then(orderSnap => {
            GameUI.renderLobbyPlayers(players, orderSnap.val() || Object.keys(players));
            GameUI.updateStartButton(players, orderSnap.val());
          });
      });
      
      multiplayerState.lobbyRef.child('status').on('value', (s) => {
        if (s.val() === 'playing') Game.Lobby.startGameSync();
      });
    },

    startGame: async () => {
      if (!multiplayerState.isHost) return;
      const deck = Game.GameLogic.createDeck();
      const startCard = deck.pop();
      
      // Simple start card check
      while(startCard.c === 'black') {
          deck.unshift(startCard);
          shuffle(deck);
          startCard = deck.pop();
      }

      // Distribute cards
      const playerHands = {};
      const snapshot = await multiplayerState.lobbyRef.once('value');
      const lobbyData = snapshot.val();
      
      lobbyData.playerOrder.forEach(pid => {
          playerHands[pid] = [];
          for(let i=0; i<7; i++) playerHands[pid].push(deck.pop());
      });

      const gameData = {
        deck, discard: [startCard], activeColor: startCard.c,
        turn: 0, direction: 1, drawStack: 0, stackType: null,
        playerOrder: lobbyData.playerOrder, playerHands,
        playerData: lobbyData.players, status: 'playing'
      };
      
      await multiplayerState.lobbyRef.update({ status: 'playing' });
      await multiplayerState.lobbyRef.child('game').set(gameData);
      playSound('start');
    },

    startGameSync: () => {
      showScreen('game-app');
      initAudio();
      multiplayerState.gameRef = multiplayerState.lobbyRef.child('game');
      
      multiplayerState.gameRef.on('value', (s) => {
        const data = s.val();
        if(!data) return;
        
        const playerOrder = data.playerOrder;
        const myIdx = playerOrder.indexOf(multiplayerState.playerId);
        multiplayerState.playerIndex = myIdx;
        
        state.players = playerOrder.map((pid, idx) => ({
            id: pid, name: data.playerData[pid].name,
            hand: data.playerHands[pid] || [],
            isBot: data.playerData[pid].isBot || false
        }));
        
        state.deck = data.deck || [];
        state.discard = data.discard || [];
        state.activeColor = data.activeColor || 'red';
        state.turn = data.turn || 0;
        state.direction = data.direction || 1;
        state.drawStack = data.drawStack || 0;
        state.active = true;
        state.isOver = false;
        
        GameUI.updateBoard();
        
        if (state.turn === myIdx && !state.players[myIdx].isBot) {
            GameUI.startTimer(); vibrate(100);
        } else {
            GameUI.stopTimer();
            if(state.players[state.turn].isBot) setTimeout(botTurn, 1000);
        }
      });
    },

    leave: async () => {
      if (multiplayerState.lobbyRef) {
        multiplayerState.lobbyRef.off();
        if (multiplayerState.playerId) {
             // Remove self from order if host logic is complex, for now simple reload/reset
             multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
        }
      }
      multiplayerState.lobbyRef = null; multiplayerState.gameRef = null;
      location.reload(); // Simple reload to clear state for demo
    },
    
    rematch: async () => {
       // Simple implementation: leave and re-create
       // In a full app, reset the game node in DB
       const modal = document.getElementById('game-over');
       if(modal) modal.classList.remove('active');
       if(multiplayerState.isHost) {
          await multiplayerState.lobbyRef.update({ status: 'waiting', game: null });
          showScreen('lobby-room');
          Game.Lobby.setupListeners();
       } else {
          Game.Lobby.leave();
       }
    }
  },

  QuickMatch: {
    start: () => {
      showToast('Searching for match...');
      // Simulate search then create/join
      setTimeout(() => {
          Game.Lobby.create(); // For demo, just create a lobby
      }, 1000);
    }
  }
};
