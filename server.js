const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 15000,
  pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const PLAYER_COLORS = [
  '#00f0ff', '#ff2e93', '#39ff14', '#ffd600',
  '#a855f7', '#ff6b35', '#38bdf8', '#fb7185',
  '#4ade80', '#facc15', '#c084fc', '#2dd4bf'
];

// In-memory rooms store: code -> RoomState
const rooms = new Map();
const disconnectTimers = new Map(); // sessionId -> timeout

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getTotalPlayers() {
  let count = 0;
  for (const room of rooms.values()) {
    count += room.players.length;
  }
  return count;
}

app.use(express.static(path.join(__dirname, 'public')));

// Anti-Sleep & Health Check Endpoints
app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'alive',
    uptime: Math.floor(process.uptime()),
    rooms: rooms.size,
    players: getTotalPlayers(),
    timestamp: Date.now()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function sanitizeText(str, maxLen = 140) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function reassignColors(players) {
  players.forEach((p, idx) => {
    p.color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  });
}

function removePlayerFromRoom(roomCode, sessionId) {
  if (!roomCode || !rooms.has(roomCode)) return;
  const room = rooms.get(roomCode);
  const idx = room.players.findIndex(p => p.sessionId === sessionId);
  if (idx === -1) return;

  const [removed] = room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  if (removed.isHost) {
    const nextHost = room.players.find(p => p.connected) || room.players[0];
    nextHost.isHost = true;
    room.hostId = nextHost.id;
    io.to(roomCode).emit('chat_message', {
      sender: 'SYSTEM',
      text: `${nextHost.nickname} is now the room host.`,
      system: true
    });
  }

  reassignColors(room.players);

  io.to(roomCode).emit('chat_message', {
    sender: 'SYSTEM',
    text: `${removed.nickname} left the session.`,
    system: true
  });

  io.to(roomCode).emit('lobby_update', {
    players: room.players,
    hostId: room.hostId,
    selectedGame: room.selectedGame
  });
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ nickname, sessionId }) => {
    const cleanNick = sanitizeText(nickname, 18) || 'Player1';
    const sid = sanitizeText(sessionId, 64) || socket.id;
    const code = generateRoomCode();

    const hostPlayer = {
      id: socket.id,
      sessionId: sid,
      nickname: cleanNick,
      isHost: true,
      connected: true,
      score: 0,
      color: PLAYER_COLORS[0]
    };

    const room = {
      code,
      hostId: socket.id,
      players: [hostPlayer],
      selectedGame: 'judgment-court',
      activeGame: null,
      createdAt: Date.now()
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.sessionId = sid;
    socket.data.nickname = cleanNick;

    socket.emit('room_created', {
      code,
      playerId: socket.id,
      players: room.players,
      selectedGame: room.selectedGame
    });
  });

  socket.on('join_room', ({ nickname, code, sessionId }) => {
    const cleanNick = sanitizeText(nickname, 18) || 'Guest';
    const cleanCode = sanitizeText(code, 8).toUpperCase();
    const sid = sanitizeText(sessionId, 64) || socket.id;

    const room = rooms.get(cleanCode);
    if (!room) {
      socket.emit('join_error', { message: `Room "${cleanCode}" not found. Check the code and try again.` });
      return;
    }

    // Check if this sessionId is already in the room (reconnect)
    const existing = room.players.find(p => p.sessionId === sid);
    if (existing) {
      if (disconnectTimers.has(sid)) {
        clearTimeout(disconnectTimers.get(sid));
        disconnectTimers.delete(sid);
      }
      existing.id = socket.id;
      existing.nickname = cleanNick;
      existing.connected = true;
      if (existing.isHost) room.hostId = socket.id;

      socket.join(cleanCode);
      socket.data.roomCode = cleanCode;
      socket.data.sessionId = sid;
      socket.data.nickname = cleanNick;

      socket.emit('room_joined', {
        code: cleanCode,
        playerId: socket.id,
        players: room.players,
        selectedGame: room.selectedGame,
        activeGame: room.activeGame,
        isHost: existing.isHost
      });

      io.to(cleanCode).emit('lobby_update', {
        players: room.players,
        hostId: room.hostId,
        selectedGame: room.selectedGame
      });
      return;
    }

    if (room.players.length >= 12) {
      socket.emit('join_error', { message: 'Room is full (max 12 players).' });
      return;
    }

    const newPlayer = {
      id: socket.id,
      sessionId: sid,
      nickname: cleanNick,
      isHost: false,
      connected: true,
      score: 0,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length]
    };

    room.players.push(newPlayer);
    socket.join(cleanCode);
    socket.data.roomCode = cleanCode;
    socket.data.sessionId = sid;
    socket.data.nickname = cleanNick;

    socket.emit('room_joined', {
      code: cleanCode,
      playerId: socket.id,
      players: room.players,
      selectedGame: room.selectedGame,
      activeGame: room.activeGame,
      isHost: false
    });

    io.to(cleanCode).emit('lobby_update', {
      players: room.players,
      hostId: room.hostId,
      selectedGame: room.selectedGame
    });

    io.to(cleanCode).emit('chat_message', {
      sender: 'SYSTEM',
      text: `${cleanNick} joined the session!`,
      system: true
    });
  });

  socket.on('select_game', ({ gameType }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.selectedGame = gameType;
    socket.to(roomCode).emit('game_selected', { gameType });
  });

  socket.on('start_game', ({ gameType }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.activeGame = gameType;
    io.to(roomCode).emit('game_started', { gameType });
  });

  socket.on('exit_game', () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.activeGame = null;
    io.to(roomCode).emit('game_exited');
  });

  socket.on('chat_message', ({ text, system }) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    const cleanText = sanitizeText(text, 200);
    if (!cleanText) return;

    const player = room.players.find(p => p.id === socket.id);
    io.to(roomCode).emit('chat_message', {
      sender: system ? 'SYSTEM' : (player ? player.nickname : 'Unknown'),
      senderId: socket.id,
      color: player ? player.color : '#00f0ff',
      text: cleanText,
      system: Boolean(system)
    });
  });

  socket.on('game_data', ({ payload, includeSelf, targetId }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    if (targetId) {
      io.to(targetId).emit('game_data', {
        senderId: socket.id,
        payload
      });
    } else if (includeSelf) {
      io.to(roomCode).emit('game_data', {
        senderId: socket.id,
        payload
      });
    } else {
      socket.to(roomCode).emit('game_data', {
        senderId: socket.id,
        payload
      });
    }
  });

  socket.on('leave_room', () => {
    const roomCode = socket.data.roomCode;
    const sid = socket.data.sessionId;
    if (!roomCode || !sid) return;

    if (disconnectTimers.has(sid)) {
      clearTimeout(disconnectTimers.get(sid));
      disconnectTimers.delete(sid);
    }
    socket.leave(roomCode);
    socket.data.roomCode = null;
    removePlayerFromRoom(roomCode, sid);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    const sid = socket.data.sessionId;
    if (!roomCode || !sid || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    const player = room.players.find(p => p.sessionId === sid);
    if (!player) return;

    player.connected = false;
    io.to(roomCode).emit('lobby_update', {
      players: room.players,
      hostId: room.hostId,
      selectedGame: room.selectedGame
    });

    // Grace period of 45s for mobile screen lock / quick refresh before kicking
    const timer = setTimeout(() => {
      disconnectTimers.delete(sid);
      removePlayerFromRoom(roomCode, sid);
    }, 45000);
    disconnectTimers.set(sid, timer);
  });
});

server.listen(PORT, () => {
  console.log(`Antigravity Game Share server running on port ${PORT}`);

  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
  if (externalUrl) {
    const pingUrl = `${externalUrl.replace(/\/$/, '')}/ping`;
    console.log(`Anti-sleep keep-alive enabled for: ${pingUrl}`);
    setInterval(async () => {
      try {
        const res = await fetch(pingUrl);
        console.log(`[Keep-Alive] Pinged ${pingUrl} -> ${res.status}`);
      } catch (err) {
        console.warn('[Keep-Alive] Ping failed:', err.message);
      }
    }, 10 * 60 * 1000);
  }
});
