// Draw & Guess (Cyber Sketch) Game Module
const DrawGuessGame = (function() {
  let canvas = null;
  let ctx = null;
  
  let isHost = false;
  let myId = '';
  let players = [];
  let gameState = 'waiting'; // 'waiting', 'drawing', 'roundover'
  
  // Game states
  let currentDrawerId = '';
  let currentWord = '';
  let guessedPlayers = []; // IDs of players who guessed correctly
  let scores = {};
  
  let timerInterval = null;
  let roundTimeLeft = 60;
  
  // Drawing state
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let brushColor = '#ff007f';
  let brushSize = 4;

  const WORDS = [
    'ROCKET', 'ALIEN', 'GALAXY', 'ASTRONAUT', 'METEOR', 'TELESCOPE', 'SATURN', 
    'SPACESHIP', 'GRAVITY', 'COMET', 'SUPERNOVA', 'SUN', 'NEBULA', 'PLANET', 
    'LASER', 'SATELLITE', 'MOON', 'ECLIPSE', 'STAR', 'ORBIT', 'UFO', 'PORTAL'
  ];

  function init() {
    canvas = document.getElementById('draw-guess-canvas');
    ctx = canvas.getContext('2d');
    
    // Internal coordinate space 500x500 scaled via CSS
    canvas.width = 500;
    canvas.height = 500;
    
    setupBrushControls();
  }

  function setupBrushControls() {
    // Colors
    document.querySelectorAll('.colors .color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.colors .color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        brushColor = btn.getAttribute('data-color');
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      });
    });

    // Brush Sizes
    document.querySelectorAll('.brush-sizes .size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.brush-sizes .size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        brushSize = parseInt(btn.getAttribute('data-size'));
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      });
    });

    // Clear Button
    document.getElementById('draw-clear-btn').addEventListener('click', () => {
      if (currentDrawerId !== myId) return; // Only drawer can clear
      
      clearCanvas();
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();

      // Sync clear
      if (isHost) {
        NetworkManager.broadcastGameData({ type: 'DRAW_CLEAR' });
      } else {
        NetworkManager.sendGameData({ type: 'DRAW_CLEAR' });
      }
    });
  }

  function start(hostFlag, playerList, localId) {
    if (!canvas) init();
    
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    
    scores = {};
    players.forEach(p => scores[p.id] = 0);
    
    clearCanvas();
    setupCanvasListeners();
    App.updateScores(scores);
    
    if (isHost) {
      // Choose first drawer
      currentDrawerId = players[0].id;
      startRound();
    }
  }

  function stop() {
    clearInterval(timerInterval);
    removeCanvasListeners();
    gameState = 'waiting';
  }

  function startRound() {
    gameState = 'drawing';
    guessedPlayers = [];
    roundTimeLeft = 60;
    
    // Choose random word
    currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    
    clearCanvas();
    
    // Broadcast round start
    if (isHost) {
      NetworkManager.broadcastGameData({
        type: 'DRAW_ROUND_START',
        drawerId: currentDrawerId,
        word: currentWord,
        scores: scores
      });
      
      // Start host timer
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        roundTimeLeft--;
        App.updateTimer(roundTimeLeft);
        
        NetworkManager.broadcastGameData({
          type: 'DRAW_TICK',
          timeLeft: roundTimeLeft
        });

        if (roundTimeLeft <= 0) {
          endRound();
        }
      }, 1000);
      
      announceTurn();
    }
    
    updateUI();
  }

  function announceTurn() {
    const drawer = players.find(p => p.id === currentDrawerId);
    const name = drawer ? drawer.nickname : 'Someone';
    NetworkManager.sendChat(`SYSTEM: Round started. ${name} is drawing!`);
  }

  function endRound() {
    clearInterval(timerInterval);
    gameState = 'roundover';
    
    // Broadcast round end
    if (isHost) {
      NetworkManager.broadcastGameData({
        type: 'DRAW_ROUND_OVER',
        word: currentWord,
        scores: scores
      });
      
      NetworkManager.sendChat(`SYSTEM: Round over! The word was "${currentWord}".`);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
      
      // Schedule next round
      setTimeout(() => {
        if (gameState !== 'roundover') return;
        
        // Select next drawer
        const currentIdx = players.findIndex(p => p.id === currentDrawerId);
        const nextIdx = (currentIdx + 1) % players.length;
        currentDrawerId = players[nextIdx].id;
        
        startRound();
      }, 4000);
    }
  }

  function clearCanvas() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawLineLocal(x1, y1, x2, y2, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playDrawTick();
    }
  }

  function setupCanvasListeners() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    canvas.addEventListener('touchstart', startDrawingTouch, { passive: false });
    canvas.addEventListener('touchmove', drawTouch, { passive: false });
    window.addEventListener('touchend', stopDrawing);
  }

  function removeCanvasListeners() {
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    window.removeEventListener('mouseup', stopDrawing);

    canvas.removeEventListener('touchstart', startDrawingTouch);
    canvas.removeEventListener('touchmove', drawTouch);
    window.removeEventListener('touchend', stopDrawing);
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale client coords back into 500x500 canvas coordinates
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDrawing(e) {
    if (currentDrawerId !== myId || gameState !== 'drawing') return;
    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;
  }

  function startDrawingTouch(e) {
    e.preventDefault();
    startDrawing(e);
  }

  function draw(e) {
    if (!isDrawing || currentDrawerId !== myId || gameState !== 'drawing') return;
    
    const coords = getCanvasCoords(e);
    const newX = coords.x;
    const newY = coords.y;

    drawLineLocal(lastX, lastY, newX, newY, brushColor, brushSize);

    // Send drawing coordinates
    const payload = {
      type: 'DRAW_LINE',
      x1: lastX,
      y1: lastY,
      x2: newX,
      y2: newY,
      color: brushColor,
      size: brushSize
    };

    if (isHost) {
      NetworkManager.broadcastGameData(payload);
    } else {
      NetworkManager.sendGameData(payload);
    }

    lastX = newX;
    lastY = newY;
  }

  function drawTouch(e) {
    e.preventDefault();
    draw(e);
  }

  function stopDrawing() {
    isDrawing = false;
  }

  function updateUI() {
    const isDrawingPlayer = (currentDrawerId === myId);
    
    // Enable/disable drawing tools
    const tools = document.querySelector('.draw-tools');
    if (tools) {
      tools.classList.toggle('disabled', !isDrawingPlayer);
      tools.querySelectorAll('button').forEach(btn => {
        if (isDrawingPlayer) btn.removeAttribute('disabled');
        else btn.setAttribute('disabled', 'true');
      });
    }

    const wordPrompt = document.getElementById('draw-guess-word-prompt');
    if (wordPrompt) {
      if (isDrawingPlayer) {
        wordPrompt.innerText = `DRAW THIS: ${currentWord}`;
      } else {
        // Scrambled letters prompt for guessers
        const hint = currentWord.split('').map((c, i) => (i === 0 || guessedPlayers.includes(myId)) ? c : '_').join(' ');
        wordPrompt.innerText = `GUESS WORD: ${hint}`;
      }
    }
  }

  function submitGuess(text) {
    const cleanGuess = text.trim().toUpperCase();
    if (!cleanGuess || gameState !== 'drawing') return;

    if (currentDrawerId === myId) {
      // Drawer can't guess! Just standard chat
      NetworkManager.sendChat(text);
      return;
    }

    // Check if player has already guessed correctly
    if (guessedPlayers.includes(myId)) {
      NetworkManager.sendChat(text);
      return;
    }

    // Send guess to host
    if (isHost) {
      processGuess(myId, cleanGuess);
    } else {
      NetworkManager.sendGameData({
        type: 'DRAW_SUBMIT_GUESS',
        guess: cleanGuess
      });
    }
  }

  function processGuess(playerId, guess) {
    if (!isHost || gameState !== 'drawing') return;
    
    const p = players.find(pl => pl.id === playerId);
    if (!p) return;

    if (guess === currentWord) {
      if (!guessedPlayers.includes(playerId)) {
        guessedPlayers.push(playerId);
        
        // Award points
        // Guess gets 10 points
        scores[playerId] = (scores[playerId] || 0) + 10;
        
        // Drawer gets 3 points for helping others guess
        scores[currentDrawerId] = (scores[currentDrawerId] || 0) + 3;
        
        App.updateScores(scores);
        
        // Broadcast point scored
        NetworkManager.broadcastGameData({
          type: 'DRAW_SCORED',
          playerId: playerId,
          scores: scores,
          guessedPlayers: guessedPlayers
        });

        NetworkManager.sendChat(`SYSTEM: ${p.nickname} guessed the correct word!`);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();

        // End round early if all guessers are correct
        const guesserCount = players.length - 1;
        if (guesserCount > 0 && guessedPlayers.length === guesserCount) {
          endRound();
        }
      }
    } else {
      // Standard chat relay
      NetworkManager.sendChat(guess);
    }
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'DRAW_LINE':
        drawLineLocal(payload.x1, payload.y1, payload.x2, payload.y2, payload.color, payload.size);
        if (isHost) {
          // Host relays coordinates to all guests
          NetworkManager.broadcastGameData(payload);
        }
        break;

      case 'DRAW_CLEAR':
        clearCanvas();
        if (isHost) {
          NetworkManager.broadcastGameData(payload);
        }
        break;

      case 'DRAW_SUBMIT_GUESS':
        if (isHost) {
          processGuess(senderId, payload.guess);
        }
        break;

      case 'DRAW_ROUND_START':
        currentDrawerId = payload.drawerId;
        currentWord = payload.word;
        scores = payload.scores;
        guessedPlayers = [];
        clearCanvas();
        App.updateScores(scores);
        updateUI();
        break;

      case 'DRAW_TICK':
        roundTimeLeft = payload.timeLeft;
        App.updateTimer(roundTimeLeft);
        break;

      case 'DRAW_SCORED':
        scores = payload.scores;
        guessedPlayers = payload.guessedPlayers;
        App.updateScores(scores);
        updateUI();
        break;

      case 'DRAW_ROUND_OVER':
        gameState = 'roundover';
        currentWord = payload.word;
        scores = payload.scores;
        App.updateScores(scores);
        
        // Overlay banner
        const overlay = document.getElementById('game-overlay');
        const overlayTitle = document.getElementById('overlay-title');
        const overlayBody = document.getElementById('overlay-body');
        
        overlayTitle.innerText = "ROUND COMPLETE";
        overlayBody.innerText = `The word was: ${currentWord}`;
        overlay.classList.remove('hidden');
        
        setTimeout(() => {
          overlay.classList.add('hidden');
        }, 3000);
        break;
    }
  }

  // Register game
  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('draw-guess', DrawGuessGame);
  });

  return {
    start: start,
    stop: stop,
    handleData: handleData,
    submitGuess: submitGuess
  };
})();
