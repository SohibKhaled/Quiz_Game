// Socket.IO Real-Time Multiplayer Network Manager
const NetworkManager = (function() {
  let socket = null;
  let isHostFlag = false;
  let roomCode = '';
  let nickname = '';
  let players = [];
  let myId = '';

  const handlers = {
    onStatusChange: () => {},
    onPlayerUpdate: () => {},
    onChatMessage: () => {},
    onGameSelected: () => {},
    onGameStart: () => {},
    onGameData: () => {},
    onGameExit: () => {},
    onRoomCreated: () => {},
    onJoined: () => {},
    onError: () => {}
  };

  function ensureSocket() {
    if (socket && socket.connected) return socket;
    if (socket) {
      socket.connect();
      return socket;
    }

    socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      myId = socket.id;
      handlers.onStatusChange('Connected to Server', true);
    });

    socket.on('disconnect', () => {
      handlers.onStatusChange('Reconnecting...', false);
    });

    socket.on('room_created', (data) => {
      roomCode = data.code;
      myId = data.playerId;
      players = data.players;
      isHostFlag = true;
      handlers.onStatusChange(`Hosting: ${roomCode}`, true);
      handlers.onRoomCreated(roomCode, data.selectedGame);
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
    });

    socket.on('room_joined', (data) => {
      roomCode = data.code;
      myId = data.playerId;
      players = data.players;
      isHostFlag = false;
      handlers.onStatusChange(`In Room: ${roomCode}`, true);
      handlers.onJoined(data.selectedGame, data.activeGame);
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
    });

    socket.on('join_error', (data) => {
      handlers.onError(data.message || 'Could not join room.');
    });

    socket.on('lobby_update', (data) => {
      players = data.players;
      isHostFlag = (data.hostId === myId);
      handlers.onPlayerUpdate(players);
    });

    socket.on('chat_message', (data) => {
      handlers.onChatMessage(data.sender, data.text, data.system, data.color);
    });

    socket.on('game_selected', (data) => {
      handlers.onGameSelected(data.gameType);
    });

    socket.on('game_started', (data) => {
      handlers.onGameStart(data.gameType);
    });

    socket.on('game_exited', () => {
      handlers.onGameExit();
    });

    socket.on('game_data', (data) => {
      handlers.onGameData(data.senderId, data.payload);
    });

    return socket;
  }

  return {
    registerHandler: function(event, callback) {
      if (Object.prototype.hasOwnProperty.call(handlers, event)) {
        handlers[event] = callback;
      }
    },

    hostRoom: function(userNickname) {
      nickname = userNickname || 'Host';
      const s = ensureSocket();
      s.emit('create_room', { nickname });
    },

    joinRoom: function(userNickname, code) {
      nickname = userNickname || 'Guest';
      roomCode = code.toUpperCase().trim();
      const s = ensureSocket();
      s.emit('join_room', { nickname, code: roomCode });
    },

    sendChat: function(text) {
      if (!text || !text.trim() || !socket) return;
      // Support legacy "SYSTEM: ..." calls from games
      if (text.startsWith('SYSTEM:')) {
        socket.emit('chat_message', { text: text.replace(/^SYSTEM:\s*/, ''), system: true });
      } else {
        socket.emit('chat_message', { text, system: false });
      }
    },

    selectGame: function(gameType) {
      if (!isHostFlag || !socket) return;
      socket.emit('select_game', { gameType });
    },

    startGame: function(gameType) {
      if (!isHostFlag || !socket) return;
      socket.emit('start_game', { gameType });
    },

    exitGame: function() {
      if (!socket) return;
      socket.emit('exit_game');
    },

    sendGameData: function(payload, includeSelf = false) {
      if (!socket) return;
      socket.emit('game_data', { payload, includeSelf });
    },

    broadcastGameData: function(payload, includeSelf = false) {
      if (!socket) return;
      socket.emit('game_data', { payload, includeSelf });
    },

    sendToPlayer: function(targetId, payload) {
      if (!socket) return;
      socket.emit('game_data', { payload, targetId });
    },

    leaveRoom: function() {
      if (socket) {
        socket.emit('leave_room');
      }
      isHostFlag = false;
      roomCode = '';
      players = [];
      handlers.onStatusChange('Connected to Server', true);
    },

    isHost: function() { return isHostFlag; },
    getRoomCode: function() { return roomCode; },
    getPlayers: function() { return players; },
    getMyId: function() { return myId; },
    getNickname: function() { return nickname; }
  };
})();
