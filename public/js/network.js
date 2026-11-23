// NetworkManager: Supports both Real-Time Socket.IO Multiplayer AND Single-Device Offline Pass & Play
const NetworkManager = (function() {
  let socket = null;
  let isHostFlag = false;
  let localMode = false;
  let roomCode = '';
  let nickname = '';
  let players = [];
  let myId = '';

  const PLAYER_COLORS = [
    '#00f0ff', '#ff2e93', '#39ff14', '#ffd600',
    '#a855f7', '#ff6b35', '#38bdf8', '#fb7185',
    '#4ade80', '#facc15', '#c084fc', '#2dd4bf'
  ];

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
    if (typeof io === 'undefined') {
      handlers.onError('Offline mode: use Single-Device Pass & Play!');
      return null;
    }
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
      if (localMode) return;
      myId = socket.id;
      if (roomCode && nickname) {
        socket.emit('join_room', { nickname, code: roomCode, sessionId });
      } else {
        handlers.onStatusChange('Connected to Server', true);
      }
    });

    socket.on('disconnect', () => {
      if (!localMode) handlers.onStatusChange('Reconnecting...', false);
    });

    socket.on('room_created', (data) => {
      localMode = false;
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
      localMode = false;
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
      if (localMode) return;
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

    // --- ONLINE MODE ---
    hostRoom: function(userNickname) {
      localMode = false;
      nickname = userNickname || 'Host';
      const s = ensureSocket();
      if (s) s.emit('create_room', { nickname, sessionId });
    },

    joinRoom: function(userNickname, code) {
      localMode = false;
      nickname = userNickname || 'Guest';
      roomCode = code.toUpperCase().trim();
      const s = ensureSocket();
      if (s) s.emit('join_room', { nickname, code: roomCode, sessionId });
    },

    // --- SINGLE-DEVICE PASS & PLAY (OFFLINE) MODE ---
    startLocalMode: function(initialNames) {
      if (socket && socket.connected) {
        socket.emit('leave_room');
      }
      localMode = true;
      isHostFlag = true;
      roomCode = 'LOCAL';
      const names = (initialNames && initialNames.length > 0) ? initialNames : ['لاعب 1', 'لاعب 2'];
      players = names.map((name, idx) => ({
        id: `local_${idx + 1}_${Date.now()}`,
        nickname: name.trim().slice(0, 18) || `لاعب ${idx + 1}`,
        isHost: idx === 0,
        connected: true,
        score: 0,
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length]
      }));
      myId = players[0].id;
      nickname = players[0].nickname;

      handlers.onStatusChange('Single Device (Offline Ready)', true);
      handlers.onRoomCreated('LOCAL', 'truth-dare');
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
    },

    addLocalPlayer: function(name) {
      if (!localMode || players.length >= 12) return false;
      const clean = (name || '').trim().slice(0, 18);
      if (!clean) return false;
      const idx = players.length;
      players.push({
        id: `local_${Date.now()}_${idx}`,
        nickname: clean,
        isHost: false,
        connected: true,
        score: 0,
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length]
      });
      handlers.onPlayerUpdate(players);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playJoin();
      return true;
    },

    removeLocalPlayer: function(playerId) {
      if (!localMode || players.length <= 1) return false;
      const idx = players.findIndex(p => p.id === playerId);
      if (idx === -1) return false;
      players.splice(idx, 1);
      players[0].isHost = true;
      if (myId === playerId) myId = players[0].id;
      players.forEach((p, i) => { p.color = PLAYER_COLORS[i % PLAYER_COLORS.length]; });
      handlers.onPlayerUpdate(players);
      return true;
    },

    sendChat: function(text) {
      if (!text || !text.trim()) return;
      if (localMode) {
        const isSys = text.startsWith('SYSTEM:');
        const clean = text.replace(/^SYSTEM:\s*/, '');
        const me = players.find(p => p.id === myId);
        handlers.onChatMessage(isSys ? 'SYSTEM' : (me ? me.nickname : 'Host'), clean, isSys, me ? me.color : '#00f0ff');
        return;
      }
      if (!socket) return;
      if (text.startsWith('SYSTEM:')) {
        socket.emit('chat_message', { text: text.replace(/^SYSTEM:\s*/, ''), system: true });
      } else {
        socket.emit('chat_message', { text, system: false });
      }
    },

    selectGame: function(gameType) {
      if (localMode || !isHostFlag || !socket) return;
      socket.emit('select_game', { gameType });
    },

    startGame: function(gameType) {
      if (localMode) {
        handlers.onGameStart(gameType);
        return;
      }
      if (!isHostFlag || !socket) return;
      socket.emit('start_game', { gameType });
    },

    exitGame: function() {
      if (localMode) {
        handlers.onGameExit();
        return;
      }
      if (!socket) return;
      socket.emit('exit_game');
    },

    sendGameData: function(payload, includeSelf = false) {
      if (localMode || !socket) return;
      socket.emit('game_data', { payload, includeSelf });
    },

    broadcastGameData: function(payload, includeSelf = false) {
      if (localMode || !socket) return;
      socket.emit('game_data', { payload, includeSelf });
    },

    sendToPlayer: function(targetId, payload) {
      if (localMode || !socket) return;
      socket.emit('game_data', { payload, targetId });
    },

    leaveRoom: function() {
      if (!localMode && socket) {
        socket.emit('leave_room');
      }
      localMode = false;
      isHostFlag = false;
      roomCode = '';
      players = [];
      sessionStorage.removeItem('ag_active_room');
      handlers.onStatusChange(socket && socket.connected ? 'Connected to Server' : 'Offline Ready', Boolean(socket && socket.connected));
    },

    getInviteUrl: function() {
      return (roomCode && !localMode) ? `${window.location.origin}/?room=${roomCode}` : window.location.origin;
    },

    isLocalMode: function() { return localMode; },
    isHost: function() { return isHostFlag; },
    getRoomCode: function() { return roomCode; },
    getPlayers: function() { return players; },
    getMyId: function() { return myId; },
    getNickname: function() { return nickname; }
  };
})();
