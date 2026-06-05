(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  var CONFIG = {
    nodThreshold: 15,           // Degrees of beta change to register a nod
    timingWindows: {
      perfect: 200,             // ±200ms for perfect hit
      good: 400                 // ±400ms for good hit
    },
    arrowDisplayTime: 500,      // Show arrow 500ms before hit time
    scoring: {
      perfect: 100,
      good: 50,
      miss: 0,
      comboMultiplier: 1.1      // 10% bonus per combo level
    }
  };

  // ============================================================================
  // LEVEL DATA
  // ============================================================================

  var LEVELS = {
    'test-level-1': {
      id: 'test-level-1',
      name: 'Test Level',
      bpm: 30,
      duration: 60,
      audioFile: null,
      beatWindowMs: 500,  // 500ms total window (250ms before/after perfect time)
      beatPattern: [
        // 30 BPM = one beat every 2 seconds, alternating down/up
        { time: 2.0, action: 'down' },
        { time: 3.0, action: 'up' },
        { time: 4.0, action: 'down' },
        { time: 5.0, action: 'up' },
        { time: 6.0, action: 'down' },
        { time: 7.0, action: 'up' },
        { time: 8.0, action: 'down' },
        { time: 9.0, action: 'up' },
        { time: 10.0, action: 'down' },
        { time: 11.0, action: 'up' },
        { time: 12.0, action: 'down' },
        { time: 13.0, action: 'up' },
        { time: 14.0, action: 'down' },
        { time: 15.0, action: 'up' },
        { time: 16.0, action: 'down' },
        { time: 17.0, action: 'up' },
        { time: 18.0, action: 'down' },
        { time: 19.0, action: 'up' },
        { time: 20.0, action: 'down' },
        { time: 21.0, action: 'up' },
        { time: 22.0, action: 'down' },
        { time: 23.0, action: 'up' },
        { time: 24.0, action: 'down' },
        { time: 25.0, action: 'up' },
        { time: 26.0, action: 'down' },
        { time: 27.0, action: 'up' },
        { time: 28.0, action: 'down' },
        { time: 29.0, action: 'up' },
        { time: 30.0, action: 'down' }
      ]
    },
    'pedro1': {
      id: 'pedro1',
      name: 'Pedro',
      bpm: 124,
      duration: 144.56256235827664,
      audioFile: 'assets/pedro1/audio.wav',
      beatWindowMs: 500,
      beatPattern: [
        { time: 5.08, action: 'down' },
        { time: 5.42, action: 'up' },
        { time: 27.23, action: 'down' },
        { time: 27.46, action: 'up' },
        { time: 27.67, action: 'down' },
        { time: 27.89, action: 'up' },
        { time: 28.1, action: 'down' },
        { time: 28.3, action: 'up' },
        { time: 28.56, action: 'down' },
        { time: 28.83, action: 'up' }
      ]
    }
  };

  // ============================================================================
  // STATE
  // ============================================================================

  var state = {
    currentScreen: 'menu',
    screenHistory: [],
    selectedLevel: null,

    // Gyro state
    orientation: {
      beta: 0,
      lastBeta: 0,
      baseBeta: 0,           // Baseline beta when game starts
      isNodding: false,
      lastNodTime: 0
    },

    // Game state
    gameStartTime: null,
    currentTime: 0,
    beatIndex: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    activeArrow: null,
    gameActive: false,

    // Animation
    animationId: null,

    // Audio
    audio: null
  };

  var screens = {};
  var canvas, ctx;

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function navigateTo(screenId, options) {
    options = options || {};
    if (options.addToHistory !== false) {
      state.screenHistory.push(state.currentScreen);
    }

    Object.values(screens).forEach(function(s) {
      s.classList.add('hidden');
    });

    screens[screenId].classList.remove('hidden');
    state.currentScreen = screenId;
    onScreenEnter(screenId);
    focusFirst(screens[screenId]);
  }

  function navigateBack() {
    if (state.screenHistory.length > 0) {
      navigateTo(state.screenHistory.pop(), { addToHistory: false });
    }
  }

  function onScreenEnter(screenId) {
    if (screenId === 'game') {
      startGame();
    } else if (screenId === 'menu') {
      resetGameState();
    }
  }

  // ============================================================================
  // FOCUS MANAGEMENT
  // ============================================================================

  function focusFirst(container) {
    var focusables = container.querySelectorAll('.focusable:not([disabled])');
    if (focusables.length > 0) {
      focusables[0].focus();
    }
  }

  function moveFocus(direction) {
    var focusables = Array.from(
      screens[state.currentScreen].querySelectorAll('.focusable:not([disabled])')
    );

    if (focusables.length === 0) return;

    var idx = focusables.indexOf(document.activeElement);
    var nextIdx;

    if (direction === 'up' || direction === 'left') {
      nextIdx = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      nextIdx = idx < focusables.length - 1 ? idx + 1 : 0;
    }

    focusables[nextIdx].focus();
  }

  // ============================================================================
  // GYRO SENSOR
  // ============================================================================

  function onDeviceOrientation(event) {
    if (event.beta !== null) {
      state.orientation.lastBeta = state.orientation.beta;
      state.orientation.beta = event.beta;

      // Always update debug display
      updateDebugDisplay();

      // Detect nod gestures during gameplay
      if (state.gameActive) {
        detectNodGesture();
      }
    }
  }

  function detectNodGesture() {
    var betaDelta = state.orientation.beta - state.orientation.baseBeta;
    var now = performance.now();

    // Debounce: ignore rapid repeated nods
    if (now - state.orientation.lastNodTime < 300) {
      return;
    }

    // Check if beta changed enough to register as a nod
    if (Math.abs(betaDelta) >= CONFIG.nodThreshold) {
      state.orientation.lastNodTime = now;

      // Update baseline to current position after detecting nod
      state.orientation.baseBeta = state.orientation.beta;

      if (betaDelta < 0) {
        // Nod down (beta decreases)
        handleNodAction('down');
      } else {
        // Raise up (beta increases)
        handleNodAction('up');
      }
    }
  }

  function handleNodAction(action) {
    if (!state.activeArrow) return;

    // Check if action matches the active arrow
    if (state.activeArrow.action === action) {
      var timeDiff = Math.abs(state.currentTime - state.activeArrow.time);

      // Get level-specific timing window
      var level = LEVELS[state.selectedLevel];
      var beatWindow = (level.beatWindowMs || 500) / 1000;  // Convert to seconds
      var halfWindow = beatWindow / 2;  // 0.25 seconds

      // Perfect = within 25% of half window (±62.5ms for 500ms window)
      // Good = within full half window (±250ms for 500ms window)
      var perfectWindow = halfWindow * 0.25;
      var goodWindow = halfWindow;

      if (timeDiff <= perfectWindow) {
        // Perfect hit
        scoreHit('perfect');
      } else if (timeDiff <= goodWindow) {
        // Good hit
        scoreHit('good');
      } else {
        // Miss (outside window)
        scoreMiss();
      }

      // Clear the active arrow
      state.activeArrow = null;
    }
  }

  function startSensors() {
    if (window.DeviceOrientationEvent) {
      // iOS 13+ requires permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(function(permissionState) {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', onDeviceOrientation);
            }
          })
          .catch(console.error);
      } else {
        // Non-iOS or older iOS
        window.addEventListener('deviceorientation', onDeviceOrientation);
      }
    }
  }

  // ============================================================================
  // GAME LOGIC
  // ============================================================================

  function startGame() {
    if (!state.selectedLevel) return;

    var level = LEVELS[state.selectedLevel];
    if (!level) return;

    resetGameState();

    // Take snapshot of current beta position as baseline
    state.orientation.baseBeta = state.orientation.beta;

    // Load and play audio if available
    if (level.audioFile) {
      state.audio = new Audio(level.audioFile);
      state.audio.play().catch(function(err) {
        console.error('Audio playback failed:', err);
      });
    }

    state.gameActive = true;
    state.gameStartTime = performance.now();
    state.beatIndex = 0;

    gameLoop();
  }

  function resetGameState() {
    state.gameActive = false;
    state.gameStartTime = null;
    state.currentTime = 0;
    state.beatIndex = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.misses = 0;
    state.activeArrow = null;

    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    // Stop audio if playing
    if (state.audio) {
      state.audio.pause();
      state.audio.currentTime = 0;
      state.audio = null;
    }

    updateScoreDisplay();
  }

  function gameLoop() {
    if (!state.gameActive) return;

    var now = performance.now();
    state.currentTime = (now - state.gameStartTime) / 1000; // Convert to seconds

    var level = LEVELS[state.selectedLevel];

    // Check if level is complete
    if (state.currentTime >= level.duration) {
      endGame();
      return;
    }

    // Update active arrow
    updateActiveArrow(level);

    // Render
    render();

    state.animationId = requestAnimationFrame(gameLoop);
  }

  function updateActiveArrow(level) {
    // Check if we need to show the next arrow
    if (state.beatIndex < level.beatPattern.length) {
      var nextBeat = level.beatPattern[state.beatIndex];
      var timeUntilBeat = nextBeat.time - state.currentTime;

      // Use level's beat window (default 500ms)
      var beatWindow = (level.beatWindowMs || 500) / 1000; // Convert to seconds
      var halfWindow = beatWindow / 2;  // 250ms before perfect time

      // Show arrow when we enter the window (250ms before perfect time)
      if (timeUntilBeat <= halfWindow && !state.activeArrow) {
        state.activeArrow = nextBeat;
      }

      // Check if we missed the arrow (passed the window after perfect time)
      if (state.activeArrow && state.currentTime > state.activeArrow.time + halfWindow) {
        scoreMiss();
        state.activeArrow = null;
        state.beatIndex++;
      }
    }
  }

  function scoreHit(quality) {
    var baseScore = CONFIG.scoring[quality];
    var comboBonus = Math.floor(state.combo * CONFIG.scoring.comboMultiplier);
    var totalScore = baseScore + comboBonus;

    state.score += totalScore;
    state.combo++;
    state.hits++;

    if (state.combo > state.maxCombo) {
      state.maxCombo = state.combo;
    }

    state.beatIndex++;
    updateScoreDisplay();
  }

  function scoreMiss() {
    state.combo = 0;
    state.misses++;
    updateScoreDisplay();
  }

  function updateScoreDisplay() {
    document.getElementById('score').textContent = state.score;
    var comboEl = document.getElementById('combo');
    if (state.combo > 0) {
      comboEl.textContent = state.combo + 'x';
    } else {
      comboEl.textContent = '';
    }
  }

  function endGame() {
    state.gameActive = false;

    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    // Stop audio
    if (state.audio) {
      state.audio.pause();
      state.audio.currentTime = 0;
    }

    // Calculate accuracy
    var totalBeats = state.hits + state.misses;
    var accuracy = totalBeats > 0 ? Math.round((state.hits / totalBeats) * 100) : 0;

    // Update results screen
    document.getElementById('final-score').textContent = state.score;
    document.getElementById('accuracy').textContent = accuracy + '%';
    document.getElementById('max-combo').textContent = state.maxCombo + 'x';

    navigateTo('results');
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  function render() {
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 600, 600);

    // Update debug display
    updateDebugDisplay();

    // Draw active arrow if present
    if (state.activeArrow) {
      drawArrow(state.activeArrow);
    }
  }

  function updateDebugDisplay() {
    var betaEl = document.getElementById('beta-debug');
    var deltaEl = document.getElementById('delta-debug');

    if (betaEl) {
      betaEl.textContent = state.orientation.beta.toFixed(1) + '°';
    }

    if (deltaEl) {
      var delta = state.orientation.beta - state.orientation.baseBeta;
      deltaEl.textContent = delta.toFixed(1) + '°';
    }
  }

  function drawArrow(beat) {
    var centerX = 300;
    var centerY = 300;
    var arrowSize = 120;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Rotate based on action
    if (beat.action === 'down') {
      ctx.rotate(Math.PI); // Point down
    }
    // 'up' is default (0 rotation)

    // Draw arrow
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(0, -arrowSize / 2);
    ctx.lineTo(-arrowSize / 3, arrowSize / 4);
    ctx.lineTo(-arrowSize / 6, arrowSize / 4);
    ctx.lineTo(-arrowSize / 6, arrowSize / 2);
    ctx.lineTo(arrowSize / 6, arrowSize / 2);
    ctx.lineTo(arrowSize / 6, arrowSize / 4);
    ctx.lineTo(arrowSize / 3, arrowSize / 4);
    ctx.closePath();
    ctx.fill();

    // Add glow effect
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00d4ff';
    ctx.fill();

    ctx.restore();

    // Draw timing indicator (time until beat)
    var timeUntil = (beat.time - state.currentTime) * 1000; // ms
    var progress = 1 - (timeUntil / CONFIG.arrowDisplayTime);

    // Draw circle around arrow that fills as time approaches
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, arrowSize, -Math.PI / 2, (-Math.PI / 2) + (progress * Math.PI * 2));
    ctx.stroke();
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  function handleAction(action, element) {
    switch (action) {
      case 'select-level':
        var levelId = element.dataset.levelId;
        state.selectedLevel = levelId;
        navigateTo('game');
        break;
      case 'back-to-menu':
        navigateTo('menu', { addToHistory: false });
        break;
      default:
        break;
    }
  }

  function setupEvents() {
    // Click events
    document.addEventListener('click', function(e) {
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        handleAction(actionEl.dataset.action, actionEl);
      }
    });

    // Keyboard events
    document.addEventListener('keydown', function(e) {
      // Don't handle if in game (gyro only)
      if (state.currentScreen === 'game') {
        if (e.key === 'Escape') {
          state.gameActive = false;
          navigateBack();
          e.preventDefault();
        }
        return;
      }

      // Menu navigation
      switch (e.key) {
        case 'ArrowUp':
          moveFocus('up');
          e.preventDefault();
          break;
        case 'ArrowDown':
          moveFocus('down');
          e.preventDefault();
          break;
        case 'ArrowLeft':
          moveFocus('left');
          e.preventDefault();
          break;
        case 'ArrowRight':
          moveFocus('right');
          e.preventDefault();
          break;
        case 'Enter':
          if (document.activeElement) {
            document.activeElement.click();
          }
          e.preventDefault();
          break;
        case 'Escape':
          navigateBack();
          e.preventDefault();
          break;
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function init() {
    // Collect screens
    document.querySelectorAll('.screen').forEach(function(s) {
      if (s.id) screens[s.id] = s;
    });

    // Get canvas
    canvas = document.getElementById('gameCanvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
    }

    // Setup events
    setupEvents();

    // Start sensors
    startSensors();

    // Navigate to menu
    navigateTo('menu', { addToHistory: false });
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
