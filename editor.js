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
    beats: [],  // { time: number, action: 'down' | 'up' }

    // Playback
    audioContext: null,
    audioSource: null,
    isPlaying: false,
    playbackStartTime: 0,
    pausedAt: 0,

    // Timeline
    pixelsPerSecond: 100,  // Zoom level
    snapToGrid: true,
    gridDivision: 0.5,  // seconds

    // Canvas
    canvases: {},
    contexts: {}
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
    els.snapToGrid = document.getElementById('snap-to-grid');
    els.gridDivision = document.getElementById('grid-division');
    els.newLevel = document.getElementById('new-level');
    els.exportLevel = document.getElementById('export-level');
    els.downTrack = document.getElementById('down-track');
    els.upTrack = document.getElementById('up-track');
    els.playhead = document.getElementById('playhead');

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
    els.snapToGrid.addEventListener('change', function() { state.snapToGrid = this.checked; });
    els.gridDivision.addEventListener('change', function() { state.gridDivision = parseFloat(this.value); render(); });
    els.newLevel.addEventListener('click', newLevel);
    els.exportLevel.addEventListener('click', exportLevel);
    els.downTrack.addEventListener('click', handleTrackClick);
    els.upTrack.addEventListener('click', handleTrackClick);

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

        els.audioInfo.textContent = file.name + ' (' + state.audioDuration.toFixed(2) + 's)';
        els.duration.textContent = state.audioDuration.toFixed(2) + 's';
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
    els.currentTime.textContent = '0.00s';
    els.seekBar.value = 0;
    els.playhead.style.left = '0px';
  }

  function handleSeek(e) {
    var time = parseFloat(e.target.value);

    if (state.isPlaying) {
      pausePlayback();
      state.pausedAt = time;
      startPlayback();
    } else {
      state.pausedAt = time;
    }

    updatePlayhead();
  }

  function updatePlayhead() {
    if (!state.isPlaying) return;

    var currentTime = state.audioContext.currentTime - state.playbackStartTime;

    if (currentTime >= state.audioDuration) {
      stopPlayback();
      return;
    }

    els.currentTime.textContent = currentTime.toFixed(2) + 's';
    els.seekBar.value = currentTime;

    var x = timeToPixels(currentTime);
    els.playhead.style.left = (80 + x) + 'px';  // Offset by track header width

    requestAnimationFrame(updatePlayhead);
  }

  // ============================================================================
  // TIMELINE INTERACTION
  // ============================================================================

  function handleTrackClick(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var time = pixelsToTime(x);

    if (state.snapToGrid) {
      time = Math.round(time / state.gridDivision) * state.gridDivision;
    }

    var action = e.currentTarget.dataset.action;

    // Check if clicking on existing beat (remove it)
    var existingIndex = state.beats.findIndex(function(beat) {
      return beat.action === action && Math.abs(beat.time - time) < 0.1;
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
    var interval = state.gridDivision;

    ctx.strokeStyle = '#404040';
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '11px sans-serif';

    for (var t = 0; t <= duration; t += interval) {
      var x = timeToPixels(t);

      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 10);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      // Draw label every second
      if (t % 1 === 0) {
        ctx.fillText(t.toFixed(1) + 's', x + 4, 18);
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

    // Draw grid
    var duration = state.audioDuration || 60;
    var interval = state.gridDivision;

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;

    for (var t = 0; t <= duration; t += interval) {
      var x = timeToPixels(t);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw beats
    var color = action === 'down' ? '#ff4466' : '#00ff88';
    ctx.fillStyle = color;

    state.beats.filter(function(beat) {
      return beat.action === action;
    }).forEach(function(beat) {
      var x = timeToPixels(beat.time);
      var width = 8;
      var height = canvas.height - 20;
      var y = 10;

      ctx.fillRect(x - width / 2, y, width, height);

      // Draw diamond marker
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
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

    // Create level JSON
    var levelData = {
      id: state.levelId,
      name: state.levelName,
      bpm: state.bpm,
      duration: state.audioDuration,
      audioFile: 'audio.' + state.audioFileName.split('.').pop(),
      beatPattern: state.beats.map(function(beat) {
        return {
          time: parseFloat(beat.time.toFixed(3)),
          action: beat.action
        };
      })
    };

    var levelJson = JSON.stringify(levelData, null, 2);

    // Create zip file using JSZip (we'll need to include this library)
    // For now, let's download separately
    downloadFile('level.json', levelJson, 'application/json');

    // Also provide instructions for the audio file
    setTimeout(function() {
      alert('Download complete!\n\nNext steps:\n1. Rename your audio file to: audio.' + state.audioFileName.split('.').pop() + '\n2. Create a folder: assets/' + state.levelId + '/\n3. Put level.json and the audio file in that folder\n4. Drop the folder into your game repo');
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
