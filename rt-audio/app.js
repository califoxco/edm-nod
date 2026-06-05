(function() {
  'use strict';

  var state = {
    stream: null,
    currentCamera: 'environment', // 'user' (front) or 'environment' (back)
    availableCameras: []
  };

  var els = {};

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    els.status = document.getElementById('status');
    els.cameraInfo = document.getElementById('camera-info');
    els.startCamera = document.getElementById('start-camera');
    els.takePhoto = document.getElementById('take-photo');
    els.stopCamera = document.getElementById('stop-camera');
    els.preview = document.getElementById('camera-preview');
    els.photoCanvas = document.getElementById('photo-canvas');
    els.downloadPhoto = document.getElementById('download-photo');
    els.debug = document.getElementById('debug');

    els.startCamera.addEventListener('click', startCamera);
    els.takePhoto.addEventListener('click', takePhoto);
    els.stopCamera.addEventListener('click', stopCamera);
    els.downloadPhoto.addEventListener('click', downloadPhoto);

    updateDebug('Ready to test camera\nBrowser: ' + navigator.userAgent);
    enumerateCameras();
  }

  // ============================================================================
  // CAMERA ENUMERATION
  // ============================================================================

  function enumerateCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      updateDebug('ERROR: enumerateDevices not supported');
      return;
    }

    navigator.mediaDevices.enumerateDevices()
      .then(function(devices) {
        state.availableCameras = devices.filter(function(device) {
          return device.kind === 'videoinput';
        });

        updateDebug('Found ' + state.availableCameras.length + ' camera(s):\n' +
          state.availableCameras.map(function(cam, i) {
            return (i + 1) + '. ' + (cam.label || 'Camera ' + (i + 1)) + '\n   ID: ' + cam.deviceId;
          }).join('\n'));
      })
      .catch(function(err) {
        updateDebug('ERROR enumerating cameras: ' + err.message);
      });
  }

  // ============================================================================
  // CAMERA CONTROL
  // ============================================================================

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateStatus('Camera API not supported', '');
      updateDebug('ERROR: getUserMedia not available in this browser');
      return;
    }

    updateStatus('Requesting camera access...', '');
    updateDebug('Requesting camera permission...\nFacing: ' + state.currentCamera);

    var constraints = {
      video: {
        facingMode: state.currentCamera,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream) {
        state.stream = stream;

        // Get actual camera info
        var videoTrack = stream.getVideoTracks()[0];
        var settings = videoTrack.getSettings();

        updateStatus('Camera Active', '');
        els.cameraInfo.textContent = videoTrack.label;
        updateDebug('Camera started!\n' +
          'Label: ' + videoTrack.label + '\n' +
          'Resolution: ' + settings.width + 'x' + settings.height + '\n' +
          'Facing: ' + (settings.facingMode || 'unknown') + '\n' +
          'Frame rate: ' + (settings.frameRate || 'unknown') + ' fps\n' +
          'Device ID: ' + settings.deviceId);

        // Display preview
        els.preview.srcObject = stream;

        // Enable controls
        els.startCamera.disabled = true;
        els.takePhoto.disabled = false;
        els.stopCamera.disabled = false;
      })
      .catch(function(err) {
        updateStatus('Camera access denied', '');
        updateDebug('ERROR: ' + err.name + '\n' + err.message + '\n\n' +
          'Possible reasons:\n' +
          '- Permission denied by user\n' +
          '- Camera in use by another app\n' +
          '- Camera not available on this device\n' +
          '- Browser doesn\'t support camera access');
        console.error('Camera error:', err);
      });
  }

  function takePhoto() {
    if (!state.stream) return;

    var videoTrack = state.stream.getVideoTracks()[0];
    var settings = videoTrack.getSettings();

    // Set canvas size to match video
    els.photoCanvas.width = settings.width || 640;
    els.photoCanvas.height = settings.height || 480;

    // Draw current frame
    var ctx = els.photoCanvas.getContext('2d');
    ctx.drawImage(els.preview, 0, 0, els.photoCanvas.width, els.photoCanvas.height);

    // Show captured photo
    els.photoCanvas.classList.add('has-photo');
    els.downloadPhoto.style.display = 'block';

    updateDebug('Photo captured!\n' +
      'Size: ' + els.photoCanvas.width + 'x' + els.photoCanvas.height + '\n' +
      'Timestamp: ' + new Date().toLocaleString());
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(function(track) {
        track.stop();
      });
      state.stream = null;
    }

    els.preview.srcObject = null;

    updateStatus('Camera Stopped', '');
    updateDebug('Camera stopped');

    els.startCamera.disabled = false;
    els.takePhoto.disabled = true;
    els.stopCamera.disabled = true;
  }

  function downloadPhoto() {
    els.photoCanvas.toBlob(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'camera-test-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateDebug('Photo downloaded!');
    });
  }

  // ============================================================================
  // UI HELPERS
  // ============================================================================

  function updateStatus(status, info) {
    els.status.textContent = status;
  }

  function updateDebug(message) {
    var timestamp = new Date().toLocaleTimeString();
    els.debug.textContent = '[' + timestamp + ']\n' + message;
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
