// PhantomPad Controller v3 — Optimized for Android
// Multi-player, Motion, Latency, Performance
(function () {
  'use strict';

  const settings = {
    haptic: true, hapticMs: 20, deadzone: 0.15, stickSize: 50, opacity: 0.85,
    theme: 'phantom', layout: 'xbox', sendRate: 60,
    motionMode: 'off',
    motionSens: 1.0,
    controllerScale: 100,
    controllerLayout: 'standard',
    controllerPositions: {}
  };

  // Load saved settings
  try {
    const saved = JSON.parse(localStorage.getItem('phantompad_settings'));
    if (saved) Object.assign(settings, saved);
  } catch (e) {}
  if (!settings.controllerPositions || typeof settings.controllerPositions !== 'object' || Array.isArray(settings.controllerPositions)) {
    settings.controllerPositions = {};
  }

  function saveSettings() {
    try { localStorage.setItem('phantompad_settings', JSON.stringify(settings)); } catch (e) {}
  }

  // --- State ---
  const state = {
    socket: null, connected: false,
    buttons: {}, axes: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 }, triggers: { lt: 0, rt: 0 },
    isGamepad: false,
    motionBase: { beta: 0, gamma: 0, set: false },
    latency: null,
    lastInput: null
  };

  // --- Performance: Use RAF-based send loop instead of setInterval ---
  let lastSendTime = 0;
  let lastPacketTime = 0;
  let lastSentInput = null;
  const sendInterval = 1000 / settings.sendRate;
  const activeInputHeartbeat = 100;
  let rafId = null;
  const joysticks = [];

  function hasActiveInput(input) {
    return Object.values(input.buttons).some(Boolean) ||
      Object.values(input.axes).some(value => Math.abs(value) > 0.001) ||
      Object.values(input.triggers).some(value => value > 0.001);
  }

  function inputMatches(a, b) {
    if (!a || !b) return false;
    for (const group of ['buttons', 'axes', 'triggers']) {
      const aValues = a[group];
      const bValues = b[group];
      const keys = Object.keys(aValues);
      if (keys.length !== Object.keys(bValues).length) return false;
      for (const key of keys) {
        if (aValues[key] !== bValues[key]) return false;
      }
    }
    return true;
  }

  function sendLoop(timestamp) {
    rafId = requestAnimationFrame(sendLoop);
    if (!state.connected) return;

    if (timestamp - lastSendTime >= sendInterval) {
      lastSendTime = timestamp;

      const input = {
        buttons: { ...state.buttons },
        axes: { ...state.axes },
        triggers: { ...state.triggers }
      };
      const active = hasActiveInput(input);
      const changed = !inputMatches(input, lastSentInput);
      const heartbeatDue = active && timestamp - lastPacketTime >= activeInputHeartbeat;

      // Neutral state needs one release snapshot, not 60 identical packets/sec.
      // Held controls keep a 100 ms heartbeat so the server watchdog stays fresh.
      if (changed || heartbeatDue) {
        state.socket.volatile.emit('input', input);
        lastSentInput = input;
        lastPacketTime = timestamp;
      }
    }
  }

  // ========================
  // Socket & Multi-player
  // ========================
  function resetInputState(sendNeutral = false) {
    // Preserve known button keys so the server receives explicit releases.
    for (const key of Object.keys(state.buttons)) state.buttons[key] = false;
    state.axes.leftX = state.axes.leftY = state.axes.rightX = state.axes.rightY = 0;
    state.triggers.lt = state.triggers.rt = 0;

    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    joysticks.forEach(joystick => {
      joystick.active = false;
      joystick.touchId = null;
      joystick.thumb.classList.remove('active');
      joystick.thumb.style.transform = 'translate(-50%, -50%)';
    });

    // A neutral snapshot is state-critical; use a non-volatile emit when connected.
    if (sendNeutral && state.connected && state.socket && state.socket.connected) {
      state.socket.emit('input', {
        buttons: { ...state.buttons },
        axes: { ...state.axes },
        triggers: { ...state.triggers }
      });
    }
  }

  async function initSocket() {
    const socketOptions = {
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: Infinity,
      // Start with polling and upgrade to WebSocket. This keeps clients
      // connected when a hotspot or firewall blocks the initial WebSocket.
      transports: ['polling', 'websocket']
    };
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get('serverUrl');
    let pairingCode = params.get('pairingCode') || '';
    const native = window.PhantomPadNative;
    let deviceIdentity = null;

    if (native && typeof native.getDeviceIdentity === 'function') {
      try {
        deviceIdentity = JSON.parse(native.getDeviceIdentity() || '{}');
        if (!/^[a-f0-9]{64}$/.test(deviceIdentity.deviceId || '') || !deviceIdentity.publicKey) {
          throw new Error('The phone could not create its secure device key.');
        }
      } catch (error) {
        updateConnUI(false);
        document.getElementById('connection-text').textContent = error.message || 'Pairing is needed. Return and enter the Windows code.';
        console.warn('PhantomPad device verification failed:', error);
        return;
      }
    }

    socketOptions.auth = (callback) => {
      const makeAuth = async () => {
        if (!deviceIdentity) {
          // Browser/PWA clients keep using the pairing code. The Android app
          // uses its Keystore identity for 30-day remembered trust.
          return { pairingCode };
        }
        if (/^[0-9]{8}$/.test(pairingCode)) {
          return { pairingCode, deviceId: deviceIdentity.deviceId, publicKey: deviceIdentity.publicKey };
        }

        const challengeUrl = new URL('/api/device-challenge', serverUrl || window.location.origin);
        challengeUrl.searchParams.set('deviceId', deviceIdentity.deviceId);
        const response = await fetch(challengeUrl, { cache: 'no-store' });
        if (!response.ok) return { pairingCode: '', deviceId: deviceIdentity.deviceId };
        const challengeData = await response.json();
        const signature = native.signDeviceChallenge(challengeData.challenge || '');
        if (!signature) throw new Error('The phone could not verify its saved pairing. Enter the Windows pairing code again.');
        return { deviceId: deviceIdentity.deviceId, challenge: challengeData.challenge, signature };
      };

      makeAuth().then(callback).catch((error) => {
        console.warn('PhantomPad device verification failed:', error);
        callback({ pairingCode: '' });
      });
    };

    state.socket = serverUrl ? io(serverUrl, socketOptions) : io(socketOptions);

    state.socket.on('connect', () => {
      resetInputState(false);
      lastSentInput = null;
      lastPacketTime = 0;
      state.connected = true;
      state.socket.emit('register-controller');
      updateConnUI(true);
      startLatencyPing();
    });

    state.socket.on('connect_error', (error) => {
      state.connected = false;
      updateConnUI(false);
      const connectionText = document.getElementById('connection-text');
      connectionText.textContent = /pairing code|trusted phone verification/i.test(error?.message || '')
        ? 'Pairing needed or expired — return and enter the current Windows code'
        : 'Retrying connection';
      console.warn('Socket.IO connection failed:', error?.message || error);
    });

    state.socket.on('device-trust-confirmed', () => {
      pairingCode = '';
      // Remove the one-time code from the Android WebView URL after pairing.
      const currentParams = new URLSearchParams(window.location.search);
      if (currentParams.has('pairingCode')) {
        currentParams.delete('pairingCode');
        const query = currentParams.toString();
        history.replaceState(null, document.title, `${window.location.pathname}${query ? `?${query}` : ''}`);
      }
    });

    state.socket.on('disconnect', (reason) => {
      state.connected = false;
      state.latency = null;
      lastSentInput = null;
      lastPacketTime = 0;
      resetInputState(false);
      updateConnUI(false);
      if (reason === 'io server disconnect') {
        document.getElementById('connection-text').textContent = 'Disconnected by PC';
      }
      updateLatencyUI();
      stopLatencyPing();
    });

    state.socket.on('reconnecting', () => updateConnUI(false));

    state.socket.on('vibrate', (d) => {
      haptic(d.duration || 50);
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
      state.socket.emit('latency-report', state.latency);
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
    stopLatencyPing();
    const ping = () => {
      if (state.connected && state.socket?.connected) {
        state.socket.emit('ping-check', Date.now());
      }
    };
    ping();
    pingInterval = setInterval(ping, 1000);
  }

  function stopLatencyPing() {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = null;
  }

  function initCustomLayout() {
    const controller = document.getElementById('controller');
    const toolbar = document.getElementById('layout-edit-toolbar');
    const customizeButton = document.getElementById('customize-controls-btn');
    const finishButton = document.getElementById('finish-layout-edit');
    const resetButton = document.getElementById('reset-control-positions-btn');
    let editing = false;
    let drag = null;

    const applyPositions = () => {
      document.querySelectorAll('[data-layout-id]').forEach((element) => {
        const position = settings.controllerPositions?.[element.dataset.layoutId];
        element.style.translate = position && Number.isFinite(position.x) && Number.isFinite(position.y)
          ? `${position.x}vw ${position.y}vh`
          : '';
      });
    };

    const finishEditing = () => {
      editing = false;
      drag = null;
      controller.classList.remove('editing-layout');
      toolbar.classList.add('hidden');
      saveSettings();
    };

    customizeButton.addEventListener('click', () => {
      document.getElementById('settings-overlay').classList.add('hidden');
      editing = true;
      controller.classList.add('editing-layout');
      toolbar.classList.remove('hidden');
    });
    finishButton.addEventListener('click', finishEditing);
    resetButton.addEventListener('click', () => {
      settings.controllerPositions = {};
      applyPositions();
      saveSettings();
    });

    controller.addEventListener('pointerdown', (event) => {
      if (!editing) return;
      const element = event.target.closest('[data-layout-id]');
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = controller.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const id = element.dataset.layoutId;
      const position = settings.controllerPositions?.[id] || { x: 0, y: 0 };
      drag = {
        element,
        id,
        startX: event.clientX,
        startY: event.clientY,
        bounds,
        rect,
        originX: position.x,
        originY: position.y
      };
      controller.setPointerCapture(event.pointerId);
    }, true);

    controller.addEventListener('pointermove', (event) => {
      if (!editing || !drag) return;
      event.preventDefault();
      const minX = drag.bounds.left + 6 - drag.rect.left;
      const maxX = drag.bounds.right - 6 - drag.rect.right;
      const minY = drag.bounds.top + 6 - drag.rect.top;
      const maxY = drag.bounds.bottom - 6 - drag.rect.bottom;
      const dx = Math.max(minX, Math.min(maxX, event.clientX - drag.startX));
      const dy = Math.max(minY, Math.min(maxY, event.clientY - drag.startY));
      const x = drag.originX + dx / window.innerWidth * 100;
      const y = drag.originY + dy / window.innerHeight * 100;
      drag.element.style.translate = `${x}vw ${y}vh`;
      settings.controllerPositions[drag.id] = { x, y };
    }, true);

    const endDrag = (event) => {
      if (!drag) return;
      event.preventDefault();
      drag = null;
      saveSettings();
    };
    controller.addEventListener('pointerup', endDrag, true);
    controller.addEventListener('pointercancel', endDrag, true);
    applyPositions();
  }

  function updateLatencyUI() {
    const el = document.getElementById('latency-display');
    if (el) {
      el.textContent = state.latency === null ? 'Network RTT: --' : `Network RTT: ${state.latency} ms`;
      const quality = state.latency === null ? 'neutral' : state.latency < 20 ? 'good' : state.latency < 60 ? 'ok' : 'bad';
      el.className = 'latency-text ' + quality;
    }
  }

  function haptic(ms) {
    if (!settings.haptic) return;
    const duration = Math.max(1, Math.min(1000, Number(ms) || settings.hapticMs));
    try {
      if (window.PhantomPadNative?.vibrate) {
        window.PhantomPadNative.vibrate(duration);
      } else if (navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch (error) {
      console.debug('Haptic feedback unavailable:', error);
    }
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

      this.zone.addEventListener('pointerdown', this._boundStart, { passive: false });
      this.zone.addEventListener('pointermove', this._boundMove, { passive: false });
      this.zone.addEventListener('pointerup', this._boundEnd, { passive: false });
      this.zone.addEventListener('pointercancel', this._boundEnd, { passive: false });
    }

    _onStart(e) {
      e.preventDefault();
      if ((settings.motionMode === 'left' && this.axisX === 'leftX') ||
          (settings.motionMode === 'right' && this.axisX === 'rightX')) return;
      if (this.active) return;

      const t = e;
      this.touchId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);
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
      if (e.pointerId === this.touchId) this._update(e.clientX, e.clientY);

    }

    _onEnd(e) {
      e.preventDefault();
      if (e.pointerId !== this.touchId) return;
      this.active = false;
      this.touchId = null;
      this.thumb.classList.remove('active');
      this.thumb.style.transform = 'translate(-50%, -50%)';
      state.axes[this.axisX] = 0;
      state.axes[this.axisY] = 0;
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
  // Button Handlers (Optimized)
  // ========================
  function initButtons() {
    const activePointers = new Map();
    const allBtns = document.querySelectorAll('[data-btn]');
    allBtns.forEach(btn => {
      const key = btn.dataset.btn;
      if (!activePointers.has(key)) activePointers.set(key, new Set());
      const pointers = activePointers.get(key);
      const trigger = key === 'lt' || key === 'rt';
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // Stick-click buttons are nested inside the joystick zones. Stop the
        // event here so the parent joystick cannot capture this pointer;
        // otherwise pointerup is delivered to the zone and L3/R3 stay held.
        e.stopPropagation();
        btn.setPointerCapture(e.pointerId);
        pointers.add(e.pointerId);
        state.buttons[key] = true;
        if (trigger) state.triggers[key] = 1;
        btn.classList.add('pressed');
        haptic();
      });
      const release = (e) => {
        if (!pointers.has(e.pointerId)) return;
        e.preventDefault();
        pointers.delete(e.pointerId);
        const pressed = pointers.size > 0;
        state.buttons[key] = pressed;
        if (trigger) state.triggers[key] = pressed ? 1 : 0;
        btn.classList.toggle('pressed', pressed);
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
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
    document.getElementById('haptic-toggle').addEventListener('change', (e) => { settings.haptic = e.target.checked; saveSettings(); });

    const dzSlider = document.getElementById('deadzone-slider');
    dzSlider.value = settings.deadzone * 100;
    document.getElementById('deadzone-value').textContent = settings.deadzone.toFixed(2);
    dzSlider.addEventListener('input', (e) => {
      settings.deadzone = parseInt(e.target.value) / 100;
      document.getElementById('deadzone-value').textContent = settings.deadzone.toFixed(2);
    });

    const stickSlider = document.getElementById('stick-size-slider');
    stickSlider.value = settings.stickSize;
    const applyStickSize = () => {
      const size = parseInt(stickSlider.value, 10);
      document.querySelectorAll('.joystick-container').forEach(el => {
        el.style.width = size * 2.4 + 'px';
        el.style.height = size * 2.4 + 'px';
      });
    };
    stickSlider.addEventListener('input', () => { settings.stickSize = parseInt(stickSlider.value, 10); applyStickSize(); saveSettings(); });
    applyStickSize();

    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.value = settings.opacity * 100;
    const applyOpacity = () => {
      const opacity = parseInt(opacitySlider.value, 10) / 100;
      document.querySelectorAll('.face-btn, .dpad-btn, .bumper-btn, .trigger-btn, .center-btn, .joystick-base, .joystick-thumb').forEach(el => { el.style.opacity = opacity; });
    };
    opacitySlider.addEventListener('input', () => { settings.opacity = parseInt(opacitySlider.value, 10) / 100; applyOpacity(); saveSettings(); });
    applyOpacity();

    const scaleSlider = document.getElementById('controller-scale-slider');
    const scaleValue = document.getElementById('controller-scale-value');
    scaleSlider.value = settings.controllerScale || 100;
    const applyControllerScale = () => {
      const scale = parseInt(scaleSlider.value, 10);
      document.getElementById('controller').style.setProperty('--controller-scale', scale / 100);
      scaleValue.textContent = scale + '%';
    };
    scaleSlider.addEventListener('input', () => { settings.controllerScale = parseInt(scaleSlider.value, 10); applyControllerScale(); saveSettings(); });
    applyControllerScale();

    const controllerLayout = document.getElementById('controller-layout-select');
    controllerLayout.value = settings.controllerLayout || 'standard';
    const applyControllerLayout = () => {
      const controller = document.getElementById('controller');
      controller.classList.remove('layout-left-handed', 'layout-compact');
      if (controllerLayout.value === 'left-handed') controller.classList.add('layout-left-handed');
      if (controllerLayout.value === 'compact') controller.classList.add('layout-compact');
    };
    controllerLayout.addEventListener('change', () => { settings.controllerLayout = controllerLayout.value; applyControllerLayout(); saveSettings(); });
    applyControllerLayout();

    // Apply saved theme without removing the user's selected layout class.
    document.getElementById('controller').classList.add('theme-' + settings.theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('controller').classList.remove('theme-phantom', 'theme-neon', 'theme-crimson', 'theme-emerald');
        document.getElementById('controller').classList.add('theme-' + btn.dataset.theme);
        settings.theme = btn.dataset.theme;
        saveSettings();
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
        saveSettings();
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

    joysticks.push(new VirtualJoystick(
      document.getElementById('left-stick-zone'),
      document.getElementById('left-stick-thumb'),
      document.getElementById('left-stick-base'),
      'leftX', 'leftY'
    ));

    joysticks.push(new VirtualJoystick(
      document.getElementById('right-stick-zone'),
      document.getElementById('right-stick-thumb'),
      document.getElementById('right-stick-base'),
      'rightX', 'rightY'
    ));

    initSettings();
    initCustomLayout();

    // Start RAF-based send loop
    rafId = requestAnimationFrame(sendLoop);

    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) resetInputState(true);
    });

    // Lock landscape
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    // Register Service Worker for PWA support
    if ('serviceWorker' in navigator && location.hostname !== 'appassets.androidplatform.net') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Wake lock to prevent screen dimming during play
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
