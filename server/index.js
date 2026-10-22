// PhantomPad Server v3 — Full Featured
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { InputHandler } = require('./input-handler');
const { createInputWatchdog } = require('./input-watchdog');
const { MacroHandler } = require('./macro-handler');
const { GameMonitor } = require('./game-monitor');
const config = require('./config');

const app = express();
app.use(express.json()); // Body parser (B12)
const httpServer = createServer(app);
const pairingCode = crypto.randomInt(0, 100_000_000).toString().padStart(8, '0');
const pairingAttempts = new Map();
const PAIRING_ATTEMPT_WINDOW_MS = 60_000;
const PAIRING_MAX_FAILED_ATTEMPTS = 5;
const PAIRING_LOCKOUT_MS = 60_000;

function isLoopbackAddress(address) {
  const normalized = String(address || '').toLowerCase();
  return normalized === '::1' || normalized === '127.0.0.1' || normalized === '::ffff:127.0.0.1';
}

function requireLocalDashboard(req, res, next) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    return res.status(403).send('The PhantomPad dashboard is available only on this PC.');
  }
  next();
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > 48 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function isValidInputPacket(data) {
  if (!isPlainObject(data)) return false;
  for (const group of ['buttons', 'axes', 'triggers']) {
    if (data[group] !== undefined && (!isPlainObject(data[group]) || Object.keys(data[group]).length > 64)) return false;
  }
  if (data.buttons && Object.entries(data.buttons).some(([key, value]) => key.length > 32 || typeof value !== 'boolean')) return false;
  if (data.axes && Object.entries(data.axes).some(([key, value]) =>
    !['leftX', 'leftY', 'rightX', 'rightY'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1
  )) return false;
  if (data.triggers && Object.entries(data.triggers).some(([key, value]) =>
    !['lt', 'rt'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1
  )) return false;
  return true;
}

const io = new Server(httpServer, {
  maxHttpBufferSize: 16 * 1024,
  cors: {
    origin: (origin, callback) => {
      // Allow localhost and local network connections
      const isAndroidBundledController = origin === 'https://appassets.androidplatform.net';
      const isLocalNetworkOrigin = origin && (
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('http://172.') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      );
      if (!origin || isAndroidBundledController || isLocalNetworkOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    }
  },
  pingInterval: 2000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

io.use((socket, next) => {
  if (isLoopbackAddress(socket.handshake.address)) {
    socket.data.role = 'dashboard';
    return next();
  }

  const now = Date.now();
  const address = String(socket.handshake.address || 'unknown').toLowerCase().replace(/^::ffff:/, '');
  const previousAttempt = pairingAttempts.get(address);
  if (previousAttempt?.blockedUntil > now) return next(new Error('Pairing code rate limited. Try again in 60 seconds.'));
  const suppliedCode = socket.handshake.auth?.pairingCode;
  const expected = Buffer.from(pairingCode, 'utf8');
  const supplied = typeof suppliedCode === 'string' ? Buffer.from(suppliedCode, 'utf8') : Buffer.alloc(0);
  if (supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)) {
    pairingAttempts.delete(address);
    socket.data.role = 'controller';
    return next();
  }

  const attempt = previousAttempt && now - previousAttempt.windowStarted < PAIRING_ATTEMPT_WINDOW_MS
    ? previousAttempt
    : { failedCodes: new Set(), windowStarted: now, blockedUntil: 0 };
  const failedCode = typeof suppliedCode === 'string' && suppliedCode.length <= 8 ? suppliedCode : '<invalid-code>';
  attempt.failedCodes.add(failedCode);
  if (attempt.failedCodes.size >= PAIRING_MAX_FAILED_ATTEMPTS) attempt.blockedUntil = now + PAIRING_LOCKOUT_MS;
  pairingAttempts.delete(address);
  pairingAttempts.set(address, attempt);
  if (pairingAttempts.size > 1024) {
    for (const [key, value] of pairingAttempts) {
      if (now - value.windowStarted > PAIRING_ATTEMPT_WINDOW_MS + PAIRING_LOCKOUT_MS) pairingAttempts.delete(key);
    }
    while (pairingAttempts.size > 1024) pairingAttempts.delete(pairingAttempts.keys().next().value);
  }
  next(new Error('Pairing code required or invalid'));
});

const PORT = config.port;
const inputHandler = new InputHandler(config);
inputHandler.onStatusChange = (status) => {
  io.emit('status-update', status);
  io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
};
const macroHandler = new MacroHandler(inputHandler);
const gameMonitor = new GameMonitor({ interval: 3000 });

// --- Persistent Storage ---
let DATA_DIR = path.join(__dirname, '..', 'data');
if (process.versions && process.versions.electron) {
  const { app: electronApp } = require('electron');
  DATA_DIR = path.join(electronApp.getPath('userData'), 'PhantomPadData');
}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MAPPINGS_FILE = path.join(DATA_DIR, 'custom-mappings.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const MACROS_FILE = path.join(DATA_DIR, 'macros.json');

let customMappings = {};
let profiles = {};
let activeGame = null;

gameMonitor.on('game-changed', (processName) => {
  activeGame = processName;
  console.log(`  🎮 Game Detected: ${processName}`);
  
  const presetKey = config.processMappings[processName];
  if (presetKey) {
    const mapping = config.keyMappings[presetKey] || customMappings[presetKey];
    if (mapping) {
      inputHandler.setGlobalMapping(mapping);
      io.emit('preset-changed', presetKey);
      io.emit('active-game-update', { name: processName, preset: presetKey });
      console.log(`  ✓ Auto-switched to preset: ${presetKey}`);
    }
  } else {
    io.emit('active-game-update', { name: processName, preset: 'manual' });
  }
});
gameMonitor.start();

// --- Data I/O (async with error logging) (B4, B7) ---
async function loadData() {
  try {
    const data = await fs.promises.readFile(MAPPINGS_FILE, 'utf8');
    customMappings = JSON.parse(data);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Failed to load custom mappings:', e.message);
  }
  
  try {
    const data = await fs.promises.readFile(PROFILES_FILE, 'utf8');
    profiles = JSON.parse(data);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Failed to load profiles:', e.message);
  }
  
  try {
    const data = await fs.promises.readFile(MACROS_FILE, 'utf8');
    const macros = JSON.parse(data);
    for (const m of macros) macroHandler.importMacro(m);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Failed to load macros:', e.message);
  }
}
loadData();

let saveMappingsTimer = null;
function saveMappings() {
  clearTimeout(saveMappingsTimer);
  saveMappingsTimer = setTimeout(async () => {
    try { await fs.promises.writeFile(MAPPINGS_FILE, JSON.stringify(customMappings, null, 2)); }
    catch (e) { console.warn('Failed to save mappings:', e.message); }
  }, 500);
}

let saveProfilesTimer = null;
function saveProfiles() {
  clearTimeout(saveProfilesTimer);
  saveProfilesTimer = setTimeout(async () => {
    try { await fs.promises.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2)); }
    catch (e) { console.warn('Failed to save profiles:', e.message); }
  }, 500);
}

let saveMacrosTimer = null;
function saveMacros() {
  clearTimeout(saveMacrosTimer);
  saveMacrosTimer = setTimeout(async () => {
    try {
      const list = macroHandler.getMacrosList().map(m => macroHandler.exportMacro(m.name)).filter(Boolean);
      await fs.promises.writeFile(MACROS_FILE, JSON.stringify(list, null, 2));
    } catch (e) { console.warn('Failed to save macros:', e.message); }
  }, 500);
}

// --- Network Interfaces ---
function getAllInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const n = name.toLowerCase();
        let type = 'network', icon = '🌐';
        if (n.includes('wi-fi') || n.includes('wifi') || n.includes('wlan')) { type = 'wifi'; icon = '📶'; }
        else if (n.includes('ethernet') || n.includes('eth')) { type = 'ethernet'; icon = '🔌'; }
        else if (n.includes('usb') || n.includes('rndis') || n.includes('tether') || n.includes('ncm')) { type = 'usb'; icon = '🔗'; }
        results.push({ name, ip: addr.address, type, icon, url: `http://${addr.address}:${currentPort}/controller` });
      }
    }
  }
  results.push({ name: 'USB via ADB', ip: '127.0.0.1', type: 'usb-adb', icon: '🔌', url: `http://127.0.0.1:${currentPort}/controller` });
  return results;
}

