// PhantomPad Dashboard v3 — Full Featured
(function () {
  'use strict';

  const socket = io({ transports: ['websocket', 'polling'] });
  socket.emit('register-dashboard');

  const traySetting = document.getElementById('tray-setting');
  const trayToggle = document.getElementById('tray-visualizer-toggle');
  if (window.phantompad?.isElectron && traySetting && trayToggle) {
    traySetting.hidden = false;
    window.phantompad.getTrayEnabled().then((enabled) => { trayToggle.checked = Boolean(enabled); });
    trayToggle.addEventListener('change', async () => {
      try {
        trayToggle.checked = await window.phantompad.setTrayEnabled(trayToggle.checked);
      } catch (error) {
        trayToggle.checked = !trayToggle.checked;
        console.error('Could not update tray visualizer preference:', error);
      }
    });
  }

  let allInterfaces = [];
  let activeTab = 0;
  let mappingsData = { presets: {}, custom: {}, vkNames: {}, vk: {} };
  let currentMapping = null;
  let currentMappingName = 'default';
  let editMode = false;
  let listeningKey = null; // which button we're listening for a keypress on

  const workspaceCopy = {
    play: {
      index: 'SESSION / 01',
      title: 'Play setup',
      description: 'Connect phones, choose the input mode, and check each player.'
    },
    customize: {
      index: 'SETUP / 02',
      title: 'Customize controls',
      description: 'Shape your keyboard mappings and record macros for your games.'
    }
  };

  document.querySelectorAll('[data-workspace-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const workspace = button.dataset.workspaceTarget;
      const copy = workspaceCopy[workspace];
      if (!copy) return;
      document.querySelectorAll('[data-workspace]').forEach((section) => {
        section.hidden = section.dataset.workspace !== workspace;
      });
      document.querySelectorAll('[data-workspace-target]').forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-pressed', String(selected));
      });
      document.getElementById('workspace-eyebrow').textContent = copy.index;
      document.getElementById('workspace-title').textContent = copy.title;
      document.getElementById('workspace-description').textContent = copy.description;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ============================================
  //  Server Info
  // ============================================
  async function loadInfo() {
    try {
      const info = await fetch('/api/info').then(r => r.json());
      allInterfaces = info.interfaces || [];
      document.getElementById('port-display').textContent = info.port;
      const pairing = await fetch('/api/pairing', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('Pairing code unavailable');
        return r.json();
      });
      document.getElementById('pairing-code').textContent = pairing.pairingCode;
      updateModeUI(info.mode, info.gamepadAvailable, info.gamepadError);
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
      const icon = document.createElement('span');
      icon.className = 'tab-icon';
      icon.textContent = iface.icon;
      const name = document.createElement('span');
      name.textContent = label;
      const type = document.createElement('span');
      type.className = 'tab-type';
      type.textContent = iface.type;
      tab.append(icon, name, type);
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
      document.getElementById('controller-url').textContent = qrData.url;
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

  document.getElementById('copy-pairing-code-btn').addEventListener('click', () => {
    const code = document.getElementById('pairing-code').textContent;
    navigator.clipboard.writeText(code).then(() => flashBtn('copy-pairing-code-btn'));
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
  function getControllerStatus(player) {
    const error = String(player.controllerError || 'details unavailable').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    return {
      waiting: ['Waiting for driver', 'controller-waiting'],
      connecting: [player.controllerStage || 'Creating virtual pad', 'controller-connecting'],
      ready: ['Virtual pad connected', 'controller-ready'],
      active: ['ViGEm accepted first input report', 'controller-active'],
      error: [`Virtual pad error: ${error}`, 'controller-error']
    }[player.controllerStatus] || ['Virtual pad status unknown', 'controller-waiting'];
  }

  socket.on('players-update', (players) => {
    const list = document.getElementById('controllers-list');
    const count = document.getElementById('controller-count');
    count.textContent = players.length;

    if (players.length === 0) {
      if (!list.querySelector('.empty-state')) list.innerHTML = '<div class="empty-state">No controllers connected</div>';
      updatePlayerVisualizers(players);
      return;
    }

    const desiredIds = players.map(p => encodeURIComponent(p.id));
    const currentIds = [...list.querySelectorAll('.player-card')].map(card => card.dataset.playerId);
    const structureChanged = desiredIds.length !== currentIds.length || desiredIds.some((id, index) => id !== currentIds[index]);
    if (structureChanged) {
      list.innerHTML = players.map(p => `
        <div class="player-card" data-player-id="${encodeURIComponent(p.id)}">
          <div class="player-info">
            <div class="player-avatar" style="background:${p.color}20;border:2px solid ${p.color};color:${p.color}">P${p.number}</div>
            <div class="player-details">
              <div class="player-name-row">
                <div class="player-name">Player ${p.number}</div>
                <span class="player-latency"></span>
              </div>
              <div class="controller-status"></div>
              <div class="player-id">${p.id.slice(0, 16)}...</div>
            </div>
          </div>
          <div class="player-actions">
            <button class="disconnect-controller-btn" data-controller-id="${encodeURIComponent(p.id)}" title="Disconnect this phone">Disconnect</button>
          </div>
        </div>`).join('');

      list.querySelectorAll('.disconnect-controller-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const player = players.find(p => encodeURIComponent(p.id) === button.dataset.controllerId);
          if (!player || !confirm(`Disconnect Player ${player.number}?`)) return;
          socket.emit('disconnect-controller', player.id);
        });
      });
    }

    players.forEach(p => {
      const card = [...list.querySelectorAll('.player-card')].find(element => element.dataset.playerId === encodeURIComponent(p.id));
      if (!card) return;
      const lat = Number.isFinite(p.latency) ? p.latency : null;
      const latency = card.querySelector('.player-latency');
      latency.textContent = lat === null ? 'Net RTT —' : `Net RTT ${lat} ms`;
      latency.className = 'player-latency ' + (lat === null ? '' : lat < 30 ? 'latency-good' : lat < 80 ? 'latency-ok' : 'latency-bad');
      const status = card.querySelector('.controller-status');
      const [statusText, statusClass] = getControllerStatus(p);
      status.textContent = statusText;
      status.className = `controller-status ${statusClass}`;
    });

    updatePlayerVisualizers(players);
  });

  socket.on('trusted-devices', (devices) => {
    const list = document.getElementById('trusted-devices-list');
    if (!list) return;
    list.replaceChildren();
    if (!Array.isArray(devices) || devices.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No Android phones remembered yet';
      list.appendChild(empty);
      return;
    }

    devices.forEach((device) => {
      if (!device || !/^[a-f0-9]{64}$/.test(device.deviceId || '')) return;
      const row = document.createElement('div');
      row.className = 'trusted-device-row';
      const details = document.createElement('div');
      details.className = 'trusted-device-details';
      const name = document.createElement('span');
      name.className = 'trusted-device-name';
      name.textContent = `Android phone · ${device.deviceId.slice(0, 8)}`;
      const expiry = document.createElement('span');
      expiry.className = 'trusted-device-expiry';
      expiry.textContent = `Trusted until ${new Date(device.expiresAt).toLocaleString()}`;
      details.append(name, expiry);

      const revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.className = 'trusted-device-revoke';
      revoke.textContent = 'Forget';
      revoke.title = 'Revoke this phone and disconnect it if connected';
      revoke.addEventListener('click', () => {
        if (confirm(`Forget Android phone ${device.deviceId.slice(0, 8)}? It will need the pairing code to connect again.`)) {
          socket.emit('revoke-trusted-device', device.deviceId);
        }
      });
      row.append(details, revoke);
      list.appendChild(row);
    });
  });

  // ============================================
  //  Mode Toggle
  // ============================================
  function updateModeUI(mode, gamepadAvailable, gamepadError) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('mode-' + mode);
    if (activeBtn) activeBtn.classList.add('active');

    const gpBtn = document.getElementById('mode-gamepad');
    const warning = document.getElementById('gamepad-warning');
    const warningMessage = document.getElementById('gamepad-warning-message');
    if (!gamepadAvailable) {
      if (warningMessage) warningMessage.textContent = gamepadError || 'ViGEmBus is unavailable. Install or repair it, then restart PhantomPad.';
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

  socket.on('status-update', (status) => updateModeUI(status.mode, status.gamepadAvailable, status.gamepadError));
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

    const fragment = document.createDocumentFragment();
    macros.forEach((macro) => {
      const name = String(macro.name || '');
      const item = document.createElement('div');
      item.className = 'macro-item';
      const info = document.createElement('div');
      info.className = 'macro-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'macro-item-name';
      nameEl.textContent = name;
      const meta = document.createElement('div');
      meta.className = 'macro-meta';
      const duration = Number.isFinite(macro.duration) ? Math.max(0, macro.duration) : 0;
      const steps = Number.isFinite(macro.steps) ? Math.max(0, macro.steps) : 0;
      meta.textContent = `${steps} steps · ${(duration / 1000).toFixed(1)}s`;
      info.append(nameEl, meta);

      const actions = document.createElement('div');
      actions.className = 'macro-actions';
      const play = document.createElement('button');
      play.className = 'macro-action-btn macro-play-btn';
      play.dataset.name = name;
      play.title = 'Play';
      play.textContent = '▶';
      const remove = document.createElement('button');
      remove.className = 'macro-action-btn delete';
      remove.dataset.name = name;
      remove.title = 'Delete';
      remove.textContent = '🗑';
      actions.append(play, remove);
      item.append(info, actions);
      fragment.appendChild(item);
    });
    list.replaceChildren(fragment);

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
  const inputVisualizers = document.getElementById('input-visualizers');
  const visualizerButtons = ['A', 'B', 'X', 'Y', 'lb', 'rb', 'lt', 'rt',
    'dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'back', 'home', 'start', 'ls', 'rs'];

  function updatePlayerVisualizers(players) {
    if (!inputVisualizers) return;
    const playerIds = new Set(players.map(player => String(player.id)));
    inputVisualizers.querySelectorAll('.player-visualizer').forEach((card) => {
      if (!playerIds.has(card.dataset.playerId)) card.remove();
    });

    if (!players.length) {
      inputVisualizers.innerHTML = '<div class="empty-state">Connect a controller to see its live input.</div>';
      return;
    }
    inputVisualizers.querySelector('.empty-state')?.remove();

    players.forEach((player) => {
      let card = [...inputVisualizers.querySelectorAll('.player-visualizer')]
        .find((item) => item.dataset.playerId === String(player.id));
      if (card && card.dataset.playerNumber !== String(player.number)) {
        card.remove();
        card = null;
      }
      if (card) return;

      card = document.createElement('article');
      card.className = 'player-visualizer';
      card.dataset.playerId = String(player.id);
      card.dataset.playerNumber = String(player.number);
      card.style.setProperty('--player-color', player.color || '#00e5ff');
      card.innerHTML = `
        <div class="player-visualizer-title"><span>Player ${player.number}</span><span class="visualizer-live">INPUT RECEIVED</span></div>
        <div class="vis-controller">
          <div class="vis-stick-box">
            <div class="vis-stick"><div class="vis-crosshair"></div><div class="vis-stick-dot" data-vis-stick="left"></div></div>
            <span class="vis-label">L Stick</span>
          </div>
          <div class="vis-buttons-grid">
            <div class="vis-row">${[['lb','LB'],['lt','LT'],['rt','RT'],['rb','RB']].map(([key,label]) => `<span class="vis-btn" data-vis-key="${key}">${label}</span>`).join('')}</div>
            <div class="vis-row">${[['dpadUp','▲'],['dpadLeft','◄'],['dpadRight','►'],['dpadDown','▼']].map(([key,label]) => `<span class="vis-btn" data-vis-key="${key}">${label}</span>`).join('')}</div>
            <div class="vis-row">${['Y','X','B','A'].map(key => `<span class="vis-btn vis-${key.toLowerCase()}" data-vis-key="${key}">${key}</span>`).join('')}</div>
            <div class="vis-row">${[['back','BK'],['home','HM'],['start','ST'],['ls','LS'],['rs','RS']].map(([key,label]) => `<span class="vis-btn small" data-vis-key="${key}">${label}</span>`).join('')}</div>
          </div>
          <div class="vis-stick-box">
            <div class="vis-stick"><div class="vis-crosshair"></div><div class="vis-stick-dot" data-vis-stick="right"></div></div>
            <span class="vis-label">R Stick</span>
          </div>
        </div>`;
      inputVisualizers.appendChild(card);
    });
    applyDashboardLayout(layoutSelect?.value || 'xbox');
  }

  socket.on('input-visualize', (data) => {
    const card = [...(inputVisualizers?.querySelectorAll('.player-visualizer') || [])]
      .find((item) => item.dataset.playerId === String(data.playerId));
    if (!card) return;
    if (data.buttons) {
      visualizerButtons.forEach(key => {
        const el = card.querySelector(`[data-vis-key="${key}"]`);
        if (el) el.classList.toggle('active', !!data.buttons[key]);
      });
    }
    if (data.triggers) {
      const ltEl = card.querySelector('[data-vis-key="lt"]');
      const rtEl = card.querySelector('[data-vis-key="rt"]');
      if (ltEl) ltEl.classList.toggle('active', data.triggers.lt > 0.3);
      if (rtEl) rtEl.classList.toggle('active', data.triggers.rt > 0.3);
    }
    if (data.axes) {
      updateStickDot(card.querySelector('[data-vis-stick="left"]'), data.axes.leftX || 0, data.axes.leftY || 0);
      updateStickDot(card.querySelector('[data-vis-stick="right"]'), data.axes.rightX || 0, data.axes.rightY || 0);
    }
  });

  function updateStickDot(dot, x, y) {
    if (!dot) return;
    const px = x * 30, py = y * 30;
    dot.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }

  // ============================================
  //  Toast Notifications
  // ============================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-hide'); }, 2500);
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
        Y: 'Y', X: 'X', B: 'B', A: 'A', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT',
        back: 'BK', start: 'ST', home: 'HM', ls: 'LS', rs: 'RS'
      },
      playstation: {
        Y: '△', X: '□', B: '○', A: '✕', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2',
        back: 'SH', start: 'OP', home: 'PS', ls: 'L3', rs: 'R3'
      },
      nintendo: {
        Y: 'X', X: 'Y', B: 'A', A: 'B', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR',
        back: '-', start: '+', home: 'HM', ls: 'LS', rs: 'RS'
      }
    };

    const map = labels[layout] || labels.xbox;
    document.querySelectorAll('.vis-btn[data-vis-key]').forEach((el) => {
      const key = el.dataset.visKey;
      if (map[key]) el.textContent = map[key];
      el.style.fontSize = layout === 'playstation' && ['Y', 'X', 'B', 'A'].includes(key) ? '18px' : '';
    });
  }

})();
