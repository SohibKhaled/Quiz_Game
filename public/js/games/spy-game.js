// The Imposter / Spy (الجاسوس في القعدة) - Social Deduction Hangout Game
const SpyGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};

  let myRole = null; // { isSpy: boolean, word: string, category: string }
  let cardHidden = true;
  let phase = 'idle'; // 'idle' | 'discussion' | 'voting' | 'result'
  let votes = {}; // voterId -> targetId
  let roundMeta = null; // { spyId, spyName, word, category, accusedId, crewWon }

  const SECRET_WORDS = [
    { category: 'أماكن', word: 'الساحل الشمالي' },
    { category: 'أماكن', word: 'قهوة بلدي' },
    { category: 'أماكن', word: 'المطار' },
    { category: 'أماكن', word: 'السينما' },
    { category: 'أماكن', word: 'المستشفى' },
    { category: 'أماكن', word: 'الجيم (النادي)' },
    { category: 'أماكن', word: 'الجامعة' },
    { category: 'أماكن', word: 'حديقة الحيوان' },
    { category: 'أكل', word: 'كشري' },
    { category: 'أكل', word: 'بيتزا' },
    { category: 'أكل', word: 'شاورما' },
    { category: 'مناسبات', word: 'فرح شعبي' },
    { category: 'مناسبات', word: 'أول يوم عيد' },
    { category: 'مناسبات', word: 'سهرة بلايستيشن' }
  ];

  function getStage() {
    return document.getElementById('spy-game-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    phase = 'idle';
    myRole = null;
    cardHidden = true;
    votes = {};
    roundMeta = null;

    App.updateScores(scores);
    render();
  }

  function stop() {
    phase = 'idle';
    myRole = null;
  }

  function startRound() {
    if (!isHost) return;
    if (players.length < 2) {
      App.showToast('لعبة الجاسوس تحتاج لاعبين على الأقل (يفضل 3+)!');
      return;
    }

    const pick = SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)];
    const spyPlayer = players[Math.floor(Math.random() * players.length)];

    roundMeta = {
      spyId: spyPlayer.id,
      spyName: spyPlayer.nickname,
      word: pick.word,
      category: pick.category,
      accusedId: null,
      crewWon: false
    };
    votes = {};
    phase = 'discussion';

    // Send private role to each player
    players.forEach(p => {
      const rolePayload = {
        type: 'SPY_ROLE',
        isSpy: p.id === spyPlayer.id,
        word: p.id === spyPlayer.id ? '???' : pick.word,
        category: pick.category,
        scores
      };

      if (p.id === myId) {
        myRole = rolePayload;
        cardHidden = true;
      } else {
        NetworkManager.sendToPlayer(p.id, rolePayload);
      }
    });

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function openVoting() {
    if (!isHost) return;
    phase = 'voting';
    votes = {};
    NetworkManager.broadcastGameData({ type: 'SPY_PHASE', phase: 'voting' });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    render();
  }

  function castVote(targetId) {
    if (phase !== 'voting' || votes[myId]) return;
    if (isHost) {
      recordVote(myId, targetId);
    } else {
      NetworkManager.sendGameData({ type: 'SPY_VOTE', targetId });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordVote(voterId, targetId) {
    if (!isHost || phase !== 'voting') return;
    votes[voterId] = targetId;

    if (Object.keys(votes).length >= players.length) {
      resolveVoting();
    } else {
      NetworkManager.broadcastGameData({ type: 'SPY_VOTES_UPDATE', votes });
      render();
    }
  }

  function resolveVoting() {
    if (!isHost || !roundMeta) return;
    phase = 'result';

    const counts = {};
    Object.values(votes).forEach(tid => {
      counts[tid] = (counts[tid] || 0) + 1;
    });

    let accusedId = players[0].id;
    let maxV = -1;
    Object.entries(counts).forEach(([id, c]) => {
      if (c > maxV) {
        maxV = c;
        accusedId = id;
      }
    });

    const crewWon = (accusedId === roundMeta.spyId);
    roundMeta.accusedId = accusedId;
    roundMeta.crewWon = crewWon;

    if (crewWon) {
      players.forEach(p => {
        if (p.id !== roundMeta.spyId) {
          scores[p.id] = (scores[p.id] || 0) + 20;
        }
      });
    } else {
      scores[roundMeta.spyId] = (scores[roundMeta.spyId] || 0) + 30;
    }

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      crewWon ? AntigravityAudio.playVictory() : AntigravityAudio.playExplosion();
    }

    NetworkManager.broadcastGameData({
      type: 'SPY_RESULT',
      roundMeta,
      votes,
      scores
    });
    render();
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'SPY_ROLE':
        myRole = payload;
        scores = payload.scores;
        phase = 'discussion';
        cardHidden = true;
        votes = {};
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'SPY_PHASE':
        phase = payload.phase;
        votes = {};
        render();
        break;
      case 'SPY_VOTE':
        if (isHost) recordVote(senderId, payload.targetId);
        break;
      case 'SPY_VOTES_UPDATE':
        votes = payload.votes;
        render();
        break;
      case 'SPY_RESULT':
        phase = 'result';
        roundMeta = payload.roundMeta;
        votes = payload.votes;
        scores = payload.scores;
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') {
          roundMeta.crewWon ? AntigravityAudio.playVictory() : AntigravityAudio.playExplosion();
        }
        render();
        break;
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (phase === 'idle') {
      html += `
        <div class="social-card center-card">
          <div class="social-big-emoji">🕵️</div>
          <h3>الجاسوس في القعدة</h3>
          <p>كل الشلة هتعرف الكلمة السرية ما عدا واحد بس هو <strong>الجاسوس</strong>! اسألوا بعض أسئلة ذكية واكشفوا مين الجاسوس قبل ما يضحك عليكم!</p>
          ${isHost
            ? `<button id="spy-start-btn" class="glow-btn-cyan">وزّع الأدوار 🕵️</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لتوزيع الأدوار...</p>`}
        </div>
      `;
    } else if (phase === 'discussion' && myRole) {
      html += `
        <div class="social-card center-card">
          <p class="vibe-subtitle">اضغط على الكارت عشان تشوف دورك سراً (خلي بالك محدش يبص في موبايلك!)</p>
          <div id="spy-secret-card" class="spy-secret-card ${cardHidden ? 'hidden-card' : (myRole.isSpy ? 'is-spy' : 'is-crew')}">
            ${cardHidden
              ? `<span>👁️ اضغط لإظهار الكارت السري</span>`
              : (myRole.isSpy
                  ? `<h3>🕵️ أنت الجاسوس!</h3><p>التصنيف: <strong>${myRole.category}</strong><br>حاول تفهم الكلمة من أسئلة صحابك ومتتكشفش!</p>`
                  : `<h3>✅ أنت من الشلة</h3><p>التصنيف: <strong>${myRole.category}</strong><br>الكلمة السرية: <strong class="secret-word-highlight">${myRole.word}</strong></p>`)}
          </div>
          <p class="vote-counter">اسألوا بعض في القعدة أو في الشات، ولما تجهزوا ابدأوا التصويت!</p>
          ${isHost
            ? `<button id="spy-open-vote-btn" class="glow-btn-magenta">ابدأ التصويت لكشف الجاسوس 🗳️</button>`
            : `<p class="waiting-pulse">المضيف هيفتح التصويت لما المناقشة تخلص...</p>`}
        </div>
      `;
    } else if (phase === 'voting') {
      const myVote = votes[myId];
      const totalVotes = Object.keys(votes).length;
      html += `
        <div class="social-card">
          <h3 class="social-question">مين في الشلة هو الجاسوس؟ 🕵️</h3>
          <div class="player-vote-grid">
            ${players.map(p => `
              <button class="player-vote-btn ${myVote === p.id ? 'selected' : ''}" 
                data-id="${p.id}" style="border-color: ${p.color};" ${myVote ? 'disabled' : ''}>
                <span class="dot" style="background: ${p.color};"></span>
                <span>${p.nickname}</span>
              </button>
            `).join('')}
          </div>
          <p class="vote-counter">صوّتوا: ${totalVotes} / ${players.length}</p>
          ${isHost && totalVotes > 0 ? `<button id="spy-resolve-btn" class="glass-btn small-btn">اعلن النتيجة الآن</button>` : ''}
        </div>
      `;
    } else if (phase === 'result' && roundMeta) {
      const accused = players.find(p => p.id === roundMeta.accusedId);
      html += `
        <div class="social-card center-card">
          <div class="result-banner ${roundMeta.crewWon ? 'win' : 'lose'}">
            ${roundMeta.crewWon
              ? `🎉 الشلة كشفت الجاسوس! (${roundMeta.spyName})`
              : `🕵️ الجاسوس (${roundMeta.spyName}) خدعكم! صوّتوا ضد ${accused ? accused.nickname : 'شخص بريء'}`}
          </div>
          <p style="margin: 10px 0;">الكلمة السرية كانت: <strong class="secret-word-highlight">${roundMeta.word}</strong></p>
          ${isHost
            ? `<button id="spy-start-btn" class="glow-btn-cyan">جولة جديدة 🕵️</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لجولة جديدة...</p>`}
        </div>
      `;
    }

    html += `</div>`;
    stage.innerHTML = html;

    const startBtn = document.getElementById('spy-start-btn');
    if (startBtn) startBtn.addEventListener('click', startRound);

    const secretCard = document.getElementById('spy-secret-card');
    if (secretCard) {
      secretCard.addEventListener('click', () => {
        cardHidden = !cardHidden;
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
        render();
      });
    }

    const openVoteBtn = document.getElementById('spy-open-vote-btn');
    if (openVoteBtn) openVoteBtn.addEventListener('click', openVoting);

    const resolveBtn = document.getElementById('spy-resolve-btn');
    if (resolveBtn) resolveBtn.addEventListener('click', resolveVoting);

    stage.querySelectorAll('.player-vote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        castVote(btn.getAttribute('data-id'));
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('spy-game', SpyGame);
  });

  return { start, stop, handleData };
})();
