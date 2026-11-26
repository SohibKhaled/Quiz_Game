// Rank the Crew (ترتيب الشلة بصراحة) - Brutally Honest Social Ranking Game
const RankCrewGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let used = new Set();

  let currentRound = null; // { rankerId, rankerName, rankerColor, trio: [], prompt, rankedOrder: [], status: 'ranking'|'judging'|'done' }

  function getStage() { return document.getElementById('rank-crew-stage'); }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    rotationIdx = 0;
    used.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() { currentRound = null; }

  function nextRound() {
    if (!isHost || players.length < 2) {
      if (players.length < 2) App.showToast('اللعبة محتاجة لاعبين على الأقل!');
      return;
    }
    const ranker = players[rotationIdx % players.length];
    rotationIdx++;

    const others = players.filter(p => p.id !== ranker.id).sort(() => Math.random() - 0.5);
    const trio = others.slice(0, Math.min(3, others.length));

    const pool = (window.SOHIB_BANK && window.SOHIB_BANK.RANK_CREW) || ['رتّب صحابك دول من الأكثر صراحة للأكثر كتماناً:'];
    let avail = pool.filter(q => !used.has(q));
    if (avail.length === 0) { used.clear(); avail = pool; }
    const prompt = avail[Math.floor(Math.random() * avail.length)];
    used.add(prompt);

    currentRound = {
      rankerId: ranker.id,
      rankerName: ranker.nickname,
      rankerColor: ranker.color,
      trio,
      prompt,
      rankedOrder: [],
      status: 'ranking'
    };

    NetworkManager.broadcastGameData({ type: 'RC_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function selectRankItem(playerId) {
    if (!currentRound || currentRound.status !== 'ranking') return;
    if (!NetworkManager.isLocalMode() && currentRound.rankerId !== myId && !isHost) return;
    if (currentRound.rankedOrder.includes(playerId)) return;

    if (isHost) {
      pushRank(playerId);
    } else {
      NetworkManager.sendGameData({ type: 'RC_PICK', playerId });
    }
  }

  function pushRank(playerId) {
    currentRound.rankedOrder.push(playerId);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    if (currentRound.rankedOrder.length >= currentRound.trio.length) {
      currentRound.status = 'judging';
    }
    NetworkManager.broadcastGameData({ type: 'RC_STATE', round: currentRound, scores });
    render();
  }

  function judgeHonesty(honest) {
    if (!isHost || !currentRound) return;
    scores[currentRound.rankerId] = Math.max(0, (scores[currentRound.rankerId] || 0) + (honest ? 20 : -5));
    currentRound.status = 'done';
    currentRound.honest = honest;
    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      honest ? AntigravityAudio.playScore() : AntigravityAudio.playExplosion();
    }
    NetworkManager.broadcastGameData({ type: 'RC_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'RC_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      render();
    } else if (payload.type === 'RC_PICK' && isHost) {
      if (senderId === currentRound?.rankerId) pushRank(payload.playerId);
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const canRank = NetworkManager.isLocalMode() || isHost || (currentRound && currentRound.rankerId === myId);

    let html = `<div class="social-game-wrapper rtl-text">`;
    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="list-ordered"></i></div>
          <h3>ترتيب الشلة بصراحة</h3>
          <p>كل لاعب هيرتب 3 من صحابه من غير مجاملة على موقف صعب أو صفة حقيقية، والشلة تقرر هل كان صادق 100% ولا بيجامل!</p>
          ${isHost ? `<button id="rc-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ الترتيب</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="target-banner" style="border-color:${currentRound.rankerColor};">
            <span>المُصنِّف:</span>
            <strong style="color:${currentRound.rankerColor};">${currentRound.rankerName}</strong>
          </div>
          <h3 class="social-question">${currentRound.prompt}</h3>
      `;

      if (currentRound.status === 'ranking') {
        html += `
          <p class="vibe-subtitle">اضغط على الأسماء بالترتيب (من رقم 1 للأخير):</p>
          <div class="player-vote-grid" style="width:100%;">
            ${currentRound.trio.map(p => {
              const rankIdx = currentRound.rankedOrder.indexOf(p.id);
              return `
                <button class="player-vote-btn rc-pick-btn ${rankIdx !== -1 ? 'selected' : ''}" data-id="${p.id}" style="border-color:${p.color};" ${!canRank || rankIdx !== -1 ? 'disabled' : ''}>
                  <span class="dot" style="background:${p.color};"></span>
                  <span>${rankIdx !== -1 ? `#${rankIdx + 1} ` : ''}${p.nickname}</span>
                </button>
              `;
            }).join('')}
          </div>
        `;
      } else {
        html += `
          <div class="poll-results" style="width:100%;">
            ${currentRound.rankedOrder.map((pid, idx) => {
              const p = currentRound.trio.find(x => x.id === pid);
              return p ? `
                <div class="rd-row" style="border-color:${p.color};">
                  <span style="color:${p.color}; font-weight:700;">المركز #${idx + 1}</span>
                  <strong>${p.nickname}</strong>
                </div>
              ` : '';
            }).join('')}
          </div>
        `;
        if (currentRound.status === 'judging') {
          html += isHost ? `
            <div class="vote-actions">
              <button id="rc-honest-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> صادق 100% (+20)</button>
              <button id="rc-fake-btn" class="glow-btn-magenta"><i data-lucide="x-circle"></i> بيجامل! (-5)</button>
            </div>
          ` : `<p class="waiting-pulse">الشلة بتناقش الترتيب...</p>`;
        } else {
          html += `
            <div class="result-banner ${currentRound.honest ? 'win' : 'lose'}" style="width:100%;">
              ${currentRound.honest ? 'الترتيب كان صريح جداً (+20)!' : 'الشلة قفشت المجاملة (-5)!'}
            </div>
            ${isHost ? `<button id="rc-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> اللاعب التالي</button>` : ''}
          `;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('rc-start-btn')?.addEventListener('click', nextRound);
    document.getElementById('rc-next-btn')?.addEventListener('click', nextRound);
    document.getElementById('rc-honest-btn')?.addEventListener('click', () => judgeHonesty(true));
    document.getElementById('rc-fake-btn')?.addEventListener('click', () => judgeHonesty(false));
    stage.querySelectorAll('.rc-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => selectRankItem(btn.getAttribute('data-id')));
    });
  }

  window.addEventListener('DOMContentLoaded', () => App.registerGame('rank-crew', RankCrewGame));
  return { start, stop, handleData };
})();
