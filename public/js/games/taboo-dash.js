// Taboo Dash (الكلمة الممنوعة) - Social Hangout Game
const TabooDashGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let timerInterval = null;
  let timeLeft = 45;

  let currentRound = null; // { describerId, describerName, describerColor, word, forbidden: [], status: 'playing'|'won'|'timeout', winnerName }

  const CARDS = [
    { word: 'كشري', forbidden: ['مكرونة', 'عدس', 'صلصة'] },
    { word: 'أهرامات', forbidden: ['مصر', 'فرعون', 'جيزة'] },
    { word: 'مطار', forbidden: ['طيارة', 'سفر', 'شنطة'] },
    { word: 'قهوة', forbidden: ['شاي', 'فنجان', 'كافيين'] },
    { word: 'سينما', forbidden: ['فيلم', 'شاشة', 'فشار'] },
    { word: 'امتحان', forbidden: ['جامعة', 'ورقة', 'درجات'] },
    { word: 'تليفون', forbidden: ['مكالمة', 'واتساب', 'شاشة'] },
    { word: 'بحر', forbidden: ['مية', 'شط', 'ساحل'] },
    { word: 'بيتزا', forbidden: ['جبنة', 'عجينة', 'فرن'] },
    { word: 'كورة', forbidden: ['ملعب', 'جول', 'فريق'] },
    { word: 'رمضان', forbidden: ['صيام', 'فطار', 'فانوس'] },
    { word: 'فرح', forbidden: ['عروسة', 'رقص', 'بدلة'] }
  ];

  function getStage() {
    return document.getElementById('taboo-dash-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    rotationIdx = 0;
    currentRound = null;

    App.updateScores(scores);
    render();
  }

  function stop() {
    clearInterval(timerInterval);
    currentRound = null;
  }

  function startRound() {
    if (!isHost || players.length === 0) return;
    const describer = players[rotationIdx % players.length];
    rotationIdx++;

    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    timeLeft = 45;

    currentRound = {
      describerId: describer.id,
      describerName: describer.nickname,
      describerColor: describer.color,
      word: card.word,
      forbidden: card.forbidden,
      status: 'playing',
      winnerName: null
    };

    // Send secret card to describer, masked card to everyone else
    players.forEach(p => {
      const isDesc = p.id === describer.id;
      const payload = {
        type: 'TD_ROUND_START',
        round: {
          ...currentRound,
          word: isDesc ? card.word : '???',
          forbidden: isDesc ? card.forbidden : []
        },
        scores
      };
      if (p.id === myId) {
        currentRound = payload.round;
      } else {
        NetworkManager.sendToPlayer(p.id, payload);
      }
    });

    // Host keeps real word in memory
    currentRound._realWord = card.word;
    currentRound._realForbidden = card.forbidden;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      App.updateTimer(timeLeft);
      NetworkManager.broadcastGameData({ type: 'TD_TICK', timeLeft });
      if (timeLeft <= 0) {
        endRound('timeout', null);
      }
    }, 1000);

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function endRound(status, winnerId) {
    if (!isHost || !currentRound) return;
    clearInterval(timerInterval);
    currentRound.status = status;

    let winnerName = null;
    if (status === 'won' && winnerId) {
      const w = players.find(p => p.id === winnerId);
      winnerName = w ? w.nickname : 'Player';
      scores[winnerId] = (scores[winnerId] || 0) + 15;
      scores[currentRound.describerId] = (scores[currentRound.describerId] || 0) + 10;
    }

    const revealedWord = currentRound._realWord || currentRound.word;
    currentRound.word = revealedWord;
    currentRound.winnerName = winnerName;

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      status === 'won' ? AntigravityAudio.playScore() : AntigravityAudio.playExplosion();
    }

    NetworkManager.broadcastGameData({
      type: 'TD_ROUND_END',
      status,
      word: revealedWord,
      winnerName,
      scores
    });
    render();
  }

  function submitGuess(text) {
    const clean = text.trim();
    if (!clean || !currentRound || currentRound.status !== 'playing') {
      NetworkManager.sendChat(text);
      return;
    }

    if (currentRound.describerId === myId) {
      NetworkManager.sendChat(text);
      return;
    }

    if (isHost) {
      checkGuess(myId, clean);
    } else {
      NetworkManager.sendGameData({ type: 'TD_GUESS', guess: clean });
    }
  }

  function checkGuess(playerId, guess) {
    if (!isHost || !currentRound || currentRound.status !== 'playing') return;
    const realWord = currentRound._realWord || '';
    if (guess.toLowerCase() === realWord.toLowerCase()) {
      const p = players.find(pl => pl.id === playerId);
      NetworkManager.sendChat(`SYSTEM: ${p ? p.nickname : 'Someone'} خمّن الكلمة الصح (${realWord})!`);
      endRound('won', playerId);
    } else {
      const p = players.find(pl => pl.id === playerId);
      NetworkManager.sendChat(`${p ? p.nickname : 'Guest'}: ${guess}`);
    }
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'TD_ROUND_START':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'TD_TICK':
        timeLeft = payload.timeLeft;
        App.updateTimer(timeLeft);
        break;
      case 'TD_GUESS':
        if (isHost) checkGuess(senderId, payload.guess);
        break;
      case 'TD_ROUND_END':
        clearInterval(timerInterval);
        if (currentRound) {
          currentRound.status = payload.status;
          currentRound.word = payload.word;
          currentRound.winnerName = payload.winnerName;
        }
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="message-square-off"></i></div>
          <h3>الكلمة الممنوعة (Taboo)</h3>
          <p>الواصف بيشرح الكلمة السرية في الشات أو بالكلام، بس <strong>ممنوع يقول الكلمات المحظورة</strong>! الشلة بتحاول تخمّن الكلمة في الشات قبل انتهاء الوقت.</p>
          ${isHost
            ? `<button id="td-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ التحدي</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء التحدي...</p>`}
        </div>
      `;
    } else if (currentRound.status === 'playing') {
      const isDescriber = currentRound.describerId === myId;
      const realWord = currentRound._realWord || currentRound.word;
      const realForbidden = currentRound._realForbidden || currentRound.forbidden || [];

      html += `
        <div class="social-card center-card">
          <div class="target-banner" style="border-color: ${currentRound.describerColor};">
            <span>الواصف:</span>
            <strong style="color: ${currentRound.describerColor};">${currentRound.describerName}</strong>
          </div>
      `;

      if (isDescriber) {
        html += `
          <div class="dare-box">
            <span class="dare-badge">اشرح الكلمة دي من غير ما تنطق الممنوعات:</span>
            <p class="dare-text" style="color: var(--neon-cyan) !important;">${realWord}</p>
            <div class="reveal-chips" style="margin-top: 12px;">
              ${realForbidden.map(f => `<span class="reveal-chip" style="border-color: var(--neon-magenta); color: var(--neon-magenta);"><i data-lucide="ban"></i> ${f}</span>`).join('')}
            </div>
          </div>
          ${isHost ? `<button id="td-skip-btn" class="glass-btn small-btn"><i data-lucide="skip-forward"></i> تخطي الكلمة</button>` : ''}
        `;
      } else {
        html += `
          <p class="social-question">اسمع شرح <strong>${currentRound.describerName}</strong> واكتب تخمينك في الشات الجانبي!</p>
          <p class="waiting-pulse">جاري الشرح...</p>
          ${isHost ? `<button id="td-skip-btn" class="glass-btn small-btn"><i data-lucide="skip-forward"></i> إنهاء الجولة</button>` : ''}
        `;
      }
      html += `</div>`;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="result-banner ${currentRound.status === 'won' ? 'win' : 'lose'}">
            ${currentRound.status === 'won'
              ? `مبروك! ${currentRound.winnerName} خمّن الكلمة الصح!`
              : `انتهى الوقت! محدش خمّن الكلمة.`}
          </div>
          <p>الكلمة السرية كانت: <strong class="secret-word-highlight">${currentRound.word}</strong></p>
          ${isHost
            ? `<button id="td-start-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> الدور اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف للدور التالي...</p>`}
        </div>
      `;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('td-start-btn')?.addEventListener('click', startRound);
    document.getElementById('td-skip-btn')?.addEventListener('click', () => endRound('timeout', null));
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('taboo-dash', TabooDashGame);
  });

  return { start, stop, handleData, submitGuess };
})();
