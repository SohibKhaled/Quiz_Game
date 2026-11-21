// Memory Matrix (Neon Pair Matching) - Arcade / Puzzle Game
const MemoryMatrixGame = (function() {
  let isHost = false;
  let myId = '';
  let players = [];
  let scores = {};

  const ICONS = ['zap', 'cpu', 'flame', 'shield', 'star', 'compass', 'gem', 'atom'];
  let cards = []; // [{ icon, flipped, matched, ownerColor }]
  let flippedIndices = [];
  let activePlayerIdx = 0;
  let lockBoard = false;

  function getStage() {
    return document.getElementById('memory-matrix-stage');
  }

  function start(hostFlag, playerList, localId) {
    isHost = hostFlag;
    players = playerList;
    myId = localId;
    scores = {};
    players.forEach(p => { scores[p.id] = 0; });
    activePlayerIdx = 0;
    lockBoard = false;
    flippedIndices = [];

    App.updateScores(scores);
    if (isHost) {
      initDeck();
    } else {
      render();
    }
  }

  function stop() {
    cards = [];
    lockBoard = false;
  }

  function initDeck() {
    const deck = [...ICONS, ...ICONS]
      .sort(() => Math.random() - 0.5)
      .map(icon => ({ icon, flipped: false, matched: false, ownerColor: null }));
    cards = deck;
    flippedIndices = [];
    lockBoard = false;

    NetworkManager.broadcastGameData({
      type: 'MM_SYNC',
      cards,
      activePlayerIdx,
      scores
    });
    render();
  }

  function handleCardClick(idx) {
    if (lockBoard || !cards[idx] || cards[idx].flipped || cards[idx].matched) return;
    const activePlayer = players[activePlayerIdx];
    if (!activePlayer || activePlayer.id !== myId) return;

    if (isHost) {
      flipCard(myId, idx);
    } else {
      NetworkManager.sendGameData({ type: 'MM_FLIP', idx });
    }
  }

  function flipCard(playerId, idx) {
    if (!isHost || lockBoard) return;
    const activePlayer = players[activePlayerIdx];
    if (!activePlayer || activePlayer.id !== playerId) return;
    if (cards[idx].flipped || cards[idx].matched) return;

    cards[idx].flipped = true;
    flippedIndices.push(idx);

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playClick();

    NetworkManager.broadcastGameData({
      type: 'MM_SYNC',
      cards,
      activePlayerIdx,
      scores
    });
    render();

    if (flippedIndices.length === 2) {
      lockBoard = true;
      const [i1, i2] = flippedIndices;

      if (cards[i1].icon === cards[i2].icon) {
        // Match!
        cards[i1].matched = true;
        cards[i2].matched = true;
        cards[i1].ownerColor = activePlayer.color;
        cards[i2].ownerColor = activePlayer.color;
        scores[playerId] = (scores[playerId] || 0) + 10;
        flippedIndices = [];
        lockBoard = false;

        App.updateScores(scores);
        if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playScore();

        NetworkManager.broadcastGameData({
          type: 'MM_SYNC',
          cards,
          activePlayerIdx,
          scores
        });
        render();

        if (cards.every(c => c.matched)) {
          if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
          setTimeout(() => {
            if (cards.length > 0) initDeck();
          }, 3000);
        }
      } else {
        // Mismatch: flip back after 900ms and advance turn
        setTimeout(() => {
          if (!cards[i1] || !cards[i2]) return;
          cards[i1].flipped = false;
          cards[i2].flipped = false;
          flippedIndices = [];
          activePlayerIdx = (activePlayerIdx + 1) % players.length;
          lockBoard = false;

          if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playTurn();
          NetworkManager.broadcastGameData({
            type: 'MM_SYNC',
            cards,
            activePlayerIdx,
            scores
          });
          render();
        }, 900);
      }
    }
  }

  function handleData(senderId, payload) {
    if (payload.type === 'MM_FLIP' && isHost) {
      flipCard(senderId, payload.idx);
    } else if (payload.type === 'MM_SYNC') {
      cards = payload.cards;
      activePlayerIdx = payload.activePlayerIdx;
      scores = payload.scores;
      App.updateScores(scores);
      render();
    }
  }

  function render() {
    const stage = getStage();
    if (!stage) return;

    const activePlayer = players[activePlayerIdx];
    const isMyTurn = activePlayer && activePlayer.id === myId;
    const allMatched = cards.length > 0 && cards.every(c => c.matched);

    let html = `
      <div class="memory-wrapper">
        <div class="game-status-bar" style="border-color: ${activePlayer ? activePlayer.color : 'var(--border-color)'};">
          ${allMatched
            ? 'Board Cleared! Shuffling new matrix...'
            : (isMyTurn ? 'YOUR TURN — Pick a card!' : `Waiting for ${activePlayer ? activePlayer.nickname : '...'}...`)}
        </div>
        <div class="memory-grid">
          ${cards.map((c, idx) => {
            const show = c.flipped || c.matched;
            const style = c.matched && c.ownerColor ? `border-color: ${c.ownerColor}; color: ${c.ownerColor};` : '';
            return `
              <button class="memory-card ${show ? 'flipped' : ''} ${c.matched ? 'matched' : ''}" data-idx="${idx}" style="${style}">
                ${show ? `<i data-lucide="${c.icon}"></i>` : `<i data-lucide="help-circle" class="card-back-icon"></i>`}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    stage.innerHTML = html;
    if (window.refreshIcons) window.refreshIcons();

    stage.querySelectorAll('.memory-card').forEach(btn => {
      btn.addEventListener('click', () => handleCardClick(parseInt(btn.getAttribute('data-idx'), 10)));
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    App.registerGame('memory-matrix', MemoryMatrixGame);
  });

  return { start, stop, handleData };
})();
