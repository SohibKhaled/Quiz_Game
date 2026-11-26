// Sacrifice Bid (رهان الشجاعة) - High-Stakes Group Challenge (Online + Single Device)
const SacrificeBidGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let used = new Set();
  let currentRound = null; // { challenge, pts, volunteerId, volunteerName, status: 'bidding'|'acting'|'done' }

  function getStage() { return document.getElementById('sacrifice-bid-stage'); }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    used.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() { currentRound = null; }

  function nextChallenge() {
    if (!isHost) return;
    const pool = (window.SOHIB_BANK && window.SOHIB_BANK.SACRIFICE_BID) || [{ challenge: 'مين قدها يعمل 20 ضغط؟', pts: 25 }];
    let avail = pool.filter(c => !used.has(c.challenge));
    if (avail.length === 0) { used.clear(); avail = pool; }
    const pick = avail[Math.floor(Math.random() * avail.length)];
    used.add(pick.challenge);

    currentRound = {
      challenge: pick.challenge,
      pts: pick.pts,
      volunteerId: null,
      volunteerName: '',
      status: 'bidding'
    };
    NetworkManager.broadcastGameData({ type: 'SB_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function claimVolunteer(playerId) {
    if (!currentRound || currentRound.status !== 'bidding') return;
    if (isHost) {
      const p = players.find(pl => pl.id === playerId);
      if (!p) return;
      currentRound.volunteerId = p.id;
      currentRound.volunteerName = p.nickname;
      currentRound.status = 'acting';
      NetworkManager.broadcastGameData({ type: 'SB_STATE', round: currentRound, scores });
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      render();
    } else {
      NetworkManager.sendGameData({ type: 'SB_CLAIM' });
    }
  }

  function resolveChallenge(success) {
    if (!isHost || !currentRound) return;
    if (currentRound.volunteerId) {
      scores[currentRound.volunteerId] = Math.max(0, (scores[currentRound.volunteerId] || 0) + (success ? currentRound.pts : -10));
    }
    currentRound.status = 'done';
    currentRound.success = success;
    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      success ? AntigravityAudio.playScore() : AntigravityAudio.playExplosion();
    }
    NetworkManager.broadcastGameData({ type: 'SB_STATE', round: currentRound, scores });
    render();
  }

  function noTakersPenalty() {
    if (!isHost || !currentRound) return;
    const victim = players[Math.floor(Math.random() * players.length)];
    currentRound.volunteerId = victim.id;
    currentRound.volunteerName = victim.nickname;
    currentRound.status = 'acting';
    App.showToast(`محدش اتطوع! القرعة اختارت ${victim.nickname} ينفّذ!`);
    NetworkManager.broadcastGameData({ type: 'SB_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'SB_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      render();
    } else if (payload.type === 'SB_CLAIM' && isHost) {
      claimVolunteer(senderId);
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const isLocal = NetworkManager.isLocalMode();

    let html = `<div class="social-game-wrapper rtl-text">`;
    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="hand"></i></div>
          <h3>رهان الشجاعة (مين قدها؟)</h3>
          <p>تحديات تقيلة ونقط ضخمة! اللي يرفع إيده الأول وينفّذ التحدي ياخد <strong>+25 أو +35 نقطة</strong>. ولو محدش اتطوع، القرعة هتختار ضحية عشوائية!</p>
          ${isHost ? `<button id="sb-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> اعرض أول رهان</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="round-meta-strip">
            <span class="badge"><i data-lucide="award"></i> الجائزة: +${currentRound.pts} نقطة</span>
          </div>
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge"><i data-lucide="flame"></i> تحدي الرهان</span>
            <p class="dare-text">${currentRound.challenge}</p>
          </div>
      `;

      if (currentRound.status === 'bidding') {
        if (isLocal) {
          html += `
            <p class="vibe-subtitle">مين اللي قد التحدي؟ اختار اسمه:</p>
            <div class="player-vote-grid" style="width:100%;">
              ${players.map(p => `
                <button class="player-vote-btn sb-local-claim" data-id="${p.id}" style="border-color:${p.color};">
                  <span class="dot" style="background:${p.color};"></span>
                  <span>${p.nickname}</span>
                </button>
              `).join('')}
            </div>
            <button id="sb-notaker-btn" class="glass-btn danger-hover-btn"><i data-lucide="dices"></i> محدش اتطوع (اختار ضحية عشوائي!)</button>
          `;
        } else {
          html += `
            <button id="sb-claim-btn" class="glow-btn-magenta"><i data-lucide="hand"></i> أنا قدها! (+${currentRound.pts})</button>
            ${isHost ? `<button id="sb-notaker-btn" class="glass-btn small-btn"><i data-lucide="dices"></i> محدش اتطوع (قرعة)</button>` : ''}
          `;
        }
      } else if (currentRound.status === 'acting') {
        html += `
          <div class="target-banner" style="border-color: var(--neon-cyan);">
            <span>المتحدّي:</span>
            <strong>${currentRound.volunteerName}</strong>
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="sb-win-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> نفّذ الرهان (+${currentRound.pts})</button>
              <button id="sb-lose-btn" class="glow-btn-magenta"><i data-lucide="x-circle"></i> فشل (-10)</button>
            </div>
          ` : `<p class="waiting-pulse">مستنيين ${currentRound.volunteerName} ينفّذ...</p>`}
        `;
      } else {
        html += `
          <div class="result-banner ${currentRound.success ? 'win' : 'lose'}" style="width:100%;">
            ${currentRound.success ? `${currentRound.volunteerName} كسب الرهان (+${currentRound.pts} نقطة)!` : `${currentRound.volunteerName} خسر الرهان (-10 نقاط)!`}
          </div>
          ${isHost ? `<button id="sb-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> الرهان اللي بعده</button>` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        `;
      }
      html += `</div>`;
    }
    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('sb-start-btn')?.addEventListener('click', nextChallenge);
    document.getElementById('sb-next-btn')?.addEventListener('click', nextChallenge);
    document.getElementById('sb-claim-btn')?.addEventListener('click', () => claimVolunteer(myId));
    document.getElementById('sb-notaker-btn')?.addEventListener('click', noTakersPenalty);
    document.getElementById('sb-win-btn')?.addEventListener('click', () => resolveChallenge(true));
    document.getElementById('sb-lose-btn')?.addEventListener('click', () => resolveChallenge(false));
    stage.querySelectorAll('.sb-local-claim').forEach(btn => {
      btn.addEventListener('click', () => claimVolunteer(btn.getAttribute('data-id')));
    });
  }

  window.addEventListener('DOMContentLoaded', () => App.registerGame('sacrifice-bid', SacrificeBidGame));
  return { start, stop, handleData };
})();
