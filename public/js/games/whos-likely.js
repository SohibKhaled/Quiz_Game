// Who's Most Likely To (مين فينا؟) - Social Hangout Game
const WhosLikelyGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let usedPrompts = new Set();

  let currentRound = null; // { prompt, votes: { [voterId]: targetId }, status: 'voting'|'revealed' }

  const PROMPTS = [
    'مين فينا اللي بيتأخر دايماً وبيقول "أنا نازل على السلم" وهو لسه نايم؟',
    'مين فينا اللي ممكن يضيع في مكان راحله 10 مرات قبل كده؟',
    'مين فينا اللي لو مسك فلوس كتير هيصرفها كلها في أسبوع واحد؟',
    'مين فينا اللي بيضحك في المواقف الجد اللي مينفعش فيها ضحك خالص؟',
    'مين فينا اللي هيغتني ويبقى مليونير قبل الباقي؟',
    'مين فينا اللي لو دخل فيلم رعب هيكون أول واحد يصرخ ويجري؟',
    'مين فينا اللي ممكن ينسى عيد ميلاد أقرب صاحب ليه؟',
    'مين فينا اللي بيكتب رسايل طويلة أوي وبعدين يمسحها ويبعت "تمام"؟',
    'مين فينا اللي دايماً عنده خطة سرية أو فكرة مجنونة للخروج؟',
    'مين فينا اللي بيعرف يطلع نفسه من أي مشكلة بكلمتين حلوين؟',
    'مين فينا اللي موبايله دايماً شحنه أقل من 10%؟',
    'مين فينا اللي لو سافرنا رحلة هيشيل هم الشنط والأكل للكل؟'
  ];

  function getStage() {
    return document.getElementById('whos-likely-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    usedPrompts.clear();
    currentRound = null;

    App.updateScores(scores);
    render();
  }

  function stop() {
    currentRound = null;
  }

  function nextPrompt() {
    if (!isHost) return;
    let available = PROMPTS.filter(p => !usedPrompts.has(p));
    if (available.length === 0) {
      usedPrompts.clear();
      available = PROMPTS;
    }
    const prompt = available[Math.floor(Math.random() * available.length)];
    usedPrompts.add(prompt);

    currentRound = {
      prompt,
      votes: {},
      status: 'voting'
    };

    NetworkManager.broadcastGameData({
      type: 'WL_NEW_ROUND',
      round: currentRound,
      scores
    });

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function castVote(targetId) {
    if (!currentRound || currentRound.status !== 'voting') return;
    if (currentRound.votes[myId]) return;

    if (isHost) {
      recordVote(myId, targetId);
    } else {
      NetworkManager.sendGameData({ type: 'WL_VOTE', targetId });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordVote(voterId, targetId) {
    if (!isHost || !currentRound || currentRound.status !== 'voting') return;
    currentRound.votes[voterId] = targetId;

    if (Object.keys(currentRound.votes).length >= players.length) {
      revealVotes();
    } else {
      NetworkManager.broadcastGameData({
        type: 'WL_STATE',
        round: currentRound,
        scores
      });
      render();
    }
  }

  function revealVotes() {
    if (!isHost || !currentRound) return;
    currentRound.status = 'revealed';

    // Tally votes
    const counts = {};
    players.forEach(p => { counts[p.id] = 0; });
    Object.values(currentRound.votes).forEach(tid => {
      if (counts[tid] !== undefined) counts[tid]++;
    });

    let maxVotes = 0;
    Object.values(counts).forEach(c => { if (c > maxVotes) maxVotes = c; });

    const winners = Object.keys(counts).filter(id => counts[id] === maxVotes && maxVotes > 0);
    // Award +10 points to anyone who voted with the majority
    Object.entries(currentRound.votes).forEach(([voterId, targetId]) => {
      if (winners.includes(targetId)) {
        scores[voterId] = (scores[voterId] || 0) + 10;
      }
    });

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();

    NetworkManager.broadcastGameData({
      type: 'WL_STATE',
      round: currentRound,
      scores
    });
    render();
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'WL_NEW_ROUND':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'WL_STATE':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
      case 'WL_VOTE':
        if (isHost) recordVote(senderId, payload.targetId);
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
          <div class="social-icon-badge"><i data-lucide="crosshair"></i></div>
          <h3>مين فينا؟</h3>
          <p>هيظهر سؤال عن الشلة، وكل واحد يصوّت سراً على أكتر شخص ينطبق عليه الوصف! اللي يصوّت مع الأغلبية بيكسب 10 نقط.</p>
          ${isHost
            ? `<button id="wl-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ التصويت</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء اللعبة...</p>`}
        </div>
      `;
    } else {
      const myVote = currentRound.votes[myId];
      const totalVotes = Object.keys(currentRound.votes).length;

      html += `
        <div class="social-card">
          <h3 class="social-question">${currentRound.prompt}</h3>
      `;

      if (currentRound.status === 'voting') {
        html += `
          <div class="player-vote-grid">
            ${players.map(p => `
              <button class="player-vote-btn ${myVote === p.id ? 'selected' : ''}" 
                data-id="${p.id}" style="border-color: ${p.color};" ${myVote ? 'disabled' : ''}>
                <span class="dot" style="background: ${p.color};"></span>
                <span>${p.nickname}</span>
              </button>
            `).join('')}
          </div>
          <p class="vote-counter">صوّتوا حتى الآن: ${totalVotes} / ${players.length}</p>
          ${isHost && totalVotes > 0 ? `<button id="wl-reveal-btn" class="glass-btn small-btn" style="margin-top:8px;">اكشف النتيجة الآن</button>` : ''}
        `;
      } else {
        const counts = {};
        players.forEach(p => { counts[p.id] = 0; });
        Object.values(currentRound.votes).forEach(tid => {
          if (counts[tid] !== undefined) counts[tid]++;
        });
        const maxVotes = Math.max(0, ...Object.values(counts));

        html += `
          <div class="poll-results">
            ${players.map(p => {
              const c = counts[p.id] || 0;
              const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
              const isTop = c === maxVotes && maxVotes > 0;
              return `
                <div class="poll-row ${isTop ? 'top-winner' : ''}">
                  <div class="poll-label">
                    <span style="color: ${p.color}; font-weight: 700;">${isTop ? '<i data-lucide="crown"></i> ' : ''}${p.nickname}</span>
                    <span>${c} صوت (${pct}%)</span>
                  </div>
                  <div class="poll-bar-bg">
                    <div class="poll-bar-fill" style="width: ${pct}%; background: ${p.color};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          ${isHost
            ? `<button id="wl-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> السؤال اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف للسؤال التالي...</p>`}
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    const startBtn = document.getElementById('wl-start-btn');
    if (startBtn) startBtn.addEventListener('click', nextPrompt);

    const nextBtn = document.getElementById('wl-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextPrompt);

    const revealBtn = document.getElementById('wl-reveal-btn');
    if (revealBtn) revealBtn.addEventListener('click', revealVotes);

    stage.querySelectorAll('.player-vote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        castVote(btn.getAttribute('data-id'));
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('whos-likely', WhosLikelyGame);
  });

  return { start, stop, handleData };
})();
