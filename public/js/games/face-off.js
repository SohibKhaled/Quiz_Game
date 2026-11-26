// Face-Off (مواجهة وجهاً لوجه) - Intense 1v1 Hangout Duel (Online + Single Device)
const FaceOffGame = (function() {
  let isHost = false;
  let players = [];
  let scores = {};
  let usedPrompts = new Set();
  let currentRound = null; // { p1, p2, prompt, winnerId }

  function getStage() { return document.getElementById('face-off-stage'); }

  function start(hostFlag, playerList) {
    isHost = hostFlag;
    players = playerList;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    usedPrompts.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() { currentRound = null; }

  function nextDuel() {
    if (!isHost || players.length < 2) {
      if (players.length < 2) App.showToast('محتاج لاعبين على الأقل للمواجهة!');
      return;
    }
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const p1 = shuffled[0];
    const p2 = shuffled[1];

    const pool = (window.SOHIB_BANK && window.SOHIB_BANK.FACE_OFF) || ['تحدي صراحة مباشر بينكم!'];
    let avail = pool.filter(q => !usedPrompts.has(q));
    if (avail.length === 0) { usedPrompts.clear(); avail = pool; }
    const prompt = avail[Math.floor(Math.random() * avail.length)];
    usedPrompts.add(prompt);

    currentRound = { p1, p2, prompt, winnerId: null };
    NetworkManager.broadcastGameData({ type: 'FO_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function pickWinner(winnerId) {
    if (!isHost || !currentRound) return;
    currentRound.winnerId = winnerId;
    if (winnerId === 'tie') {
      scores[currentRound.p1.id] = (scores[currentRound.p1.id] || 0) + 10;
      scores[currentRound.p2.id] = (scores[currentRound.p2.id] || 0) + 10;
    } else {
      scores[winnerId] = (scores[winnerId] || 0) + 20;
    }
    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    NetworkManager.broadcastGameData({ type: 'FO_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'FO_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
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
          <div class="social-icon-badge"><i data-lucide="swords"></i></div>
          <h3>مواجهة وجهاً لوجه</h3>
          <p>في كل جولة بنختار اتنين من الشلة في مواجهة صريحة أو تحدي مباشر، والشلة بتختار مين اللي كسب المواجهة (+20 نقطة)!</p>
          ${isHost ? `<button id="fo-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ المواجهة</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="faceoff-vs-banner">
            <span class="fo-player" style="border-color:${currentRound.p1.color}; color:${currentRound.p1.color};">${currentRound.p1.nickname}</span>
            <span class="fo-vs">VS</span>
            <span class="fo-player" style="border-color:${currentRound.p2.color}; color:${currentRound.p2.color};">${currentRound.p2.nickname}</span>
          </div>
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge"><i data-lucide="swords"></i> تحدي المواجهة</span>
            <p class="dare-text">${currentRound.prompt}</p>
          </div>
      `;

      if (!currentRound.winnerId) {
        html += isHost ? `
          <div class="vote-actions">
            <button id="fo-win-1" class="glow-btn-cyan">${currentRound.p1.nickname} كسب (+20)</button>
            <button id="fo-win-tie" class="glass-btn">تعادل (+10)</button>
            <button id="fo-win-2" class="glow-btn-magenta">${currentRound.p2.nickname} كسب (+20)</button>
          </div>
        ` : `<p class="waiting-pulse">المضيف بيحدد الفايز في المواجهة...</p>`;
      } else {
        const wName = currentRound.winnerId === 'tie' ? 'تعادل بطولي!' : (currentRound.winnerId === currentRound.p1.id ? currentRound.p1.nickname : currentRound.p2.nickname);
        html += `
          <div class="result-banner win" style="width:100%;"><i data-lucide="trophy"></i> ${wName}</div>
          ${isHost ? `<button id="fo-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> المواجهة التالية</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        `;
      }
      html += `</div>`;
    }
    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('fo-start-btn')?.addEventListener('click', nextDuel);
    document.getElementById('fo-next-btn')?.addEventListener('click', nextDuel);
    document.getElementById('fo-win-1')?.addEventListener('click', () => pickWinner(currentRound.p1.id));
    document.getElementById('fo-win-2')?.addEventListener('click', () => pickWinner(currentRound.p2.id));
    document.getElementById('fo-win-tie')?.addEventListener('click', () => pickWinner('tie'));
  }

  window.addEventListener('DOMContentLoaded', () => App.registerGame('face-off', FaceOffGame));
  return { start, stop, handleData };
})();
