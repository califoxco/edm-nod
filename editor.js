(function() {
  'use strict';

  // State
  var state = {
    levelId: '',
    levelName: '',
    bpm: 124,
    audioFile: null,
    audioFileName: '',
    audioBuffer: null,
    audioDuration: 0,
    beats: [],  // { time: number (perfect time), action: 'down' | 'up' }

    // Playback
    audioContext: null,
    audioSource: null,
    isPlaying: false,
    playbackStartTime: 0,
    pausedAt: 0,

    // Timeline
    pixelsPerSecond: 100,
    followPlayhead: true,

    // Canvas
    canvases: {},
    contexts: {},

    // Timing
    beatWindowMs: 500  // 500ms total window (250ms before, 250ms after perfect)
  };

  // Elements
  var els = {};

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    // Get elements
    els.levelId = document.getElementById('level-id');
    els.levelName = document.getElementById('level-name');
    els.levelBpm = document.getElementById('level-bpm');
    els.audioFile = document.getElementById('audio-file');
    els.audioInfo = document.getElementById('audio-info');
    els.playPause = document.getElementById('play-pause');
    els.stop = document.getElementById('stop');
    els.seekBar = document.getElementById('seek-bar');
    els.currentTime = document.getElementById('current-time');
    els.downCount = document.getElementById('down-count');
    els.upCount = document.getElementById('up-count');
    els.totalCount = document.getElementById('total-count');
    els.duration = document.getElementById('duration');
    els.zoomIn = document.getElementById('zoom-in');
    els.zoomOut = document.getElementById('zoom-out');
    els.zoomLevel = document.getElementById('zoom-level');
    els.followPlayhead = document.getElementById('follow-playhead');
    els.newLevel = document.getElementById('new-level');
    els.exportLevel = document.getElementById('export-level');
    els.downTrack = document.getElementById('down-track');
    els.upTrack = document.getElementById('up-track');
    els.playhead = document.getElementById('playhead');
    els.timelineContainer = document.querySelector('.timeline-container');
    els.timelineRuler = document.querySelector('.timeline-ruler');

    // Get canvases
    state.canvases.ruler = document.getElementById('ruler-canvas');
    state.canvases.waveform = document.getElementById('waveform-canvas');
    state.canvases.down = document.getElementById('down-canvas');
    state.canvases.up = document.getElementById('up-canvas');

    Object.keys(state.canvases).forEach(function(key) {
      state.contexts[key] = state.canvases[key].getContext('2d');
    });

    // Setup audio context
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Event listeners
    els.audioFile.addEventListener('change', handleAudioImport);
    els.playPause.addEventListener('click', togglePlayPause);
    els.stop.addEventListener('click', stopPlayback);
    els.seekBar.addEventListener('input', handleSeek);
    els.zoomIn.addEventListener('click', function() { zoom(1.2); });
    els.zoomOut.addEventListener('click', function() { zoom(0.8); });
    els.followPlayhead.addEventListener('change', function() { state.followPlayhead = this.checked; });
    els.newLevel.addEventListener('click', newLevel);
    els.exportLevel.addEventListener('click', exportLevel);
    els.downTrack.addEventListener('click', handleTrackClick);
    els.upTrack.addEventListener('click', handleTrackClick);
    els.timelineRuler.addEventListener('click', handleRulerClick);

    els.levelId.addEventListener('input', function() { state.levelId = this.value; });
    els.levelName.addEventListener('input', function() { state.levelName = this.value; });
    els.levelBpm.addEventListener('input', function() { state.bpm = parseInt(this.value) || 124; });

    // Resize canvases
    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();

    // Initial render
    render();
  }

  // ============================================================================
  // AUDIO HANDLING
  // ============================================================================

  function handleAudioImport(e) {
    var file = e.target.files[0];
    if (!file) return;

    state.audioFile = file;
    state.audioFileName = file.name;

    var reader = new FileReader();
    reader.onload = function(event) {
      state.audioContext.decodeAudioData(event.target.result, function(buffer) {
        state.audioBuffer = buffer;
        state.audioDuration = buffer.duration;

        els.audioInfo.textContent = file.name + ' (' + formatTime(state.audioDuration) + ')';
        els.duration.textContent = formatTime(state.audioDuration);
        els.seekBar.max = state.audioDuration;

        resizeCanvases();
        render();
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (!state.audioBuffer) return;

    state.audioSource = state.audioContext.createBufferSource();
    state.audioSource.buffer = state.audioBuffer;
    state.audioSource.connect(state.audioContext.destination);

    var offset = state.pausedAt || 0;
    state.audioSource.start(0, offset);
    state.playbackStartTime = state.audioContext.currentTime - offset;
    state.isPlaying = true;

    els.playPause.textContent = '⏸ Pause';

    state.audioSource.onended = function() {
      if (state.isPlaying) {
        stopPlayback();
      }
    };

    updatePlayhead();
  }

  function pausePlayback() {
    if (!state.audioSource) return;

    state.pausedAt = state.audioContext.currentTime - state.playbackStartTime;
    state.audioSource.stop();
    state.audioSource = null;
    state.isPlaying = false;

    els.playPause.textContent = '▶ Play';
  }

  function stopPlayback() {
    if (state.audioSource) {
      state.audioSource.stop();
      state.audioSource = null;
    }

    state.isPlaying = false;
    state.pausedAt = 0;
    state.playbackStartTime = 0;

    els.playPause.textContent = '▶ Play';
    els.currentTime.textContent = formatTime(0);
    els.seekBar.value = 0;
    updatePlayheadPosition(0);
  }

  function handleSeek(e) {
    var time = parseFloat(e.target.value);
    seekToTime(time);
  }

  function seekToTime(time) {
    var wasPlaying = state.isPlaying;

    if (wasPlaying) {
      pausePlayback();
    }

    state.pausedAt = time;

    if (wasPlaying) {
      startPlayback();
    } else {
      updatePlayheadPosition(time);
      els.currentTime.textContent = formatTime(time);
      els.seekBar.value = time;
    }
  }

  function updatePlayhead() {
    if (!state.isPlaying) return;

    var currentTime = state.audioContext.currentTime - state.playbackStartTime;

    if (currentTime >= state.audioDuration) {
      stopPlayback();
      return;
    }

    els.currentTime.textContent = formatTime(currentTime);
    els.seekBar.value = currentTime;
    updatePlayheadPosition(currentTime);

    // Auto-scroll if follow mode enabled
    if (state.followPlayhead) {
      var playheadX = timeToPixels(currentTime) + 80;
      var containerWidth = els.timelineContainer.clientWidth;
      var scrollLeft = els.timelineContainer.scrollLeft;

      // Keep playhead in center third of screen
      if (playheadX < scrollLeft + containerWidth * 0.33 || playheadX > scrollLeft + containerWidth * 0.66) {
        els.timelineContainer.scrollLeft = playheadX - containerWidth / 2;
      }
    }

    requestAnimationFrame(updatePlayhead);
  }

  function updatePlayheadPosition(time) {
    var x = timeToPixels(time);
    els.playhead.style.left = (80 + x) + 'px';
  }

  // ============================================================================
  // TIMELINE INTERACTION
  // ============================================================================

  function handleRulerClick(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var time = pixelsToTime(x);

    seekToTime(time);
  }

  function handleTrackClick(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var time = pixelsToTime(x);  // This is the perfect time

    var action = e.currentTarget.dataset.action;

    // Check if clicking on existing beat (remove it)
    var existingIndex = state.beats.findIndex(function(beat) {
      return beat.action === action && Math.abs(beat.time - time) < 0.25;
    });

    if (existingIndex !== -1) {
      state.beats.splice(existingIndex, 1);
    } else {
      state.beats.push({ time: time, action: action });
      state.beats.sort(function(a, b) { return a.time - b.time; });
    }

    updateStats();
    render();
  }

  function zoom(factor) {
    state.pixelsPerSecond *= factor;
    state.pixelsPerSecond = Math.max(50, Math.min(500, state.pixelsPerSecond));

    els.zoomLevel.textContent = Math.round((state.pixelsPerSecond / 100) * 100) + '%';

    resizeCanvases();
    render();
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  function resizeCanvases() {
    var duration = state.audioDuration || 60;
    var width = timeToPixels(duration);

    Object.keys(state.canvases).forEach(function(key) {
      var canvas = state.canvases[key];
      var container = canvas.parentElement;

      canvas.width = Math.max(width, container.clientWidth);
      canvas.height = container.clientHeight;
    });
  }

  function render() {
    drawRuler();
    drawWaveform();
    drawBeats('down');
    drawBeats('up');
  }

  function drawRuler() {
    var ctx = state.contexts.ruler;
    var canvas = state.canvases.ruler;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var duration = state.audioDuration || 60;

    ctx.strokeStyle = '#404040';
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';

    // Draw timestamp every second
    for (var t = 0; t <= duration; t += 1) {
      var x = timeToPixels(t);

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 8);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      // Label
      ctx.fillText(formatTime(t), x, 14);

      // Minor ticks (every 0.25s)
      if (t < duration) {
        for (var i = 0.25; i < 1; i += 0.25) {
          var minorX = timeToPixels(t + i);
          ctx.beginPath();
          ctx.moveTo(minorX, canvas.height - 4);
          ctx.lineTo(minorX, canvas.height);
          ctx.stroke();
        }
      }
    }
  }

  function drawWaveform() {
    var ctx = state.contexts.waveform;
    var canvas = state.canvases.waveform;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!state.audioBuffer) {
      ctx.fillStyle = '#404040';
      ctx.font = '13px sans-serif';
      ctx.fillText('No audio loaded', 10, canvas.height / 2);
      return;
    }

    var data = state.audioBuffer.getChannelData(0);
    var step = Math.ceil(data.length / canvas.width);
    var amp = canvas.height / 2;

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (var i = 0; i < canvas.width; i++) {
      var min = 1.0;
      var max = -1.0;

      for (var j = 0; j < step; j++) {
        var datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.stroke();
  }

  function drawBeats(action) {
    var ctx = state.contexts[action];
    var canvas = state.canvases[action];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw beats as rectangles
    var color = action === 'down' ? '#ff4466' : '#00ff88';
    var windowSeconds = state.beatWindowMs / 1000;  // 0.5 seconds
    var halfWindow = windowSeconds / 2;  // 0.25 seconds

    state.beats.filter(function(beat) {
      return beat.action === action;
    }).forEach(function(beat) {
      var perfectTime = beat.time;
      var startTime = perfectTime - halfWindow;
      var endTime = perfectTime + halfWindow;

      var startX = timeToPixels(startTime);
      var endX = timeToPixels(endTime);
      var width = endX - startX;

      // Draw rectangle for the entire window
      ctx.fillStyle = color + '40';  // Semi-transparent
      ctx.fillRect(startX, 10, width, canvas.height - 20);

      // Draw perfect time marker in center
      var perfectX = timeToPixels(perfectTime);
      ctx.fillStyle = color;
      ctx.fillRect(perfectX - 2, 5, 4, canvas.height - 10);

      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 10, width, canvas.height - 20);

      // Draw time label
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.fillText(formatTime(perfectTime), perfectX + 6, 25);
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function timeToPixels(time) {
    return time * state.pixelsPerSecond;
  }

  function pixelsToTime(pixels) {
    return pixels / state.pixelsPerSecond;
  }

  function formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs.toFixed(2);
  }

  function updateStats() {
    var downCount = state.beats.filter(function(b) { return b.action === 'down'; }).length;
    var upCount = state.beats.filter(function(b) { return b.action === 'up'; }).length;

    els.downCount.textContent = downCount;
    els.upCount.textContent = upCount;
    els.totalCount.textContent = state.beats.length;
  }

  // ============================================================================
  // LEVEL MANAGEMENT
  // ============================================================================

  function newLevel() {
    if (state.beats.length > 0 && !confirm('Clear current level?')) {
      return;
    }

    state.levelId = '';
    state.levelName = '';
    state.bpm = 124;
    state.beats = [];
    state.audioFile = null;
    state.audioFileName = '';
    state.audioBuffer = null;
    state.audioDuration = 0;

    els.levelId.value = '';
    els.levelName.value = '';
    els.levelBpm.value = 124;
    els.audioFile.value = '';
    els.audioInfo.textContent = '';

    stopPlayback();
    updateStats();
    resizeCanvases();
    render();
  }

  function exportLevel() {
    if (!state.levelId || !state.levelName) {
      alert('Please fill in Level ID and Level Name');
      return;
    }

    if (!state.audioFile) {
      alert('Please import an audio file');
      return;
    }

    if (state.beats.length === 0) {
      alert('Please add some beats to the timeline');
      return;
    }

    var audioExt = state.audioFileName.split('.').pop();

    // Create level JSON with timing window info
    var levelData = {
      id: state.levelId,
      name: state.levelName,
      bpm: state.bpm,
      duration: state.audioDuration,
      audioFile: 'audio.' + audioExt,
      beatWindowMs: state.beatWindowMs,  // Include timing window in export
      beatPattern: state.beats.map(function(beat) {
        return {
          time: parseFloat(beat.time.toFixed(3)),
          action: beat.action
        };
      })
    };

    var levelJson = JSON.stringify(levelData, null, 2);

    downloadFile('level.json', levelJson, 'application/json');

    setTimeout(function() {
      alert('Download complete!\n\nNext steps:\n1. Rename your audio file to: audio.' + audioExt + '\n2. Create a folder: assets/' + state.levelId + '/\n3. Put level.json and the audio file in that folder\n4. Drop the folder into your game repo');
    }, 100);
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // START
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
