// Neon Grid (Dots & Boxes) Game Module
const NeonGridGame = (function() {
  let boardContainer = null;
  let statusText = null;
  
  let isHost = false;
  let myId = '';
  let players = [];
  let gameState = 'waiting'; // 'waiting', 'playing', 'gameover'
  
  // Board configuration (5x5 dots creates 4x4 boxes)
  const DOTS_COLS = 5;
  const DOTS_ROWS = 5;
  const BOARD_SIZE = 360; // 360px wide board
  let spacing = BOARD_SIZE / (DOTS_COLS - 1);
  
  // State variables
  let hLines = []; // (COLS-1) x ROWS -> player ID who claimed it
  let vLines = []; // COLS x (ROWS-1) -> player ID who claimed it
  let boxes = [];  // (COLS-1) x (ROWS-1) -> player ID who completed it
  
  let activePlayerIdx = 0;
  let scores = {};

  function init() {
    boardContainer = document.getElementById('neon-grid-board');
    statusText = document.getElementById('neon-grid-status');
    
    // Set board dimensions
    boardContainer.style.width = `${BOARD_SIZE}px`;
    boardContainer.style.height = `${BOARD_SIZE}px`;
  }

  function start(hostFlag, playerList, localId) {
    if (!boardContainer) init();
    
    isHost = hostFlag;
    players = [...playerList];
    myId = localId;

    // Add bot if single player
    if (players.length === 1) {
      players.push({
        id: 'bot-opponent',
        nickname: 'QuantumBot',
        color: '#ff007f',
        isHost: false
      });
    }
    
    scores = {};
    players.forEach(p => scores[p.id] = 0);
    
    resetBoard();
    App.updateScores(scores);
    
    if (isHost) {
      activePlayerIdx = 0;
      broadcastState();
    }
  }

  function stop() {
    gameState = 'waiting';
    boardContainer.innerHTML = '';
  }

  function resetBoard() {
    gameState = 'playing';
    
    // Initialize horizontal lines (4 columns x 5 rows)
    hLines = [];
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      hLines[x] = [];
      for (let y = 0; y < DOTS_ROWS; y++) {
        hLines[x][y] = null;
      }
    }

    // Initialize vertical lines (5 columns x 4 rows)
    vLines = [];
    for (let x = 0; x < DOTS_COLS; x++) {
      vLines[x] = [];
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        vLines[x][y] = null;
      }
    }

    // Initialize boxes (4x4 grid)
    boxes = [];
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      boxes[x] = [];
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        boxes[x][y] = null;
      }
    }

    renderBoard();
    updateStatus();
  }

  function handleLineClick(lineType, x, y) {
    if (gameState !== 'playing') return;

    // Check if it's player's turn
    const activePlayer = players[activePlayerIdx];
    if (activePlayer.id !== myId) return; // Not your turn!

    if (lineType === 'h' && hLines[x][y] !== null) return;
    if (lineType === 'v' && vLines[x][y] !== null) return;

    if (isHost) {
      makeMove(myId, lineType, x, y);
    } else {
      NetworkManager.sendGameData({
        type: 'GRID_CLAIM_LINE',
        lineType: lineType,
        x: x,
        y: y
      });
    }
  }

  function makeMove(playerId, lineType, x, y) {
    if (!isHost || gameState !== 'playing') return;

    // Validate turn
    const activePlayer = players[activePlayerIdx];
    if (activePlayer.id !== playerId) return;

    // Claim line
    if (lineType === 'h') {
      hLines[x][y] = playerId;
    } else {
      vLines[x][y] = playerId;
    }

    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playClick();
    }

    // Check for box completions
    let boxesCompleted = checkCompletions(playerId);

    if (boxesCompleted > 0) {
      scores[playerId] = (scores[playerId] || 0) + boxesCompleted;
      App.updateScores(scores);
      if (typeof AntigravityAudio !== 'undefined') {
        AntigravityAudio.playScore();
      }

      // Check game over
      if (isGridFilled()) {
        gameState = 'gameover';
        broadcastState();
        endGame();
        return;
      }
      // Capture means player gets another turn, do not change active player
    } else {
      // Advance active player index
      activePlayerIdx = (activePlayerIdx + 1) % players.length;
      if (typeof AntigravityAudio !== 'undefined') {
        AntigravityAudio.playTurn();
      }
    }

    broadcastState();
    renderBoard();
    updateStatus();

    // Check if next player is bot
    if (players[activePlayerIdx].id === 'bot-opponent') {
      setTimeout(makeBotMove, 800);
    }
  }

  function checkCompletions(playerId) {
    let completedCount = 0;

    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        // If box not completed yet, check its 4 boundary lines
        if (boxes[x][y] === null) {
          const top = hLines[x][y] !== null;
          const bottom = hLines[x][y+1] !== null;
          const left = vLines[x][y] !== null;
          const right = vLines[x+1][y] !== null;

          if (top && bottom && left && right) {
            boxes[x][y] = playerId;
            completedCount++;
          }
        }
      }
    }

    return completedCount;
  }

  function isGridFilled() {
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        if (boxes[x][y] === null) return false;
      }
    }
    return true;
  }

  function makeBotMove() {
    if (!isHost || gameState !== 'playing') return;

    // Bot AI Decision Making
    let selectedMove = null;

    // 1. Check if bot can complete any box right now (Capture move)
    selectedMove = findWinningMove();
    if (selectedMove) {
      makeMove('bot-opponent', selectedMove.type, selectedMove.x, selectedMove.y);
      return;
    }

    // 2. Avoid setting up opponent: Claim a line that does NOT make a box have 3 lines claimed (which would let player score)
    selectedMove = findSafeMove();
    if (selectedMove) {
      makeMove('bot-opponent', selectedMove.type, selectedMove.x, selectedMove.y);
      return;
    }

    // 3. Last resort: Claim any random available line
    selectedMove = findRandomMove();
    if (selectedMove) {
      makeMove('bot-opponent', selectedMove.type, selectedMove.x, selectedMove.y);
    }
  }

  function countBoxLines(bx, by) {
    let count = 0;
    if (hLines[bx][by] !== null) count++;     // Top
    if (hLines[bx][by+1] !== null) count++;   // Bottom
    if (vLines[bx][by] !== null) count++;     // Left
    if (vLines[bx+1][by] !== null) count++;   // Right
    return count;
  }

  function getMissingLine(bx, by) {
    if (hLines[bx][by] === null) return { type: 'h', x: bx, y: by };
    if (hLines[bx][by+1] === null) return { type: 'h', x: bx, y: by+1 };
    if (vLines[bx][by] === null) return { type: 'v', x: bx, y: by };
    if (vLines[bx+1][by] === null) return { type: 'v', x: bx+1, y: by };
    return null;
  }

  function findWinningMove() {
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        if (boxes[x][y] === null && countBoxLines(x, y) === 3) {
          return getMissingLine(x, y);
        }
      }
    }
    return null;
  }

  function findSafeMove() {
    let allAvailableMoves = [];
    
    // Scan all horizontal lines
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS; y++) {
        if (hLines[x][y] === null) {
          allAvailableMoves.push({ type: 'h', x: x, y: y });
        }
      }
    }

    // Scan all vertical lines
    for (let x = 0; x < DOTS_COLS; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        if (vLines[x][y] === null) {
          allAvailableMoves.push({ type: 'v', x: x, y: y });
        }
      }
    }

    // Filter moves that don't increase count of adjacent boxes to 3
    let safeMoves = allAvailableMoves.filter(move => {
      // Temporarily apply move
      if (move.type === 'h') {
        hLines[move.x][move.y] = 'temp';
      } else {
        vLines[move.x][move.y] = 'temp';
      }

      // Check if any box now has 3 lines claimed (meaning opponent could capture)
      let dangerous = false;
      for (let bx = 0; bx < DOTS_COLS - 1; bx++) {
        for (let by = 0; by < DOTS_ROWS - 1; by++) {
          if (boxes[bx][by] === null && countBoxLines(bx, by) === 3) {
            dangerous = true;
          }
        }
      }

      // Undo move
      if (move.type === 'h') {
        hLines[move.x][move.y] = null;
      } else {
        vLines[move.x][move.y] = null;
      }

      return !dangerous;
    });

    if (safeMoves.length > 0) {
      return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }
    return null;
  }

  function findRandomMove() {
    let remaining = [];
    // H lines
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS; y++) {
        if (hLines[x][y] === null) remaining.push({ type: 'h', x: x, y: y });
      }
    }
    // V lines
    for (let x = 0; x < DOTS_COLS; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        if (vLines[x][y] === null) remaining.push({ type: 'v', x: x, y: y });
      }
    }

    if (remaining.length > 0) {
      return remaining[Math.floor(Math.random() * remaining.length)];
    }
    return null;
  }

  function broadcastState() {
    if (!isHost) return;
    NetworkManager.broadcastGameData({
      type: 'GRID_STATE_SYNC',
      hLines: hLines,
      vLines: vLines,
      boxes: boxes,
      activePlayerIdx: activePlayerIdx,
      gameState: gameState,
      scores: scores
    });
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'GRID_CLAIM_LINE':
        if (isHost) {
          makeMove(senderId, payload.lineType, payload.x, payload.y);
        }
        break;

      case 'GRID_STATE_SYNC':
        hLines = payload.hLines;
        vLines = payload.vLines;
        boxes = payload.boxes;
        activePlayerIdx = payload.activePlayerIdx;
        gameState = payload.gameState;
        scores = payload.scores;

        App.updateScores(scores);
        renderBoard();
        updateStatus();

        if (gameState === 'gameover') {
          endGame();
        }
        break;
    }
  }

  function updateStatus() {
    if (gameState === 'gameover') return;
    
    const activePlayer = players[activePlayerIdx];
    if (activePlayer.id === myId) {
      statusText.innerText = "YOUR TURN - Click a dotted line!";
      statusText.style.color = '#00f0ff';
    } else {
      statusText.innerText = `Waiting for ${activePlayer.nickname}...`;
      statusText.style.color = '#9f8eb7';
    }
  }

  function endGame() {
    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playVictory();
    }
    
    // Calculate winner
    let maxScore = -1;
    let winners = [];

    for (let id in scores) {
      if (scores[id] > maxScore) {
        maxScore = scores[id];
        winners = [id];
      } else if (scores[id] === maxScore) {
        winners.push(id);
      }
    }

    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayBody = document.getElementById('overlay-body');

    overlayTitle.innerText = "GRID OCCUPIED";

    let winText = '';
    if (winners.length === 1) {
      const winner = players.find(p => p.id === winners[0]);
      winText = winner ? `${winner.nickname} wins with ${maxScore} cells!` : `Crew member wins!`;
    } else {
      winText = `It's a draw! Tie score of ${maxScore}.`;
    }
    
    overlayBody.innerText = winText;
    overlay.classList.remove('hidden');

    setTimeout(() => {
      overlay.classList.add('hidden');
      if (isHost) {
        resetBoard();
        broadcastState();
      }
    }, 4500);
  }

  function renderBoard() {
    boardContainer.innerHTML = '';

    // 1. Render Boxes (background layer)
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        const claimerId = boxes[x][y];
        if (claimerId) {
          const claimer = players.find(p => p.id === claimerId);
          const boxDiv = document.createElement('div');
          boxDiv.className = `grid-box claimed`;
          boxDiv.style.left = `${x * spacing + 5}px`;
          boxDiv.style.top = `${y * spacing + 5}px`;
          boxDiv.style.width = `${spacing - 10}px`;
          boxDiv.style.height = `${spacing - 10}px`;
          boxDiv.style.background = claimer ? claimer.color : 'rgba(255,255,255,0.1)';
          boardContainer.appendChild(boxDiv);
        }
      }
    }

    // 2. Render Clickable Lines
    // Horizontal lines
    for (let x = 0; x < DOTS_COLS - 1; x++) {
      for (let y = 0; y < DOTS_ROWS; y++) {
        const claimerId = hLines[x][y];
        const line = document.createElement('div');
        line.className = `grid-line h-line ${claimerId ? 'active' : ''}`;
        
        // Position
        line.style.left = `${x * spacing + 10}px`;
        line.style.top = `${y * spacing - 5}px`;
        line.style.width = `${spacing - 20}px`;
        line.style.height = `10px`; // Click buffer
        
        if (claimerId) {
          const claimer = players.find(p => p.id === claimerId);
          line.style.background = claimer ? claimer.color : '#bd00ff';
          line.style.boxShadow = `0 0 10px ${claimer ? claimer.color : '#bd00ff'}`;
        }

        // Event listener
        line.addEventListener('click', () => handleLineClick('h', x, y));
        boardContainer.appendChild(line);
      }
    }

    // Vertical lines
    for (let x = 0; x < DOTS_COLS; x++) {
      for (let y = 0; y < DOTS_ROWS - 1; y++) {
        const claimerId = vLines[x][y];
        const line = document.createElement('div');
        line.className = `grid-line v-line ${claimerId ? 'active' : ''}`;
        
        // Position
        line.style.left = `${x * spacing - 5}px`;
        line.style.top = `${y * spacing + 10}px`;
        line.style.width = `10px`; // Click buffer
        line.style.height = `${spacing - 20}px`;
        
        if (claimerId) {
          const claimer = players.find(p => p.id === claimerId);
          line.style.background = claimer ? claimer.color : '#bd00ff';
          line.style.boxShadow = `0 0 10px ${claimer ? claimer.color : '#bd00ff'}`;
        }

        // Event listener
        line.addEventListener('click', () => handleLineClick('v', x, y));
        boardContainer.appendChild(line);
      }
    }

    // 3. Render Dots (top layer)
    for (let x = 0; x < DOTS_COLS; x++) {
      for (let y = 0; y < DOTS_ROWS; y++) {
        const dot = document.createElement('div');
        dot.className = 'grid-dot';
        dot.style.left = `${x * spacing}px`;
        dot.style.top = `${y * spacing}px`;
        boardContainer.appendChild(dot);
      }
    }
  }

  // Register game
  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('neon-grid', NeonGridGame);
  });

  return {
    start: start,
    stop: stop,
    handleData: handleData
  };
})();
