// 5-Second Rule (تحدي الـ 5 ثواني) - Social Hangout Game (Online + Single Device)
const FiveSecondsGame = (function() {
  let isHost = false;
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let timerInterval = null;
  let used = new Set();

  let currentRound = null; // { targetId, targetName, targetColor, prompt, timeLeft, phase: 'ready'|'counting'|'done' }

  const PROMPTS = [
    'اذكر 3 أعذار بتقولها لما تتأخر على الشلة!',
    'اذكر 3 أكلات بتاكلها بعد نص الليل!',
    'اذكر 3 حاجات دايماً بتضيع في البيت!',
    'اذكر 3 أفلام مصرية بتحبها جداً!',
    'اذكر 3 حاجات مستحيل تخرج من البيت من غيرهم!',
    'اذكر 3 بلاد نفسك تسافرها!',
    'اذكر 3 حاجات بتعصبك بسرعة!',
    'اذكر 3 تطبيقات بتفتحهم أول ما تصحى من النوم!',
    'اذكر 3 أغاني حافظ كلماتها صم!',
    'اذكر 3 حاجات لو لقيتها في الشارع هتفرح!',
    'اذكر 3 شخصيات مشهورة في الكورة!',
    'اذكر 3 مشروبات بتطلبها في القهوة أو الكافيه!'
  ];

  function getStage() {
    return document.getElementById('five-seconds-stage');
  }

  function start(hostFlag, playerList) {
    isHost = hostFlag;
    players = playerList;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    rotationIdx = 0;
    used.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() {
    clearInterval(timerInterval);
    currentRound = null;
  }

  function nextRound() {
    if (!isHost || players.length === 0) return;
    clearInterval(timerInterval);
    const target = players[rotationIdx % players.length];
    rotationIdx++;

    let avail = PROMPTS.filter(p => !used.has(p));
    if (avail.length === 0) {
      used.clear();
      avail = PROMPTS;
    }
    const prompt = avail[Math.floor(Math.random() * avail.length)];
    used.add(prompt);

    currentRound = {
      targetId: target.id,
      targetName: target.nickname,
      targetColor: target.color,
      prompt,
      timeLeft: 5,
      phase: 'ready'
    };

    App.updateTimer(5);
    NetworkManager.broadcastGameData({ type: 'FS_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function startCountdown() {
    if (!isHost || !currentRound || currentRound.phase !== 'ready') return;
    currentRound.phase = 'counting';
    currentRound.timeLeft = 5;
    NetworkManager.broadcastGameData({ type: 'FS_STATE', round: currentRound, scores });
    render();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!currentRound) { clearInterval(timerInterval); return; }
      currentRound.timeLeft--;
      App.updateTimer(Math.max(0, currentRound.timeLeft));

      if (currentRound.timeLeft > 0) {
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
        NetworkManager.broadcastGameData({ type: 'FS_STATE', round: currentRound, scores });
        render();
      } else {
        clearInterval(timerInterval);
        currentRound.phase = 'done';
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
        NetworkManager.broadcastGameData({ type: 'FS_STATE', round: currentRound, scores });
        render();
      }
    }, 1000);
  }

  function judge(won) {
    if (!isHost || !currentRound) return;
    clearInterval(timerInterval);
    if (won) {
      scores[currentRound.targetId] = (scores[currentRound.targetId] || 0) + 15;
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    }
    App.updateScores(scores);
    nextRound();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'FS_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      if (currentRound) App.updateTimer(Math.max(0, currentRound.timeLeft));
      render();
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="timer"></i></div>
          <h3>تحدي الـ 5 ثواني</h3>
          <p>لازم تقول <strong>3 حاجات</strong> في 5 ثواني بس قبل ما الجرس يضرب! لعبة سرعة وضحك لقعدة الشلة.</p>
          ${isHost
            ? `<button id="fs-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ التحدي</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء التحدي...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="target-banner" style="border-color: ${currentRound.targetColor};">
            <span>المتسابق:</span>
            <strong style="color: ${currentRound.targetColor};">${currentRound.targetName}</strong>
          </div>
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge"><i data-lucide="zap"></i> في 5 ثواني بس</span>
            <p class="dare-text">${currentRound.prompt}</p>
          </div>
          <div class="fs-countdown ${currentRound.phase === 'done' ? 'time-up' : ''}">
            ${currentRound.phase === 'done' ? 'انتهى الوقت!' : currentRound.timeLeft}
          </div>
      `;

      if (currentRound.phase === 'ready') {
        html += isHost
          ? `<button id="fs-go-btn" class="glow-btn-magenta"><i data-lucide="timer"></i> شغّل الـ 5 ثواني!</button>`
          : `<p class="waiting-pulse">استعد يا ${currentRound.targetName}...</p>`;
      } else {
        html += isHost ? `
          <div class="vote-actions">
            <button id="fs-win-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> قالهم في الوقت (+15)</button>
            <button id="fs-lose-btn" class="glow-btn-magenta"><i data-lucide="x-circle"></i> ملحقش (0)</button>
          </div>
        ` : `<p class="waiting-pulse">المضيف بيحسب النتيجة...</p>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('fs-start-btn')?.addEventListener('click', nextRound);
    document.getElementById('fs-go-btn')?.addEventListener('click', startCountdown);
    document.getElementById('fs-win-btn')?.addEventListener('click', () => judge(true));
    document.getElementById('fs-lose-btn')?.addEventListener('click', () => judge(false));
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('five-seconds', FiveSecondsGame);
  });

  return { start, stop, handleData };
})();
