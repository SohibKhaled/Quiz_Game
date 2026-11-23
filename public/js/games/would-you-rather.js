// Would You Rather (لو خيروك؟) - Social Hangout Game (Online + Single Device Pass & Play)
const WouldYouRatherGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let used = new Set();
  let localTurnIdx = 0;

  let currentRound = null; // { a, b, votes: { [id]: 'a'|'b' }, status: 'voting'|'revealed' }

  const DILEMMAS = [
    { a: 'تقدر تقرأ أفكار الناس لمدة يوم', b: 'تختفي عن الأنظار لمدة يوم كامل' },
    { a: 'تعيش من غير إنترنت لمدة سنة وتاخد مليون جنيه', b: 'تكمل حياتك عادي بالنت من غير المليون' },
    { a: 'تسافر للماضي وتشوف أجدادك', b: 'تسافر للمستقبل بعد 100 سنة' },
    { a: 'تأكل أكلتك المفضلة بس طول عمرك', b: 'تجرب أكلات جديدة بس ممنوع تاكل أي أكلة مرتين' },
    { a: 'تبقى مشهور جداً بس ملكش خصوصية', b: 'تعيش حياة هادية ومحدش يعرفك بس غني' },
    { a: 'تنسى كل ذكرياتك الحلوة', b: 'تفضل فاكر كل ذكرياتك الوحشة بالتفصيل' },
    { a: 'تصاحب ناس تضحّكك طول الوقت بس مش جد وقت الجد', b: 'تصاحب ناس جد جداً بس بيقفوا جنبك في أي أزمة' },
    { a: 'تصحى كل يوم الساعة 5 الفجر بنشاط', b: 'تنام 4 ساعات بس في اليوم ومش بتتعب أبداً' },
    { a: 'تتكلم كل لغات العالم بطلاقة', b: 'تقدر تفهم وتتكلم مع الحيوانات' },
    { a: 'تشتغل شغلانة بتحبها بمرتب عادي', b: 'تشتغل شغلانة مملة بمرتب ضخم جداً' }
  ];

  function getStage() {
    return document.getElementById('would-you-rather-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    used.clear();
    localTurnIdx = 0;
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() {
    currentRound = null;
  }

  function nextDilemma() {
    if (!isHost) return;
    let avail = DILEMMAS.filter(d => !used.has(d.a));
    if (avail.length === 0) {
      used.clear();
      avail = DILEMMAS;
    }
    const pick = avail[Math.floor(Math.random() * avail.length)];
    used.add(pick.a);

    localTurnIdx = 0;
    currentRound = {
      a: pick.a,
      b: pick.b,
      votes: {},
      status: 'voting'
    };

    NetworkManager.broadcastGameData({ type: 'WYR_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function submitVote(choice) {
    if (!currentRound || currentRound.status !== 'voting') return;

    if (NetworkManager.isLocalMode()) {
      const voter = players[localTurnIdx];
      if (!voter) return;
      currentRound.votes[voter.id] = choice;
      localTurnIdx++;
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      if (localTurnIdx >= players.length) {
        revealVotes();
      } else {
        render();
      }
      return;
    }

    if (currentRound.votes[myId]) return;
    if (isHost) {
      recordVote(myId, choice);
    } else {
      NetworkManager.sendGameData({ type: 'WYR_VOTE', choice });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordVote(voterId, choice) {
    if (!isHost || !currentRound || currentRound.status !== 'voting') return;
    currentRound.votes[voterId] = choice;

    if (Object.keys(currentRound.votes).length >= players.length) {
      revealVotes();
    } else {
      NetworkManager.broadcastGameData({ type: 'WYR_STATE', round: currentRound, scores });
      render();
    }
  }

  function revealVotes() {
    if (!isHost || !currentRound) return;
    currentRound.status = 'revealed';

    const countA = Object.values(currentRound.votes).filter(v => v === 'a').length;
    const countB = Object.values(currentRound.votes).filter(v => v === 'b').length;
    const majority = countA === countB ? null : (countA > countB ? 'a' : 'b');

    if (majority) {
      Object.entries(currentRound.votes).forEach(([vid, c]) => {
        if (c === majority) scores[vid] = (scores[vid] || 0) + 10;
      });
    }

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    NetworkManager.broadcastGameData({ type: 'WYR_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'WYR_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      render();
    } else if (payload.type === 'WYR_VOTE' && isHost) {
      recordVote(senderId, payload.choice);
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
          <div class="social-icon-badge"><i data-lucide="split"></i></div>
          <h3>لو خيروك؟</h3>
          <p>اختيارات صعبة ومضحكة! اختاروا بين خيارين وشوفوا مين في الشلة بيفكر زيكم. (شغالة أونلاين أو على جهاز واحد!)</p>
          ${isHost
            ? `<button id="wyr-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ الاختيارات</button>`
            : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        </div>
      `;
    } else {
      const totalVotes = Object.keys(currentRound.votes).length;
      const myVote = isLocal ? null : currentRound.votes[myId];
      const countA = Object.values(currentRound.votes).filter(v => v === 'a').length;
      const countB = Object.values(currentRound.votes).filter(v => v === 'b').length;
      const pctA = totalVotes > 0 ? Math.round((countA / totalVotes) * 100) : 0;
      const pctB = totalVotes > 0 ? Math.round((countB / totalVotes) * 100) : 0;

      const currentLocalPlayer = isLocal ? players[localTurnIdx] : null;

      html += `<div class="social-card">`;

      if (currentRound.status === 'voting' && isLocal && currentLocalPlayer) {
        html += `
          <div class="target-banner" style="border-color: ${currentLocalPlayer.color};">
            <span>مرّر الموبايل لـ:</span>
            <strong style="color: ${currentLocalPlayer.color};">${currentLocalPlayer.nickname}</strong>
          </div>
        `;
      }

      html += `
        <h3 class="social-question">لو خيروك... تختار إيه؟</h3>
        <div class="wyr-split">
          <button class="wyr-choice-btn option-a ${myVote === 'a' ? 'selected' : ''}" data-c="a" ${myVote || currentRound.status === 'revealed' ? 'disabled' : ''}>
            <span class="wyr-tag">أ</span>
            <span>${currentRound.a}</span>
            ${currentRound.status === 'revealed' ? `<strong class="wyr-pct">${pctA}% (${countA})</strong>` : ''}
          </button>
          <div class="wyr-vs">أو</div>
          <button class="wyr-choice-btn option-b ${myVote === 'b' ? 'selected' : ''}" data-c="b" ${myVote || currentRound.status === 'revealed' ? 'disabled' : ''}>
            <span class="wyr-tag">ب</span>
            <span>${currentRound.b}</span>
            ${currentRound.status === 'revealed' ? `<strong class="wyr-pct">${pctB}% (${countB})</strong>` : ''}
          </button>
        </div>
      `;

      if (currentRound.status === 'voting') {
        html += `<p class="vote-counter">صوّتوا: ${totalVotes} / ${players.length}</p>`;
        if (isHost && totalVotes > 0 && !isLocal) {
          html += `<button id="wyr-reveal-btn" class="glass-btn small-btn">اكشف النسب الآن</button>`;
        }
      } else {
        html += `
          <div class="reveal-chips">
            ${players.map(p => {
              const v = currentRound.votes[p.id];
              return `<span class="reveal-chip" style="border-color: ${p.color}; color: ${p.color};">${p.nickname}: ${v === 'a' ? 'أ' : (v === 'b' ? 'ب' : '-')}</span>`;
            }).join('')}
          </div>
          ${isHost
            ? `<button id="wyr-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> السؤال اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('wyr-start-btn')?.addEventListener('click', nextDilemma);
    document.getElementById('wyr-next-btn')?.addEventListener('click', nextDilemma);
    document.getElementById('wyr-reveal-btn')?.addEventListener('click', revealVotes);

    stage.querySelectorAll('.wyr-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => submitVote(btn.getAttribute('data-c')));
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('would-you-rather', WouldYouRatherGame);
  });

  return { start, stop, handleData };
})();