function getControllerUrl() {
  const ifaces = getAllInterfaces();
  const iface = ifaces.find((item) => item.type === 'wifi') || ifaces.find((item) => item.type !== 'usb-adb') || ifaces[0];
  const ip = iface?.ip || '127.0.0.1';
  return `http://${ip}:${currentPort}/controller?pairingCode=${encodeURIComponent(pairingCode)}`;
}

// --- Static Files ---
app.use('/controller', express.static(path.join(__dirname, '..', 'controller')));
app.use('/dashboard', requireLocalDashboard, express.static(path.join(__dirname, '..', 'dashboard')));
app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));
app.get('/', (req, res) => res.redirect('/dashboard'));

// --- API ---
app.get('/api/info', (req, res) => {
  res.json({ port: currentPort, interfaces: getAllInterfaces(), ...inputHandler.getStatus() });
});

app.get('/api/qr', requireLocalDashboard, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const ifaces = getAllInterfaces();
    const requestedIp = typeof req.query.ip === 'string' ? req.query.ip : null;
    const ip = requestedIp || ifaces.find(i => i.type === 'wifi')?.ip || ifaces[0]?.ip || '127.0.0.1';

    if (ip !== 'localhost' && net.isIP(ip) !== 4) {
      return res.status(400).send('Invalid IP address');
    }

    const url = `http://${ip}:${currentPort}/controller?pairingCode=${encodeURIComponent(pairingCode)}`;
    const qr = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#00e5ff', light: '#00000000' } });
    res.json({ qr, url, ip });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pairing', requireLocalDashboard, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ pairingCode });
});

