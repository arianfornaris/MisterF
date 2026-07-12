// Presents the per-turn WAV clips of a scene media item as a single continuous
// audio: the clips are fetched and concatenated client-side into one WAV blob,
// played through one <audio> element with one timeline, with markers at each
// turn boundary and an optional transcript that can be toggled and jumped to.

function readJsonScript(element, fallback) {
  try {
    return JSON.parse(element?.textContent || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Parse a WAV file into its format descriptor, PCM data bytes, and duration.
function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 12 || view.getUint32(0, false) !== 0x52494646) {
    throw new Error('Not a RIFF file');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (chunkId === 0x666d7420 /* 'fmt ' */) {
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (chunkId === 0x64617461 /* 'data' */) {
      data = new Uint8Array(arrayBuffer, body, Math.min(chunkSize, view.byteLength - body));
    }
    // Chunks are word-aligned.
    offset = body + chunkSize + (chunkSize % 2);
  }
  if (!fmt || !data) {
    throw new Error('Invalid WAV file');
  }
  const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
  const duration = bytesPerSecond > 0 ? data.length / bytesPerSecond : 0;
  return { fmt, data, duration };
}

// Build a single WAV file from a shared format and a list of PCM data chunks.
function buildWav(fmt, dataChunks) {
  const totalDataLength = dataChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytesPerSample = fmt.bitsPerSample / 8;
  const blockAlign = fmt.channels * bytesPerSample;
  const byteRate = fmt.sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + totalDataLength);
  const view = new DataView(buffer);
  const writeString = (position, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(position + index, value.charCodeAt(index));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalDataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, fmt.audioFormat || 1, true);
  view.setUint16(22, fmt.channels, true);
  view.setUint32(24, fmt.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, fmt.bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, totalDataLength, true);
  const out = new Uint8Array(buffer);
  let position = 44;
  for (const chunk of dataChunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return buffer;
}

// Fetch every clip, concatenate them into one WAV blob, and compute the
// cumulative turn boundaries used for markers and transcript sync.
async function buildCombinedAudio(segments) {
  const buffers = await Promise.all(
    segments.map(async (segment) => {
      const response = await fetch(segment.src);
      if (!response.ok) {
        throw new Error(`Failed to load audio clip: ${segment.src}`);
      }
      return response.arrayBuffer();
    }),
  );
  const parsed = buffers.map(parseWav);
  const url = URL.createObjectURL(
    new Blob([buildWav(parsed[0].fmt, parsed.map((clip) => clip.data))], {
      type: 'audio/wav',
    }),
  );
  let elapsed = 0;
  const marks = parsed.map((clip, index) => {
    const start = elapsed;
    elapsed += clip.duration;
    return {
      index,
      start,
      end: elapsed,
      speaker: segments[index].speaker || '',
      text: segments[index].text || '',
    };
  });
  return { url, duration: elapsed, marks };
}

export function createSceneAudioPlayer(root) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }
  const audio = root.querySelector('[data-scene-media-audio-element]');
  const toggle = root.querySelector('[data-scene-media-audio-toggle]');
  const icon = root.querySelector('[data-scene-media-audio-icon]');
  const spinner = root.querySelector('[data-scene-media-audio-spinner]');
  const track = root.querySelector('[data-scene-media-audio-track]');
  const progress = root.querySelector('[data-scene-media-audio-progress]');
  const markers = root.querySelector('[data-scene-media-audio-markers]');
  const speaker = root.querySelector('[data-scene-media-audio-speaker]');
  const time = root.querySelector('[data-scene-media-audio-time]');
  const transcriptWrap = root.querySelector('[data-scene-media-audio-transcript-wrap]');
  const transcriptToggle = root.querySelector('[data-scene-media-audio-transcript-toggle]');
  const transcript = root.querySelector('[data-scene-media-audio-transcript]');
  if (!(audio instanceof HTMLAudioElement)) {
    return null;
  }

  const labels = {
    play: root.dataset.playLabel || 'Play',
    pause: root.dataset.pauseLabel || 'Pause',
    loading: root.dataset.loadingLabel || 'Loading…',
    error: root.dataset.errorLabel || 'Audio unavailable',
    showScript: root.dataset.showScriptLabel || 'Show script',
    hideScript: root.dataset.hideScriptLabel || 'Hide script',
  };

  let segments = [];
  let built = null;
  let buildPromise = null;
  let activeIndex = -1;

  const revoke = () => {
    if (built?.url) {
      URL.revokeObjectURL(built.url);
    }
    built = null;
    buildPromise = null;
  };

  const setToggleState = (state) => {
    if (!(toggle instanceof HTMLButtonElement)) return;
    const busy = state === 'loading';
    toggle.disabled = busy || segments.length === 0;
    spinner?.classList.toggle('d-none', !busy);
    icon?.classList.toggle('d-none', busy);
    if (icon) {
      icon.className = state === 'playing' ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }
    const label = state === 'playing' ? labels.pause : labels.play;
    toggle.setAttribute('aria-label', busy ? labels.loading : label);
    toggle.setAttribute('title', busy ? labels.loading : label);
  };

  const renderMarkers = () => {
    if (!(markers instanceof HTMLElement)) return;
    markers.replaceChildren();
    if (!built || built.duration <= 0) return;
    // Skip the first boundary at 0; mark where each following turn begins.
    for (const mark of built.marks.slice(1)) {
      const tick = document.createElement('span');
      tick.className = 'scene-media-audio-marker';
      tick.style.left = `${(mark.start / built.duration) * 100}%`;
      markers.append(tick);
    }
  };

  const renderTranscript = () => {
    if (!(transcript instanceof HTMLElement) || !(transcriptWrap instanceof HTMLElement)) {
      return;
    }
    transcript.replaceChildren();
    const hasText = segments.some((segment) => segment.text);
    transcriptWrap.classList.toggle('d-none', !hasText);
    if (!hasText) return;
    segments.forEach((segment, index) => {
      const item = document.createElement('li');
      item.className = 'scene-media-audio-turn';
      item.dataset.index = String(index);
      const name = document.createElement('span');
      name.className = 'fw-semibold me-1';
      name.textContent = segment.speaker ? `${segment.speaker}:` : '';
      const text = document.createElement('span');
      text.textContent = segment.text || '';
      item.append(name, text);
      item.addEventListener('click', () => {
        void seekToIndex(index, true);
      });
      transcript.append(item);
    });
  };

  const updateActive = (currentTime) => {
    const index = built
      ? built.marks.findIndex((mark) => currentTime >= mark.start && currentTime < mark.end)
      : -1;
    const resolved = index === -1 && built && currentTime >= built.duration
      ? built.marks.length - 1
      : index;
    if (resolved !== activeIndex) {
      activeIndex = resolved;
      if (speaker) {
        speaker.textContent = resolved >= 0 ? built.marks[resolved].speaker : '';
      }
      if (transcript instanceof HTMLElement) {
        for (const item of transcript.children) {
          const isActive = Number(item.dataset.index) === resolved;
          item.classList.toggle('is-active', isActive);
        }
      }
    }
  };

  const renderProgress = () => {
    const duration = built?.duration || 0;
    const current = audio.currentTime || 0;
    if (progress instanceof HTMLElement) {
      progress.style.width = duration > 0 ? `${Math.min(100, (current / duration) * 100)}%` : '0%';
    }
    if (time) {
      time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    }
    if (track instanceof HTMLElement) {
      track.setAttribute('aria-valuenow', String(Math.floor(current)));
      track.setAttribute('aria-valuemax', String(Math.floor(duration)));
    }
    updateActive(current);
  };

  const ensureBuilt = () => {
    if (built) return Promise.resolve(built);
    if (buildPromise) return buildPromise;
    if (segments.length === 0) return Promise.resolve(null);
    setToggleState('loading');
    buildPromise = buildCombinedAudio(segments)
      .then((result) => {
        built = result;
        audio.src = result.url;
        audio.load();
        renderMarkers();
        renderProgress();
        setToggleState(audio.paused ? 'paused' : 'playing');
        return result;
      })
      .catch((error) => {
        buildPromise = null;
        if (speaker) speaker.textContent = labels.error;
        if (toggle instanceof HTMLButtonElement) toggle.disabled = true;
        throw error;
      });
    return buildPromise;
  };

  const seekToIndex = async (index, play) => {
    const target = await ensureBuilt().catch(() => null);
    if (!target || index < 0 || index >= target.marks.length) return;
    audio.currentTime = target.marks[index].start;
    if (play) void audio.play().catch(() => {});
  };

  const seekToFraction = async (fraction) => {
    const target = await ensureBuilt().catch(() => null);
    if (!target) return;
    audio.currentTime = Math.min(1, Math.max(0, fraction)) * target.duration;
  };

  toggle?.addEventListener('click', async () => {
    await ensureBuilt().catch(() => null);
    if (!built) return;
    if (audio.paused) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  track?.addEventListener('click', (event) => {
    if (!(track instanceof HTMLElement)) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    void seekToFraction((event.clientX - rect.left) / rect.width);
  });

  track?.addEventListener('keydown', (event) => {
    if (!built) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 5 : -5;
      audio.currentTime = Math.min(built.duration, Math.max(0, audio.currentTime + step));
    }
  });

  transcriptToggle?.addEventListener('click', () => {
    if (!(transcript instanceof HTMLElement)) return;
    const hidden = transcript.classList.toggle('d-none');
    transcriptToggle.setAttribute('aria-expanded', String(!hidden));
    transcriptToggle.textContent = hidden ? labels.showScript : labels.hideScript;
  });

  audio.addEventListener('play', () => setToggleState('playing'));
  audio.addEventListener('pause', () => setToggleState('paused'));
  audio.addEventListener('timeupdate', renderProgress);
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    setToggleState('paused');
    renderProgress();
  });

  const setData = (nextSegments) => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    revoke();
    activeIndex = -1;
    segments = Array.isArray(nextSegments)
      ? nextSegments.filter((segment) => segment && segment.src)
      : [];
    if (speaker) speaker.textContent = '';
    if (time) time.textContent = '0:00 / 0:00';
    if (progress instanceof HTMLElement) progress.style.width = '0%';
    if (markers instanceof HTMLElement) markers.replaceChildren();
    renderTranscript();
    setToggleState('paused');
    if (segments.length > 0) {
      // Build eagerly so markers and durations are ready before the first play.
      void ensureBuilt().catch(() => {});
    }
  };

  const initial = readJsonScript(root.querySelector('[data-scene-media-audio-segments]'), []);
  if (Array.isArray(initial) && initial.length > 0) {
    setData(initial);
  } else {
    setToggleState('paused');
  }

  return {
    play() {
      void ensureBuilt()
        .then(() => audio.play().catch(() => {}))
        .catch(() => {});
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
    },
    setData,
  };
}
