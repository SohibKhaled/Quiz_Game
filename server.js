const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 20000,
  pingTimeout: 25000
});

const PORT = process.env.PORT || 3000;
const PLAYER_COLORS = [
  '#00f0ff', '#ff007f', '#39ff14', '#ffff00',
  '#bd00ff', '#ff6b35', '#00e5ff', '#ff4081',
  '#76ff03', '#ffd600', '#e040fb', '#18ffff'
];

// In-memory rooms store: code -> RoomState
const rooms = new Map();

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

// Serve static frontend
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

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function sanitizeText(str, maxLen = 120) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function reassignColors(players) {
  players.forEach((p, idx) => {
    p.color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  });
}

function handlePlayerLeave(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode || !rooms.has(roomCode)) return;

  const room = rooms.get(roomCode);
  const idx = room.players.findIndex(p => p.id === socket.id);
  if (idx === -1) return;

  const [removed] = room.players.splice(idx, 1);
  socket.leave(roomCode);
  socket.data.roomCode = null;

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  // Promote next player to host if host left
  if (removed.isHost) {
    room.players[0].isHost = true;
    room.hostId = room.players[0].id;
    io.to(roomCode).emit('chat_message', {
      sender: 'SYSTEM',
      text: `${room.players[0].nickname} is now the room host.`,
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
  socket.on('create_room', ({ nickname }) => {
    const cleanNick = sanitizeText(nickname, 18) || 'Player1';
    const code = generateRoomCode();

    const hostPlayer = {
      id: socket.id,
      nickname: cleanNick,
      isHost: true,
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
    socket.data.nickname = cleanNick;

    socket.emit('room_created', {
      code,
      playerId: socket.id,
      players: room.players,
      selectedGame: room.selectedGame
    });
  });

  socket.on('join_room', ({ nickname, code }) => {
    const cleanNick = sanitizeText(nickname, 18) || 'Guest';
    const cleanCode = sanitizeText(code, 8).toUpperCase();

    const room = rooms.get(cleanCode);
    if (!room) {
      socket.emit('join_error', { message: `Room "${cleanCode}" not found. Check the code and try again.` });
      return;
    }

    if (room.players.length >= 12) {
      socket.emit('join_error', { message: 'Room is full (max 12 players).' });
      return;
    }

    const newPlayer = {
      id: socket.id,
      nickname: cleanNick,
      isHost: false,
      score: 0,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length]
    };

    room.players.push(newPlayer);
    socket.join(cleanCode);
    socket.data.roomCode = cleanCode;
    socket.data.nickname = cleanNick;

    socket.emit('room_joined', {
      code: cleanCode,
      playerId: socket.id,
      players: room.players,
      selectedGame: room.selectedGame,
      activeGame: room.activeGame
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
    handlePlayerLeave(socket);
  });

  socket.on('disconnect', () => {
    handlePlayerLeave(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Antigravity Game Share server running on port ${PORT}`);

  // Built-in Anti-Sleep Self-Pinger for Render
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
    }, 10 * 60 * 1000); // Every 10 minutes
  }
});
