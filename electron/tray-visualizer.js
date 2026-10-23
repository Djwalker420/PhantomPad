'use strict';

const playersElement = document.getElementById('players');
const hostState = document.getElementById('host-state');
const modeElement = document.getElementById('mode');
const labels = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'BACK', 'START', '↑', '↓', '←', '→'];

function setStick(element, x, y) {
  const dot = element.querySelector('i');
  const left = Math.max(0, Math.min(100, (Number(x) || 0) * 42 + 50));
  const top = Math.max(0, Math.min(100, (Number(y) || 0) * 42 + 50));
  dot.style.left = `${left}%`;
  dot.style.top = `${top}%`;
}

function createPlayer(player) {
  const card = document.createElement('article');
  card.className = 'player';
  card.style.setProperty('--player-color', player.color || '#00f5d4');
  const head = document.createElement('div');
  head.className = 'player-head';
  const dot = document.createElement('span'); dot.className = 'player-dot';
  const name = document.createElement('strong'); name.className = 'player-title'; name.textContent = `Player ${player.number}`;
  const latency = document.createElement('span'); latency.className = 'latency';
  const state = document.createElement('span'); state.className = 'state';
  head.append(dot, name, latency, state);
  const row = document.createElement('div'); row.className = 'input-row';
  const stick = document.createElement('div'); stick.className = 'stick'; stick.title = 'Left stick'; stick.setAttribute('aria-label', 'Left stick position');
  const stickDot = document.createElement('i'); stick.append(stickDot);
  const rightStick = document.createElement('div'); rightStick.className = 'stick'; rightStick.title = 'Right stick'; rightStick.setAttribute('aria-label', 'Right stick position');
  const rightStickDot = document.createElement('i'); rightStick.append(rightStickDot);
  const buttons = document.createElement('div'); buttons.className = 'buttons';
  row.append(stick, rightStick, buttons); card.append(head, row);
  card.update = () => {
    latency.textContent = Number.isFinite(player.latency) ? `RTT ${player.latency} ms` : 'RTT —';
    const ready = player.controllerStatus === 'ready' || player.controllerStatus === 'active';
    state.textContent = player.controllerStatus === 'active' ? 'Input active' : ready ? 'Virtual pad ready' : player.controllerStatus || 'waiting';
    state.classList.toggle('ready', ready);
    const input = player.input || {};
    const axes = input.axes || {};
    setStick(stick, axes.leftX, axes.leftY);
    setStick(rightStick, axes.rightX, axes.rightY);
    const active = new Set();
    const inputButtons = input.buttons || {};
    const map = { A: 'A', B: 'B', X: 'X', Y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', ls: 'LS', rs: 'RS', back: 'BACK', start: 'START', dpadUp: '↑', dpadDown: '↓', dpadLeft: '←', dpadRight: '→' };
    for (const [key, label] of Object.entries(map)) if (inputButtons[key]) active.add(label);
    const triggers = input.triggers || {};
    if (triggers.lt > 0.15) active.add('LT');
    if (triggers.rt > 0.15) active.add('RT');
    buttons.replaceChildren();
    if (!active.size) {
      const idle = document.createElement('span'); idle.className = 'button'; idle.textContent = '—'; buttons.append(idle);
    } else {
      for (const label of labels) if (active.has(label)) {
        const element = document.createElement('span'); element.className = 'button on'; element.textContent = label; buttons.append(element);
      }
    }
  };
  card.update();
  return card;
}

async function refresh() {
  if (!window.phantompad?.getTrayStatus) return;
  try {
    const status = await window.phantompad.getTrayStatus();
    const active = status.gamepadAvailable;
    hostState.textContent = active ? 'Windows input bridge ready' : (status.gamepadError || 'Windows input bridge unavailable');
    modeElement.textContent = String(status.mode || 'gamepad').toUpperCase();
    playersElement.replaceChildren();
    if (!status.players?.length) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'Waiting for a phone to connect';
      playersElement.append(empty);
      return;
    }
    for (const player of status.players) playersElement.append(createPlayer(player));
  } catch (error) {
    hostState.textContent = 'Live status unavailable';
  }
}

document.getElementById('close').addEventListener('click', () => window.phantompad?.hideTrayVisualizer());
document.getElementById('dashboard').addEventListener('click', () => window.phantompad?.openDashboard());
window.addEventListener('blur', () => window.phantompad?.hideTrayVisualizer());
refresh();
setInterval(refresh, 500);
