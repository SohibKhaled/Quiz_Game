// Cosmic Quiz (Trivia Showdown) Game Module
const CosmicQuizGame = (function() {
  let questionText = null;
  let optionsContainer = null;
  
  let isHost = false;
  let myId = '';
  let players = [];
  let gameState = 'waiting'; // 'waiting', 'question', 'reveal', 'gameover'
  
  // Quiz states
  let activeQuestions = [];
  let currentQIdx = 0;
  let timerInterval = null;
  let timeLeft = 15;
  let scores = {};
  
  // Local answers tracking
  let hasAnswered = false;
  let selectedOptionIdx = -1;
  let playerAnswers = {}; // id -> answer index
  let answerTimes = {}; // id -> time spent in ms (for speed bonus)
  let questionStartTime = 0;

  // 15 cosmic questions pool
  const QUESTION_POOL = [
    {
      q: "What is the approximate age of the universe?",
      o: ["4.5 billion years", "13.8 billion years", "93 billion years", "500 million years"],
      a: 1
    },
    {
      q: "Which planet has the most extensive ring system?",
      o: ["Jupiter", "Neptune", "Saturn", "Uranus"],
      a: 2
    },
    {
      q: "What is the closest star system to our Sun?",
      o: ["Alpha Centauri", "Sirius", "Polaris", "Betelgeuse"],
      a: 0
    },
    {
      q: "What was the name of the first artificial satellite in orbit?",
      o: ["Apollo 11", "Explorer 1", "Sputnik 1", "Voyager 1"],
      a: 2
    },
    {
      q: "What is the boundary around a black hole called, beyond which nothing can escape?",
      o: ["Singularity", "Accretion Disk", "Gravity Well", "Event Horizon"],
      a: 3
    },
    {
      q: "Which galaxy is on a collision course with our Milky Way?",
      o: ["Andromeda", "Triangulum", "Sombrero", "Whirlpool"],
      a: 0
    },
    {
      q: "Who was the first human to travel into outer space?",
      o: ["Neil Armstrong", "Yuri Gagarin", "John Glenn", "Buzz Aldrin"],
      a: 1
    },
    {
      q: "How many minutes does it take light to travel from the Sun to the Earth?",
      o: ["About 8 minutes", "About 1 minute", "About 8 seconds", "About 24 minutes"],
      a: 0
    },
    {
      q: "Which is the hottest planet in our solar system?",
      o: ["Mercury", "Mars", "Venus", "Jupiter"],
      a: 2
    },
    {
      q: "What is the primary gas that makes up the Sun?",
      o: ["Helium", "Hydrogen", "Oxygen", "Carbon Dioxide"],
      a: 1
    },
    {
      q: "What is the name of the largest moon of Saturn?",
      o: ["Titan", "Europa", "Ganymede", "Io"],
      a: 0
    },
    {
      q: "Which spacecraft has traveled the farthest into deep space?",
      o: ["Voyager 1", "New Horizons", "Pioneer 10", "Voyager 2"],
      a: 0
    },
    {
      q: "What are neutron stars that emit regular pulses of radiation called?",
      o: ["Quasars", "Pulsars", "Supernovas", "White Dwarfs"],
      a: 1
    },
    {
      q: "How long is a day on Jupiter in Earth hours?",
      o: ["24 hours", "10 hours", "48 hours", "6 hours"],
      a: 1
    },
    {
      q: "What force keeps the Milky Way galaxy bound together?",
      o: ["Electromagnetism", "Dark Energy", "Gravity", "Strong Nuclear Force"],
      a: 2
    }
  ];

  function init() {
    questionText = document.getElementById('quiz-question-text');
    optionsContainer = document.getElementById('quiz-options-container');
  }

  function start(hostFlag, playerList, localId) {
    if (!questionText) init();
    
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    
    scores = {};
    players.forEach(p => scores[p.id] = 0);
    App.updateScores(scores);
    
    if (isHost) {
      // Pick 5 random questions
      activeQuestions = [...QUESTION_POOL].sort(() => 0.5 - Math.random()).slice(0, 5);
      currentQIdx = 0;
      startQuestion();
    }
  }

  function stop() {
    clearInterval(timerInterval);
    gameState = 'waiting';
  }

  function startQuestion() {
    gameState = 'question';
    timeLeft = 15;
    hasAnswered = false;
    selectedOptionIdx = -1;
    playerAnswers = {};
    answerTimes = {};
    questionStartTime = Date.now();
    
    App.updateTimer(timeLeft);
    
    if (isHost) {
      // Broadcast question start
      NetworkManager.broadcastGameData({
        type: 'QUIZ_Q_START',
        questions: activeQuestions,
        currentQIdx: currentQIdx,
        scores: scores
      });
      
      // Host timer loop
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
        App.updateTimer(timeLeft);
        
        NetworkManager.broadcastGameData({
          type: 'QUIZ_TICK',
          timeLeft: timeLeft
        });

        if (timeLeft <= 0) {
          evaluateAnswers();
        }
      }, 1000);
    }
    
    renderQuestion();
  }

  function handleOptionClick(optIdx) {
    if (gameState !== 'question' || hasAnswered) return;
    
    hasAnswered = true;
    selectedOptionIdx = optIdx;
    
    const timeSpent = Date.now() - questionStartTime;
    
    // Highlight local selection
    const buttons = optionsContainer.querySelectorAll('.quiz-option-btn');
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === optIdx) {
        btn.classList.add('selected');
      }
    });

    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playClick();
    }

    if (isHost) {
      submitHostAnswer(myId, optIdx, timeSpent);
    } else {
      NetworkManager.sendGameData({
        type: 'QUIZ_SUBMIT',
        optIdx: optIdx,
        timeSpent: timeSpent
      });
    }
  }

  function submitHostAnswer(playerId, optIdx, timeSpent) {
    if (!isHost || gameState !== 'question') return;
    
    playerAnswers[playerId] = optIdx;
    answerTimes[playerId] = timeSpent;
    
    // Check if everyone has submitted
    let submissionCount = Object.keys(playerAnswers).length;
    if (submissionCount === players.length) {
      evaluateAnswers();
    }
  }

  function evaluateAnswers() {
    if (!isHost) return;
    
    clearInterval(timerInterval);
    gameState = 'reveal';
    
    const correctIdx = activeQuestions[currentQIdx].a;
    
    // Calculate new scores
    players.forEach(p => {
      const ans = playerAnswers[p.id];
      if (ans === correctIdx) {
        // Base 10 points for correct answer
        let points = 10;
        
        // Speed bonus: up to 10 extra points if answered in under 10 seconds
        const timeSpent = answerTimes[p.id] || 15000;
        if (timeSpent < 10000) {
          const bonus = Math.round((10000 - timeSpent) / 1000); // Max 10 points bonus
          points += Math.max(0, bonus);
        }
        
        scores[p.id] = (scores[p.id] || 0) + points;
      }
    });

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playScore();
    }

    // Broadcast results
    NetworkManager.broadcastGameData({
      type: 'QUIZ_REVEAL',
      correctIdx: correctIdx,
      playerAnswers: playerAnswers,
      scores: scores
    });

    revealAnswers(correctIdx);

    // Schedule next question or end quiz
    setTimeout(() => {
      if (gameState !== 'reveal') return;
      
      currentQIdx++;
      if (currentQIdx < activeQuestions.length) {
        startQuestion();
      } else {
        endQuiz();
      }
    }, 4500);
  }

  function revealAnswers(correctIdx) {
    gameState = 'reveal';
    
    // Highlight options
    const buttons = optionsContainer.querySelectorAll('.quiz-option-btn');
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      
      if (idx === correctIdx) {
        btn.classList.add('correct');
      } else if (idx === selectedOptionIdx) {
        btn.classList.add('incorrect');
      }
    });

    // Reveal who answered what underneath the options
    const revealContainer = document.createElement('div');
    revealContainer.className = 'quiz-responses-reveal';
    revealContainer.style.marginTop = '15px';
    revealContainer.style.display = 'flex';
    revealContainer.style.flexWrap = 'wrap';
    revealContainer.style.gap = '8px';
    revealContainer.style.justifyContent = 'center';
    
    players.forEach(p => {
      const ansIdx = playerAnswers[p.id];
      if (ansIdx !== undefined) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.border = `1px solid ${p.color}`;
        badge.style.color = p.color;
        badge.style.background = 'rgba(255,255,255,0.03)';
        badge.style.fontSize = '0.75rem';
        badge.style.padding = '4px 8px';
        badge.style.borderRadius = '4px';
        
        const answerText = activeQuestions[currentQIdx].o[ansIdx];
        badge.innerText = `${p.nickname}: ${answerText}`;
        revealContainer.appendChild(badge);
      }
    });

    optionsContainer.appendChild(revealContainer);
  }

  function endQuiz() {
    if (!isHost) return;
    
    gameState = 'gameover';
    
    // Sort players by score
    const leaderboard = players.map(p => ({
      nickname: p.nickname,
      score: scores[p.id] || 0,
      color: p.color
    })).sort((a, b) => b.score - a.score);

    NetworkManager.broadcastGameData({
      type: 'QUIZ_GAMEOVER',
      leaderboard: leaderboard
    });

    showFinalLeaderboard(leaderboard);
  }

  function showFinalLeaderboard(leaderboard) {
    if (typeof AntigravityAudio !== 'undefined') {
      AntigravityAudio.playVictory();
    }

    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayBody = document.getElementById('overlay-body');

    overlayTitle.innerText = "QUIZ LEADERBOARD";

    let html = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:10px; text-align:left;">';
    leaderboard.forEach((pl, idx) => {
      const rankBadge = idx === 0 ? '<i data-lucide="trophy" style="color:#ffd600;"></i>' : `#${idx + 1}`;
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:6px 0;">
          <span style="color:${pl.color}; font-weight:600; display:inline-flex; align-items:center; gap:6px;">${rankBadge} ${pl.nickname}</span>
          <span style="font-family:var(--font-display); font-weight:800; color:var(--neon-cyan);">${pl.score} pts</span>
        </div>
      `;
    });
    html += '</div>';

    overlayBody.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();
    overlay.classList.remove('hidden');

    // Reset quiz if host clicks exit or it closes
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (isHost) {
        // Return to lobby
        NetworkManager.exitGame();
      }
    }, 8000);
  }

  function renderQuestion() {
    optionsContainer.innerHTML = '';
    const qData = activeQuestions[currentQIdx];
    
    questionText.innerText = qData.q;
    
    qData.o.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.innerText = opt;
      btn.addEventListener('click', () => handleOptionClick(idx));
      optionsContainer.appendChild(btn);
    });
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'QUIZ_SUBMIT':
        if (isHost) {
          submitHostAnswer(senderId, payload.optIdx, payload.timeSpent);
        }
        break;

      case 'QUIZ_Q_START':
        activeQuestions = payload.questions;
        currentQIdx = payload.currentQIdx;
        scores = payload.scores;
        
        hasAnswered = false;
        selectedOptionIdx = -1;
        playerAnswers = {};
        
        App.updateScores(scores);
        renderQuestion();
        break;

      case 'QUIZ_TICK':
        timeLeft = payload.timeLeft;
        App.updateTimer(timeLeft);
        break;

      case 'QUIZ_REVEAL':
        playerAnswers = payload.playerAnswers;
        scores = payload.scores;
        
        App.updateScores(scores);
        revealAnswers(payload.correctIdx);
        break;

      case 'QUIZ_GAMEOVER':
        showFinalLeaderboard(payload.leaderboard);
        break;
    }
  }

  // Register game
  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('cosmic-quiz', CosmicQuizGame);
  });

  return {
    start: start,
    stop: stop,
    handleData: handleData
  };
})();
