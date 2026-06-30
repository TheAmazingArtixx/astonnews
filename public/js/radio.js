// Lecteur radio persistant : injecte la barre en bas de page,
// gère lecture/pause du flux en direct + volume.
// La source vient de /api/settings (radio_stream_url, radio_show_name, radio_enabled).

(function () {
  async function initRadio() {
    const mount = document.getElementById('radio-bar-mount');
    if (!mount) return;

    let settings = { radio_show_name: 'Radio', radio_stream_url: '', radio_enabled: '1' };
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.ok) settings = { ...settings, ...data.settings };
    } catch (e) {
      console.error('Impossible de charger les réglages radio', e);
    }

    const enabled = settings.radio_enabled === '1' || settings.radio_enabled === 'true';

    mount.innerHTML = `
      <div class="radio-bar">
        <div class="show-info">
          <span class="on-air-dot" id="onAirDot"></span>
          <span class="label" id="showLabel">${escapeHtml(settings.radio_show_name || 'Radio')}</span>
        </div>
        <div class="radio-controls">
          <span class="radio-status" id="radioStatus">${enabled ? 'En direct' : 'Hors antenne'}</span>
          <div class="volume-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <input type="range" id="volumeSlider" min="0" max="100" value="80" aria-label="Volume" />
          </div>
          <button class="play-btn" id="playBtn" ${enabled ? '' : 'disabled'} aria-label="Lecture / Pause">
            <svg id="playIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>
    `;

    if (!enabled || !settings.radio_stream_url) return;

    const audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.8;

    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const dot = document.getElementById('onAirDot');
    const status = document.getElementById('radioStatus');
    const volumeSlider = document.getElementById('volumeSlider');

    const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
    const ICON_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

    let playing = false;

    function setPlaying(state) {
      playing = state;
      playIcon.innerHTML = state ? ICON_PAUSE : ICON_PLAY;
      dot.classList.toggle('live', state);
      status.textContent = state ? 'En direct' : 'En pause';
    }

    playBtn.addEventListener('click', async () => {
      if (!playing) {
        try {
          status.textContent = 'Connexion...';
          audio.src = settings.radio_stream_url + (settings.radio_stream_url.includes('?') ? '&' : '?') + 't=' + Date.now();
          await audio.play();
          setPlaying(true);
        } catch (e) {
          status.textContent = 'Source indisponible';
          setPlaying(false);
        }
      } else {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        setPlaying(false);
      }
    });

    audio.addEventListener('error', () => {
      status.textContent = 'Source indisponible';
      setPlaying(false);
    });

    volumeSlider.addEventListener('input', (e) => {
      audio.volume = Number(e.target.value) / 100;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', initRadio);
})();
