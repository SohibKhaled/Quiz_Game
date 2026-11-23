// Truth or Dare (صراحة وجرأة) - With Pre-Game Setup, Penalty Library, Non-Repeating Deck & Round Limits
const TruthDareGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;

  // Pre-game configuration
  let config = {
    level: 'bold', // 'casual' | 'bold' | 'intense'
    questionsPerPlayer: 5, // 5 | 10 | 20 | 0 (unlimited)
    penalties: [] // active penalty texts selected/added before game
  };

  let defaultPenaltyLibrary = [
    'يعمل 15 ضغط قدام الشلة دلوقتي',
    'يشرب كوباية مية كاملة على نفس واحد',
    'يحكي موقف محرج حصله في الشغل أو الجامعة',
    'يقول 3 حاجات بيحبها في الشخص اللي على يمينه',
    'يغني مقطع من أغنية بصوت عالي قدام الكل',
    'يتصور صورة مضحكة مع الشخص اللي قبله في الدور',
    'يمتنع عن مسك الموبايل لمدة 10 دقايق كاملة',
    'يقلّد شخصية مشهورة أو واحد من الشلة لمدة 20 ثانية',
    'يدفع حساب أقرب طلب عصير أو قهوة للشلة',
    'يتكلم بالفصحى بس لمدة 3 دقايق متواصلة'
  ];

  let selectedDefaultPenalties = new Set([0, 1, 2, 3, 4, 5]);
  let customPenalties = [];
  let usedTruths = new Set();
  let usedDares = new Set();
  let askedCount = {}; // playerId -> number of turns completed

  let currentRound = null;
  // { targetId, targetName, targetColor, choice, prompt, penaltyText, status: 'setup'|'choosing'|'acting'|'penalty'|'resolved'|'finished' }

  const TRUTHS = {
    casual: [
      'إيه أكتر أكلة بتحبها ومستعد تاكلها كل يوم؟',
      'لو معاك تذكرة سفر مجانية لأي بلد، هتروح فين وليه؟',
      'إيه أكتر فيلم أو مسلسل اتفرجت عليه أكتر من مرة؟',
      'إيه العادة الغريبة اللي بتعملها وأنت لوحدك في البيت؟',
      'لو تقدر تتعلم مهارة جديدة في يوم واحد، هتختار إيه؟',
      'إيه أكتر ذكرى حلوة من أيام المدرسة لسه فاكرها لحد النهاردة؟',
      'مين أكتر شخص في القعدة دي بتحس إنه شبهك في طريقة التفكير؟',
      'إيه الحاجة اللي بتضحكك فوراً مهما كان مودك وحش؟',
      'لو فتحت مشروع خاص بيك بكرة، هيكون في مجال إيه؟',
      'إيه أكتر مشوار أو خروجة ندمت إنك مكنتش رحتها؟',
      'إيه الأغنية اللي لو اشتغلت دلوقتي لازم تندمج معاها؟',
      'إيه أكتر حاجة بتشتريها أونلاين وبتضيع فلوسك عليها؟',
      'لو تقدر تقابل شخصية تاريخية أو مشهورة وتقعد معاها ساعة، هتختار مين؟',
      'إيه أكتر كلمة أو لزمة بتقولها دايماً في كلامك؟',
      'إيه أحلى هدية جتلك في حياتك ولسه محتفظ بيها؟'
    ],
    bold: [
      'إيه أكتر موقف محرج حصلك قدام ناس متعرفهمش؟',
      'هل في مرة عملت نفسك مش شايف رسالة شخص قاصد؟ مين وليه؟',
      'إيه أكتر صفة في شخصيتك نفسك تغيرها بجد؟',
      'إمتى آخر مرة حسيت إنك اتظلمت في موقف ومقدرتش تاخد حقك؟',
      'إيه أكتر حاجة الناس بتفهمها عنك غلط في أول تعامل؟',
      'لو مضطر تحذف تطبيق واحد من موبايلك للأبد، هتضحي بمين فيهم؟',
      'إيه أغرب كدبة بيضة قولتها عشان تهرب من خروجة أو عزومة؟',
      'مين أكتر شخص في القعدة دي تقدر تحكيله سرك وأنت مطمن؟',
      'إيه أكتر قرار خدته بسرعة وطلع صح رغم إن الكل حذرك منه؟',
      'هل في مرة حكمت على حد من شكله وبعدين اكتشفت إنك غلطان تماماً؟',
      'إيه الحاجة اللي كنت خايف تجربها ولما جربتها عجبتك جداً؟',
      'لو تقدر تعرف رأي الشلة فيك في جملة واحدة، تحب تسمع إيه؟',
      'إيه أكتر حاجة بتعصبك في تعاملات الناس اليومية؟',
      'هل في حد من صحابك القديمين نفسك ترجع تكلمه تاني؟',
      'إيه أكتر مرة صرفت فيها فلوس على حاجة وندمت تاني يوم؟'
    ],
    intense: [
      'إيه أكبر قرار خدته في حياتك وغيّر مسارك بالكامل؟',
      'لو رجع بيك الزمن 3 سنين لورا، إيه النصيحة اللي هتقولها لنفسك؟',
      'إمتى آخر مرة عيّطت بجد وكان إيه السبب الحقيقي؟',
      'إيه الخوف اللي لسه مسيطر عليك ومبتحكيش عنه لحد؟',
      'هل حسيت بالغيرة من نجاح حد قريب منك قبل كده؟ واتعاملت معاها إزاي؟',
      'إيه الحاجة اللي بتندم إنك مقولتهاش لشخص قبل ما علاقتكم تنتهي؟',
      'مين أكتر شخص أثّر في حياتك وغيّر طريقتك في التفكير؟',
      'لو كتاب حياتك اتكتب النهاردة، تسمّي الفصل الحالي إيه؟',
      'إيه السر اللي محتفظ بيه لحد دلوقتي ومحدش في القعدة يعرفه؟',
      'هل في مرة كسرت ثقة حد كان واثق فيك؟ وإزاي صلحت ده؟',
      'إيه الحاجة اللي لو خسرتها بكرة، حياتك هتتلخبط تماماً؟',
      'إمتى حسيت إنك فخور بنفسك لأول مرة بجد؟',
      'لو تقدر تمسح سنة كاملة من عمرك وتعيدها، هتختار أي سنة؟',
      'إيه الحاجة اللي نفسك تحققها قبل ما توصل سن الأربعين؟',
      'مين الشخص اللي لو بعتلك رسالة الساعة 3 الفجر هترد عليه فوراً من غير تفكير؟'
    ]
  };

  const DARES = {
    casual: [
      'اتكلم بلهجة مختلفة (صعيدي أو إسكندراني) لحد ما دورك الجاي يجي.',
      'قول 3 مميزات حقيقية في الشخص اللي على يمينك.',
      'اعمل نفسك بتمثل إعلان منتج عشوائي في الأوضة لمدة 20 ثانية.',
      'ورّي الشلة آخر صورة التقطتها بكاميرا موبايلك.',
      'اقرأ آخر بوست أو رسالة شوفتها بصوت مذيع نشرة أخبار.',
      'حاول تضحّك الشخص اللي قدامك في 15 ثانية من غير ما تلمسه.',
      'اختار أغنية وغنّي منها 15 ثانية بأداء مسرحي.',
      'اعمل مقارنة سريعة بين اتنين في القعدة كأنك معلق رياضي.',
      'سيب موبايلك مقلوب على الترابيزة وممنوع تلمسه لدورتين.',
      'قول نكتة، ولو محدش ضحك تاخد تحدي خفيف من اختيار الشلة.'
    ],
    bold: [
      'افتح قائمة أكتر 5 إيموجيز بتستخدمها واشرح بتستخدمهم مع مين.',
      'اقرأ آخر 3 رسايل بعتهم في أي شات (غير خاص بأهلك).',
      'خلي الشخص اللي جنبك يختارلك صورة بروفايل مؤقتة لمدة ساعة.',
      'اتصل بحد من صحابك (مش في القعدة) وقوله "عندي ليك خبر غريب" واسمع رده.',
      'قول 3 عيوب في شخصيتك بصراحة قدام الشلة.',
      'اختار واحد من الشلة واعترفله بحاجة مكنتش قولتها قبل كده.',
      'اعمل 10 نطات Jumping Jacks وأنت بتقول أسماء الشلة بالترتيب.',
      'ورّي الشلة أكتر 3 تطبيقات استخدمتها النهاردة في الـ Screen Time.',
      'ابعت رسالة لواحد صاحبك واكتبله "تفتكر أنا اتغيرت؟" وسيبه يرد.',
      'خلي الشلة تسألك سؤال واحد مشترك ولازم تجاوب عليه بنعم أو لأ بس.'
    ],
    intense: [
      'اتصل بحد من صحابك وقوله "محتاجلك في مشوار ضروري الساعة 6 الصبح بكرة" وشوف رده على السبيكر!',
      'اعمل 15 ضغط دلوقتي قدام الكل أو نفّذ حكم من مكتبة الأحكام.',
      'اقرأ بصوت عالي آخر رسالة كتبتها في الـ Notes عندك (لو مش سر خطير).',
      'اسمح للشلة تكتبلك ستوري مضحك على السوشيال ميديا وتسيبه 15 دقيقة.',
      'اجاوب على سؤال عشوائي من الشلة بصراحة 100% من غير أي تجميل.',
      'امشي في الأوضة أو قدام الكاميرا كأنك في عرض أزياء لمدة 20 ثانية.',
      'اختار شخص في القعدة وقوله أكبر حاجة بتقدرها فيه بجد.',
      'نفّذ طلب واحد تتفق عليه الشلة بالإجماع في خلال 30 ثانية.'
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
    askedCount = {};
    players.forEach(p => {
      scores[p.id] = 0;
      askedCount[p.id] = 0;
    });
    rotationIdx = 0;
    usedTruths.clear();
    usedDares.clear();

    currentRound = { status: 'setup' };
    App.updateScores(scores);
    render();
  }

  function stop() {
    currentRound = null;
  }

  function startSessionFromSetup() {
    if (!isHost || players.length === 0) return;
    const activePenalties = [];
    defaultPenaltyLibrary.forEach((txt, idx) => {
      if (selectedDefaultPenalties.has(idx)) activePenalties.push(txt);
    });
    customPenalties.forEach(txt => activePenalties.push(txt));
    config.penalties = activePenalties.length > 0 ? activePenalties : [...defaultPenaltyLibrary];

    askedCount = {};
    players.forEach(p => { askedCount[p.id] = 0; });
    rotationIdx = 0;

    nextTurn(false);
  }

  function drawNonRepeating(type) {
    const lvl = config.level || 'bold';
    const fullPool = type === 'truth' ? TRUTHS[lvl] : DARES[lvl];
    const usedSet = type === 'truth' ? usedTruths : usedDares;

    let available = fullPool.filter(item => !usedSet.has(item));
    if (available.length === 0) {
      // Reset only this level's items when all exhausted
      fullPool.forEach(item => usedSet.delete(item));
      available = fullPool;
    }
    const chosen = available[Math.floor(Math.random() * available.length)];
    usedSet.add(chosen);
    return chosen;
  }

  function isGameFinished() {
    if (!config.questionsPerPlayer || config.questionsPerPlayer === 0) return false;
    return players.every(p => (askedCount[p.id] || 0) >= config.questionsPerPlayer);
  }

  function nextTurn(random = false) {
    if (!isHost || players.length === 0) return;

    if (isGameFinished()) {
      currentRound = { status: 'finished' };
      NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
      render();
      return;
    }

    let target = null;
    if (random) {
      const eligible = players.filter(p => !config.questionsPerPlayer || (askedCount[p.id] || 0) < config.questionsPerPlayer);
      const pool = eligible.length > 0 ? eligible : players;
      target = pool[Math.floor(Math.random() * pool.length)];
    } else {
      for (let i = 0; i < players.length; i++) {
        const cand = players[(rotationIdx + i) % players.length];
        if (!config.questionsPerPlayer || (askedCount[cand.id] || 0) < config.questionsPerPlayer) {
          target = cand;
          rotationIdx = (rotationIdx + i + 1) % players.length;
          break;
        }
      }
      if (!target) target = players[0];
    }

    currentRound = {
      targetId: target.id,
      targetName: target.nickname,
      targetColor: target.color,
      choice: null,
      prompt: '',
      penaltyText: '',
      status: 'choosing'
    };

    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function pickChoice(choice) {
    if (!currentRound || currentRound.status !== 'choosing') return;
    if (!NetworkManager.isLocalMode() && currentRound.targetId !== myId && !isHost) return;

    if (isHost) {
      applyChoice(choice);
    } else {
      NetworkManager.sendGameData({ type: 'TDARE_CHOOSE', choice });
    }
  }

  function applyChoice(choice) {
    currentRound.choice = choice;
    currentRound.prompt = drawNonRepeating(choice);
    currentRound.status = 'acting';
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    render();
  }

  function resolvePass() {
    if (!isHost || !currentRound) return;
    askedCount[currentRound.targetId] = (askedCount[currentRound.targetId] || 0) + 1;
    scores[currentRound.targetId] = (scores[currentRound.targetId] || 0) + 15;
    currentRound.status = 'resolved';
    currentRound.passed = true;

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function triggerPenalty() {
    if (!isHost || !currentRound) return;
    const pool = config.penalties.length > 0 ? config.penalties : defaultPenaltyLibrary;
    const penaltyText = pool[Math.floor(Math.random() * pool.length)];

    currentRound.penaltyText = penaltyText;
    currentRound.status = 'penalty';
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function finishPenalty(didPenalty) {
    if (!isHost || !currentRound) return;
    askedCount[currentRound.targetId] = (askedCount[currentRound.targetId] || 0) + 1;
    if (didPenalty) {
      scores[currentRound.targetId] = (scores[currentRound.targetId] || 0) + 5;
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    } else {
      scores[currentRound.targetId] = Math.max(0, (scores[currentRound.targetId] || 0) - 5);
    }
    currentRound.status = 'resolved';
    currentRound.passed = didPenalty;
    App.updateScores(scores);
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function handleData(senderId, payload) {
    if (payload.type === 'TDARE_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      if (payload.config) config = payload.config;
      if (payload.askedCount) askedCount = payload.askedCount;
      App.updateScores(scores);
      render();
    } else if (payload.type === 'TDARE_CHOOSE' && isHost) {
      applyChoice(payload.choice);
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const isLocal = NetworkManager.isLocalMode();
    const canAct = isLocal || isHost || (currentRound && currentRound.targetId === myId);

    const levelMeta = {
      casual: { icon: 'coffee', label: 'رايق / ودي' },
      bold: { icon: 'flame', label: 'صريح / جريء' },
      intense: { icon: 'zap', label: 'تحدي تقيل' }
    };

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound || currentRound.status === 'setup') {
      if (isHost) {
        html += `
          <div class="social-card setup-card">
            <div class="setup-header">
              <div class="social-icon-badge sm"><i data-lucide="settings-2"></i></div>
              <div>
                <h3>إعدادات جولة صراحة وجرأة</h3>
                <p>ظبّط المستوى وعدد الأسئلة ومكتبة الأحكام قبل ما تبدأوا</p>
              </div>
            </div>

            <div class="setup-section">
              <label class="setup-label">1. مستوى الأسئلة والتحديات (يتحدد مرة واحدة للجولة):</label>
              <div class="intensity-pills">
                ${Object.keys(levelMeta).map(k => `
                  <button type="button" class="pill-btn td-lvl-btn ${config.level === k ? 'active' : ''}" data-lvl="${k}">
                    <i data-lucide="${levelMeta[k].icon}"></i> ${levelMeta[k].label}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="setup-section">
              <label class="setup-label">2. عدد الأسئلة لكل لاعب:</label>
              <div class="intensity-pills">
                ${[5, 10, 20, 0].map(cnt => `
                  <button type="button" class="pill-btn td-cnt-btn ${config.questionsPerPlayer === cnt ? 'active' : ''}" data-cnt="${cnt}">
                    ${cnt === 0 ? 'مفتوح (بلا حد)' : `${cnt} أسئلة`}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="setup-section">
              <label class="setup-label">3. مكتبة الأحكام المسبقة (لو حد رفض يجاوب يطلعله حكم عشوائي منها):</label>
              <div class="penalty-chips-grid">
                ${defaultPenaltyLibrary.map((txt, idx) => `
                  <button type="button" class="penalty-chip ${selectedDefaultPenalties.has(idx) ? 'active' : ''}" data-pidx="${idx}">
                    <i data-lucide="${selectedDefaultPenalties.has(idx) ? 'check-square' : 'square'}"></i>
                    <span>${txt}</span>
                  </button>
                `).join('')}
                ${customPenalties.map((txt, cidx) => `
                  <span class="penalty-chip active custom">
                    <i data-lucide="star"></i>
                    <span>${txt}</span>
                  </span>
                `).join('')}
              </div>
              <form id="td-add-penalty-form" class="custom-prompt-bar" style="margin-top:8px;">
                <input type="text" id="td-custom-penalty-input" placeholder="أضف حكم خاص بيكم للمكتبة..." maxlength="100" autocomplete="off">
                <button type="submit" class="glass-btn small-btn"><i data-lucide="plus"></i> أضف</button>
              </form>
            </div>

            <button id="tdare-begin-btn" class="glow-btn-cyan" style="width:100%;">
              <i data-lucide="play"></i> ابدأ الجولة الآن
            </button>
          </div>
        `;
      } else {
        html += `
          <div class="social-card center-card">
            <div class="social-icon-badge"><i data-lucide="settings-2"></i></div>
            <h3>صراحة وجرأة</h3>
            <p class="waiting-pulse">المضيف بيجهز إعدادات الجولة ومكتبة الأحكام...</p>
          </div>
        `;
      }
    } else if (currentRound.status === 'finished') {
      const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="trophy"></i></div>
          <h3>انتهت الجولة!</h3>
          <p>كل الشلة خلصت عدد الأسئلة المحدد (${config.questionsPerPlayer} لكل لاعب).</p>
          <div class="poll-results" style="width:100%;">
            ${sorted.map((p, i) => `
              <div class="rd-row" style="border-color: ${p.color};">
                <span style="color: ${p.color}; font-weight: 700;">#${i + 1} ${p.nickname}</span>
                <span>${scores[p.id] || 0} نقطة</span>
              </div>
            `).join('')}
          </div>
          ${isHost ? `<button id="tdare-reconfig-btn" class="glow-btn-cyan"><i data-lucide="rotate-cw"></i> جولة جديدة</button>` : ''}
        </div>
      `;
    } else {
      const targetCount = askedCount[currentRound.targetId] || 0;
      const limitLabel = config.questionsPerPlayer > 0 ? `${targetCount + 1} / ${config.questionsPerPlayer}` : `#${targetCount + 1}`;
      const lvlInfo = levelMeta[config.level] || levelMeta.bold;

      html += `
        <div class="social-card center-card">
          <div class="round-meta-strip">
            <span class="badge"><i data-lucide="${lvlInfo.icon}"></i> ${lvlInfo.label}</span>
            <span class="badge">سؤال ${limitLabel}</span>
          </div>
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
          html += `<p class="waiting-pulse">مستنيين ${currentRound.targetName} يختار...</p>`;
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
              <button id="tdare-pass-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> جاوب / نفّذ (+15)</button>
              <button id="tdare-refuse-btn" class="glow-btn-magenta"><i data-lucide="gavel"></i> رفض (اسحب حكم!)</button>
            </div>
          ` : `<p class="waiting-pulse">المضيف بيقيّم التنفيذ...</p>`}
        `;
      } else if (currentRound.status === 'penalty') {
        html += `
          <div class="dare-box penalty-box" style="width:100%;">
            <span class="dare-badge" style="color: var(--neon-magenta);"><i data-lucide="gavel"></i> عقاب تلقائي من مكتبة الأحكام</span>
            <p class="dare-text">${currentRound.penaltyText}</p>
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="tdare-pen-done" class="glow-btn-green"><i data-lucide="check"></i> نفّذ الحكم (+5)</button>
              <button id="tdare-pen-skip" class="glass-btn danger-hover-btn"><i data-lucide="x"></i> تهرب تاني (-5)</button>
            </div>
          ` : `<p class="waiting-pulse">لازم ${currentRound.targetName} ينفّذ الحكم!</p>`}
        `;
      } else if (currentRound.status === 'resolved') {
        html += `
          <div class="result-banner ${currentRound.passed ? 'win' : 'lose'}" style="width:100%;">
            <i data-lucide="${currentRound.passed ? 'award' : 'shield-alert'}"></i>
            ${currentRound.passed ? `عاش يا ${currentRound.targetName}!` : `تم تسجيل النتيجة على ${currentRound.targetName}`}
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

    // Setup bindings
    stage.querySelectorAll('.td-lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        config.level = btn.getAttribute('data-lvl');
        render();
      });
    });
    stage.querySelectorAll('.td-cnt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        config.questionsPerPlayer = parseInt(btn.getAttribute('data-cnt'), 10);
        render();
      });
    });
    stage.querySelectorAll('.penalty-chip[data-pidx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-pidx'), 10);
        if (selectedDefaultPenalties.has(idx)) selectedDefaultPenalties.delete(idx);
        else selectedDefaultPenalties.add(idx);
        render();
      });
    });
    document.getElementById('td-add-penalty-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('td-custom-penalty-input');
      const val = inp.value.trim();
      if (val) {
        customPenalties.push(val);
        inp.value = '';
        render();
      }
    });
    document.getElementById('tdare-begin-btn')?.addEventListener('click', startSessionFromSetup);
    document.getElementById('tdare-reconfig-btn')?.addEventListener('click', () => start(isHost, players, myId));

    // Gameplay bindings
    document.getElementById('tdare-truth-btn')?.addEventListener('click', () => pickChoice('truth'));
    document.getElementById('tdare-dare-btn')?.addEventListener('click', () => pickChoice('dare'));
    document.getElementById('tdare-pass-btn')?.addEventListener('click', resolvePass);
    document.getElementById('tdare-refuse-btn')?.addEventListener('click', triggerPenalty);
    document.getElementById('tdare-pen-done')?.addEventListener('click', () => finishPenalty(true));
    document.getElementById('tdare-pen-skip')?.addEventListener('click', () => finishPenalty(false));
    document.getElementById('tdare-next-btn')?.addEventListener('click', () => nextTurn(false));
    document.getElementById('tdare-rand-btn')?.addEventListener('click', () => nextTurn(true));
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('truth-dare', TruthDareGame);
  });

  return { start, stop, handleData };
})();
