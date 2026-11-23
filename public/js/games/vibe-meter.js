// Vibe & Feelings Meter (مقياس المشاعر والتوافق) - Social Hangout Game
const VibeMeterGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let localTurnIdx = 0;

  let currentRound = null; // { spotlightId, spotlightName, spotlightColor, question, options, answers: { [id]: idx }, status: 'answering'|'revealed' }

  const QUESTIONS = [
    {
      q: 'لو صاحبك/صاحبتك زعل منك فجأة من غير ما يتكلم، بتعمل إيه غالباً؟',
      o: ['بواجهه فوراً وأسأله ماله', 'بسيبه يهدى شوية وبعدين أكلمه', 'ببعتله ميم أو حاجة تضحكه', 'بزعل أنا كمان وبستنى يكلمني']
    },
    {
      q: 'إيه أكتر حاجة بتخليك تحس إن الشخص اللي قدامك قريب من قلبك بجد؟',
      o: ['لما يفتكر تفاصيل صغيرة عني', 'لما يضحكني وأنا في أسوأ حالاتي', 'لما يسمعني من غير ما يحكم عليا', 'لما يقف جنبي وقت الجد']
    },
    {
      q: 'لو الدنيا ضاقت بيك وعايز تهرب من كل حاجة، بتعمل إيه؟',
      o: ['بقفل موبايلي وأنام', 'بخرج أتمشى لوحدي مع أغاني', 'بكلم أكتر حد برتاحله', 'باكل أكل بحبه وأتفرج على حاجة']
    },
    {
      q: 'في قعدة الشلة، إنت بتحس إن دورك إيه غالباً؟',
      o: ['اللي بيضحّك الكل وبيولّع الجو', 'الحكيم اللي الكل بياخد رأيه', 'الهادي اللي بيسمع ويراقب', 'المنظّم اللي بيجمع الشلة']
    },
    {
      q: 'لو جتلك فرصة تبدأ حياة جديدة في بلد تانية، هتاخد القرار إزاي؟',
      o: ['هسافر فوراً من غير تردد', 'لازم حد من صحابي أو أهلي معايا', 'هخاف أسيب الناس اللي بحبهم', 'هخطط لها سنة قدام الأول']
    },
    {
      q: 'أكتر حاجة بتخاف تخسرها في علاقاتك بالناس؟',
      o: ['الثقة والصدق', 'الاهتمام والسؤال', 'الراحة والضحك من القلب', 'الخصوصية والمساحة الشخصية']
    },
    {
      q: 'لما بتكون مبسوط أوي، أول حاجة بتعملها إيه؟',
      o: ['بحكي للشلة أو بعمل ستوري', 'بحتفظ بالفرحة لنفسي', 'بعزم صحابي على خروجة', 'بكلّم أقرب شخص لقلبي فوراً']
    },
    {
      q: 'لو تقدر تقرأ أفكار شخص واحد في القعدة دي لمدة 5 دقايق، هتعمل إيه؟',
      o: ['هشوف رأيه الحقيقي فيا إيه', 'هشوف إيه اللي مضايقه وأساعده', 'لأ شكراً، مش عايز أعرف!', 'هستخدمها في الهزار والضحك']
    }
  ];

  function getStage() {
    return document.getElementById('vibe-meter-stage');
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

  function startNewRound() {
    if (!isHost || players.length === 0) return;

    const spotlight = players[rotationIdx % players.length];
    rotationIdx++;
    const qObj = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

    localTurnIdx = 0;
    currentRound = {
      spotlightId: spotlight.id,
      spotlightName: spotlight.nickname,
      spotlightColor: spotlight.color,
      question: qObj.q,
      options: qObj.o,
      answers: {},
      status: 'answering'
    };

    NetworkManager.broadcastGameData({
      type: 'VM_NEW_ROUND',
      round: currentRound,
      scores
    });

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function submitChoice(optIdx) {
    if (!currentRound || currentRound.status !== 'answering') return;
    if (NetworkManager.isLocalMode()) {
      const voter = players[localTurnIdx];
      if (!voter) return;
      localTurnIdx++;
      recordAnswer(voter.id, optIdx);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      return;
    }
    if (currentRound.answers[myId] !== undefined) return;

    if (isHost) {
      recordAnswer(myId, optIdx);
    } else {
      NetworkManager.sendGameData({ type: 'VM_ANSWER', optIdx });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordAnswer(playerId, optIdx) {
    if (!isHost || !currentRound || currentRound.status !== 'answering') return;
    currentRound.answers[playerId] = optIdx;

    if (Object.keys(currentRound.answers).length >= players.length) {
      revealRound();
    } else {
      NetworkManager.broadcastGameData({
        type: 'VM_STATE',
        round: currentRound,
        scores
      });
      render();
    }
  }

  function revealRound() {
    if (!isHost || !currentRound) return;
    currentRound.status = 'revealed';

    const spotlightChoice = currentRound.answers[currentRound.spotlightId];
    let matchCount = 0;

    players.forEach(p => {
      if (p.id === currentRound.spotlightId) return;
      if (spotlightChoice !== undefined && currentRound.answers[p.id] === spotlightChoice) {
        scores[p.id] = (scores[p.id] || 0) + 20;
        matchCount++;
      }
    });

    if (matchCount > 0) {
      scores[currentRound.spotlightId] = (scores[currentRound.spotlightId] || 0) + (matchCount * 5);
    }

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();

    NetworkManager.broadcastGameData({
      type: 'VM_STATE',
      round: currentRound,
      scores
    });
    render();
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'VM_NEW_ROUND':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'VM_STATE':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
      case 'VM_ANSWER':
        if (isHost) recordAnswer(senderId, payload.optIdx);
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
          <div class="social-icon-badge"><i data-lucide="heart-handshake"></i></div>
          <h3>مقياس المشاعر والتوافق</h3>
          <p>في كل جولة بنختار نجم من الشلة! النجم بيجاوب عن مشاعره بصراحة، والباقي بيحاولوا يتوقعوا إجابته عشان نقيس قد إيه فاهمين بعض!</p>
          ${isHost
            ? `<button id="vm-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ اختبار المشاعر</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء الاختبار...</p>`}
        </div>
      `;
    } else {
      const isLocal = NetworkManager.isLocalMode();
      const localVoter = isLocal ? players[localTurnIdx] : null;
      const isSpotlight = isLocal
        ? (localVoter && localVoter.id === currentRound.spotlightId)
        : (currentRound.spotlightId === myId);
      const myChoice = isLocal ? undefined : currentRound.answers[myId];
      const answeredCount = Object.keys(currentRound.answers).length;

      html += `
        <div class="social-card">
          ${currentRound.status === 'answering' && isLocal && localVoter ? `
            <div class="target-banner" style="border-color: ${localVoter.color};">
              <span>مرّر الموبايل لـ:</span>
              <strong style="color: ${localVoter.color};">${localVoter.nickname}</strong>
            </div>
          ` : `
            <div class="target-banner" style="border-color: ${currentRound.spotlightColor};">
              <span>نجم الجولة:</span>
              <strong style="color: ${currentRound.spotlightColor};">${currentRound.spotlightName}</strong>
            </div>
          `}
          <p class="vibe-subtitle">
            ${isSpotlight
              ? 'جاوب بصراحة عن إحساسك الحقيقي (الشلة بتحاول تتوقع إجابتك!)'
              : `توقّع: <strong>${currentRound.spotlightName}</strong> هيختار إيه؟`}
          </p>
          <h3 class="social-question">${currentRound.question}</h3>
          <div class="social-options-grid">
            ${currentRound.options.map((opt, idx) => {
              let cls = 'social-opt-btn';
              if (myChoice === idx) cls += ' selected';
              if (currentRound.status === 'revealed') {
                const spotAns = currentRound.answers[currentRound.spotlightId];
                if (idx === spotAns) cls += ' correct';
                else if (myChoice === idx && idx !== spotAns) cls += ' incorrect';
              }
              return `
                <button class="${cls}" data-idx="${idx}" ${myChoice !== undefined || currentRound.status === 'revealed' ? 'disabled' : ''}>
                  ${opt}
                </button>
              `;
            }).join('')}
          </div>
      `;

      if (currentRound.status === 'answering') {
        html += `<p class="vote-counter">تمت الإجابة: ${answeredCount} / ${players.length}</p>`;
        if (isHost && answeredCount > 0) {
          html += `<button id="vm-reveal-btn" class="glass-btn small-btn" style="margin-top:8px;">اكشف الإجابات الآن</button>`;
        }
      } else {
        const spotAns = currentRound.answers[currentRound.spotlightId];
        const totalGuessers = Math.max(1, players.length - 1);
        const matches = players.filter(p => p.id !== currentRound.spotlightId && currentRound.answers[p.id] === spotAns).length;
        const vibePct = players.length > 1 ? Math.round((matches / totalGuessers) * 100) : 100;

        html += `
          <div class="vibe-result-box">
            <div class="vibe-meter-bar">
              <div class="vibe-meter-fill" style="width: ${vibePct}%;"></div>
            </div>
            <p class="vibe-pct-text">نسبة توافق الشلة مع ${currentRound.spotlightName}: <strong>${vibePct}%</strong></p>
            <div class="reveal-chips">
              ${players.map(p => {
                const ans = currentRound.answers[p.id];
                const isMatch = p.id !== currentRound.spotlightId && ans === spotAns;
                return `
                  <span class="reveal-chip" style="border-color: ${p.color}; color: ${p.color};">
                    ${p.nickname}: ${ans !== undefined ? (isMatch ? '<i data-lucide="check"></i> توقع صح' : (p.id === currentRound.spotlightId ? '<i data-lucide="star"></i> النجم' : '<i data-lucide="x"></i>')) : '<i data-lucide="clock"></i>'}
                  </span>
                `;
              }).join('')}
            </div>
          </div>
          ${isHost
            ? `<button id="vm-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> النجم اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف للجولة التالية...</p>`}
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    const startBtn = document.getElementById('vm-start-btn');
    if (startBtn) startBtn.addEventListener('click', startNewRound);

    const nextBtn = document.getElementById('vm-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', startNewRound);

    const revealBtn = document.getElementById('vm-reveal-btn');
    if (revealBtn) revealBtn.addEventListener('click', revealRound);

    stage.querySelectorAll('.social-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        submitChoice(parseInt(btn.getAttribute('data-idx'), 10));
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('vibe-meter', VibeMeterGame);
  });

  return { start, stop, handleData };
})();
