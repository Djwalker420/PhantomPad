// PhantomPad Dashboard v3 — Full Featured
(function () {
  'use strict';

  const socket = io({ transports: ['websocket', 'polling'] });
  socket.emit('register-dashboard');

  let allInterfaces = [];
  let activeTab = 0;
  let mappingsData = { presets: {}, custom: {}, vkNames: {}, vk: {} };
  let currentMapping = null;
  let currentMappingName = 'default';
  let editMode = false;
  let listeningKey = null; // which button we're listening for a keypress on

  // ============================================
  //  Server Info
  // ============================================
  async function loadInfo() {
    try {
      const info = await fetch('/api/info').then(r => r.json());
      allInterfaces = info.interfaces || [];
      document.getElementById('port-display').textContent = info.port;
      updateModeUI(info.mode, info.gamepadAvailable);
      buildConnectionTabs();
      if (allInterfaces.length > 0) selectTab(0);
    } catch (e) {
      console.error('Failed to load info:', e);
    }
  }
  loadInfo();

  // ============================================
  //  Connection Tabs
  // ============================================
  function buildConnectionTabs() {
    const container = document.getElementById('conn-tabs');
    container.innerHTML = '';
    allInterfaces.forEach((iface, i) => {
      const tab = document.createElement('button');
      tab.className = 'conn-tab' + (i === 0 ? ' active' : '');
      tab.dataset.index = i;
      let label = iface.name;
      if (iface.type === 'usb-adb') label = 'USB / ADB';
      else if (iface.type === 'usb') label = 'USB Tether';
      tab.innerHTML = `<span class="tab-icon">${iface.icon}</span><span>${label}</span><span class="tab-type">${iface.type}</span>`;
      tab.addEventListener('click', () => selectTab(i));
      container.appendChild(tab);
    });
  }

  async function selectTab(index) {
    activeTab = index;
    const iface = allInterfaces[index];
    if (!iface) return;
    document.querySelectorAll('.conn-tab').forEach((t, i) => t.classList.toggle('active', i === index));
    document.getElementById('controller-url').textContent = iface.url;
    document.getElementById('ip-display').textContent = iface.ip;
    document.getElementById('iface-display').textContent = iface.name;

    const instrEl = document.getElementById('conn-instructions');
    const instructions = {
      wifi: 'Connect your phone to the same WiFi network as this PC, then scan the QR code or open the URL:',
      usb: 'USB Tethering detected! Enable tethering on your phone, then open this URL in your phone\'s browser:',
      'usb-adb': 'For the lowest latency wired connection, use ADB port forwarding. Follow the steps below:',
      ethernet: 'Ethernet connection. Open the URL below on your phone (phone must be on same network):',
    };
    instrEl.textContent = instructions[iface.type] || 'Open the URL below in your phone\'s browser to connect:';

    document.getElementById('adb-help').classList.toggle('hidden', iface.type !== 'usb-adb');
    document.getElementById('usb-tether-help').classList.toggle('hidden', iface.type !== 'usb');

    try {
      const qrData = await fetch(`/api/qr?ip=${iface.ip}`).then(r => r.json());
      const qrImg = document.getElementById('qr-code');
      qrImg.src = qrData.qr;
      qrImg.onload = () => { document.getElementById('qr-loading').style.display = 'none'; };
    } catch (e) { console.error('QR error:', e); }
  }

  // ============================================
  //  Copy Buttons
  // ============================================
  document.getElementById('copy-url-btn').addEventListener('click', () => {
    const url = document.getElementById('controller-url').textContent;
    navigator.clipboard.writeText(url).then(() => flashBtn('copy-url-btn'));
  });

  const adbBtn = document.getElementById('copy-adb-btn');
  if (adbBtn) {
    adbBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('adb reverse tcp:3000 tcp:3000').then(() => flashBtn('copy-adb-btn'));
    });
  }

  function flashBtn(id) {
    const btn = document.getElementById(id);
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = '📋'; }, 1500);
  }

  // ============================================
  //  Players List
  // ============================================
  const playerLatencies = {};

  socket.on('players-update', (players) => {
    const list = document.getElementById('controllers-list');
    const count = document.getElementById('controller-count');
    count.textContent = players.length;

    if (players.length === 0) {
      list.innerHTML = '<div class="empty-state">No controllers connected</div>';
      return;
    }

    list.innerHTML = players.map(p => {
      const lat = playerLatencies[p.id];
      const latClass = !lat ? '' : lat < 30 ? 'latency-good' : lat < 80 ? 'latency-ok' : 'latency-bad';
      const latText = lat ? `${lat}ms` : '—';
      return `
        <div class="player-card">
          <div class="player-info">
            <div class="player-avatar" style="background:${p.color}20;border:2px solid ${p.color};color:${p.color}">P${p.number}</div>
            <div class="player-details">
              <div class="player-name">Player ${p.number}</div>
              <div class="player-id">${p.id.slice(0, 16)}...</div>
            </div>
          </div>
          <span class="player-latency ${latClass}">${latText}</span>
        </div>`;
    }).join('');
  });

  // ============================================
  //  Mode Toggle
  // ============================================
  function updateModeUI(mode, gamepadAvailable) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('mode-' + mode);
    if (activeBtn) activeBtn.classList.add('active');

    const gpBtn = document.getElementById('mode-gamepad');
    const warning = document.getElementById('gamepad-warning');
    if (!gamepadAvailable) {
      gpBtn.classList.add('disabled');
      warning.classList.remove('hidden');
    } else {
      gpBtn.classList.remove('disabled');
      warning.classList.add('hidden');
    }
  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled')) return;
      socket.emit('set-mode', btn.dataset.mode);
    });
  });

  socket.on('status-update', (status) => updateModeUI(status.mode, status.gamepadAvailable));
  socket.on('error-msg', (msg) => showToast(msg, 'danger'));

  // ============================================
  //  Presets (Quick Switch)
  // ============================================
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      socket.emit('set-preset', btn.dataset.preset);
    });
  });

  socket.on('preset-changed', (preset) => {
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.preset === preset);
    });
  });

  // ============================================
  //  Key Mapping Editor
  // ============================================
  const BUTTON_LABELS = {
    A: 'A Button', B: 'B Button', X: 'X Button', Y: 'Y Button',
    dpadUp: 'D-Pad ▲', dpadDown: 'D-Pad ▼', dpadLeft: 'D-Pad ◄', dpadRight: 'D-Pad ►',
    lb: 'Left Bumper', rb: 'Right Bumper', lt: 'Left Trigger', rt: 'Right Trigger',
    start: 'Start', back: 'Back', home: 'Home',
    ls: 'L-Stick Click', rs: 'R-Stick Click',
    axisLeftUp: 'L-Stick ↑', axisLeftDown: 'L-Stick ↓', axisLeftLeft: 'L-Stick ←', axisLeftRight: 'L-Stick →',
    axisRightUp: 'R-Stick ↑', axisRightDown: 'R-Stick ↓', axisRightLeft: 'R-Stick ←', axisRightRight: 'R-Stick →'
  };

  socket.on('mappings-data', (data) => {
    mappingsData = data;
    refreshMappingSelect();
    loadMapping('default');
  });

  socket.on('mappings-updated', (data) => {
    mappingsData.presets = data.presets || mappingsData.presets;
    mappingsData.custom = data.custom || {};
    refreshMappingSelect();
  });

  function refreshMappingSelect() {
    const presetGroup = document.getElementById('preset-optgroup');
    const customGroup = document.getElementById('custom-optgroup');
    presetGroup.innerHTML = '';
    customGroup.innerHTML = '';

    for (const name of Object.keys(mappingsData.presets)) {
      const opt = document.createElement('option');
      opt.value = `preset:${name}`;
      opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      presetGroup.appendChild(opt);
    }

    for (const name of Object.keys(mappingsData.custom)) {
      const opt = document.createElement('option');
      opt.value = `custom:${name}`;
      opt.textContent = name;
      customGroup.appendChild(opt);
    }

    // Also update quick-switch preset buttons to include custom ones
    const presetContainer = document.getElementById('preset-buttons');
    // Keep built-in buttons, add custom
    const existing = presetContainer.querySelectorAll('.preset-btn[data-custom]');
    existing.forEach(b => b.remove());
    for (const name of Object.keys(mappingsData.custom)) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.dataset.preset = name;
      btn.dataset.custom = 'true';
      btn.textContent = name;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        socket.emit('set-preset', name);
      });
      presetContainer.appendChild(btn);
    }
  }

  function loadMapping(name) {
    let mapping = null;
    if (mappingsData.presets[name]) {
      mapping = { ...mappingsData.presets[name] };
      currentMappingName = name;
    } else if (mappingsData.custom[name]) {
      mapping = { ...mappingsData.custom[name] };
      currentMappingName = name;
    }
    if (!mapping) return;
    currentMapping = mapping;
    renderMappingGrid();
  }

  function renderMappingGrid() {
    const grid = document.getElementById('mapping-grid');
    if (!currentMapping) { grid.innerHTML = '<div class="empty-state">Select a mapping to view</div>'; return; }

    grid.innerHTML = '';
    for (const [btn, vkCode] of Object.entries(currentMapping)) {
      const item = document.createElement('div');
      item.className = 'mapping-item';
      item.dataset.btn = btn;

      const keyName = mappingsData.vkNames[vkCode] || `0x${vkCode.toString(16).toUpperCase()}`;

      item.innerHTML = `
        <span class="mapping-btn-name">${BUTTON_LABELS[btn] || btn}</span>
        <span class="mapping-key-value">${keyName}</span>
      `;

      if (editMode) {
        item.addEventListener('click', () => startListening(item, btn));
      }

      grid.appendChild(item);
    }
  }

  function startListening(itemEl, btn) {
    if (!editMode) return;
    // Clear previous listener
    document.querySelectorAll('.mapping-item.listening').forEach(el => el.classList.remove('listening'));
    itemEl.classList.add('listening');
    itemEl.querySelector('.mapping-key-value').textContent = 'Press a key...';
    listeningKey = btn;
  }

  // Listen for key presses when in edit mode
  document.addEventListener('keydown', (e) => {
    if (!listeningKey || !editMode) return;
    e.preventDefault();

    // Map browser key codes to VK codes
    const vkCode = browserKeyToVK(e.code, e.keyCode);
    if (vkCode !== null) {
      currentMapping[listeningKey] = vkCode;
      const keyName = mappingsData.vkNames[vkCode] || e.code;

      const item = document.querySelector(`.mapping-item[data-btn="${listeningKey}"]`);
      if (item) {
        item.classList.remove('listening');
        item.querySelector('.mapping-key-value').textContent = keyName;
      }
      listeningKey = null;
    }
  });

  function browserKeyToVK(code, keyCode) {
    // Common browser keyCode → Windows VK mapping
    const map = {
      'Backspace': 0x08, 'Tab': 0x09, 'Enter': 0x0D, 'ShiftLeft': 0x10, 'ShiftRight': 0x10,
      'ControlLeft': 0x11, 'ControlRight': 0x11, 'AltLeft': 0x12, 'AltRight': 0x12,
      'Escape': 0x1B, 'Space': 0x20,
      'ArrowLeft': 0x25, 'ArrowUp': 0x26, 'ArrowRight': 0x27, 'ArrowDown': 0x28,
      'Digit0': 0x30, 'Digit1': 0x31, 'Digit2': 0x32, 'Digit3': 0x33,
      'Digit4': 0x34, 'Digit5': 0x35, 'Digit6': 0x36, 'Digit7': 0x37,
      'Digit8': 0x38, 'Digit9': 0x39,
      'KeyA': 0x41, 'KeyB': 0x42, 'KeyC': 0x43, 'KeyD': 0x44,
      'KeyE': 0x45, 'KeyF': 0x46, 'KeyG': 0x47, 'KeyH': 0x48,
      'KeyI': 0x49, 'KeyJ': 0x4A, 'KeyK': 0x4B, 'KeyL': 0x4C,
      'KeyM': 0x4D, 'KeyN': 0x4E, 'KeyO': 0x4F, 'KeyP': 0x50,
      'KeyQ': 0x51, 'KeyR': 0x52, 'KeyS': 0x53, 'KeyT': 0x54,
      'KeyU': 0x55, 'KeyV': 0x56, 'KeyW': 0x57, 'KeyX': 0x58,
      'KeyY': 0x59, 'KeyZ': 0x5A,
      'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
      'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B
    };
    return map[code] !== undefined ? map[code] : (keyCode >= 0x08 ? keyCode : null);
  }

  // Editor toolbar buttons
  document.getElementById('mapping-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const [type, name] = val.split(':');
    if (type === 'preset') loadMapping(name);
    else if (type === 'custom') { currentMappingName = name; currentMapping = { ...mappingsData.custom[name] }; renderMappingGrid(); }
  });

  document.getElementById('edit-mapping-btn').addEventListener('click', () => {
    editMode = !editMode;
    const btn = document.getElementById('edit-mapping-btn');
    btn.textContent = editMode ? '✅ Done' : '✏️ Edit';
    btn.classList.toggle('primary', editMode);
    if (!editMode && currentMapping) {
      // Apply the mapping
      socket.emit('set-mapping', currentMapping);
    }
    renderMappingGrid();
  });

  document.getElementById('new-mapping-btn').addEventListener('click', () => {
    // Start with copy of current mapping
    editMode = true;
    document.getElementById('edit-mapping-btn').textContent = '✅ Done';
    document.getElementById('edit-mapping-btn').classList.add('primary');
    showSaveModal();
  });

  document.getElementById('delete-mapping-btn').addEventListener('click', () => {
    const select = document.getElementById('mapping-select');
    const val = select.value;
    if (val.startsWith('preset:')) { showToast('Cannot delete built-in presets', 'warning'); return; }
    const name = val.split(':')[1];
    if (confirm(`Delete custom mapping "${name}"?`)) {
      socket.emit('delete-mapping', name);
      loadMapping('default');
    }
  });

  // Export/Import
  document.getElementById('export-mapping-btn').addEventListener('click', () => {
    if (!currentMapping) return;
    const data = JSON.stringify({ name: currentMappingName, mapping: currentMapping }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `phantompad-mapping-${currentMappingName}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Mapping exported!', 'success');
  });

  document.getElementById('import-mapping-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.mapping) {
          socket.emit('save-mapping', { name: data.name || file.name.replace('.json', ''), mapping: data.mapping });
          showToast('Mapping imported!', 'success');
        }
      } catch (err) { showToast('Invalid mapping file', 'danger'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Save Modal
  function showSaveModal() {
    document.getElementById('save-modal').classList.add('active');
    document.getElementById('mapping-name-input').value = '';
    document.getElementById('mapping-name-input').focus();
  }

  document.getElementById('save-cancel-btn').addEventListener('click', () => {
    document.getElementById('save-modal').classList.remove('active');
  });

  document.getElementById('save-confirm-btn').addEventListener('click', () => {
    const name = document.getElementById('mapping-name-input').value.trim();
    if (!name) { showToast('Please enter a name', 'warning'); return; }
    socket.emit('save-mapping', { name, mapping: currentMapping });
    currentMappingName = name;
    document.getElementById('save-modal').classList.remove('active');
    showToast(`Mapping "${name}" saved!`, 'success');
  });

  document.getElementById('save-modal').addEventListener('click', (e) => {
    if (e.target.id === 'save-modal') document.getElementById('save-modal').classList.remove('active');
  });

  // ============================================
  //  Macros
  // ============================================
  socket.on('macros-update', (macros) => {
    renderMacroList(macros);
  });

  socket.on('macro-recording', (name) => {
    const status = document.getElementById('recording-status');
    const recordBtn = document.getElementById('macro-record-btn');
    const stopBtn = document.getElementById('macro-stop-btn');

    if (name) {
      status.classList.remove('hidden');
      document.getElementById('recording-name').textContent = name;
      recordBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      status.classList.add('hidden');
      recordBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  });

  socket.on('macro-playing', (name) => {
    document.querySelectorAll('.macro-play-btn').forEach(btn => {
      btn.textContent = btn.dataset.name === name ? '⏹' : '▶';
    });
  });

  document.getElementById('macro-record-btn').addEventListener('click', () => {
    const name = document.getElementById('macro-name').value.trim() || `Macro_${Date.now()}`;
    socket.emit('macro-start-record', name);
  });

  document.getElementById('macro-stop-btn').addEventListener('click', () => {
    socket.emit('macro-stop-record');
  });

  function renderMacroList(macros) {
    const list = document.getElementById('macro-list');
    if (!macros || macros.length === 0) {
      list.innerHTML = '<div class="empty-state">No macros recorded yet. Record button sequences and replay them!</div>';
      return;
    }

    list.innerHTML = macros.map(m => `
      <div class="macro-item">
        <div class="macro-info">
          <div class="macro-item-name">${m.name}</div>
          <div class="macro-meta">${m.steps} steps · ${(m.duration / 1000).toFixed(1)}s</div>
        </div>
        <div class="macro-actions">
          <button class="macro-action-btn macro-play-btn" data-name="${m.name}" title="Play">▶</button>
          <button class="macro-action-btn delete" data-name="${m.name}" title="Delete">🗑</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.macro-play-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.textContent === '⏹') socket.emit('macro-stop', btn.dataset.name);
        else socket.emit('macro-play', btn.dataset.name);
      });
    });

    list.querySelectorAll('.macro-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Delete macro "${btn.dataset.name}"?`)) socket.emit('macro-delete', btn.dataset.name);
      });
    });
  }

  // ============================================
  //  Input Visualizer
  // ============================================
  const visBtns = ['A', 'B', 'X', 'Y', 'lb', 'rb', 'lt', 'rt',
    'dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'back', 'start', 'home', 'ls', 'rs'];

  socket.on('input-visualize', (data) => {
    if (data.buttons) {
      visBtns.forEach(key => {
        const el = document.getElementById('vis-' + key);
        if (el) el.classList.toggle('active', !!data.buttons[key]);
      });
    }
    if (data.triggers) {
      const ltEl = document.getElementById('vis-lt');
      const rtEl = document.getElementById('vis-rt');
      if (ltEl) ltEl.classList.toggle('active', data.triggers.lt > 0.3);
      if (rtEl) rtEl.classList.toggle('active', data.triggers.rt > 0.3);
    }
    if (data.axes) {
      updateStickDot('vis-ls-dot', data.axes.leftX || 0, data.axes.leftY || 0);
      updateStickDot('vis-rs-dot', data.axes.rightX || 0, data.axes.rightY || 0);
    }
  });

  function updateStickDot(id, x, y) {
    const dot = document.getElementById(id);
    if (!dot) return;
    const px = x * 30, py = y * 30;
    dot.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }

  // ============================================
  //  Toast Notifications
  // ============================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      padding: 14px 22px; border-radius: 12px; font-size: 13px; font-weight: 600;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      animation: slideIn 0.3s ease; max-width: 360px;
      font-family: 'Inter', sans-serif;
    `;
    const colors = {
      success: { bg: 'rgba(0,230,118,0.15)', border: 'rgba(0,230,118,0.3)', color: '#00e676' },
      danger: { bg: 'rgba(255,23,68,0.15)', border: 'rgba(255,23,68,0.3)', color: '#ff1744' },
      warning: { bg: 'rgba(255,171,0,0.15)', border: 'rgba(255,171,0,0.3)', color: '#ffab00' },
      info: { bg: 'rgba(0,229,255,0.15)', border: 'rgba(0,229,255,0.3)', color: '#00e5ff' }
    };
    const c = colors[type] || colors.info;
    toast.style.background = c.bg;
    toast.style.border = `1px solid ${c.border}`;
    toast.style.color = c.color;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => toast.remove(), 2800);
  }

  // ============================================
  //  Dashboard Controller Visuals
  // ============================================
  const layoutSelect = document.getElementById('dashboard-layout-select');
  if (layoutSelect) {
    layoutSelect.addEventListener('change', (e) => applyDashboardLayout(e.target.value));
  }

  function applyDashboardLayout(layout) {
    const labels = {
      xbox: {
        'vis-Y': 'Y', 'vis-X': 'X', 'vis-B': 'B', 'vis-A': 'A',
        'vis-lb': 'LB', 'vis-rb': 'RB', 'vis-lt': 'LT', 'vis-rt': 'RT',
        'vis-back': 'BK', 'vis-start': 'ST', 'vis-home': 'HM',
        'vis-ls': 'LS', 'vis-rs': 'RS'
      },
      playstation: {
        'vis-Y': '△', 'vis-X': '□', 'vis-B': '○', 'vis-A': '✕',
        'vis-lb': 'L1', 'vis-rb': 'R1', 'vis-lt': 'L2', 'vis-rt': 'R2',
        'vis-back': 'SH', 'vis-start': 'OP', 'vis-home': 'PS',
        'vis-ls': 'L3', 'vis-rs': 'R3'
      },
      nintendo: {
        'vis-Y': 'X', 'vis-X': 'Y', 'vis-B': 'A', 'vis-A': 'B',
        'vis-lb': 'L', 'vis-rb': 'R', 'vis-lt': 'ZL', 'vis-rt': 'ZR',
        'vis-back': '-', 'vis-start': '+', 'vis-home': 'HM',
        'vis-ls': 'LS', 'vis-rs': 'RS'
      }
    };

    const map = labels[layout] || labels.xbox;
    for (const [id, text] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = text;
        if (layout === 'playstation' && ['vis-Y','vis-X','vis-B','vis-A'].includes(id)) {
          el.style.fontSize = '18px';
        } else {
          el.style.fontSize = '';
        }
      }
    }
  }

})();
