const Lobby = {
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
                    name: multiplayerState.playerName,
                    isHost: true,
                    isReady: true,
                    isBot: false
                }
            },
            playerOrder: [multiplayerState.playerId]
        };

        try {
            await lobbyRef.set(lobbyData);
            multiplayerState.playerIndex = 0;
            GameUI.updateLobbyUI();
            Lobby.setupListeners();
            playSound('join');
            showToast('Lobby created: ' + roomCode);
        } catch (error) {
            console.error(error);
            showToast('Failed to create lobby');
            showScreen('menu-screen');
        }
    },

    joinByCode: async () => {
        const nameInput = document.getElementById('join-name');
        const codeInput = document.getElementById('room-code-input');
        multiplayerState.playerName = nameInput?.value?.trim() || 'Player';
        const roomCode = codeInput?.value?.toUpperCase().trim();

        if (!roomCode || roomCode.length < 5) {
            showToast('Invalid code');
            return;
        }

        await Lobby.joinRoom(roomCode);
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

            if (!data || data.status !== 'waiting') {
                showToast('Lobby not available');
                showScreen('menu-screen');
                return;
            }

            const updates = {};
            updates['/players/' + multiplayerState.playerId] = {
                name: multiplayerState.playerName,
                isHost: false,
                isReady: true,
                isBot: false
            };
            const newOrder = [...(data.playerOrder || []), multiplayerState.playerId];
            updates['/playerOrder'] = newOrder;

            await lobbyRef.update(updates);

            multiplayerState.playerIndex = newOrder.length - 1;
            multiplayerState.gameMode = data.gameMode;
            multiplayerState.maxPlayers = data.maxPlayers;

            GameUI.updateLobbyUI();
            Lobby.setupListeners();
            playSound('join');

        } catch (e) {
            console.error(e);
            showToast('Failed to join');
            showScreen('menu-screen');
        }
    },

    setupListeners: () => {
        if (!multiplayerState.lobbyRef) return;

        // Listen for player changes
        multiplayerState.lobbyRef.child('players').on('value', (s) => {
            const players = s.val();
            if (players) {
                multiplayerState.lobbyRef.child('playerOrder').once('value').then(orderSnap => {
                    GameUI.renderLobbyPlayers(players, orderSnap.val() || Object.keys(players));
                    GameUI.updateStartButton(players, orderSnap.val());
                });
            }
        });

        // Listen for game start
        multiplayerState.lobbyRef.child('status').on('value', (s) => {
            if (s.val() === 'playing') {
                Lobby.startGameSync();
            }
        });
    },

    startGame: async () => {
        if (!multiplayerState.isHost) return;

        const deck = GameEngine.createDeck();
        let startCard = deck.pop();

        // Pastikan kartu awal bukan Wild untuk simplifikasi
        while (startCard.c === 'black') {
            deck.unshift(startCard);
            shuffle(deck);
            startCard = deck.pop();
        }

        // Bagikan kartu
        const playerHands = {};
        const snapshot = await multiplayerState.lobbyRef.once('value');
        const lobbyData = snapshot.val();

        lobbyData.playerOrder.forEach(pid => {
            playerHands[pid] = [];
            for (let i = 0; i < 7; i++) {
                playerHands[pid].push(deck.pop());
            }
        });

        const gameData = {
            deck: deck,
            discard: [startCard],
            activeColor: startCard.c,
            turn: 0,
            direction: 1,
            drawStack: 0,
            stackType: null,
            playerOrder: lobbyData.playerOrder,
            playerHands: playerHands,
            playerData: lobbyData.players,
            status: 'playing'
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
            if (!data) return;

            const playerOrder = data.playerOrder;
            const myIdx = playerOrder.indexOf(multiplayerState.playerId);
            multiplayerState.playerIndex = myIdx;

            // Rebuild Players State
            state.players = playerOrder.map((pid, idx) => ({
                id: pid,
                name: data.playerData[pid].name,
                hand: data.playerHands[pid] || [],
                isBot: data.playerData[pid].isBot || false
            }));

            // Sync Game State
            state.deck = data.deck || [];
            state.discard = data.discard || [];
            state.activeColor = data.activeColor || 'red';
            state.turn = data.turn || 0;
            state.direction = data.direction || 1;
            state.drawStack = data.drawStack || 0;
            state.active = true;
            state.isOver = false;

            // Update UI
            GameUI.updateBoard();

            // Trigger Turn Logic
            if (state.turn === myIdx && !state.players[myIdx].isBot) {
                GameUI.startTimer();
                vibrate(100);
            } else {
                GameUI.stopTimer();
                if (state.players[state.turn] && state.players[state.turn].isBot) {
                    setTimeout(botTurn, 1000);
                }
            }
        });
    },

    leave: async () => {
        if (multiplayerState.lobbyRef) {
            multiplayerState.lobbyRef.off();
            if (multiplayerState.playerId) {
                multiplayerState.lobbyRef.child('players/' + multiplayerState.playerId).remove();
            }
        }
        multiplayerState.lobbyRef = null;
        multiplayerState.gameRef = null;
        location.reload(); 
    },

    rematch: async () => {
        const modal = document.getElementById('game-over');
        if (modal) modal.classList.remove('active');
        
        if (multiplayerState.isHost) {
            await multiplayerState.lobbyRef.update({ status: 'waiting', game: null });
            showScreen('lobby-room');
            Lobby.setupListeners();
        } else {
            Lobby.leave();
        }
    }
};
