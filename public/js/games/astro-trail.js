// Astro Trail Game Module (Tron / Snake Arena)
const AstroTrailGame = (function() {
  let canvas = null;
  let ctx = null;
  
  let isHost = false;
  let myId = '';
  let players = [];
  let gameState = 'waiting'; // 'waiting', 'playing', 'gameover'
  
  let gameInterval = null;
  const GRID_SIZE = 70; // 70x70 grid cells
  let cellSize = 8;
  
  // Game state variables
  let ships = {}; // id -> { x, y, dx, dy, color, nickname, alive, trail: [] }
  let grid = []; // 2D array of grid cells representing who occupies it
  
  // Score tracking
  let scores = {}; // id -> score

  // Keyboard state
  let currentDir = { x: 0, y: -1 }; // Initial direction up
  
  function init() {
    canvas = document.getElementById('astro-trail-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!canvas) return;
    // Keep canvas 560x560 (8px * 70 grid)
    canvas.width = GRID_SIZE * cellSize;
    canvas.height = GRID_SIZE * cellSize;
  }

  function start(hostFlag, playerList, localId) {
    if (!canvas) init();
    
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    
    scores = {};
    players.forEach(p => {
      scores[p.id] = 0;
    });
    
    setupKeyboardListeners();
    resetGame();
    
    if (isHost) {
      startGameLoop();
    }
  }

  function stop() {
    clearInterval(gameInterval);
    gameInterval = null;
    gameState = 'waiting';
    removeKeyboardListeners();
  }

  function resetGame() {
    gameState = 'playing';
    
    // Clear Grid
    grid = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[x] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        grid[x][y] = null; // Unoccupied
      }
    }

    ships = {};
    currentDir = { x: 0, y: -1 };

    // Set starting positions for human players (distributed)
    const positions = [
      { x: 15, y: 15, dx: 1, dy: 0 },
      { x: GRID_SIZE - 16, y: GRID_SIZE - 16, dx: -1, dy: 0 },
      { x: GRID_SIZE - 16, y: 15, dx: 0, dy: 1 },
      { x: 15, y: GRID_SIZE - 16, dx: 0, dy: -1 }
    ];

    players.forEach((p, idx) => {
      const pos = positions[idx % positions.length];
      ships[p.id] = {
        id: p.id,
        x: pos.x,
        y: pos.y,
        dx: pos.dx,
        dy: pos.dy,
        color: p.color,
        nickname: p.nickname,
        alive: true,
        trail: [{ x: pos.x, y: pos.y }],
        isBot: false
      };
      grid[pos.x][pos.y] = p.id;
    });

    // If only 1 player, add 2 bots to make it fun!
    if (players.length === 1) {
      const botConfigs = [
        { id: 'bot-1', nickname: 'NebulaBot', color: '#ff007f', x: GRID_SIZE - 16, y: GRID_SIZE - 16, dx: -1, dy: 0 },
        { id: 'bot-2', nickname: 'CosmoBot', color: '#39ff14', x: GRID_SIZE - 16, y: 15, dx: 0, dy: 1 }
      ];
      
      botConfigs.forEach(bc => {
        ships[bc.id] = {
          id: bc.id,
          x: bc.x,
          y: bc.y,
          dx: bc.dx,
          dy: bc.dy,
          color: bc.color,
          nickname: bc.nickname,
          alive: true,
          trail: [{ x: bc.x, y: bc.y }],
          isBot: true
        };
        grid[bc.x][bc.y] = bc.id;
        scores[bc.id] = 0;
      });
    }

    App.updateScores(scores);
    render();
  }

  function startGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
    // Move every 80ms (very fast, exciting)
    gameInterval = setInterval(gameTick, 80);
  }

  function gameTick() {
    if (gameState !== 'playing') return;

    // 1. Move Bots (Host decides Bot movement)
    for (let id in ships) {
      if (ships[id].alive && ships[id].isBot) {
        decideBotDirection(ships[id]);
      }
    }

    // 2. Move Ships
    let newlyDead = [];
    let activePlayers = 0;

    for (let id in ships) {
      const s = ships[id];
      if (!s.alive) continue;

      activePlayers++;
      
      // Calculate next step
      const nextX = s.x + s.dx;
      const nextY = s.y + s.dy;

      // Check boundary collision
      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        newlyDead.push(id);
        continue;
      }

      // Check trail collision
      if (grid[nextX][nextY] !== null) {
        newlyDead.push(id);
        continue;
      }

      // Move is valid, update grid and trail
      s.x = nextX;
      s.y = nextY;
      s.trail.push({ x: nextX, y: nextY });
      grid[nextX][nextY] = id;
    }

    // Eliminate crashed players
    newlyDead.forEach(id => {
      ships[id].alive = false;
      if (typeof AntigravityAudio !== 'undefined') {
        AntigravityAudio.playExplosion();
      }
    });

    // Check game over
    let survivors = [];
    for (let id in ships) {
      if (ships[id].alive) {
        survivors.push(ships[id]);
      }
    }

    if (survivors.length <= 1 && Object.keys(ships).length > 1) {
      // Award point to the last survivor
      if (survivors.length === 1) {
        scores[survivors[0].id] = (scores[survivors[0].id] || 0) + 1;
      }
      gameState = 'gameover';
      App.updateScores(scores);
      broadcastState();
      
      // Let the game display "Game Over" for 3 seconds, then reset
      setTimeout(() => {
        if (gameState === 'gameover') {
          resetGame();
        }
      }, 3500);
    } else if (survivors.length === 0 && Object.keys(ships).length === 1) {
      // Solo mode: player crashed
      gameState = 'gameover';
      broadcastState();
      setTimeout(() => {
        if (gameState === 'gameover') {
          resetGame();
        }
      }, 3000);
    } else {
      broadcastState();
    }

    render();
  }

  function decideBotDirection(bot) {
    const nextX = bot.x + bot.dx;
    const nextY = bot.y + bot.dy;

    // Check if next step is blocked
    let isBlocked = nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE || grid[nextX][nextY] !== null;

    // Also randomly change direction sometimes to keep it lively
    if (isBlocked || Math.random() < 0.08) {
      const possibleDirs = [
        { x: 0, y: -1 }, // Up
        { x: 0, y: 1 },  // Down
        { x: -1, y: 0 }, // Left
        { x: 1, y: 0 }   // Right
      ];

      // Remove reverse direction (can't go backwards)
      const validDirs = possibleDirs.filter(d => {
        if (d.x === -bot.dx && d.y === -bot.dy) return false;
        
        // Check if this new dir is safe
        const nx = bot.x + d.x;
        const ny = bot.y + d.y;
        return nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && grid[nx][ny] === null;
      });

      if (validDirs.length > 0) {
        const choice = validDirs[Math.floor(Math.random() * validDirs.length)];
        bot.dx = choice.x;
        bot.dy = choice.y;
      }
    }
  }

  function broadcastState() {
    if (!isHost) return;
    NetworkManager.broadcastGameData({
      type: 'TRAIL_STATE_SYNC',
      ships: ships,
      grid: grid,
      gameState: gameState,
      scores: scores
    });
  }

  function handleData(senderId, payload) {
    if (isHost) {
      // Host receives direction changes from clients
      if (payload.type === 'TRAIL_TURN') {
        const s = ships[senderId];
        if (s && s.alive) {
          // Prevent turning 180 degrees backwards
          if (payload.dx !== -s.dx || payload.dy !== -s.dy) {
            s.dx = payload.dx;
            s.dy = payload.dy;
          }
        }
      }
    } else {
      // Guest receives state sync from host
      if (payload.type === 'TRAIL_STATE_SYNC') {
        ships = payload.ships;
        grid = payload.grid;
        
        const oldState = gameState;
        gameState = payload.gameState;
        scores = payload.scores;

        if (oldState === 'playing' && gameState === 'gameover') {
          // Play explosion on death screen change
          if (typeof AntigravityAudio !== 'undefined') {
            AntigravityAudio.playExplosion();
          }
        }
        
        App.updateScores(scores);
        render();
      }
    }
  }

  function setupKeyboardListeners() {
    window.addEventListener('keydown', handleKeyDown);
  }

  function removeKeyboardListeners() {
    window.removeEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    if (gameState !== 'playing') return;

    let nextDx = 0;
    let nextDy = 0;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        nextDx = 0; nextDy = -1;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        nextDx = 0; nextDy = 1;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        nextDx = -1; nextDy = 0;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        nextDx = 1; nextDy = 0;
        break;
      default:
        return; // Exit handler
    }

    e.preventDefault();

    // Sound feedback
    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playDrawTick();
    }

    if (isHost) {
      const s = ships[myId];
      if (s && s.alive) {
        if (nextDx !== -s.dx || nextDy !== -s.dy) {
          s.dx = nextDx;
          s.dy = nextDy;
        }
      }
    } else {
      // Guest sends turn instruction to Host
      NetworkManager.sendGameData({
        type: 'TRAIL_TURN',
        dx: nextDx,
        dy: nextDy
      });
    }
  }

  function render() {
    if (!ctx) return;

    // Draw background grid with subtle grid lines
    ctx.fillStyle = '#020108';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_SIZE; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvas.height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, x * cellSize);
      ctx.lineTo(canvas.width, x * cellSize);
      ctx.stroke();
    }

    // Draw player trails
    for (let id in ships) {
      const s = ships[id];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = cellSize - 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Create glowing neon trail effect
      ctx.shadowBlur = 12;
      ctx.shadowColor = s.color;

      ctx.beginPath();
      s.trail.forEach((pt, index) => {
        const drawX = pt.x * cellSize + cellSize / 2;
        const drawY = pt.y * cellSize + cellSize / 2;
        if (index === 0) {
          ctx.moveTo(drawX, drawY);
        } else {
          ctx.lineTo(drawX, drawY);
        }
      });
      ctx.stroke();

      // Draw active head
      if (s.alive) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(
          s.x * cellSize + cellSize / 2,
          s.y * cellSize + cellSize / 2,
          cellSize / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Reset shadow parameters for text drawing
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Draw Game Over overlays
    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(7, 3, 18, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = '800 28px Outfit';
      ctx.fillStyle = '#ff007f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff007f';
      ctx.fillText('MISSION COMPLETED', canvas.width / 2, canvas.height / 2 - 30);
      
      ctx.shadowBlur = 0;
      ctx.font = '400 16px Space Grotesk';
      ctx.fillStyle = '#f5f2fa';

      let winMsg = 'Grid Cleared!';
      
      // Determine winner
      let survivors = [];
      for (let id in ships) {
        if (ships[id].alive) survivors.push(ships[id]);
      }
      
      if (survivors.length === 1) {
        winMsg = `${survivors[0].nickname} dominates the grid!`;
      } else {
        winMsg = 'Mutual annihilation!';
      }

      ctx.fillText(winMsg, canvas.width / 2, canvas.height / 2 + 15);
      ctx.fillStyle = '#bd00ff';
      ctx.fillText('Syncing new run...', canvas.width / 2, canvas.height / 2 + 50);
    }
  }

  // Register game
  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('astro-trail', AstroTrailGame);
  });

  return {
    start: start,
    stop: stop,
    handleData: handleData
  };
})();
