(() => {
  const audio = document.querySelector('#site-song');
  const hint = document.querySelector('#site-song-hint');
  if (!audio || !hint) return;

  let attempting = false;
  let started = false;
  let lastPassiveAttempt = 0;

  function stopAutoStart() {
    started = true;
    window.removeEventListener('scroll', tryPassive);
    window.removeEventListener('mousemove', tryPassive);
    window.removeEventListener('pointerdown', tryActive);
    window.removeEventListener('keydown', tryActive);
    window.removeEventListener('touchstart', tryActive);
  }

  function tryPlay() {
    if (started || attempting || !audio.paused) return;
    attempting = true;
    audio.play().then(() => {
      hint.textContent = 'Playing.';
      stopAutoStart();
    }).catch(() => {
      hint.textContent = 'Press play to listen.';
    }).finally(() => {
      attempting = false;
    });
  }

  function tryPassive() {
    const now = Date.now();
    if (now - lastPassiveAttempt < 1200) return;
    lastPassiveAttempt = now;
    tryPlay();
  }

  function tryActive(event) {
    if (event.target.closest?.('.song-player, .door-testimony, audio')) return;
    tryPlay();
  }

  const recordings = document.querySelectorAll('audio:not(#site-song)');
  recordings.forEach(recording => {
    recording.addEventListener('play', () => {
      audio.pause();
      recordings.forEach(other => {
        if (other !== recording) other.pause();
      });
      stopAutoStart();
      hint.textContent = 'Music paused for the recording.';
    });
  });
  const doorTestimonyButton = document.querySelector('#door-testimony-button');
  const doorTestimonyAudio = document.querySelector('#door-testimony-audio');
  if (doorTestimonyButton && doorTestimonyAudio) {
    doorTestimonyButton.addEventListener('click', () => {
      doorTestimonyAudio.play().catch(() => doorTestimonyAudio.focus());
    });
  }
  audio.addEventListener('play', () => {
    recordings.forEach(recording => recording.pause());
  });
  audio.addEventListener('playing', () => {
    hint.textContent = 'Playing.';
    stopAutoStart();
  });
  audio.addEventListener('error', () => {
    hint.textContent = 'The song could not be played.';
    stopAutoStart();
  });

  window.addEventListener('scroll', tryPassive, { passive: true });
  window.addEventListener('mousemove', tryPassive, { passive: true });
  window.addEventListener('pointerdown', tryActive);
  window.addEventListener('keydown', tryActive);
  window.addEventListener('touchstart', tryActive, { passive: true });
})();
