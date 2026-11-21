// Truth or Bluff (حقيقة أم كذبة) - Social Hangout Game
const TruthBluffGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;

  let currentRound = null;
  // { tellerId, tellerName, tellerColor, statements: [s0, s1, s2], lieIdx: 0|1|2, votes: { [id]: idx }, phase: 'writing'|'voting'|'revealed' }

  const SAMPLE_SETS = [
    { statements: ['اتكلمت مع شخص مشهور قبل كده', 'سافرت بره البلد لوحدي', 'عمري ما ركبت طيارة'], lieIdx: 2 },
    { statements: ['كسرت دراع قبل كده وأنا صغير', 'بعرف أطبخ مكرونة بشاميل ممتازة', 'خسرت موبايلي في مواصلات ورجعلي'], lieIdx: 0 },
    { statements: ['نمت في امتحان مهم قبل كده', 'بعرف أعوم كويس جداً', 'دخلت بيت مسكون أو مهجور'], lieIdx: 2 },
    { statements: ['اشتغلت شغلانة غريبة وأنا في الجامعة', 'عندي فوبيا من الأماكن العالية', 'قابلت صاحبي المفضل بالصدفة في مدينة تانية'], lieIdx: 1 }
  ];

  function getStage() {
    return document.getElementById('truth-bluff-stage');
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
    currentRound = null;
  }

  function startNextRound() {
    if (!isHost || players.length === 0) return;
    const teller = players[rotationIdx % players.length];
    rotationIdx++;

    currentRound = {
      tellerId: teller.id,
      tellerName: teller.nickname,
      tellerColor: teller.color,
      statements: ['', '', ''],
      lieIdx: 2,
      votes: {},
      phase: 'writing'
    };

    NetworkManager.broadcastGameData({ type: 'TB_ROUND', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function submitStatements(statements, lieIdx) {
    if (!currentRound || currentRound.tellerId !== myId || currentRound.phase !== 'writing') return;
    if (isHost) {
      activateVoting(statements, lieIdx);
    } else {
      NetworkManager.sendGameData({ type: 'TB_SUBMIT_STATEMENTS', statements, lieIdx });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function activateVoting(statements, lieIdx) {
    if (!isHost || !currentRound) return;
    currentRound.statements = statements;
    currentRound.lieIdx = lieIdx;
    currentRound.votes = {};
    currentRound.phase = 'voting';
    NetworkManager.broadcastGameData({ type: 'TB_ROUND', round: currentRound, scores });
    render();
  }

  function castVote(idx) {
    if (!currentRound || currentRound.phase !== 'voting') return;
    if (currentRound.tellerId === myId && players.length > 1) return;
    if (currentRound.votes[myId] !== undefined) return;

    if (isHost) {
      recordVote(myId, idx);
    } else {
      NetworkManager.sendGameData({ type: 'TB_VOTE', idx });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordVote(voterId, idx) {
    if (!isHost || !currentRound || currentRound.phase !== 'voting') return;
    currentRound.votes[voterId] = idx;

    const eligible = players.length > 1 ? players.length - 1 : 1;
    if (Object.keys(currentRound.votes).length >= eligible) {
      revealRound();
    } else {
      NetworkManager.broadcastGameData({ type: 'TB_ROUND', round: currentRound, scores });
      render();
    }
  }

  function revealRound() {
    if (!isHost || !currentRound) return;
    currentRound.phase = 'revealed';

    let fooled = 0;
    Object.entries(currentRound.votes).forEach(([vid, idx]) => {
      if (idx === currentRound.lieIdx) {
        scores[vid] = (scores[vid] || 0) + 15;
      } else {
        fooled++;
      }
    });
    scores[currentRound.tellerId] = (scores[currentRound.tellerId] || 0) + (fooled * 10);

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    NetworkManager.broadcastGameData({ type: 'TB_ROUND', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'TB_ROUND':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
      case 'TB_SUBMIT_STATEMENTS':
        if (isHost && senderId === currentRound?.tellerId) {
          activateVoting(payload.statements, payload.lieIdx);
        }
        break;
      case 'TB_VOTE':
        if (isHost) recordVote(senderId, payload.idx);
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
          <div class="social-icon-badge"><i data-lucide="drama"></i></div>
          <h3>حقيقة أم كذبة</h3>
          <p>في كل جولة، لاعب يكتب 3 جمل عن نفسه: <strong>اتنين حقيقة وواحدة كذبة</strong>، والشلة تحاول تكشف الكذبة!</p>
          ${isHost
            ? `<button id="tb-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ الجولة</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء اللعبة...</p>`}
        </div>
      `;
    } else if (currentRound.phase === 'writing') {
      const isTeller = currentRound.tellerId === myId;
      html += `
        <div class="social-card">
          <div class="target-banner" style="border-color: ${currentRound.tellerColor};">
            <span>صاحب القصة:</span>
            <strong style="color: ${currentRound.tellerColor};">${currentRound.tellerName}</strong>
          </div>
      `;
      if (isTeller) {
        html += `
          <p class="vibe-subtitle">اكتب 3 جمل عن نفسك وحدد مين فيهم <strong>الكذبة</strong>:</p>
          <form id="tb-form" class="tb-form">
            ${[0, 1, 2].map(i => `
              <div class="tb-input-row">
                <input type="text" id="tb-s-${i}" placeholder="الجملة رقم ${i + 1}..." maxlength="100" required autocomplete="off">
                <label class="tb-lie-radio">
                  <input type="radio" name="tb-lie" value="${i}" ${i === 2 ? 'checked' : ''}>
                  <span>الكذبة</span>
                </label>
              </div>
            `).join('')}
            <div class="vote-actions">
              <button type="button" id="tb-autofill" class="glass-btn small-btn"><i data-lucide="sparkles"></i> اقترح جمل جاهزة</button>
              <button type="submit" class="glow-btn-cyan"><i data-lucide="send"></i> ارسل للشلة</button>
            </div>
          </form>
        `;
      } else {
        html += `<p class="waiting-pulse">${currentRound.tellerName} بيكتب قصته دلوقتي...</p>`;
      }
      html += `</div>`;
    } else {
      const isTeller = currentRound.tellerId === myId && players.length > 1;
      const myVote = currentRound.votes[myId];
      const totalVotes = Object.keys(currentRound.votes).length;

      html += `
        <div class="social-card">
          <div class="target-banner" style="border-color: ${currentRound.tellerColor};">
            <span>قصص ${currentRound.tellerName} — فين الكذبة؟</span>
          </div>
          <div class="social-options-grid single-col">
            ${currentRound.statements.map((st, idx) => {
              let cls = 'social-opt-btn';
              if (myVote === idx) cls += ' selected';
              if (currentRound.phase === 'revealed') {
                if (idx === currentRound.lieIdx) cls += ' incorrect';
                else cls += ' correct';
              }
              return `
                <button class="${cls}" data-idx="${idx}" ${isTeller || myVote !== undefined || currentRound.phase === 'revealed' ? 'disabled' : ''}>
                  ${currentRound.phase === 'revealed'
                    ? (idx === currentRound.lieIdx ? '<i data-lucide="x-circle"></i> (كذبة) ' : '<i data-lucide="check-circle"></i> (حقيقة) ')
                    : ''}
                  ${st}
                </button>
              `;
            }).join('')}
          </div>
      `;

      if (currentRound.phase === 'voting') {
        html += `<p class="vote-counter">صوّتوا: ${totalVotes} / ${Math.max(1, players.length - 1)}</p>`;
        if (isHost && totalVotes > 0) {
          html += `<button id="tb-reveal-btn" class="glass-btn small-btn"><i data-lucide="eye"></i> اكشف الكذبة</button>`;
        }
      } else {
        html += `
          ${isHost
            ? `<button id="tb-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> اللاعب اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف للجولة التالية...</p>`}
        `;
      }
      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('tb-start-btn')?.addEventListener('click', startNextRound);
    document.getElementById('tb-next-btn')?.addEventListener('click', startNextRound);
    document.getElementById('tb-reveal-btn')?.addEventListener('click', revealRound);

    document.getElementById('tb-autofill')?.addEventListener('click', () => {
      const sample = SAMPLE_SETS[Math.floor(Math.random() * SAMPLE_SETS.length)];
      sample.statements.forEach((txt, idx) => {
        const el = document.getElementById(`tb-s-${idx}`);
        if (el) el.value = txt;
      });
      const radio = document.querySelector(`input[name="tb-lie"][value="${sample.lieIdx}"]`);
      if (radio) radio.checked = true;
    });

    document.getElementById('tb-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const st = [0, 1, 2].map(i => document.getElementById(`tb-s-${i}`).value.trim());
      const lieEl = document.querySelector('input[name="tb-lie"]:checked');
      const lieIdx = lieEl ? parseInt(lieEl.value, 10) : 2;
      if (st.every(Boolean)) submitStatements(st, lieIdx);
    });

    stage.querySelectorAll('.social-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => castVote(parseInt(btn.getAttribute('data-idx'), 10)));
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('truth-bluff', TruthBluffGame);
  });

  return { start, stop, handleData };
})();
