// Web Audio API Retro Sound Synthesizer
const AntigravityAudio = (function() {
  let audioCtx = null;
  let enabled = true;

  function initCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, volume = 0.1) {
    if (!enabled) return;
    try {
      initCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  }

  return {
    toggle: function() {
      enabled = !enabled;
      initCtx();
      return enabled;
    },
    isEnabled: function() {
      return enabled;
    },
    playClick: function() {
      playTone(600, 'sine', 0.08, 0.12);
    },
    playJoin: function() {
      if (!enabled) return;
      try {
        initCtx();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.3);
      } catch (e) {}
    },
    playLeave: function() {
      if (!enabled) return;
      try {
        initCtx();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.35);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.35);
      } catch (e) {}
    },
    playScore: function() {
      if (!enabled) return;
      playTone(523.25, 'sine', 0.1, 0.1); // C5
      setTimeout(() => {
        playTone(659.25, 'sine', 0.15, 0.1); // E5
      }, 100);
    },
    playDrawTick: function() {
      // Tiny mechanical-like tick for canvas painting
      playTone(1500, 'square', 0.01, 0.02);
    },
    playExplosion: function() {
      if (!enabled) return;
      try {
        initCtx();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.6);

        // Low pass filter to make it sound rumblier
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.linearRampToValueAtTime(50, now + 0.6);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(now + 0.6);
      } catch (e) {}
    },
    playVictory: function() {
      if (!enabled) return;
      // Arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          playTone(freq, 'triangle', 0.25, 0.08);
        }, idx * 100);
      });
    },
    playTurn: function() {
      playTone(440, 'triangle', 0.15, 0.08);
    }
  };
})();
