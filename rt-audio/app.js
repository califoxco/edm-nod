(function() {
  'use strict';

  var state = {
    audioContext: null,
    analyser: null,
    microphone: null,
    animationId: null,
    isRunning: false
  };

  var els = {};

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    els.status = document.getElementById('status');
    els.method = document.getElementById('method');
    els.startMic = document.getElementById('start-mic');
    els.stop = document.getElementById('stop');
    els.visualizer = document.getElementById('visualizer');
    els.volumeMeter = document.getElementById('volume-bar');
    els.volumeText = document.getElementById('volume-text');
    els.debug = document.getElementById('debug');

    els.startMic.addEventListener('click', startMicrophone);
    els.stop.addEventListener('click', stopCapture);

    updateDebug('Ready to test audio capture');
  }

  // ============================================================================
  // MICROPHONE CAPTURE
  // ============================================================================

  function startMicrophone() {
    updateStatus('Requesting microphone access...', 'getUserMedia API');
    updateDebug('Requesting microphone permission...');

    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
    .then(function(stream) {
      updateDebug('Microphone access granted!\nStream: ' + stream.id);

      // Create audio context
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 2048;

      // Connect microphone
      state.microphone = state.audioContext.createMediaStreamSource(stream);
      state.microphone.connect(state.analyser);

      updateStatus('Capturing audio from microphone', 'getUserMedia API');
      updateDebug('Audio context created\nSample rate: ' + state.audioContext.sampleRate + 'Hz\nFFT size: ' + state.analyser.fftSize);

      state.isRunning = true;
      els.startMic.disabled = true;
      els.stop.disabled = false;

      visualize();
    })
    .catch(function(err) {
      updateStatus('Microphone access denied', 'Error');
      updateDebug('ERROR: ' + err.name + '\n' + err.message + '\n\nMake sure to allow microphone access when prompted.');
      console.error('Microphone error:', err);
    });
  }

  // ============================================================================
  // VISUALIZATION
  // ============================================================================

  function visualize() {
    if (!state.isRunning) return;

    var canvas = els.visualizer;
    var ctx = canvas.getContext('2d');
    var bufferLength = state.analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!state.isRunning) return;

      state.animationId = requestAnimationFrame(draw);

      // Get frequency data
      state.analyser.getByteFrequencyData(dataArray);

      // Calculate volume (average amplitude)
      var sum = 0;
      for (var i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      var average = sum / bufferLength;
      var volume = Math.round((average / 255) * 100);

      // Update volume meter
      els.volumeMeter.style.width = volume + '%';
      els.volumeText.textContent = 'Volume: ' + volume + '%';

      // Draw waveform
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00d4ff';
      ctx.beginPath();

      var sliceWidth = canvas.width / bufferLength;
      var x = 0;

      for (var i = 0; i < bufferLength; i++) {
        var v = dataArray[i] / 255.0;
        var y = v * canvas.height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw frequency bars
      ctx.fillStyle = '#00ff88';
      var barWidth = (canvas.width / bufferLength) * 2.5;
      var barHeight;
      x = 0;

      for (var i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        ctx.fillStyle = 'rgb(' +
          Math.round((dataArray[i] / 255) * 100 + 155) + ',' +
          Math.round(200 - (dataArray[i] / 255) * 100) + ',' +
          Math.round((dataArray[i] / 255) * 200) + ')';

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    }

    draw();
  }

  // ============================================================================
  // CONTROLS
  // ============================================================================

  function stopCapture() {
    state.isRunning = false;

    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    if (state.microphone) {
      state.microphone.disconnect();
      state.microphone = null;
    }

    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }

    updateStatus('Stopped', '');
    updateDebug('Audio capture stopped');

    els.startMic.disabled = false;
    els.stop.disabled = true;

    // Clear visualizer
    var canvas = els.visualizer;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    els.volumeMeter.style.width = '0%';
    els.volumeText.textContent = 'Volume: 0%';
  }

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  function updateStatus(status, method) {
    els.status.textContent = status;
    els.method.textContent = method;
  }

  function updateDebug(message) {
    var timestamp = new Date().toLocaleTimeString();
    els.debug.textContent = '[' + timestamp + '] ' + message;
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
