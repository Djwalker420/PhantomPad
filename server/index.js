// PhantomPad Server v3 — Full Featured
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const QRCode = require('qrcode');
const { InputHandler } = require('./input-handler');
const { MacroHandler } = require('./macro-handler');
const { GameMonitor } = require('./game-monitor');
const config = require('./config');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 2000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

const PORT = config.port;
const inputHandler = new InputHandler(config);
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

function loadData() {
  try { customMappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); } catch (e) { }
  try { profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); } catch (e) { }
  try {
    const macros = JSON.parse(fs.readFileSync(MACROS_FILE, 'utf8'));
    for (const m of macros) macroHandler.importMacro(m);
  } catch (e) { }
}
loadData();

function saveMappings() {
  try { fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(customMappings, null, 2)); } catch (e) { }
}
function saveProfiles() {
  try { fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2)); } catch (e) { }
}
function saveMacros() {
  try {
    const list = macroHandler.getMacrosList().map(m => macroHandler.exportMacro(m.name)).filter(Boolean);
    fs.writeFileSync(MACROS_FILE, JSON.stringify(list, null, 2));
  } catch (e) { }
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

// --- Static Files ---
app.use('/controller', express.static(path.join(__dirname, '..', 'controller')));
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));
app.use('/mobile', express.static(path.join(__dirname, '..', 'mobile')));
app.get('/', (req, res) => res.redirect('/dashboard'));

// --- API ---
app.get('/api/info', (req, res) => {
  res.json({ port: currentPort, interfaces: getAllInterfaces(), ...inputHandler.getStatus() });
});

app.get('/api/qr', async (req, res) => {
  try {
    const ifaces = getAllInterfaces();
    const ip = req.query.ip || ifaces.find(i => i.type === 'wifi')?.ip || ifaces[0]?.ip || '127.0.0.1';
    const url = `http://${ip}:${currentPort}/controller`;
    const qr = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#00e5ff', light: '#00000000' } });
    res.json({ qr, url, ip });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mappings', (req, res) => {
  res.json({
    presets: config.keyMappings,
    custom: customMappings,
    vkNames: config.VK_NAMES,
    vk: config.VK
  });
});

app.get('/api/profiles', (req, res) => res.json(profiles));
app.get('/api/macros', (req, res) => res.json(macroHandler.getMacrosList()));

// --- Socket.IO ---
io.on('connection', (socket) => {
  // ---- Controller registration ----
  socket.on('register-controller', () => {
    const player = inputHandler.addPlayer(socket.id);
    if (!player) { socket.emit('error-msg', 'Max 4 players'); return; }
    console.log(`  ✓ P${player.number} connected: ${socket.id}`);
    socket.emit('player-assigned', { number: player.number, color: player.color });
    if (activeGame) socket.emit('active-game-update', { name: activeGame, preset: config.processMappings[activeGame] || 'manual' });
    io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
  });

  // ---- Dashboard registration ----
  socket.on('register-dashboard', () => {
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

  // ---- Controller input ----
  socket.on('input', (data) => {
    inputHandler.handleInput(socket.id, data);
    // Record macro if active
    if (macroHandler.recording) macroHandler.recordInput(data);
    io.to('dashboard').emit('input-visualize', { playerId: socket.id, ...data });
  });

  // ---- Mouse/trackpad ----
  socket.on('mouse', (data) => {
    inputHandler.handleMouse(socket.id, data);
  });

  // ---- Mode switching ----
  socket.on('set-mode', (mode) => {
    const ok = inputHandler.setMode(mode);
    io.emit('status-update', inputHandler.getStatus());
    if (!ok) socket.emit('error-msg', 'Gamepad mode requires ViGEmBus driver');
  });

  // ---- Preset switching ----
  socket.on('set-preset', (preset) => {
    const mapping = config.keyMappings[preset] || customMappings[preset];
    if (mapping) {
      if (inputHandler.players.has(socket.id)) {
        inputHandler.setPlayerMapping(socket.id, mapping);
      } else {
        inputHandler.setGlobalMapping(mapping);
      }
      io.emit('preset-changed', preset);
    }
  });

  // ---- Custom mappings ----
  socket.on('save-mapping', (data) => {
    customMappings[data.name] = data.mapping;
    saveMappings();
    io.emit('mappings-updated', { presets: config.keyMappings, custom: customMappings });
  });

  socket.on('set-mapping', (mapping) => {
    inputHandler.setPlayerMapping(socket.id, mapping);
  });

  socket.on('delete-mapping', (name) => {
    delete customMappings[name];
    saveMappings();
    io.emit('mappings-updated', { presets: config.keyMappings, custom: customMappings });
  });

  // ---- Profiles ----
  socket.on('save-profile', (data) => {
    profiles[data.name] = { mapping: data.mapping, mode: data.mode, created: Date.now() };
    saveProfiles();
    io.emit('profiles-updated', profiles);
  });

  socket.on('load-profile', (name) => {
    const p = profiles[name];
    if (p) {
      if (p.mapping) inputHandler.setPlayerMapping(socket.id, p.mapping);
      if (p.mode) { inputHandler.setMode(p.mode); io.emit('status-update', inputHandler.getStatus()); }
      socket.emit('profile-loaded', { name, ...p });
    }
  });

  socket.on('delete-profile', (name) => {
    delete profiles[name];
    saveProfiles();
    io.emit('profiles-updated', profiles);
  });

  // ---- Macros ----
  socket.on('macro-start-record', (name) => {
    const ok = macroHandler.startRecording(name || `Macro_${Date.now()}`);
    io.to('dashboard').emit('macro-recording', ok ? macroHandler.recording.name : null);
  });

  socket.on('macro-stop-record', () => {
    const macro = macroHandler.stopRecording();
    saveMacros();
    io.to('dashboard').emit('macro-recording', null);
    io.to('dashboard').emit('macros-update', macroHandler.getMacrosList());
  });

  socket.on('macro-play', (name) => {
    macroHandler.playMacro(name, socket.id).then(() => {
      io.to('dashboard').emit('macro-playing', null);
    });
    io.to('dashboard').emit('macro-playing', name);
  });

  socket.on('macro-stop', (name) => {
    macroHandler.stopMacro(name);
    io.to('dashboard').emit('macro-playing', null);
  });

  socket.on('macro-delete', (name) => {
    macroHandler.deleteMacro(name);
    saveMacros();
    io.to('dashboard').emit('macros-update', macroHandler.getMacrosList());
  });

  // ---- Disconnect ----
  socket.on('disconnect', () => {
    const info = inputHandler.getPlayerInfo(socket.id);
    if (info) {
      inputHandler.removePlayer(socket.id);
      console.log(`  ✗ P${info.number} disconnected: ${socket.id}`);
      io.to('dashboard').emit('players-update', inputHandler.getPlayersInfo());
    }
  });
});

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
  module.exports.activePort = currentPort; // Update active port for Electron
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
module.exports = { app, httpServer, io, PORT, activePort: currentPort };

process.on('SIGINT', () => { inputHandler.cleanup(); process.exit(0); });
process.on('SIGTERM', () => { inputHandler.cleanup(); process.exit(0); });
