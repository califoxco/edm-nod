(function() {
  'use strict';

  var CONFIG = {
    tiltThresholdUp: 15,      // Degrees of beta change to detect tilt up
    tiltThresholdDown: 19.5,  // Degrees for tilt down (30% higher than up)
    cooldownMs: 500           // Cooldown between detections
  };

  var state = {
    isActive: false,
    beta: 0,
    baseBeta: 0,
    lastTiltTime: 0
  };

  var els = {};

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    els.start = document.getElementById('start');
    els.arrowUp = document.getElementById('arrow-up');
    els.arrowDown = document.getElementById('arrow-down');

    els.start.addEventListener('click', start);

    // Start sensors immediately
    startSensors();
  }

  // ============================================================================
  // SENSORS
  // ============================================================================

  function startSensors() {
    if (window.DeviceOrientationEvent) {
      // iOS 13+ requires permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // Don't auto-request, wait for user to click start
      } else {
        window.addEventListener('deviceorientation', onDeviceOrientation);
      }
    }
  }

  function requestPermissionAndStart() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function(permissionState) {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', onDeviceOrientation);
            activateDetection();
          }
        })
        .catch(console.error);
    } else {
      activateDetection();
    }
  }

  function onDeviceOrientation(event) {
    if (event.beta !== null) {
      state.beta = event.beta;

      if (state.isActive) {
        detectTilt();
      }
    }
  }

  // ============================================================================
  // DETECTION
  // ============================================================================

  function start() {
    els.start.classList.add('hidden');
    requestPermissionAndStart();
  }

  function activateDetection() {
    // Capture baseline beta position
    state.baseBeta = state.beta;
    state.isActive = true;
  }

  function detectTilt() {
    var now = performance.now();

    // Cooldown check
    if (now - state.lastTiltTime < CONFIG.cooldownMs) {
      return;
    }

    var betaDelta = state.beta - state.baseBeta;

    // Check if tilt is significant enough (different thresholds for up/down)
    var threshold;
    var direction;

    if (betaDelta < 0) {
      // Head tilted down (beta decreased) - requires higher threshold
      threshold = CONFIG.tiltThresholdDown;
      direction = 'down';
    } else {
      // Head tilted up (beta increased)
      threshold = CONFIG.tiltThresholdUp;
      direction = 'up';
    }

    if (Math.abs(betaDelta) >= threshold) {
      state.lastTiltTime = now;

      // Update baseline for next detection
      state.baseBeta = state.beta;

      showArrow(direction);
    }
  }

  function showArrow(direction) {
    var arrow = direction === 'up' ? els.arrowUp : els.arrowDown;

    // Remove any existing animation
    arrow.classList.remove('show');

    // Force reflow to restart animation
    void arrow.offsetWidth;

    // Show arrow
    arrow.classList.add('show');

    // Hide after brief display
    setTimeout(function() {
      arrow.classList.remove('show');
    }, 400);
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
