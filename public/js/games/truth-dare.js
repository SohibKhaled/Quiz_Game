// Truth or Dare (صراحة وجرأة) - Massive Non-Repeating Bank, Turn Timer, Penalty Library & Lowest-Score Loser Judgment
const TruthDareGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let turnTimerInterval = null;

  let config = {
    level: 'bold', // 'casual' | 'bold' | 'intense'
    questionsPerPlayer: 5, // 5 | 10 | 20 | 0
    turnTimerSeconds: 30, // 0 | 15 | 30 | 45 | 60
    loserPenaltyEnabled: true,
    penalties: []
  };

  function getBank() {
    return window.SOHIB_BANK || {
      TRUTHS: { casual: ['إيه أكتر أكلة بتحبها؟'], bold: ['إيه أكتر موقف محرج حصلك؟'], intense: ['إيه أكبر سر محدش يعرفه؟'] },
      DARES: { casual: ['اتكلم بلهجة صعيدي لدورتين.'], bold: ['اقرأ آخر 3 رسايل بعتهم.'], intense: ['اعمل 20 ضغط قدام الكل.'] },
      HEAVY_PENALTIES: ['يعمل 20 ضغط قدام الشلة دلوقتي', 'يدفع حساب أقرب طلب مشروبات للشلة']
    };
  }

  let selectedDefaultPenalties = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
  let customPenalties = [];
  let usedTruths = new Set();
  let usedDares = new Set();
  let askedCount = {};
  let currentRound = null;

  function getStage() {
    return document.getElementById('truth-dare-stage');
  }

  function start(hostFlag, playerList, localId) {
    clearTurnTimer();
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
    App.updateTimer('--');
    render();
  }

  function stop() {
    clearTurnTimer();
    currentRound = null;
  }

  function clearTurnTimer() {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
  }

  function startSessionFromSetup() {
    if (!isHost || players.length === 0) return;
    const bank = getBank();
    const activePenalties = [];
    bank.HEAVY_PENALTIES.forEach((txt, idx) => {
      if (selectedDefaultPenalties.has(idx)) activePenalties.push(txt);
    });
    customPenalties.forEach(txt => activePenalties.push(txt));
    config.penalties = activePenalties.length > 0 ? activePenalties : [...bank.HEAVY_PENALTIES];

    askedCount = {};
    players.forEach(p => { askedCount[p.id] = 0; });
    rotationIdx = 0;
    nextTurn(false);
  }

  function drawNonRepeating(type) {
    const bank = getBank();
    const lvl = config.level || 'bold';
    const fullPool = type === 'truth' ? bank.TRUTHS[lvl] : bank.DARES[lvl];
    const usedSet = type === 'truth' ? usedTruths : usedDares;

    let available = fullPool.filter(item => !usedSet.has(item));
    if (available.length === 0) {
      fullPool.forEach(item => usedSet.delete(item));
      available = fullPool;
    }
    const chosen = available[Math.floor(Math.random() * available.length)];
    usedSet.add(chosen);
    return chosen;
  }

  function drawRandomPenalty() {
    const pool = config.penalties.length > 0 ? config.penalties : getBank().HEAVY_PENALTIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function isGameFinished() {
    if (!config.questionsPerPlayer || config.questionsPerPlayer === 0) return false;
    return players.every(p => (askedCount[p.id] || 0) >= config.questionsPerPlayer);
  }

  function finishGameNow() {
    if (!isHost) return;
    clearTurnTimer();
    const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
    const loser = sorted[sorted.length - 1];

    currentRound = {
      status: 'finished',
      loserId: loser ? loser.id : null,
      loserName: loser ? loser.nickname : '',
      loserColor: loser ? loser.color : '#ff2e93',
      loserPenalty: config.loserPenaltyEnabled ? drawRandomPenalty() : ''
    };

    App.updateTimer('--');
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
    render();
  }

  function rerollLoserPenalty() {
    if (!isHost || !currentRound || currentRound.status !== 'finished') return;
    currentRound.loserPenalty = drawRandomPenalty();
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function nextTurn(random = false) {
    if (!isHost || players.length === 0) return;
    clearTurnTimer();

    if (isGameFinished()) {
      finishGameNow();
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
      timeLeft: config.turnTimerSeconds || 0,
      timeExpired: false,
      status: 'choosing'
    };

    App.updateTimer(config.turnTimerSeconds > 0 ? config.turnTimerSeconds : '--');
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function startTurnCountdown() {
    clearTurnTimer();
    if (!isHost || !config.turnTimerSeconds || config.turnTimerSeconds <= 0) return;

    currentRound.timeLeft = config.turnTimerSeconds;
    currentRound.timeExpired = false;
    App.updateTimer(currentRound.timeLeft);

    turnTimerInterval = setInterval(() => {
      if (!currentRound || currentRound.status !== 'acting') {
        clearTurnTimer();
        return;
      }
      currentRound.timeLeft--;
      App.updateTimer(Math.max(0, currentRound.timeLeft));

      if (currentRound.timeLeft <= 0) {
        clearTurnTimer();
        currentRound.timeExpired = true;
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playExplosion();
      } else if (currentRound.timeLeft <= 5) {
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
      }

      NetworkManager.broadcastGameData({ type: 'TDARE_TICK', timeLeft: currentRound.timeLeft, timeExpired: currentRound.timeExpired });
      updateTimerBarUI();
    }, 1000);
  }

  function updateTimerBarUI() {
    const bar = document.getElementById('tdare-timer-fill');
    const txt = document.getElementById('tdare-timer-text');
    if (bar && config.turnTimerSeconds > 0 && currentRound) {
      const pct = Math.max(0, Math.round((currentRound.timeLeft / config.turnTimerSeconds) * 100));
      bar.style.width = `${pct}%`;
      bar.classList.toggle('danger', currentRound.timeLeft <= 5);
    }
    if (txt && currentRound) {
      txt.innerText = currentRound.timeExpired ? 'انتهى الوقت! اسحب حكم أو قيّم' : `الوقت المتبقي: ${currentRound.timeLeft} ثانية`;
      txt.classList.toggle('time-up-txt', Boolean(currentRound.timeExpired));
    }
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
    currentRound.doubleStakes = false;
    currentRound.status = 'acting';
    currentRound.timeLeft = config.turnTimerSeconds || 0;
    currentRound.timeExpired = false;

    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    render();
    startTurnCountdown();
  }

  function toggleDoubleStakes() {
    if (!isHost || !currentRound || currentRound.status !== 'acting') return;
    currentRound.doubleStakes = !currentRound.doubleStakes;
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function resolvePass() {
    if (!isHost || !currentRound) return;
    clearTurnTimer();
    askedCount[currentRound.targetId] = (askedCount[currentRound.targetId] || 0) + 1;
    const pts = currentRound.doubleStakes ? 30 : 15;
    scores[currentRound.targetId] = (scores[currentRound.targetId] || 0) + pts;
    currentRound.status = 'resolved';
    currentRound.passed = true;

    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    NetworkManager.broadcastGameData({ type: 'TDARE_STATE', round: currentRound, scores, config, askedCount });
    render();
  }

  function triggerPenalty() {
    if (!isHost || !currentRound) return;
    clearTurnTimer();
    currentRound.penaltyText = drawRandomPenalty();
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
    } else if (payload.type === 'TDARE_TICK') {
      if (currentRound) {
        currentRound.timeLeft = payload.timeLeft;
        currentRound.timeExpired = payload.timeExpired;
        App.updateTimer(Math.max(0, payload.timeLeft));
        updateTimerBarUI();
      }
    } else if (payload.type === 'TDARE_CHOOSE' && isHost) {
      applyChoice(payload.choice);
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;
    const bank = getBank();
    const isLocal = NetworkManager.isLocalMode();
    const canAct = isLocal || isHost || (currentRound && currentRound.targetId === myId);

    const levelMeta = {
      casual: { icon: 'coffee', label: 'رايق / ودي' },
      bold: { icon: 'flame', label: 'صريح / جريء' },
      intense: { icon: 'heart-crack', label: 'مشاعر وتحدي تقيل' },
      redline: { icon: 'shield-alert', label: 'خط أحمر / بدون فلتر' }
    };

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound || currentRound.status === 'setup') {
      if (isHost) {
        const totalPool =
          bank.TRUTHS.casual.length + bank.TRUTHS.bold.length + bank.TRUTHS.intense.length + (bank.TRUTHS.redline?.length || 0) +
          bank.DARES.casual.length + bank.DARES.bold.length + bank.DARES.intense.length + (bank.DARES.redline?.length || 0);
        html += `
          <div class="social-card setup-card">
            <div class="setup-header">
              <div class="social-icon-badge sm"><i data-lucide="settings-2"></i></div>
              <div>
                <h3>إعدادات جولة صراحة وجرأة</h3>
                <p>أكتر من ${totalPool} سؤال وتحدي بدون تكرار</p>
              </div>
            </div>

            <div class="setup-section">
              <label class="setup-label">1. مستوى الأسئلة والتحديات:</label>
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
              <label class="setup-label">3. تايمر الإجابة لكل سؤال:</label>
              <div class="intensity-pills">
                ${[0, 15, 30, 45, 60].map(sec => `
                  <button type="button" class="pill-btn td-tmr-btn ${config.turnTimerSeconds === sec ? 'active' : ''}" data-sec="${sec}">
                    <i data-lucide="timer"></i> ${sec === 0 ? 'بدون تايمر' : `${sec} ثانية`}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="setup-section">
              <label class="setup-label">4. حكم آخر اللعبة على صاحب أقل نقاط:</label>
              <button type="button" id="td-loser-toggle" class="penalty-chip ${config.loserPenaltyEnabled ? 'active' : ''}" style="width:fit-content;">
                <i data-lucide="${config.loserPenaltyEnabled ? 'check-square' : 'square'}"></i>
                <span>تطبيق حكم تقيل تلقائياً على صاحب أقل نقاط في النهاية</span>
              </button>
            </div>

            <div class="setup-section">
              <label class="setup-label">5. مكتبة الأحكام المسبقة (للرفض أو للخاسر):</label>
              <div class="penalty-chips-grid">
                ${bank.HEAVY_PENALTIES.map((txt, idx) => `
                  <button type="button" class="penalty-chip ${selectedDefaultPenalties.has(idx) ? 'active' : ''}" data-pidx="${idx}">
                    <i data-lucide="${selectedDefaultPenalties.has(idx) ? 'check-square' : 'square'}"></i>
                    <span>${txt}</span>
                  </button>
                `).join('')}
                ${customPenalties.map(txt => `
                  <span class="penalty-chip active custom"><i data-lucide="star"></i><span>${txt}</span></span>
                `).join('')}
              </div>
              <form id="td-add-penalty-form" class="custom-prompt-bar" style="margin-top:6px;">
                <input type="text" id="td-custom-penalty-input" placeholder="أضف حكم تقيل خاص بيكم..." maxlength="100" autocomplete="off">
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
            <p class="waiting-pulse">المضيف بيجهز إعدادات الجولة والتايمر ومكتبة الأحكام...</p>
          </div>
        `;
      }
    } else if (currentRound.status === 'finished') {
      const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="trophy"></i></div>
          <h3>انتهت الجولة!</h3>
          <div class="poll-results" style="width:100%;">
            ${sorted.map((p, i) => `
              <div class="rd-row ${i === sorted.length - 1 && players.length > 1 ? 'loser-row' : ''}" style="border-color: ${p.color};">
                <span style="color: ${p.color}; font-weight: 700;">#${i + 1} ${p.nickname}</span>
                <span>${scores[p.id] || 0} نقطة</span>
              </div>
            `).join('')}
          </div>
          ${config.loserPenaltyEnabled && currentRound.loserPenalty ? `
            <div class="dare-box penalty-box" style="width:100%;">
              <span class="dare-badge" style="color: var(--neon-magenta);">
                <i data-lucide="gavel"></i> حكم صاحب أقل نقاط (${currentRound.loserName})
              </span>
              <p class="dare-text">${currentRound.loserPenalty}</p>
            </div>
          ` : ''}
          ${isHost ? `
            <div class="vote-actions">
              ${config.loserPenaltyEnabled ? `<button id="tdare-reroll-loser" class="glass-btn"><i data-lucide="dices"></i> غيّر حكم الخاسر</button>` : ''}
              <button id="tdare-reconfig-btn" class="glow-btn-cyan"><i data-lucide="rotate-cw"></i> جولة جديدة</button>
            </div>
          ` : ''}
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
            ${isHost ? `<button id="tdare-end-early" class="glass-btn xs-btn" title="إنهاء وحساب الخاسر"><i data-lucide="flag"></i> إنهاء وحساب الخاسر</button>` : ''}
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
        const pct = config.turnTimerSeconds > 0 ? Math.max(0, Math.round((currentRound.timeLeft / config.turnTimerSeconds) * 100)) : 100;
        html += `
          ${config.turnTimerSeconds > 0 ? `
            <div class="td-timer-wrap">
              <div class="vibe-meter-bar"><div id="tdare-timer-fill" class="vibe-meter-fill ${currentRound.timeLeft <= 5 ? 'danger' : ''}" style="width:${pct}%;"></div></div>
              <p id="tdare-timer-text" class="timer-subtext ${currentRound.timeExpired ? 'time-up-txt' : ''}">
                ${currentRound.timeExpired ? 'انتهى الوقت! اسحب حكم أو قيّم' : `الوقت المتبقي: ${currentRound.timeLeft} ثانية`}
              </p>
            </div>
          ` : ''}
          <div class="dare-box ${currentRound.doubleStakes ? 'penalty-box' : ''}" style="width:100%;">
            <span class="dare-badge">
              <i data-lucide="${currentRound.choice === 'truth' ? 'message-circle-question' : 'flame'}"></i>
              ${currentRound.choice === 'truth' ? 'سؤال صراحة' : 'تحدي جرأة'} ${currentRound.doubleStakes ? '(مضاعفة الرهان +30!)' : ''}
            </span>
            <p class="dare-text">${currentRound.prompt}</p>
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="tdare-pass-btn" class="glow-btn-green"><i data-lucide="check-circle"></i> جاوب / نفّذ (+${currentRound.doubleStakes ? 30 : 15})</button>
              <button id="tdare-double-btn" class="glass-btn ${currentRound.doubleStakes ? 'active' : ''}"><i data-lucide="zap"></i> ضاعف الرهان</button>
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

    stage.querySelectorAll('.td-lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => { config.level = btn.getAttribute('data-lvl'); render(); });
    });
    stage.querySelectorAll('.td-cnt-btn').forEach(btn => {
      btn.addEventListener('click', () => { config.questionsPerPlayer = parseInt(btn.getAttribute('data-cnt'), 10); render(); });
    });
    stage.querySelectorAll('.td-tmr-btn').forEach(btn => {
      btn.addEventListener('click', () => { config.turnTimerSeconds = parseInt(btn.getAttribute('data-sec'), 10); render(); });
    });
    document.getElementById('td-loser-toggle')?.addEventListener('click', () => {
      config.loserPenaltyEnabled = !config.loserPenaltyEnabled;
      render();
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
      if (val) { customPenalties.push(val); inp.value = ''; render(); }
    });
    document.getElementById('tdare-begin-btn')?.addEventListener('click', startSessionFromSetup);
    document.getElementById('tdare-reconfig-btn')?.addEventListener('click', () => start(isHost, players, myId));
    document.getElementById('tdare-reroll-loser')?.addEventListener('click', rerollLoserPenalty);
    document.getElementById('tdare-end-early')?.addEventListener('click', finishGameNow);

    document.getElementById('tdare-truth-btn')?.addEventListener('click', () => pickChoice('truth'));
    document.getElementById('tdare-dare-btn')?.addEventListener('click', () => pickChoice('dare'));
    document.getElementById('tdare-pass-btn')?.addEventListener('click', resolvePass);
    document.getElementById('tdare-double-btn')?.addEventListener('click', toggleDoubleStakes);
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
