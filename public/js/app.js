// Main UI Coordinator and Game Shell
window.refreshIcons = function() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
};

const App = (function() {
  let activeGame = null;
  let activeGameType = '';
  let selectedGameType = 'truth-dare';
  let activeCategory = 'social';

  const elHomeView = document.getElementById('home-view');
  const elLobbyView = document.getElementById('lobby-view');
  const elGameView = document.getElementById('game-view');

  const inputNickname = document.getElementById('player-nickname');
  const inputJoinCode = document.getElementById('join-code-input');

  const btnHostMode = document.getElementById('btn-host-mode');
  const btnLocalMode = document.getElementById('btn-local-mode');
  const btnJoinMode = document.getElementById('btn-join-mode');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnShareInvite = document.getElementById('btn-share-invite');
  const btnRandomPick = document.getElementById('btn-random-pick');
  const btnLeaveLobby = document.getElementById('btn-leave-lobby');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnExitGame = document.getElementById('btn-exit-game');

  const displayRoomCode = document.getElementById('room-code-display');
  const labelSessionMode = document.getElementById('session-mode-label');
  const onlineShareBtns = document.getElementById('online-share-btns');
  const localAddForm = document.getElementById('local-add-player-form');
  const localPlayerInput = document.getElementById('local-player-name-input');
  const badgePlayerCount = document.getElementById('player-count-badge');
  const listPlayers = document.getElementById('players-list');
  const msgHostOnly = document.getElementById('host-only-msg');

  const formLobbyChat = document.getElementById('chat-form');
  const inputLobbyChat = document.getElementById('chat-input');
  const containerLobbyChat = document.getElementById('chat-messages');

  const formGameChat = document.getElementById('game-chat-form');
  const inputGameChat = document.getElementById('game-chat-input');
  const containerGameChat = document.getElementById('game-chat-messages');
  const listGameScores = document.getElementById('game-scores-list');

  const titleCurrentGame = document.getElementById('current-game-title');
  const btnSoundToggle = document.getElementById('sound-toggle');

  const gamesMap = {};

  function init() {
    setupEventListeners();
    setupNetworkHandlers();
    window.refreshIcons();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const randomAdjectives = ['Nova', 'Solar', 'Cyber', 'Cosmic', 'Astro', 'Orbit', 'Turbo', 'Neon'];
    const randomNouns = ['Rider', 'Pilot', 'Wolf', 'Star', 'Ghost', 'Legend', 'Fox', 'King'];
    const randomName =
      randomAdjectives[Math.floor(Math.random() * randomAdjectives.length)] +
      randomNouns[Math.floor(Math.random() * randomNouns.length)] +
      Math.floor(Math.random() * 90 + 10);
    inputNickname.value = localStorage.getItem('ag_nickname') || randomName;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      inputJoinCode.value = roomParam.trim().toUpperCase().slice(0, 5);
      showToast(`Invite code ${inputJoinCode.value} ready! Click Join to enter.`);
    }
  }

  function registerGame(type, instance) {
    gamesMap[type] = instance;
  }

  function setupEventListeners() {
    btnSoundToggle.addEventListener('click', () => {
      const isSoundOn = AntigravityAudio.toggle();
      btnSoundToggle.classList.toggle('disabled', !isSoundOn);
      btnSoundToggle.style.opacity = isSoundOn ? '1' : '0.4';
      btnSoundToggle.innerHTML = `<i data-lucide="${isSoundOn ? 'volume-2' : 'volume-x'}"></i>`;
      window.refreshIcons();
      if (isSoundOn) AntigravityAudio.playClick();
    });

    btnHostMode.addEventListener('click', () => {
      const nick = inputNickname.value.trim();
      if (!validateNickname(nick)) return;
      localStorage.setItem('ag_nickname', nick);
      AntigravityAudio.playClick();
      NetworkManager.hostRoom(nick);
    });

    btnLocalMode.addEventListener('click', () => {
      const nick = inputNickname.value.trim() || 'لاعب 1';
      localStorage.setItem('ag_nickname', nick);
      AntigravityAudio.playClick();
      NetworkManager.startLocalMode([nick, 'صاحبك 2']);
    });

    btnJoinMode.addEventListener('click', () => {
      const nick = inputNickname.value.trim();
      const code = inputJoinCode.value.trim().toUpperCase();
      if (!validateNickname(nick)) return;
      if (code.length !== 5) {
        showToast('Room Code must be 5 characters.');
        return;
      }
      localStorage.setItem('ag_nickname', nick);
      AntigravityAudio.playClick();
      NetworkManager.joinRoom(nick, code);
    });

    localAddForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = localPlayerInput.value.trim();
      if (name && NetworkManager.addLocalPlayer(name)) {
        localPlayerInput.value = '';
      }
    });

    btnRandomPick.addEventListener('click', () => {
      const players = NetworkManager.getPlayers();
      if (!players.length) return;
      const chosen = players[Math.floor(Math.random() * players.length)];
      AntigravityAudio.playScore();
      showToast(`قرعة الشلة اختارت: ${chosen.nickname}`);
      NetworkManager.sendChat(`SYSTEM: قرعة الشلة اختارت: ${chosen.nickname}`);
    });

    document.querySelectorAll('.react-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const reactMap = { flame: 'نار يا شلة!', laugh: 'ههههههه!', 'thumbs-up': 'عاش يا بطل!' };
        const key = btn.getAttribute('data-react');
        AntigravityAudio.playClick();
        NetworkManager.sendChat(reactMap[key] || 'Nice!');
      });
    });

    btnCopyCode.addEventListener('click', () => {
      const code = NetworkManager.getRoomCode();
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Room code ${code} copied!`);
        AntigravityAudio.playClick();
      });
    });

    btnCopyLink.addEventListener('click', () => {
      const inviteUrl = NetworkManager.getInviteUrl();
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast('Invite link copied! Share it with friends.');
        AntigravityAudio.playClick();
      });
    });

    btnShareInvite.addEventListener('click', async () => {
      const code = NetworkManager.getRoomCode();
      const inviteUrl = NetworkManager.getInviteUrl();
      AntigravityAudio.playClick();
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join my Sohib Games Room!',
            text: `Join my game session with code ${code}:`,
            url: inviteUrl
          });
          return;
        } catch (err) {}
      }
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast('Invite link copied to clipboard!');
      });
    });

    btnLeaveLobby.addEventListener('click', () => {
      AntigravityAudio.playClick();
      NetworkManager.leaveRoom();
      containerLobbyChat.innerHTML = '';
      switchView(elHomeView);
    });

    formLobbyChat.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputLobbyChat.value.trim();
      if (text) {
        NetworkManager.sendChat(text);
        inputLobbyChat.value = '';
      }
    });

    formGameChat.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputGameChat.value.trim();
      if (text) {
        if ((activeGameType === 'draw-guess' || activeGameType === 'taboo-dash') && activeGame && activeGame.submitGuess) {
          activeGame.submitGuess(text);
        } else {
          NetworkManager.sendChat(text);
        }
        inputGameChat.value = '';
      }
    });

    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.getAttribute('data-category');
        switchCategory(cat);
        AntigravityAudio.playClick();
      });
    });

    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!NetworkManager.isHost()) return;
        selectedGameType = card.getAttribute('data-game');
        AntigravityAudio.playClick();
        NetworkManager.selectGame(selectedGameType);
        updateGameSelectionUI();
      });
    });

    btnStartGame.addEventListener('click', () => {
      if (!NetworkManager.isHost()) return;
      AntigravityAudio.playClick();
      NetworkManager.startGame(selectedGameType);
    });

    btnExitGame.addEventListener('click', () => {
      AntigravityAudio.playClick();
      NetworkManager.exitGame();
    });
  }

  function switchCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-category') === cat);
    });
    document.querySelectorAll('.category-panel').forEach(p => {
      p.classList.toggle('active', p.id === `cat-${cat}`);
    });
  }

  function validateNickname(nick) {
    if (!nick || nick.trim() === '') {
      showToast('Please enter a nickname first!');
      return false;
    }
    return true;
  }

  function setupNetworkHandlers() {
    NetworkManager.registerHandler('onStatusChange', (statusText, isOnline) => {
      const elIndicator = document.getElementById('connection-status-indicator');
      const elText = document.getElementById('status-text');
      elText.innerText = statusText;
      elIndicator.classList.toggle('online', isOnline);
      elIndicator.classList.toggle('offline', !isOnline);
      elIndicator.classList.remove('hidden');
    });

    NetworkManager.registerHandler('onError', (msg) => {
      showToast(msg);
    });

    NetworkManager.registerHandler('onRoomCreated', (code, initialGame) => {
      const isLocal = NetworkManager.isLocalMode();
      displayRoomCode.innerText = isLocal ? '1 DEVICE' : code;
      labelSessionMode.innerText = isLocal ? 'Pass & Play Mode' : 'Session Code';
      onlineShareBtns.classList.toggle('hidden', isLocal);
      localAddForm.classList.toggle('hidden', !isLocal);

      if (initialGame) selectedGameType = initialGame;
      containerLobbyChat.innerHTML = '';
      switchView(elLobbyView);
      updateLobbyUI();
      showToast(isLocal
        ? 'تم فتح قعدة على جهاز واحد! أضف أسماء صحابك وابدأوا اللعب.'
        : `Room ${code} created! Share the code or link with friends.`);
    });

    NetworkManager.registerHandler('onJoined', (initialGame, runningGame) => {
      displayRoomCode.innerText = NetworkManager.getRoomCode();
      labelSessionMode.innerText = 'Session Code';
      onlineShareBtns.classList.remove('hidden');
      localAddForm.classList.add('hidden');
      if (initialGame) selectedGameType = initialGame;
      containerLobbyChat.innerHTML = '';
      switchView(elLobbyView);
      updateLobbyUI();
      if (runningGame) launchGameView(runningGame);
    });

    NetworkManager.registerHandler('onPlayerUpdate', (players) => {
      updatePlayersList(players);
      updateLobbyUI();
    });

    NetworkManager.registerHandler('onChatMessage', (sender, text, isSystem, color) => {
      addChatMessage(containerLobbyChat, sender, text, isSystem, color);
      addChatMessage(containerGameChat, sender, text, isSystem, color);
    });

    NetworkManager.registerHandler('onGameSelected', (gameType) => {
      selectedGameType = gameType;
      const card = document.querySelector(`.game-card[data-game="${gameType}"]`);
      if (card) switchCategory(card.getAttribute('data-category'));
      updateGameSelectionUI();
    });

    NetworkManager.registerHandler('onGameStart', (gameType) => {
      launchGameView(gameType);
    });

    NetworkManager.registerHandler('onGameData', (senderId, payload) => {
      if (activeGame && activeGame.handleData) activeGame.handleData(senderId, payload);
    });

    NetworkManager.registerHandler('onGameExit', () => {
      exitActiveGame();
    });
  }

  function switchView(targetView) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    targetView.classList.add('active');
    window.refreshIcons();
  }

  function updateLobbyUI() {
    const isHost = NetworkManager.isHost();
    if (isHost) {
      msgHostOnly.classList.add('hidden');
      btnStartGame.classList.remove('disabled');
      btnStartGame.removeAttribute('disabled');
    } else {
      msgHostOnly.classList.remove('hidden');
      btnStartGame.classList.add('disabled');
      btnStartGame.setAttribute('disabled', 'true');
    }
    updateGameSelectionUI();
  }

  function updateGameSelectionUI() {
    document.querySelectorAll('.game-card').forEach(card => {
      card.classList.toggle('selected', card.getAttribute('data-game') === selectedGameType);
    });
  }

  function updatePlayersList(players) {
    listPlayers.innerHTML = '';
    badgePlayerCount.innerText = `${players.length}/12`;
    const isLocal = NetworkManager.isLocalMode();

    players.forEach(p => {
      const li = document.createElement('li');
      if (p.isHost) li.classList.add('host');
      if (!isLocal && p.id === NetworkManager.getMyId()) li.classList.add('me');
      if (p.connected === false) li.classList.add('reconnecting');

      const removeBtn = (isLocal && players.length > 1)
        ? `<button type="button" class="remove-local-btn" data-id="${p.id}" title="Remove"><i data-lucide="x"></i></button>`
        : `<span class="role-badge ${p.isHost ? 'host' : 'guest'}">${p.isHost ? 'Host' : 'Player'}</span>`;

      li.innerHTML = `
        <div class="player-info">
          <span class="player-name" style="color: ${p.color}; font-weight: 600;">${escapeHTML(p.nickname)}</span>
        </div>
        ${removeBtn}
      `;
      listPlayers.appendChild(li);
    });

    if (isLocal) {
      listPlayers.querySelectorAll('.remove-local-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          NetworkManager.removeLocalPlayer(btn.getAttribute('data-id'));
        });
      });
      window.refreshIcons();
    }
  }

  function addChatMessage(container, sender, text, isSystem, color) {
    const p = document.createElement('p');
    p.className = 'chat-msg';
    if (isSystem) {
      p.classList.add('system');
      p.innerText = text;
    } else {
      const spanSender = document.createElement('span');
      spanSender.className = 'sender';
      spanSender.innerText = `${sender}:`;
      if (color) spanSender.style.color = color;
      p.appendChild(spanSender);
      p.appendChild(document.createTextNode(` ${text}`));
    }
    container.appendChild(p);
    container.scrollTop = container.scrollHeight;
  }

  function showToast(text, duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = text;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  function launchGameView(gameType) {
    activeGameType = gameType;
    activeGame = gamesMap[gameType];

    if (!activeGame) {
      showToast(`Game "${gameType}" is not loaded!`);
      return;
    }

    document.querySelectorAll('.game-subview').forEach(sub => sub.classList.remove('active'));
    const elSubview = document.getElementById(`game-${gameType}`);
    if (elSubview) elSubview.classList.add('active');

    const gameNames = {
      'truth-dare': 'صراحة وجرأة',
      'deep-talk': 'كرسي الاعتراف',
      'five-seconds': 'تحدي الـ 5 ثواني',
      'would-you-rather': 'لو خيروك؟',
      'judgment-court': 'محكمة الأحكام',
      'vibe-meter': 'مقياس المشاعر والتوافق',
      'whos-likely': 'مين فينا؟',
      'spy-game': 'الجاسوس في القعدة',
      'truth-bluff': 'حقيقة أم كذبة',
      'taboo-dash': 'الكلمة الممنوعة',
      'face-off': 'مواجهة وجهاً لوجه',
      'sacrifice-bid': 'رهان الشجاعة',
      'hot-potato': 'القنبلة الموقوتة',
      'rank-crew': 'ترتيب الشلة بصراحة',
      'astro-trail': 'Astro Trail',
      'draw-guess': 'Cyber Sketch',
      'neon-grid': 'Neon Grid',
      'cosmic-quiz': 'Cosmic Quiz',
      'memory-matrix': 'Memory Matrix',
      'reaction-duel': 'Reaction Duel'
    };
    titleCurrentGame.innerText = gameNames[gameType] || 'Game Arena';
    document.getElementById('game-timer').innerText = '--';
    document.getElementById('game-overlay').classList.add('hidden');
    containerGameChat.innerHTML = '';

    switchView(elGameView);

    activeGame.start(
      NetworkManager.isHost(),
      NetworkManager.getPlayers(),
      NetworkManager.getMyId()
    );

    if (typeof AntigravityAudio !== 'undefined') AntigravityAudio.playVictory();
  }

  function exitActiveGame() {
    if (activeGame) {
      activeGame.stop();
      activeGame = null;
      activeGameType = '';
    }
    switchView(elLobbyView);
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    registerGame,
    showToast,
    updateScores: function(scores) {
      listGameScores.innerHTML = '';
      const players = NetworkManager.getPlayers();
      const scoresArray = players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        color: p.color,
        score: scores[p.id] !== undefined ? scores[p.id] : 0
      })).sort((a, b) => b.score - a.score);

      scoresArray.forEach(s => {
        const li = document.createElement('li');
        if (!NetworkManager.isLocalMode() && s.id === NetworkManager.getMyId()) li.classList.add('player-active');
        li.innerHTML = `
          <span class="score-name" style="color: ${s.color}; font-weight: 600;">${escapeHTML(s.nickname)}</span>
          <span class="score-num">${s.score}</span>
        `;
        listGameScores.appendChild(li);
      });
    },
    updateTimer: function(timeSecs) {
      document.getElementById('game-timer').innerText = String(timeSecs).padStart(2, '0');
    }
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
