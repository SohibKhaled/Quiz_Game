// Judgment Court (محكمة الأحكام) - Social Hangout Game
const JudgmentCourtGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let customDares = [];

  let currentIntensity = 'spicy';
  let currentRound = null; // { targetId, targetName, targetColor, dareText, intensity, votes: { [id]: 'pass'|'fail' }, status: 'voting'|'resolved' }
  let targetRotationIdx = 0;
  let usedDares = new Set();

  const DARES = {
    chill: [
      'قلّد طريقة كلام أو ضحكة واحد من الشلة لمدة 30 ثانية، والشلة تخمّن مين!',
      'احكي أكتر موقف محرج حصلك في الشغل أو الجامعة من غير ما تضحك.',
      'ورّي الشلة آخر 3 صور في الجاليري بتاعك (أو اشرحهم بالتفصيل!).',
      'اقرأ آخر رسالة بعتّها أو استلمتها بصوت درامي كأنك في فيلم عربي.',
      'اتكلم باللغة العربية الفصحى بس لمدة دقيقتين كاملين مهما حصل.',
      'اختار واحد من الشلة وقوله 3 حاجات بتحبها فيه بجد من غير هزار.',
      'غني مقطع من أغنية شعبية أو قديمة بأعلى صوت وبأداء مسرحي.',
      'اعمل نفسك مذيع نشرة أخبار واحكي يومك النهاردة في 30 ثانية.'
    ],
    spicy: [
      'افتح موبايلك وورّي الشلة أكتر 3 تطبيقات بتستخدمهم في الـ Screen Time النهاردة.',
      'ابعت رسالة لواحد صاحبك مش معانا واكتبله: "محتاجك في موضوع خطير جداً" ومتردش عليه 5 دقايق.',
      'لو مضطر تحذف شخص واحد من جروب الشلة لمدة أسبوع، هتختار مين وليه؟ (بهزار طبعا!)',
      'اعترف بحاجة عملتها زمان ومحدش من الشلة يعرفها لحد دلوقتي.',
      'مين أكتر شخص في القعدة دي بتحس إنه بيعرف يمثّل أو يخبّي مشاعره؟',
      'خلي الشخص اللي على يمينك (أو اللي قبلك في القائمة) يكتبلك ستوري أو بوست قصير من غير ما يبعته.. أو ابعته لو قلبك جامد!',
      'احكي عن أسوأ خروجة أو ديت روحته في حياتك وإيه اللي بوّظها.',
      'لو الشلة كلها في جزيرة ومعاك أكل يكفي 2 بس، هتاخد مين معاك؟'
    ],
    extreme: [
      'اتصل بأحد صحابك (أو حد من أهلك) وقوله "أنا قررت أسيب كل حاجة وأسافر بكرة" وشوف رد فعله على السبيكر!',
      'اعمل 15 ضغط (Push-ups) دلوقتي قدام الكل، ولو معملتهمش تاخد لقب "الجبان" لآخر الجيم!',
      'اسمح للشلة تختارلك صورة بروفايل جديدة على الواتساب أو ديسكورد لمدة ساعة.',
      'اقرأ آخر محادثة بينك وبين أكتر شخص بتكلمه اليومين دول (أول 5 رسايل بس!).',
      'جاوب بصراحة تامة: مين أكتر شخص في القعدة دي لو اختفى فجأة هتفتقده أكتر واحد؟',
      'اتحدّى واحد من الشلة في تحدي صمت: أول واحد يضحك أو يتكلم يخسر 10 نقط!',
      'قول سر حقيقي عن نفسك لأول مرة، أو اشرب كوباية مية بملح/ليمون!'
    ]
  };

  function getContainer() {
    return document.getElementById('judgment-court-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    targetRotationIdx = 0;
    currentRound = null;
    customDares = [];

    App.updateScores(scores);
    render();
  }

  function stop() {
    currentRound = null;
  }

  function drawNextRound() {
    if (!isHost || players.length === 0) return;

    const target = players[targetRotationIdx % players.length];
    targetRotationIdx++;

    let pool = [...DARES[currentIntensity]];
    if (customDares.length > 0 && Math.random() < 0.45) {
      pool = customDares;
    }
    let available = pool.filter(d => !usedDares.has(d));
    if (available.length === 0) {
      pool.forEach(d => usedDares.delete(d));
      available = pool;
    }
    const dareText = available[Math.floor(Math.random() * available.length)];
    usedDares.add(dareText);

    currentRound = {
      targetId: target.id,
      targetName: target.nickname,
      targetColor: target.color,
      dareText,
      intensity: currentIntensity,
      votes: {},
      status: 'voting'
    };

    NetworkManager.broadcastGameData({
      type: 'JC_NEW_ROUND',
      round: currentRound,
      scores
    });

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function submitVote(vote) {
    if (!currentRound || currentRound.status !== 'voting') return;
    if (currentRound.targetId === myId && players.length > 1) return; // Defendant can't vote on themselves unless solo

    if (isHost) {
      recordVote(myId, vote);
    } else {
      NetworkManager.sendGameData({ type: 'JC_VOTE', vote });
    }
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
  }

  function recordVote(voterId, vote) {
    if (!isHost || !currentRound || currentRound.status !== 'voting') return;
    currentRound.votes[voterId] = vote;

    const eligibleVoters = players.length > 1 ? players.length - 1 : 1;
    const voteCount = Object.keys(currentRound.votes).length;

    if (voteCount >= eligibleVoters) {
      resolveRound();
    } else {
      NetworkManager.broadcastGameData({
        type: 'JC_STATE',
        round: currentRound,
        scores
      });
      render();
    }
  }

  function resolveRound() {
    if (!isHost || !currentRound) return;
    currentRound.status = 'resolved';

    let pass = 0;
    let fail = 0;
    Object.values(currentRound.votes).forEach(v => {
      if (v === 'pass') pass++;
      else fail++;
    });

    const passed = pass >= fail;
    const delta = passed ? 15 : -5;
    scores[currentRound.targetId] = Math.max(0, (scores[currentRound.targetId] || 0) + delta);
    currentRound.passed = passed;

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      passed ? AntigravityAudio.playScore() : AntigravityAudio.playExplosion();
    }

    NetworkManager.broadcastGameData({
      type: 'JC_STATE',
      round: currentRound,
      scores
    });
    render();
  }

  function addCustomDare(text) {
    const clean = text.trim();
    if (!clean) return;
    if (isHost) {
      customDares.push(clean);
      App.showToast('تمت إضافة الحكم لقائمة الشلة! 🔥');
    } else {
      NetworkManager.sendGameData({ type: 'JC_ADD_DARE', text: clean });
      App.showToast('تم إرسال الحكم للمضيف! 🔥');
    }
  }

  function handleData(senderId, payload) {
    switch (payload.type) {
      case 'JC_NEW_ROUND':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
        render();
        break;
      case 'JC_STATE':
        currentRound = payload.round;
        scores = payload.scores;
        App.updateScores(scores);
        render();
        break;
      case 'JC_VOTE':
        if (isHost) recordVote(senderId, payload.vote);
        break;
      case 'JC_ADD_DARE':
        if (isHost && payload.text) {
          customDares.push(payload.text);
          NetworkManager.sendChat(`SYSTEM: حكم جديد انضاف للقرعة!`);
        }
        break;
      case 'JC_INTENSITY':
        currentIntensity = payload.intensity;
        render();
        break;
    }
  }

  function render() {
    const stage = getContainer();
    if (!stage) return;

    const intensityLabels = {
      chill: { icon: 'coffee', label: 'رايق / ودي' },
      spicy: { icon: 'flame', label: 'جريء' },
      extreme: { icon: 'zap', label: 'تحدي تقيل' }
    };

    let html = `
      <div class="social-game-wrapper rtl-text">
        <div class="social-top-bar">
          <div class="intensity-pills">
            ${Object.keys(intensityLabels).map(key => `
              <button class="pill-btn ${currentIntensity === key ? 'active' : ''}" 
                data-intensity="${key}" ${!isHost ? 'disabled' : ''}>
                <i data-lucide="${intensityLabels[key].icon}"></i> ${intensityLabels[key].label}
              </button>
            `).join('')}
          </div>
        </div>
    `;

    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="scale"></i></div>
          <h3>محكمة الأحكام جاهزة!</h3>
          <p>في كل دور هيتم اختيار واحد من الشلة وتنفيذ حكم قدام الكل. الشلة هتصوّت إذا كان نفّذ الحكم ولا هرب!</p>
          ${isHost
            ? `<button id="jc-draw-btn" class="glow-btn-cyan"><i data-lucide="gavel"></i> اسحب أول حكم</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء المحكمة...</p>`}
        </div>
      `;
    } else {
      const myVote = currentRound.votes[myId];
      const isTarget = currentRound.targetId === myId && players.length > 1;
      const passCount = Object.values(currentRound.votes).filter(v => v === 'pass').length;
      const failCount = Object.values(currentRound.votes).filter(v => v === 'fail').length;
      const badgeInfo = intensityLabels[currentRound.intensity] || { icon: 'flame', label: '' };

      html += `
        <div class="social-card judgment-card">
          <div class="target-banner" style="border-color: ${currentRound.targetColor};">
            <span>المُتَّهَم في القفص:</span>
            <strong style="color: ${currentRound.targetColor};">${currentRound.targetName}</strong>
          </div>
          <div class="dare-box">
            <span class="dare-badge"><i data-lucide="${badgeInfo.icon}"></i> ${badgeInfo.label}</span>
            <p class="dare-text">${currentRound.dareText}</p>
          </div>
      `;

      if (currentRound.status === 'voting') {
        if (isTarget) {
          html += `<p class="waiting-pulse">نفّذ الحكم قدام الشلة! مستنيين تصويتهم عليك... (${passCount + failCount} صوّتوا)</p>`;
        } else {
          html += `
            <div class="vote-actions">
              <button id="jc-vote-pass" class="glow-btn-green ${myVote === 'pass' ? 'selected-vote' : ''}" ${myVote ? 'disabled' : ''}>
                <i data-lucide="check-circle"></i> نفّذ الحكم (+15)
              </button>
              <button id="jc-vote-fail" class="glow-btn-magenta ${myVote === 'fail' ? 'selected-vote' : ''}" ${myVote ? 'disabled' : ''}>
                <i data-lucide="x-circle"></i> هرب / رفض (-5)
              </button>
            </div>
            <p class="vote-counter">الأصوات: <i data-lucide="check"></i> ${passCount} | <i data-lucide="x"></i> ${failCount}</p>
          `;
        }
        if (isHost) {
          html += `<button id="jc-force-resolve" class="glass-btn small-btn" style="margin-top:8px;">اعتماد النتيجة الآن</button>`;
        }
      } else {
        html += `
          <div class="result-banner ${currentRound.passed ? 'win' : 'lose'}">
            <i data-lucide="${currentRound.passed ? 'award' : 'shield-alert'}"></i>
            ${currentRound.passed
              ? `براءة! ${currentRound.targetName} نفّذ الحكم بشجاعة (+15 نقطة)`
              : `إدانة! ${currentRound.targetName} هرب من الحكم (-5 نقاط)`}
          </div>
          ${isHost
            ? `<button id="jc-draw-btn" class="glow-btn-cyan"><i data-lucide="gavel"></i> الحكم اللي بعده</button>`
            : `<p class="waiting-pulse">في انتظار المضيف للدور التالي...</p>`}
        `;
      }

      html += `</div>`;
    }

    html += `
        <form id="jc-custom-form" class="custom-prompt-bar">
          <input type="text" id="jc-custom-input" placeholder="اكتب حكم من تأليفك للشلة..." maxlength="120" autocomplete="off">
          <button type="submit" class="glass-btn small-btn"><i data-lucide="plus"></i> أضف حكم</button>
        </form>
      </div>
    `;

    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    // Bind events
    stage.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isHost) return;
        currentIntensity = btn.getAttribute('data-intensity');
        NetworkManager.broadcastGameData({ type: 'JC_INTENSITY', intensity: currentIntensity });
        render();
      });
    });

    const drawBtn = document.getElementById('jc-draw-btn');
    if (drawBtn) drawBtn.addEventListener('click', drawNextRound);

    const passBtn = document.getElementById('jc-vote-pass');
    if (passBtn) passBtn.addEventListener('click', () => submitVote('pass'));

    const failBtn = document.getElementById('jc-vote-fail');
    if (failBtn) failBtn.addEventListener('click', () => submitVote('fail'));

    const forceBtn = document.getElementById('jc-force-resolve');
    if (forceBtn) forceBtn.addEventListener('click', resolveRound);

    const customForm = document.getElementById('jc-custom-form');
    if (customForm) {
      customForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = document.getElementById('jc-custom-input');
        if (inp.value.trim()) {
          addCustomDare(inp.value);
          inp.value = '';
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('judgment-court', JudgmentCourtGame);
  });

  return { start, stop, handleData };
})();