app.get('/api/mappings', requireLocalDashboard, (req, res) => {
  res.json({
    presets: config.keyMappings,
    custom: customMappings,
    vkNames: config.VK_NAMES,
    vk: config.VK
  });
});

app.get('/api/profiles', requireLocalDashboard, (req, res) => res.json(profiles));
app.get('/api/macros', requireLocalDashboard, (req, res) => res.json(macroHandler.getMacrosList()));

// --- Socket.IO ---
io.on('connection', (socket) => {
  let lastInputTime = 0;
  const RATE_LIMIT_MS = 8; // ~125Hz max (B6)
  const inputWatchdog = createInputWatchdog(socket.id, inputHandler, 300);

  // ---- Controller registration ----
  socket.on('register-controller', () => {
    if (socket.data.role !== 'controller') return socket.disconnect(true);
    const player = inputHandler.addPlayer(socket.id);
    if (!player) { socket.emit('error-msg', 'Max 4 players'); return; }
    console.log(`  ✓ P${player.number} connected: ${socket.id}`);
    socket.emit('player-assigned', { number: player.number, color: player.color });
    if (activeGame) socket.emit('active-game-update', { name: activeGame, preset: config.processMappings[activeGame] || 'manual' });
    io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
  });

  // ---- Dashboard registration ----
  socket.on('register-dashboard', () => {
    if (socket.data.role !== 'dashboard') return socket.disconnect(true);
    socket.join('dashboard');
    socket.emit('players-update', inputHandler.getPlayersInfo());
    socket.emit('status-update', inputHandler.getStatus());
    socket.emit('mappings-data', {
      presets: config.keyMappings,
      custom: customMappings,
      vkNames: config.VK_NAMES,
      vk: config.VK
    });
    socket.emit('macros-update', macroHandler.getMacrosList());
  });

  // ---- Latency ping ----
  socket.on('ping-check', (ts) => {
    socket.emit('pong-check', ts);
  });

  socket.on('latency-report', (latency) => {
    const player = inputHandler.players.get(socket.id);
    if (!player || !Number.isFinite(latency)) return;
    player.latency = Math.max(0, Math.min(60000, Math.round(latency)));
    io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
  });

  socket.on('disconnect-controller', (controllerId) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof controllerId !== 'string') return;
    const target = io.sockets.sockets.get(controllerId);
    if (!target || !inputHandler.players.has(controllerId)) return;
    target.disconnect(true);
  });

  // ---- Controller input ----
  socket.on('input', (data) => {
    if (socket.data.role !== 'controller' || !inputHandler.players.has(socket.id)) return;
    // Rate limit (B6)
    const now = Date.now();
    if (now - lastInputTime < RATE_LIMIT_MS) return;
    lastInputTime = now;

    // Validation (B5)
    if (!isValidInputPacket(data)) return;

    inputHandler.handleInput(socket.id, data);
    if (inputHandler.players.has(socket.id)) inputWatchdog.refresh();
    if (macroHandler.recording) macroHandler.recordInput(data);
    io.to('dashboard').emit('input-visualize', { playerId: socket.id, ...data });
  });

  // ---- Mode switching ----
  socket.on('set-mode', (mode) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard')) return;
    const ok = inputHandler.setMode(mode);
    io.emit('status-update', inputHandler.getStatus());
    if (!ok) socket.emit('error-msg', 'Gamepad mode requires ViGEmBus driver');
  });

  // ---- Preset switching ----
  socket.on('set-preset', (preset) => {
    if (typeof preset !== 'string' || preset.length > 48) return;
    const mapping = Object.prototype.hasOwnProperty.call(config.keyMappings, preset)
      ? config.keyMappings[preset]
      : Object.prototype.hasOwnProperty.call(customMappings, preset) ? customMappings[preset] : null;
    if (mapping) {
      if (socket.data.role === 'controller' && inputHandler.players.has(socket.id)) {
        inputHandler.setPlayerMapping(socket.id, mapping);
      } else if (socket.data.role === 'dashboard' && socket.rooms.has('dashboard')) {
        inputHandler.setGlobalMapping(mapping);
      } else {
        return;
      }
      io.emit('preset-changed', preset);
    }
  });

  // ---- Custom mappings ----
  socket.on('save-mapping', (data) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || !isPlainObject(data)) return;
    const name = cleanName(data.name);
    if (!name || ['__proto__', 'constructor', 'prototype'].includes(name.toLowerCase()) || !isPlainObject(data.mapping)) return;
    customMappings[name] = data.mapping;
    saveMappings();
    io.emit('mappings-updated', { presets: config.keyMappings, custom: customMappings });
  });

  socket.on('set-mapping', (mapping) => {
    if (!isPlainObject(mapping) || socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard')) return;
    inputHandler.setGlobalMapping(mapping);
  });

  socket.on('delete-mapping', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(customMappings, name)) return;
    delete customMappings[name];
    saveMappings();
    io.emit('mappings-updated', { presets: config.keyMappings, custom: customMappings });
  });

  // ---- Profiles ----
  socket.on('save-profile', (data) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || !isPlainObject(data)) return;
    const name = cleanName(data.name);
    if (!name || ['__proto__', 'constructor', 'prototype'].includes(name.toLowerCase())) return;
    if (data.mapping !== undefined && !isPlainObject(data.mapping)) return;
    if (data.mode !== undefined && !['gamepad', 'keyboard'].includes(data.mode)) return;
    profiles[name] = { mapping: data.mapping, mode: data.mode, created: Date.now() };
    saveProfiles();
    io.emit('profiles-updated', profiles);
  });

  socket.on('load-profile', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string') return;
    const p = profiles[name];
    if (p) {
      if (p.mapping) inputHandler.setGlobalMapping(p.mapping);
      if (p.mode) { inputHandler.setMode(p.mode); io.emit('status-update', inputHandler.getStatus()); }
      socket.emit('profile-loaded', { name, ...p });
    }
  });

  socket.on('delete-profile', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string') return;
    delete profiles[name];
    saveProfiles();
    io.emit('profiles-updated', profiles);
  });

  // ---- Macros ----
  socket.on('macro-start-record', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard')) return;
    const safeName = cleanName(name) || `Macro_${Date.now()}`;
    const ok = macroHandler.startRecording(safeName);
    io.to('dashboard').emit('macro-recording', ok ? macroHandler.recording.name : null);
  });

  socket.on('macro-stop-record', () => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard')) return;
    const macro = macroHandler.stopRecording();
    saveMacros();
    io.to('dashboard').emit('macro-recording', null);
    io.to('dashboard').emit('macros-update', macroHandler.getMacrosList());
  });

  socket.on('macro-play', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string') return;
    macroHandler.playMacro(name, socket.id).then(() => {
      io.to('dashboard').emit('macro-playing', null);
    });
    io.to('dashboard').emit('macro-playing', name);
  });

  socket.on('macro-stop', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string') return;
    macroHandler.stopMacro(name);
    io.to('dashboard').emit('macro-playing', null);
  });

  socket.on('macro-delete', (name) => {
    if (socket.data.role !== 'dashboard' || !socket.rooms.has('dashboard') || typeof name !== 'string') return;
    macroHandler.deleteMacro(name);
    saveMacros();
    io.to('dashboard').emit('macros-update', macroHandler.getMacrosList());
  });

  // ---- Disconnect ----
  socket.on('disconnect', () => {
    inputWatchdog.stop();
    const info = inputHandler.getPlayerInfo(socket.id);
    if (info) {
      inputHandler.removePlayer(socket.id);
      console.log(`  ✗ P${info.number} disconnected: ${socket.id}`);
      io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
    }
  });
});

