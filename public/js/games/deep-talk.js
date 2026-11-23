// Deep Talk / Hot Seat (كرسي الاعتراف) - Social Hangout Game (Online + Single Device)
const DeepTalkGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};
  let rotationIdx = 0;
  let usedQuestions = new Set();

  let currentRound = null; // { targetId, targetName, targetColor, question, category }

  const QUESTIONS = [
    { cat: 'ذكريات', q: 'إيه أكتر يوم في حياتك نفسك تعيشه تاني من أول وجديد؟' },
    { cat: 'صداقة', q: 'إيه أكتر صفة بتخليك تثق في الشخص اللي قدامك من أول تعامل؟' },
    { cat: 'اعتراف', q: 'لو تقدر تغير قرار واحد خدته في السنتين اللي فاتوا، هتغير إيه؟' },
    { cat: 'شخصية', q: 'إيه الحاجة اللي الناس دايماً بتفهمها عنك غلط؟' },
    { cat: 'مشاعر', q: 'إمتى آخر مرة حسيت إنك فخور بنفسك بجد؟' },
    { cat: 'أحلام', q: 'لو الفلوس والوقت مش مشكلة خالص، هتعمل إيه في حياتك بكرة؟' },
    { cat: 'شلة', q: 'مين في القعدة دي تقدر تحكيله أي مشكلة من غير ما تخاف من حكمه عليك؟' },
    { cat: 'اعتراف', q: 'إيه أكتر درس اتعلمته بالطريقة الصعبة في علاقاتك بالناس؟' },
    { cat: 'عميق', q: 'لو كتاب حياتك اتكتب النهاردة، تسمّي الفصل اللي أنت فيه دلوقتي إيه؟' },
    { cat: 'صراحة', q: 'إيه أكتر حاجة بتخاف منها في المستقبل؟' },
    { cat: 'شلة', q: 'قول كلمة شكر أو تقدير لشخص واحد في القعدة دي على حاجة عملها معاك.' },
    { cat: 'عميق', q: 'إيه الحاجة اللي لو اختفت من يومك هتحس إن يومك ناقص؟' }
  ];

  function getStage() {
    return document.getElementById('deep-talk-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    rotationIdx = 0;
    usedQuestions.clear();
    currentRound = null;
    App.updateScores(scores);
    render();
  }

  function stop() {
    currentRound = null;
  }

  function drawQuestion(samePlayer = false) {
    if (!isHost || players.length === 0) return;
    if (!samePlayer) rotationIdx++;
    const target = players[(rotationIdx - 1 + players.length) % players.length];

    let available = QUESTIONS.filter(item => !usedQuestions.has(item.q));
    if (available.length === 0) {
      usedQuestions.clear();
      available = QUESTIONS;
    }
    const pick = available[Math.floor(Math.random() * available.length)];
    usedQuestions.add(pick.q);

    currentRound = {
      targetId: target.id,
      targetName: target.nickname,
      targetColor: target.color,
      question: pick.q,
      category: pick.cat
    };

    NetworkManager.broadcastGameData({ type: 'DT_STATE', round: currentRound, scores });
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
    render();
  }

  function awardHonesty() {
    if (!isHost || !currentRound) return;
    scores[currentRound.targetId] = (scores[currentRound.targetId] || 0) + 10;
    App.updateScores(scores);
    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();
    drawQuestion(false);
  }

  function handleData(senderId, payload) {
    if (payload.type === 'DT_STATE') {
      currentRound = payload.round;
      scores = payload.scores;
      App.updateScores(scores);
      if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
      render();
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    let html = `<div class="social-game-wrapper rtl-text">`;

    if (!currentRound) {
      html += `
        <div class="social-card center-card">
          <div class="social-icon-badge"><i data-lucide="armchair"></i></div>
          <h3>كرسي الاعتراف</h3>
          <p>أسئلة عميقة وصريحة تقرّب الشلة من بعض! كل لاعب يقعد على الكرسي ويجاوب بصدق على سؤال من القلب.</p>
          ${isHost
            ? `<button id="dt-start-btn" class="glow-btn-cyan"><i data-lucide="play"></i> ابدأ الجلسة</button>`
            : `<p class="waiting-pulse">في انتظار المضيف لبدء الجلسة...</p>`}
        </div>
      `;
    } else {
      html += `
        <div class="social-card center-card">
          <div class="target-banner" style="border-color: ${currentRound.targetColor};">
            <span>على كرسي الاعتراف:</span>
            <strong style="color: ${currentRound.targetColor};">${currentRound.targetName}</strong>
          </div>
          <div class="dare-box" style="width:100%;">
            <span class="dare-badge"><i data-lucide="message-circle-heart"></i> ${currentRound.category}</span>
            <p class="dare-text">${currentRound.question}</p>
          </div>
          ${isHost ? `
            <div class="vote-actions">
              <button id="dt-honest-btn" class="glow-btn-green"><i data-lucide="heart"></i> جاوب بصراحة (+10) والتالي</button>
              <button id="dt-reroll-btn" class="glass-btn"><i data-lucide="refresh-cw"></i> سؤال تاني</button>
            </div>
          ` : `<p class="waiting-pulse">اسمعوا إجابة ${currentRound.targetName}!</p>`}
        </div>
      `;
    }

    html += `</div>`;
    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    document.getElementById('dt-start-btn')?.addEventListener('click', () => drawQuestion(false));
    document.getElementById('dt-honest-btn')?.addEventListener('click', awardHonesty);
    document.getElementById('dt-reroll-btn')?.addEventListener('click', () => drawQuestion(true));
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('deep-talk', DeepTalkGame);
  });

  return { start, stop, handleData };
})();
