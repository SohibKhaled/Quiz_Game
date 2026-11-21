// Reaction Duel (Reflex Speed Showdown) - Arcade Game
const ReactionDuelGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};

  let phase = 'idle'; // 'idle' | 'waiting' | 'go' | 'result'
  let goTimestamp = 0;
  let roundTimer = null;
  let reactions = {}; // id -> ms or 'early'

  function getStage() {
    return document.getElementById('reaction-duel-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    phase = 'idle';
    reactions = {};

    App.updateScores(scores);
    render();
  }

  function stop() {
    clearTimeout(roundTimer);
    phase = 'idle';
  }

  function startRound() {
    if (!isHost) return;
    clearTimeout(roundTimer);
    phase = 'waiting';
    reactions = {};

    NetworkManager.broadcastGameData({ type: 'RD_WAIT', scores });
    render();

    const delay = 1800 + Math.floor(Math.random() * 3200);
    roundTimer = setTimeout(() => {
      if (phase !== 'waiting') return;
      phase = 'go';
      goTimestamp = performance.now();
      NetworkManager.broadcastGameData({ type: 'RD_GO' });
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
      render();
    }, delay);
  }

  function handlePadClick() {
    if (phase === 'idle' || phase === 'result') return;
    if (reactions[myId] !== undefined) return;

    if (phase === 'waiting') {
      reactions[myId] = 'early';
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
      if (isHost) {
        recordReaction(myId, 'early');
      } else {
        NetworkManager.sendGameData({ type: 'RD_REACT', time: 'early' });
      }
      render();
    } else if (phase === 'go') {
      const ms = Math.max(1, Math.round(performance.now() - goTimestamp));
      reactions[myId] = ms;
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
      if (isHost) {
        recordReaction(myId, ms);
      } else {
        NetworkManager.sendGameData({ type: 'RD_REACT', time: ms });
      }
      render();
    }
  }

  function recordReaction(playerId, time) {
    if (!isHost) return;
    reactions[playerId] = time;

    if (Object.keys(reactions).length >= players.length) {
      finishRound();
    } else {
      NetworkManager.broadcastGameData({ type: 'RD_UPDATE', reactions });
      render();
    }
  }

  function finishRound() {
    if (!isHost) return;
    clearTimeout(roundTimer);
    phase = 'result';

    let bestId = null;
    let bestTime = Infinity;

    Object.entries(reactions).forEach(([id, val]) => {
      if (val === 'early') {
        scores[id] = Math.max(0, (scores[id] || 0) - 5);
      } else if (typeof val === 'number' && val < bestTime) {
        bestTime = val;
        bestId = id;
      }
    });

    if (bestId) {
      scores[bestId] = (scores[bestId] || 0) + 15;
    }

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
    NetworkManager.broadcastGameData({ type: 'RD_RESULT', reactions, scores, bestId });
    render();
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'RD_WAIT':
        phase = 'waiting';
        reactions = {};
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
      case 'RD_GO':
        phase = 'go';
        goTimestamp = performance.now();
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'RD_REACT':
        if (isHost) recordReaction(senderId, payload.time);
        break;
      case 'RD_UPDATE':
        reactions = payload.reactions;
        render();
        break;
      case 'RD_RESULT':
        phase = 'result';
        reactions = payload.reactions;
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    let padClass = 'rd-pad';
    let padLabel = 'Ready?';
    let padIcon = 'zap';

    if (phase === 'waiting') {
      padClass += ' waiting';
      padLabel = reactions[myId] === 'early' ? 'TOO EARLY! (-5 pts)' : 'WAIT FOR GREEN...';
      padIcon = 'clock';
    } else if (phase === 'go') {
      padClass += ' go';
      padLabel = typeof reactions[myId] === 'number' ? `${reactions[myId]} ms!` : 'CLICK NOW!';
      padIcon = 'zap';
    } else if (phase === 'result') {
      padClass += ' result';
      padLabel = 'Round Complete';
      padIcon = 'trophy';
    }

    let html = `<div class="reaction-wrapper">`;

    if (phase === 'idle') {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="zap"></i></div>
          <h3>Reaction Duel</h3>
          <p>Wait for the neon pad to turn <strong>GREEN</strong>, then tap as fast as you can! Fastest player wins +15 pts. Tapping early costs -5 pts.</p>
          ${isHost
            ? `<button id="rd-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> Start Duel</button>`
            : `<p class="waiting-pulse">Waiting for host to start...</p>`}
        </div>
      `;
    } else {
      html += `
        <button id="rd-pad" class="${padClass}" ${phase === 'result' ? 'disabled' : ''}>
          <i data-lucide="${padIcon}"></i>
          <span>${padLabel}</span>
        </button>
        <div class="rd-results-list">
          ${players.map(p => {
            const r = reactions[p.id];
            const txt = r === undefined ? 'Waiting...' : (r === 'early' ? 'Too Early (-5)' : `${r} ms`);
            return `
              <div class="rd-row" style="border-color: ${p.color};">
                <span style="color: ${p.color}; font-weight: 700;">${p.nickname}</span>
                <span>${txt}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${phase === 'result'
          ? (isHost ? `<button id="rd-next-btn" class="glow-btn-cyan"><i data-lucide="rotate-cw"></i> Next Round</button>` : `<p class="waiting-pulse">Waiting for host...</p>`)
          : (isHost ? `<button id="rd-finish-btn" class="glass-btn small-btn">Finish Round Now</button>` : '')}
      `;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('rd-start-btn')?.addEventListener('click', startRound);
    document.getElementById('rd-next-btn')?.addEventListener('click', startRound);
    document.getElementById('rd-finish-btn')?.addEventListener('click', finishRound);
    document.getElementById('rd-pad')?.addEventListener('click', handlePadClick);
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('reaction-duel', ReactionDuelGame);
  });

  return { start, stop, handleData };
})();
