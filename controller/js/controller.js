// PhantomPad Controller v3 — Optimized for Android
// Multi-player, Trackpad, Motion, Latency, Performance
(function () {
  'use strict';

  const settings = {
    haptic: true, hapticMs: 20, deadzone: 0.15, stickSize: 50, opacity: 0.85,
    theme: 'phantom', layout: 'xbox', sendRate: 60,
    motionMode: 'off',
    motionSens: 1.0,
    trackpadSens: 1.5
  };

  // Load saved settings
  try {
    const saved = JSON.parse(localStorage.getItem('phantompad_settings'));
    if (saved) Object.assign(settings, saved);
  } catch (e) {}

  function saveSettings() {
    try { localStorage.setItem('phantompad_settings', JSON.stringify(settings)); } catch (e) {}
  }

  // --- State ---
  const state = {
    socket: null, connected: false,
    buttons: {}, axes: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 }, triggers: { lt: 0, rt: 0 },
    isGamepad: false,
    isTrackpadMode: false,
    motionBase: { beta: 0, gamma: 0, set: false },
    latency: 0,
    lastInput: null
  };

  // --- Performance: Use RAF-based send loop instead of setInterval ---
  let lastSendTime = 0;
  const sendInterval = 1000 / settings.sendRate;
  let rafId = null;

  function sendLoop(timestamp) {
    rafId = requestAnimationFrame(sendLoop);
    if (!state.connected || state.isTrackpadMode) return;

    if (timestamp - lastSendTime >= sendInterval) {
      lastSendTime = timestamp;

      // Only send if there's actual input (optimization for battery)
      const input = {
        buttons: state.buttons,
        axes: state.axes,
        triggers: state.triggers
      };

      state.socket.volatile.emit('input', input);
    }
  }

  // ========================
  // Socket & Multi-player
  // ========================
  function initSocket() {
    state.socket = io({
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling']
    });

    state.socket.on('connect', () => {
      state.connected = true;
      state.socket.emit('register-controller');
      updateConnUI(true);
      startLatencyPing();
    });

    state.socket.on('disconnect', () => {
      state.connected = false;
      updateConnUI(false);
      stopLatencyPing();
    });

    state.socket.on('reconnecting', () => updateConnUI(false));

    state.socket.on('vibrate', (d) => {
      if (settings.haptic && navigator.vibrate) navigator.vibrate(d.duration || 50);
    });

    state.socket.on('player-assigned', (info) => {
      const badge = document.getElementById('player-badge');
      const num = document.getElementById('player-num');
      badge.style.display = 'block';
      num.textContent = 'P' + info.number;
      num.style.borderColor = info.color;
      num.style.color = info.color;
      num.style.boxShadow = `0 0 10px ${info.color}40`;
    });

    // Latency response
    state.socket.on('pong-check', (sentTime) => {
      state.latency = Date.now() - sentTime;
      updateLatencyUI();
    });

    // Active Game Auto-Detection
    state.socket.on('active-game-update', (data) => {
      if (data.name) {
        showMobileToast(`Detected: ${data.name}`);
        // Optionally update a persistent text element if it exists
        const el = document.getElementById('current-game-name');
        if (el) el.textContent = data.name;
      }
    });
  }

  function updateConnUI(connected) {
    const dot = document.getElementById('connection-indicator');
    const txt = document.getElementById('connection-text');
    dot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
    txt.textContent = connected ? 'Connected' : 'Disconnected';
  }

  // ========================
  // Latency Monitoring
  // ========================
  let pingInterval = null;

  function startLatencyPing() {
    pingInterval = setInterval(() => {
      if (state.connected) {
        state.socket.emit('ping-check', Date.now());
      }
    }, 3000);
  }

  function stopLatencyPing() {
    if (pingInterval) clearInterval(pingInterval);
  }

  function updateLatencyUI() {
    const el = document.getElementById('latency-display');
    if (el) {
      el.textContent = `${state.latency}ms`;
      el.className = 'latency-text ' + (state.latency < 20 ? 'good' : state.latency < 60 ? 'ok' : 'bad');
    }
  }

  function haptic(ms) {
    if (settings.haptic && navigator.vibrate) navigator.vibrate(ms || settings.hapticMs);
  }

  // ========================
  // Virtual Joystick (Optimized)
  // ========================
  class VirtualJoystick {
    constructor(zoneEl, thumbEl, baseEl, axisXKey, axisYKey) {
      this.zone = zoneEl;
      this.thumb = thumbEl;
      this.base = baseEl;
      this.axisX = axisXKey;
      this.axisY = axisYKey;
      this.active = false;
      this.touchId = null;
      this.centerX = 0;
      this.centerY = 0;
      this.maxRadius = 0;

      // Pre-bind for performance
      this._boundStart = this._onStart.bind(this);
      this._boundMove = this._onMove.bind(this);
      this._boundEnd = this._onEnd.bind(this);

      this.zone.addEventListener('touchstart', this._boundStart, { passive: false });
      this.zone.addEventListener('touchmove', this._boundMove, { passive: false });
      this.zone.addEventListener('touchend', this._boundEnd, { passive: false });
      this.zone.addEventListener('touchcancel', this._boundEnd, { passive: false });
    }

    _onStart(e) {
      e.preventDefault();
      if ((settings.motionMode === 'left' && this.axisX === 'leftX') ||
          (settings.motionMode === 'right' && this.axisX === 'rightX')) return;
      if (this.active) return;

      const t = e.changedTouches[0];
      this.touchId = t.identifier;
      this.active = true;

      const rect = this.base.getBoundingClientRect();
      this.centerX = rect.left + rect.width * 0.5;
      this.centerY = rect.top + rect.height * 0.5;
      this.maxRadius = rect.width * 0.5 - (this.thumb.offsetWidth * 0.5);

      this.thumb.classList.add('active');
      this._update(t.clientX, t.clientY);
      haptic(12);
    }

    _onMove(e) {
      e.preventDefault();
      if (!this.active) return;
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === this.touchId) {
          this._update(touches[i].clientX, touches[i].clientY);
          break;
        }
      }
    }

    _onEnd(e) {
      e.preventDefault();
      const touches = e.changedTouches;
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === this.touchId) {
          this.active = false;
          this.touchId = null;
          this.thumb.classList.remove('active');
          this.thumb.style.transform = 'translate(-50%, -50%)';
          state.axes[this.axisX] = 0;
          state.axes[this.axisY] = 0;
          break;
        }
      }
    }

    _update(cx, cy) {
      let dx = cx - this.centerX;
      let dy = cy - this.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.maxRadius) {
        const ratio = this.maxRadius / dist;
        dx *= ratio;
        dy *= ratio;
      }

      // Use translate3d for GPU acceleration
      this.thumb.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0)`;

      let nx = dx / this.maxRadius;
      let ny = dy / this.maxRadius;

      if (Math.abs(nx) < settings.deadzone) nx = 0;
      if (Math.abs(ny) < settings.deadzone) ny = 0;

      state.axes[this.axisX] = Math.round(nx * 1000) / 1000;
      state.axes[this.axisY] = Math.round(ny * 1000) / 1000;
    }
  }

  // ========================
  // Motion Controls
  // ========================
  function initMotion() {
    window.addEventListener('deviceorientation', (e) => {
      if (settings.motionMode === 'off' || !e.beta || !e.gamma) return;

      if (!state.motionBase.set) {
        state.motionBase.beta = e.beta;
        state.motionBase.gamma = e.gamma;
        state.motionBase.set = true;
      }

      if (settings.motionMode === 'steering') {
        // Steering mode uses roll (gamma) for X-axis steering
        let tiltX = e.gamma - state.motionBase.gamma;
        state.axes.leftX = Utils.normalizeSensor(tiltX, 45, settings.motionSens, settings.deadzone);
        return;
      }

      let tiltX = e.gamma - state.motionBase.gamma;
      let tiltY = e.beta - state.motionBase.beta;

      const target = settings.motionMode === 'left' ? 'left' : 'right';
      state.axes[target + 'X'] = Utils.normalizeSensor(tiltX, 30, settings.motionSens, settings.deadzone);
      state.axes[target + 'Y'] = Utils.normalizeSensor(tiltY, 30, settings.motionSens, settings.deadzone);
    }, { passive: true });
  }

  function calibrateMotion() {
    state.motionBase.set = false;
    const btn = document.getElementById('calibrate-btn');
    const oldText = btn.textContent;
    btn.textContent = '✓ Calibrated!';
    haptic(50);
    setTimeout(() => { btn.textContent = oldText; }, 1000);
  }

  function requestMotionPermissions() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => { if (response === 'granted') calibrateMotion(); })
        .catch(console.error);
    } else {
      calibrateMotion();
    }
  }

  // ========================
  // Mouse Trackpad Mode
  // ========================
  function initTrackpad() {
    const overlay = document.getElementById('trackpad-overlay');
    const surface = document.getElementById('trackpad-surface');

    document.getElementById('mode-switch-btn').addEventListener('click', () => {
      state.isTrackpadMode = true;
      overlay.classList.remove('hidden');
    });

    document.getElementById('trackpad-to-controller').addEventListener('click', () => {
      state.isTrackpadMode = false;
      overlay.classList.add('hidden');
    });

    let lastX = 0, lastY = 0;

    surface.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }, { passive: false });

    surface.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!state.connected) return;

      if (e.touches.length === 1) {
        const x = e.touches[0].clientX, y = e.touches[0].clientY;
        const dx = (x - lastX) * settings.trackpadSens;
        const dy = (y - lastY) * settings.trackpadSens;
        state.socket.emit('mouse', { dx, dy });
        lastX = x;
        lastY = y;
      } else if (e.touches.length === 2) {
        const y = e.touches[0].clientY;
        const dy = y - lastY;
        if (Math.abs(dy) > 5) {
          state.socket.emit('mouse', { scroll: dy > 0 ? -1 : 1 });
          lastY = y;
        }
      }
    }, { passive: false });

    surface.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const dist = Math.abs(touch.clientX - lastX) + Math.abs(touch.clientY - lastY);
        if (dist < 10) {
          if (e.touches.length === 0) {
            state.socket.emit('mouse', { click: 'left' });
            haptic(15);
          }
        }
      }
    }, { passive: false });

    // Explicit click buttons
    document.getElementById('trackpad-left-click').addEventListener('touchstart', (e) => {
      e.preventDefault();
      state.socket.emit('mouse', { click: 'left' });
      haptic(20);
    }, { passive: false });

    document.getElementById('trackpad-right-click').addEventListener('touchstart', (e) => {
      e.preventDefault();
      state.socket.emit('mouse', { click: 'right' });
      haptic(20);
    }, { passive: false });
  }

  // ========================
  // Button Handlers (Optimized)
  // ========================
  function initButtons() {
    const allBtns = document.querySelectorAll('[data-btn]');

    allBtns.forEach(btn => {
      const key = btn.dataset.btn;

      // Skip triggers - handled separately
      if (key === 'lt' || key === 'rt') return;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        state.buttons[key] = true;
        btn.classList.add('pressed');
        haptic();
      }, { passive: false });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        state.buttons[key] = false;
        btn.classList.remove('pressed');
      }, { passive: false });

      btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        state.buttons[key] = false;
        btn.classList.remove('pressed');
      }, { passive: false });
    });

    // Triggers with analog behavior
    ['lt', 'rt'].forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        state.triggers[id] = 1.0;
        state.buttons[id] = true;
        el.classList.add('pressed');
        haptic();
      }, { passive: false });

      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        state.triggers[id] = 0;
        state.buttons[id] = false;
        el.classList.remove('pressed');
      }, { passive: false });

      el.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        state.triggers[id] = 0;
        state.buttons[id] = false;
        el.classList.remove('pressed');
      }, { passive: false });
    });
  }

  // ========================
  // Settings UI
  // ========================
  function initSettings() {
    const overlay = document.getElementById('settings-overlay');
    document.getElementById('settings-btn').addEventListener('click', () => overlay.classList.remove('hidden'));
    document.getElementById('close-settings').addEventListener('click', () => { overlay.classList.add('hidden'); saveSettings(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.add('hidden'); saveSettings(); } });

    document.getElementById('haptic-toggle').checked = settings.haptic;
    document.getElementById('haptic-toggle').addEventListener('change', (e) => { settings.haptic = e.target.checked; });

    const dzSlider = document.getElementById('deadzone-slider');
    dzSlider.value = settings.deadzone * 100;
    document.getElementById('deadzone-value').textContent = settings.deadzone.toFixed(2);
    dzSlider.addEventListener('input', (e) => {
      settings.deadzone = parseInt(e.target.value) / 100;
      document.getElementById('deadzone-value').textContent = settings.deadzone.toFixed(2);
    });

    document.getElementById('stick-size-slider').addEventListener('input', (e) => {
      const s = parseInt(e.target.value);
      document.querySelectorAll('.joystick-container').forEach(el => {
        el.style.width = s * 2.4 + 'px';
        el.style.height = s * 2.4 + 'px';
      });
    });

    document.getElementById('opacity-slider').addEventListener('input', (e) => {
      const o = parseInt(e.target.value) / 100;
      document.querySelectorAll('.face-btn, .dpad-btn, .bumper-btn, .trigger-btn, .center-btn').forEach(el => {
        el.style.opacity = o;
      });
    });

    // Apply saved theme
    document.getElementById('controller').className = 'controller theme-' + settings.theme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('controller').className = 'controller theme-' + btn.dataset.theme;
        settings.theme = btn.dataset.theme;
      });
    });

    // Console Layout Presets
    const layoutEl = document.getElementById('layout-select');
    if (layoutEl) {
      layoutEl.value = settings.layout;
      applyLayout(settings.layout);

      layoutEl.addEventListener('change', (e) => {
        settings.layout = e.target.value;
        applyLayout(settings.layout);
      });
    }

    // Game Preset Selector
    const presetEl = document.getElementById('preset-select');
    if (presetEl) {
      presetEl.value = settings.preset || 'default';
      presetEl.addEventListener('change', (e) => {
        settings.preset = e.target.value;
        state.socket.emit('set-preset', settings.preset);
        saveSettings();
        haptic(25);
        showMobileToast(`Equipped: ${e.target.options[e.target.selectedIndex].text}`);
      });
    }

    // Simple mobile toast notification
    function showMobileToast(msg) {
      let toast = document.getElementById('mobile-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mobile-toast';
        toast.style.cssText = 'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#00e5ff; padding:8px 16px; border-radius:20px; font-size:12px; font-weight:600; z-index:9999; pointer-events:none; opacity:0; transition:opacity 0.3s; border:1px solid rgba(0,229,255,0.4); box-shadow:0 0 10px rgba(0,229,255,0.2)';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      if (toast.timeout) clearTimeout(toast.timeout);
      toast.timeout = setTimeout(() => toast.style.opacity = '0', 2500);
    }

    // Sync when dashboard changes preset
    state.socket.on('preset-changed', (preset) => {
      settings.preset = preset;
      const el = document.getElementById('preset-select');
      if (el) el.value = preset;
      saveSettings();
    });

    const motInd = document.getElementById('motion-indicator');
    document.getElementById('motion-select').addEventListener('change', (e) => {
      settings.motionMode = e.target.value;
      if (settings.motionMode !== 'off') {
        motInd.classList.remove('hidden');
        requestMotionPermissions();
      } else {
        motInd.classList.add('hidden');
      }
    });

    const motSensSlider = document.getElementById('motion-sens-slider');
    motSensSlider.value = settings.motionSens * 100;
    document.getElementById('motion-sens-value').textContent = settings.motionSens.toFixed(1) + 'x';
    motSensSlider.addEventListener('input', (e) => {
      settings.motionSens = parseInt(e.target.value) / 100;
      document.getElementById('motion-sens-value').textContent = settings.motionSens.toFixed(1) + 'x';
    });

    const tpSensSlider = document.getElementById('trackpad-sens-slider');
    tpSensSlider.value = settings.trackpadSens * 100;
    document.getElementById('trackpad-sens-value').textContent = settings.trackpadSens.toFixed(1) + 'x';
    tpSensSlider.addEventListener('input', (e) => {
      settings.trackpadSens = parseInt(e.target.value) / 100;
      document.getElementById('trackpad-sens-value').textContent = settings.trackpadSens.toFixed(1) + 'x';
    });

    document.getElementById('calibrate-btn').addEventListener('click', calibrateMotion);

    document.getElementById('fullscreen-btn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });
  }

  // ========================
  // Layout Logic
  // ========================
  function applyLayout(layout) {
    const labels = {
      xbox: {
        'Y': 'Y', 'X': 'X', 'B': 'B', 'A': 'A',
        'lb': 'LB', 'rb': 'RB', 'lt': 'LT', 'rt': 'RT',
        'back': 'BACK', 'start': 'START', 'home': '⬡',
        'ls': 'L3', 'rs': 'R3'
      },
      playstation: {
        'Y': '△', 'X': '□', 'B': '○', 'A': '✕',
        'lb': 'L1', 'rb': 'R1', 'lt': 'L2', 'rt': 'R2',
        'back': 'SHARE', 'start': 'OPTIONS', 'home': '⬡',
        'ls': 'L3', 'rs': 'R3'
      },
      nintendo: {
        'Y': 'X', 'X': 'Y', 'B': 'A', 'A': 'B',
        'lb': 'L', 'rb': 'R', 'lt': 'ZL', 'rt': 'ZR',
        'back': '-', 'start': '+', 'home': '⌂',
        'ls': 'LS', 'rs': 'RS'
      }
    };

    const map = labels[layout] || labels.xbox;
    
    // Update every button that has a [data-btn] matching our map
    document.querySelectorAll('[data-btn]').forEach(btn => {
      const key = btn.dataset.btn;
      if (map[key]) {
        btn.textContent = map[key];
        
        // Slightly tweak classes/styles to make special characters look better if needed
        if (layout === 'playstation' && ['A','B','X','Y'].includes(key)) {
          btn.style.fontSize = '32px'; // PS characters look better slightly larger
        } else {
          btn.style.fontSize = ''; 
        }
      }
    });
  }

  // ========================
  // Init
  // ========================
  function init() {
    initSocket();
    initButtons();
    initMotion();
    initTrackpad();

    new VirtualJoystick(
      document.getElementById('left-stick-zone'),
      document.getElementById('left-stick-thumb'),
      document.getElementById('left-stick-base'),
      'leftX', 'leftY'
    );

    new VirtualJoystick(
      document.getElementById('right-stick-zone'),
      document.getElementById('right-stick-thumb'),
      document.getElementById('right-stick-base'),
      'rightX', 'rightY'
    );

    initSettings();

    // Start RAF-based send loop
    rafId = requestAnimationFrame(sendLoop);

    // Prevent all scrolling/bouncing on mobile
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Lock landscape
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    // Unregister any old service workers that cause caching issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }

    // Wake lock to prevent screen dimming during play
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
