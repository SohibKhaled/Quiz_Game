// Truth or Dare (صراحة وجرأة) - Social Hangout Game (Online + Single Device)
const TruthDareGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;

  let currentRound = null;
  // { targetId, targetName, targetColor, choice: null|'truth'|'dare', level: 'chill'|'spicy'|'extreme', prompt: '', status: 'choosing'|'acting'|'resolved' }

  const TRUTHS = {
    chill: [
      'إيه أكتر حاجة غريبة عملتها وأنت لوحدك في البيت؟',
      'لو تقدر تمسح موقف واحد محرج من ذاكرتك، هتمسح إيه؟',
      'إيه أكتر أكلة بتحبها بس بتتكسف تقول قدام الناس؟',
      'مين أكتر شخص في القعدة دي بتحس إنه شبهك في التفكير؟',
      'إيه الحاجة اللي نفسك تتعلمها بس بتكسل تبدأ فيها؟',
      'أكتر كدبة بيضة قولتها عشان تهرب من خروجة أو مشوار؟'
    ],
    spicy: [
      'إيه أكتر صفة بتضايقك في شخص في القعدة دي (من غير ما تقول اسمه)؟',
      'لو رجع بيك الزمن، إيه العلاقة أو الصداقة اللي مكنتش هتبدأها؟',
      'إمتى آخر مرة عيّطت بجد وكان إيه السبب؟',
      'هل في مرة عملت نفسك مش واخد بالك من رسالة شخص قاصد؟ مين؟',
      'إيه أكتر سر خايف إن أهلك أو صحابك يعرفوه؟',
      'لو مضطر تحكي حقيقة واحدة محدش يعرفها عنك دلوقتي، هتقول إيه؟'
    ],
    extreme: [
      'مين أكتر شخص في القعدة دي لو احتجته الساعة 3 الفجر متأكد إنه هيرد؟',
      'إيه أكبر غلطة عملتها في حياتك واتعلمت منها درس قاسي؟',
      'هل حسيت بالغيرة من حد من صحابك قبل كده؟ في إيه؟',
      'لو فتحت دلوقتي آخر بحث عملته على جوجل أو يوتيوب، هتتكسف؟ قولنا إيه هو!',
      'إيه الحاجة اللي بتندم إنك مقولتهاش لشخص قبل ما يمشي من حياتك؟'
    ]
  };

  const DARES = {
    chill: [
      'اتكلم بلهجة صعيدي أو إسكندراني لحد ما دورك الجاي يجي!',
      'اعمل نفسك بتمثل إعلان شامبو أو برفان لمدة 20 ثانية!',
      'ورّي الشلة آخر صورة التقطتها بكاميرا موبايلك.',
      'قول جملة حب درامية لـ كوباية المية أو الكرسي اللي جنبك.',
      'حاول تضحك كل اللي في القعدة من غير ما تقول ولا كلمة!'
    ],
    spicy: [
      'افتح آخر 5 إيموجيز استخدمتها واشرح استخدمتهم مع مين وليه!',
      'خلي الشخص اللي جنبك يبعت رسالة لواحد صاحبكم مش في القعدة (كلام عادي مضحك)!',
      'اقرأ بصوت عالي آخر رسالة بعتها على جروب العيلة.',
      'قول 3 عيوب في شخصيتك بصراحة قدام الكل.',
      'قُم اعمل 10 نطات (Jumping Jacks) وأنت بتقول أسماء الشلة!'
    ],
    extreme: [
      'اتصل بحد من صحابك وقوله "أنا محتاج أستلف منك 5000 جنيه ضروري دلوقتي" وشوف رد فعله!',
      'اعمل 15 ضغط دلوقتي أو احكي أكتر سر محرج حصلك في حياتك!',
      'سمّح للشلة تختارلك نيك نيم جديد يفضل معاك لآخر الجلسة.',
      'ابعت فويس نوت 5 ثواني لواحد صاحبك بتقوله فيه "سامحني يا صاحبي" واقفل!'
    ]
  };

  function getStage() {
    return document.getElementById('truth-dare-stage');
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

  function nextTurn(random = false) {
    if (!isHost || players.length === 0) return;
    const idx = random ? Math.floor(Math.random() * players.length) : (rotationIdx % players.length);
    if (!random) rotationIdx++;
    const target = players[idx];

    currentRound = {
      targetId: target.id,
      targetName: target.nickname,
      targetColor: target.color,
      choice: null,
      level: currentRound?.level || 'spicy',
      prompt: '',
      status: 'choosing'
    };

    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function pickChoice(choice, level) {
    if (!currentRound || currentRound.status !== 'choosing') return;
    if (!NetworkManager.isLocalMode() && currentRound.targetId !== myId && !isHost) return;

    const lvl = level || currentRound.level || 'spicy';
    const pool = choice === 'truth' ? TRUTHS[lvl] : DARES[lvl];
    const prompt = pool[Math.floor(Math.random() * pool.length)];

    if (isHost) {
      applyChoice(choice, lvl, prompt);
    } else {
      NetworkManager.sendGameData({ type: 'TDARE_CHOOSE', choice, level: lvl });
    }
  }

  function applyChoice(choice, level, promptText) {
    const lvl = level || 'spicy';
    const pool = choice === 'truth' ? TRUTHS[lvl] : DARES[lvl];
    currentRound.choice = choice;
    currentRound.level = lvl;
    currentRound.prompt = promptText || pool[Math.floor(Math.random() * pool.length)];
    currentRound.status = 'acting';
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    render();
  }

  function resolveRound(passed) {
    if (!isHost || !currentRound) return;
    currentRound.status = 'resolved';
    currentRound.passed = passed;
    const delta = passed ? 15 : -5;
    scores[currentRound.targetId] = Math.max(0, (scores[currentRound.targetId] || 0) + delta);

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') {
      passed ? AntigravityAudio.playScore() : AntigravityAudio.playExplosion();
    }
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'TDARE_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      render();
    } else if (payload.type === 'TDARE_CHOOSE' && isHost) {
      applyChoice(payload.choice, payload.level);
    } else if (payload.type === 'TDARE_LEVEL') {
      if (currentRound) currentRound.level = payload.level;
      render();
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const isLocal = NetworkManager.isLocalMode();
    const canAct = isLocal || isHost || (currentRound && currentRound.targetId === myId);

    const levels = {
      chill: { icon: 'smile', label: 'خفيف' },
      spicy: { icon: 'flame', label: 'حامي' },
      extreme: { icon: 'zap', label: 'نار' }
    };

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="flame"></i></div>
          <h3>صراحة وجرأة</h3>
          <p>كل لاعب في دوره بيختار: <strong>صراحة</strong> يجاوب بصدق، أو <strong>جرأة</strong> ينفّذ تحدي قدام الشلة!</p>
          ${isHost
            ? `<button id="tdare-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ الجولة</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء اللعبة...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-top-bar">
          <div class="intensity-pills">
            ${Object.keys(levels).map(k => `
              <button class="pill-btn ${currentRound.level === k ? 'active' : ''}" data-lvl="${k}" ${!isHost ? 'disabled' : ''}>
                <i data-lucide="${levels[k].icon}"></i> ${levels[k].label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="social-card center-card">
          <div class="target-banner" style="border-color: ${currentRound.targetColor};">
            <span>الدور على:</span>
            <strong style="color: ${currentRound.targetColor};">${currentRound.targetName}</strong>
          </div>
      `;

      if (currentRound.status === 'choosing') {
        if (canAct) {
          html += `
            <p class="vibe-subtitle">اختار صراحة ولا جرأة؟</p>
            <div class="vote-actions">
              <button id="tdare-truth-btn" class="glow-btn-cyan"><i data-lucide="message-circle-question"></i> صراحة</button>
              <button id="tdare-dare-btn" class="glow-btn-magenta"><i data-lucide="flame"></i> جرأة</button>
            </div>
          `;
        } else {
          html += `<p class="waiting-pulse">مستنيين ${currentRound.targetName} يختار صراحة ولا جرأة...</p>`;
        }
      } else if (currentRound.status === 'acting') {
        html += `
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge">
              <i data-lucide="${currentRound.choice === 'truth' ? 'message-circle-question' : 'flame'}"></i>
              ${currentRound.choice === 'truth' ? 'سؤال صراحة' : 'تحدي جرأة'}
            </span>
            <p class="dare-text">${currentRound.prompt}</p>
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="tdare-pass-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> نفّذ / جاوب (+15)</button>
              <button id="tdare-fail-btn" class="glow-btn-magenta"><i data-lucide="x-circle"></i> رفض (-5)</button>
            </div>
          ` : `<p class="waiting-pulse">المضيف بيقيّم التنفيذ...</p>`}
        `;
      } else {
        html += `
          <div class="result-banner ${currentRound.passed ? 'win' : 'lose'}" style="width:100%;">
            <i data-lucide="${currentRound.passed ? 'award' : 'shield-alert'}"></i>
            ${currentRound.passed ? `${currentRound.targetName} قدها! (+15 نقطة)` : `${currentRound.targetName} هرب! (-5 نقاط)`}
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="tdare-next-btn" class="glow-btn-cyan"><i data-lucide="arrow-right"></i> اللاعب التالي</button>
              <button id="tdare-rand-btn" class="glass-btn"><i data-lucide="shuffle"></i> اختيار عشوائي</button>
            </div>
          ` : `<p class="waiting-pulse">في انتظار المضيف...</p>`}
        `;
      }

      html += `</div>`;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('tdare-start-btn')?.addEventListener('click', () => nextTurn(false));
    document.getElementById('tdare-next-btn')?.addEventListener('click', () => nextTurn(false));
    document.getElementById('tdare-rand-btn')?.addEventListener('click', () => nextTurn(true));
    document.getElementById('tdare-truth-btn')?.addEventListener('click', () => pickChoice('truth', currentRound?.level));
    document.getElementById('tdare-dare-btn')?.addEventListener('click', () => pickChoice('dare', currentRound?.level));
    document.getElementById('tdare-pass-btn')?.addEventListener('click', () => resolveRound(true));
    document.getElementById('tdare-fail-btn')?.addEventListener('click', () => resolveRound(false));

    stage.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isHost || !currentRound) return;
        currentRound.level = btn.getAttribute('data-lvl');
        NetworkManager.broadcastGameData({ type: 'TDARE_LEVEL', level: currentRound.level });
        render();
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('truth-dare', TruthDareGame);
  });

  return { start, stop, handleData };
})();