// --- Server Startup ---
let currentPort = PORT;

function tryListen() {
  httpServer.listen(currentPort, '0.0.0.0');
}

httpServer.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${currentPort} is already in use.`);
    const maxPort = PORT + 10;
    if (currentPort < maxPort) {
      currentPort++;
      console.log(`Trying next available port: ${currentPort}...`);
      tryListen();
    } else {
      if (process.versions && process.versions.electron) {
        const { dialog, app: electronApp } = require('electron');
        dialog.showErrorBox('PhantomPad — Port Error', `Could not find any available ports (tried ${PORT} to ${maxPort}).\n\nPlease close any background Node.js terminals or other PhantomPad instances.`);
        electronApp.quit();
      } else {
        process.exit(1);
      }
    }
  }
});

httpServer.on('listening', () => {
  module.exports.activePort = currentPort;
  const ifaces = getAllInterfaces();
  console.log('  ╔═══════════════════════════════════════════════════╗');
  console.log('  ║           ⚡ PhantomPad Server v1.2 ⚡            ║');
  console.log('  ╠═══════════════════════════════════════════════════╣');
  console.log(`  ║  Dashboard:  http://localhost:${currentPort.toString().padEnd(20)}║`);
  console.log(`  ║  Mode:       ${inputHandler.getMode().padEnd(37)}║`);
  console.log(`  ║  Players:    Up to 4 simultaneous                ║`);
  console.log('  ╠═══════════════════════════════════════════════════╣');
  for (const iface of ifaces) {
    const l = `  ║  ${iface.icon} ${iface.type.padEnd(10)} ${iface.url}`;
    console.log(l.padEnd(56) + '║');
  }
  console.log('  ╚═══════════════════════════════════════════════════╝\n');
});

tryListen();

// Export for Electron
module.exports = { app, httpServer, io, PORT, activePort: currentPort, getControllerUrl };

// --- Cleanup (B8) ---
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(sig => {
  process.on(sig, () => {
    inputHandler.cleanup();
    gameMonitor.cleanup();
    process.exit(0);
  });
});
