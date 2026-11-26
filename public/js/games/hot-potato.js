// Hot Potato Bomb (القنبلة الموقوتة) - Fast-Paced Pass-the-Bomb Hangout Game
const HotPotatoGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let holderIdx = 0;
  let fuseTimer = null;
  let used = new Set();

  let currentRound = null; // { holderId, holderName, holderColor, prompt, status: 'ticking'|'exploded', penaltyText }

  function getStage() { return document.getElementById('hot-potato-stage'); }

  function start(hostFlag, playerList, localId) {
    clearTimeout(fuseTimer);
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    holderIdx = 0;
    used.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() {
    clearTimeout(fuseTimer);
    currentRound = null;
  }

  function drawPrompt() {
    const pool = (window.SOHIB_BANK && window.SOHIB_BANK.HOT_POTATO) || ['قول اسم فيلم بسرعة!'];
    let avail = pool.filter(p => !used.has(p));
    if (avail.length === 0) { used.clear(); avail = pool; }
    const pick = avail[Math.floor(Math.random() * avail.length)];
    used.add(pick);
    return pick;
  }

  function startBombRound() {
    if (!isHost || players.length === 0) return;
    clearTimeout(fuseTimer);

    holderIdx = Math.floor(Math.random() * players.length);
    const holder = players[holderIdx];
    currentRound = {
      holderId: holder.id,
      holderName: holder.nickname,
      holderColor: holder.color,
      prompt: drawPrompt(),
      penaltyText: '',
      status: 'ticking'
    };

    const fuseMs = 15000 + Math.floor(Math.random() * 18000); // 15s to 33s hidden fuse
    fuseTimer = setTimeout(explodeBomb, fuseMs);

    NetworkManager.broadcastGameData({ type: 'HP_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function passBomb() {
    if (!currentRound || currentRound.status !== 'ticking') return;
    if (!NetworkManager.isLocalMode() && currentRound.holderId !== myId && !isHost) return;

    if (isHost) {
      advanceHolder();
    } else {
      NetworkManager.sendGameData({ type: 'HP_PASS' });
    }
  }

  function advanceHolder() {
    if (!isHost || !currentRound || currentRound.status !== 'ticking') return;
    scores[currentRound.holderId] = (scores[currentRound.holderId] || 0) + 5;
    holderIdx = (holderIdx + 1) % players.length;
    const nextHolder = players[holderIdx];
    currentRound.holderId = nextHolder.id;
    currentRound.holderName = nextHolder.nickname;
    currentRound.holderColor = nextHolder.color;
    currentRound.prompt = drawPrompt();

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    NetworkManager.broadcastGameData({ type: 'HP_STATE', round: currentRound, scores });
    render();
  }

  function explodeBomb() {
    if (!isHost || !currentRound || currentRound.status !== 'ticking') return;
    currentRound.status = 'exploded';
    scores[currentRound.holderId] = Math.max(0, (scores[currentRound.holderId] || 0) - 10);
    const penalties = (window.SOHIB_BANK && window.SOHIB_BANK.HEAVY_PENALTIES) || ['يعمل 15 ضغط دلوقتي'];
    currentRound.penaltyText = penalties[Math.floor(Math.random() * penalties.length)];

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
    NetworkManager.broadcastGameData({ type: 'HP_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'HP_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      if (currentRound?.status === 'exploded' && typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
      render();
    } else if (payload.type === 'HP_PASS' && isHost) {
      if (senderId === currentRound?.holderId) advanceHolder();
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const canPass = NetworkManager.isLocalMode() || isHost || (currentRound && currentRound.holderId === myId);

    let html = `<div class="social-game-wrapper rtl-text">`;
    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="bomb"></i></div>
          <h3>القنبلة الموقوتة</h3>
          <p>القنبلة معاك وممكن تنفجر في أي لحظة (وقت سري)! جاوب بسرعة على المطلوب واضغط <strong>مرّر القنبلة</strong> للي بعدك. اللي تنفجر في إيده ياخد حكم تقيل!</p>
          ${isHost ? `<button id="hp-start-btn" class="glow-btn-magenta"><i data-lucide="flame"></i> ولّع القنبلة!</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    } else if (currentRound.status === 'ticking') {
      html += `
        <div class="social-card center-card">
          <div class="bomb-pulse-badge"><i data-lucide="bomb"></i> القنبلة بتتكّت!</div>
          <div class="target-banner" style="border-color:${currentRound.holderColor};">
            <span>القنبلة في إيد:</span>
            <strong style="color:${currentRound.holderColor};">${currentRound.holderName}</strong>
          </div>
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge"><i data-lucide="zap"></i> جاوب بسرعة عشان تمرّرها:</span>
            <p class="dare-text">${currentRound.prompt}</p>
          </div>
          ${canPass
            ? `<button id="hp-pass-btn" class="glow-btn-cyan" style="width:100%;"><i data-lucide="send"></i> جاوبت! مرّر القنبلة للي بعدي (+5)</button>`
            : `<p class="waiting-pulse">مستنيين ${currentRound.holderName} يجاوب ويمرّر القنبلة...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="result-banner lose" style="width:100%;">
            <i data-lucide="bomb"></i> بوووم! القنبلة انفجرت في إيد ${currentRound.holderName} (-10 نقاط)
          </div>
          <div class="dare-box penalty-box" style="width:100%;">
            <span class="dare-badge" style="color:var(--neon-magenta);"><i data-lucide="gavel"></i> حكم الانفجار</span>
            <p class="dare-text">${currentRound.penaltyText}</p>
          </div>
          ${isHost ? `<button id="hp-start-btn" class="glow-btn-cyan"><i data-lucide="rotate-cw"></i> قنبلة جديدة</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    }
    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('hp-start-btn')?.addEventListener('click', startBombRound);
    document.getElementById('hp-pass-btn')?.addEventListener('click', passBomb);
  }

  window.addEventListener('DOMContentLoaded', () => App.registerGame('hot-potato', HotPotatoGame));
  return { start, stop, handleData };
})();
