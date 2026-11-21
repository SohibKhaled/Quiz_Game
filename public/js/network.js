// Socket.IO Real-Time Multiplayer Network Manager with Auto-Reconnect & Session Persistence
const NetworkManager = (function() {
  let socket = null;
  let isHostFlag = false;
  let roomCode = '';
  let nickname = '';
  let players = [];
  let myId = '';

  // Persistent sessionId per browser tab so brief disconnects/refreshes keep the player's seat
  let sessionId = sessionStorage.getItem('ag_session_id');
  if (!sessionId) {
    sessionId = 'sid_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    sessionStorage.setItem('ag_session_id', sessionId);
  }

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
      reconnectionAttempts: 15,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000
    });

    socket.on('connect', () => {
      myId = socket.id;
      if (roomCode && nickname) {
        // Automatically rejoin room if we were already in one
        socket.emit('join_room', { nickname, code: roomCode, sessionId });
      } else {
        handlers.onStatusChange('Connected to Server', true);
      }
    });

    socket.on('disconnect', () => {
      handlers.onStatusChange('Reconnecting...', false);
    });

    socket.on('room_created', (data) => {
      roomCode = data.code;
      myId = data.playerId;
      players = data.players;
      isHostFlag = true;
      sessionStorage.setItem('ag_active_room', roomCode);
      handlers.onStatusChange(`Hosting: ${roomCode}`, true);
      handlers.onRoomCreated(roomCode, data.selectedGame);
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
    });

    socket.on('room_joined', (data) => {
      roomCode = data.code;
      myId = data.playerId;
      players = data.players;
      isHostFlag = Boolean(data.isHost);
      sessionStorage.setItem('ag_active_room', roomCode);
      handlers.onStatusChange(`In Room: ${roomCode}`, true);
      handlers.onJoined(data.selectedGame, data.activeGame);
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
    });

    socket.on('join_error', (data) => {
      roomCode = '';
      sessionStorage.removeItem('ag_active_room');
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
      s.emit('create_room', { nickname, sessionId });
    },

    joinRoom: function(userNickname, code) {
      nickname = userNickname || 'Guest';
      roomCode = code.toUpperCase().trim();
      const s = ensureSocket();
      s.emit('join_room', { nickname, code: roomCode, sessionId });
    },

    sendChat: function(text) {
      if (!text || !text.trim() || !socket) return;
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
      sessionStorage.removeItem('ag_active_room');
      handlers.onStatusChange('Connected to Server', true);
    },

    getInviteUrl: function() {
      return roomCode ? `${window.location.origin}/?room=${roomCode}` : window.location.origin;
    },

    isHost: function() { return isHostFlag; },
    getRoomCode: function() { return roomCode; },
    getPlayers: function() { return players; },
    getMyId: function() { return myId; },
    getNickname: function() { return nickname; }
  };
})();
