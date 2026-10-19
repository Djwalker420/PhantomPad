/**
 * PhantomPad - Input Handler v2
 * Multi-player Keyboard & Gamepad modes
 *
 * ARCHITECTURE & CROSS-PLATFORM EXTENSION GUIDE:
 * -----------------------------------------------------------------------------
 * Currently, input simulation relies on Windows user32.dll via PowerShell and 
 * ViGEmClient for virtual Xbox controller emulation.
 *
 * To extend PhantomPad input emulation for non-Windows operating systems:
 *
 * 1. Linux Support (via uinput / evdev):
 *    - Virtual Gamepad: Use the Linux kernel `uinput` module (e.g., via node-uinput
 *      or writing to `/dev/uinput`) to register input devices supporting EV_KEY,
 *      EV_ABS (joystick axes), and EV_SYN.
 *    - Virtual Keyboard: Emit `uinput` key events. Requires appropriate
 *      permission (uaccess rule or input group access to `/dev/uinput`).
 *
 * 2. macOS Support (via CoreGraphics / CGEvent):
 *    - Virtual Keyboard: Use macOS CoreGraphics keyboard events through a native
 *      addon or supported automation library. Requires Accessibility permission.
 *    - Virtual Gamepad: macOS does not natively provide a simple userspace virtual 
 *      gamepad API like ViGEm, but virtual gamepads can be created using DriverKit 
 *      or IOUSBHostDevice extensions, or by utilizing Foohid driver bindings.
 *
 * 3. Abstraction Pattern:
 *    - Abstract platform-specific logic into an `InputDriver` interface:
 *        interface InputDriver {
 *          init(): Promise<void>;
 *          sendKeyEvent(code, isDown): void;
 *          sendGamepadState(playerIndex, state): void;
 *        }
 *    - Detect `process.platform` ('win32', 'linux', 'darwin') in constructor/factory
 *      to instantiate the appropriate driver backend.
 * -----------------------------------------------------------------------------
 */
const { spawn } = require('child_process');
const path = require('path');
const config = require('./config');

const sanitizeNumber = (val, min, max) => {
  const n = Number(val);
  return (Number.isFinite(n)) ? Math.max(min, Math.min(max, n)) : 0;
};

class InputHandler {
  constructor(cfg) {
    this.mode = cfg.defaultMode || 'keyboard';
    this.players = new Map();
    this.maxPlayers = 4;
    this.ps = null;
    this.gamepadAvailable = false;
    this.gamepadError = 'Checking ViGEmBus availability';
    this.onStatusChange = null;
    this.keyboardAvailable = false;

    this._initEmulation();
  }

  _initEmulation() {
    try {
      this.ps = spawn('powershell', ['-NoProfile', '-NoLogo', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const packagedDllPath = process.versions.electron && require('electron').app?.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'lib', 'Nefarius.ViGEm.Client.dll')
        : path.join(__dirname, 'lib', 'Nefarius.ViGEm.Client.dll');
      const psDllPath = packagedDllPath.replace(/'/g, "''");
      const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KBSim {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
}
"@

try {
    Add-Type -Path '${psDllPath}'
    $global:vigemClient = New-Object Nefarius.ViGEm.Client.ViGEmClient
    $global:xctrls = @{}
    $global:inputAck = @{}
    $global:inputFailureReported = @{}
    $global:XA = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Axis]
    $global:XS = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Slider]
    $global:XB = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Button]
    $probe = $global:vigemClient.CreateXbox360Controller()
    $probe.Connect()
    $probe.Disconnect()
    $probe.Dispose()
    Write-Host "VIGEM_READY"
} catch {
    Write-Host "VIGEM_FAILED: $_"
}
Write-Host "KB_READY"
`;
      this.ps.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('VIGEM_READY')) {
          this.gamepadAvailable = true;
          this.gamepadError = null;
          console.log('  ✓ ViGEm bus and virtual Xbox controller connection verified');
          for (const player of this.players.values()) this._createPlayerController(player);
          this.onStatusChange?.(this.getStatus());
        }
        const playerReady = output.match(/VIGEM_PLAYER_READY\[(\d+)\]/);
        if (playerReady) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(playerReady[1]));
          if (player) {
            player.hasController = true;
            player.controllerStatus = 'ready';
            player.controllerError = null;
            console.log(`  ✓ ViGEm controller ready for player ${player.number}`);
            this._notifyStatusChange();
          }
        }
        const playerFailure = output.match(/VIGEM_PLAYER_FAILED\[(\d+)\]:\s*([^\r\n]+)/);
        if (playerFailure) {
          const failedNumber = Number(playerFailure[1]);
          const player = [...this.players.values()].find((entry) => entry.number === failedNumber);
          if (player) {
            player.hasController = false;
            player.controllerStatus = 'error';
            player.controllerError = playerFailure[2];
            this._notifyStatusChange();
          }
          console.error(`  ✗ ViGEm could not create player ${failedNumber}:`, playerFailure[2]);
        }
        const inputReported = output.match(/VIGEM_INPUT_REPORT\[(\d+)\]/);
        if (inputReported) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(inputReported[1]));
          if (player) {
            player.controllerStatus = 'active';
            player.controllerError = null;
            console.log(`  ✓ ViGEm accepted an input report for player ${player.number}`);
            this._notifyStatusChange();
          }
        }
        const inputFailure = output.match(/VIGEM_INPUT_FAILED\[(\d+)\]:\s*([^\r\n]+)/);
        if (inputFailure) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(inputFailure[1]));
          if (player) {
            player.controllerStatus = 'error';
            player.controllerError = inputFailure[2];
            this._notifyStatusChange();
          }
          console.error(`  ✗ ViGEm input report failed for player ${inputFailure[1]}:`, inputFailure[2]);
        }
        const failure = output.match(/VIGEM_FAILED:\s*([^\r\n]+)/);
        if (failure) {
          this.gamepadAvailable = false;
          this.gamepadError = failure[1];
          console.error('  ✗ ViGEm initialization failed:', failure[1]);
          this.onStatusChange?.(this.getStatus());
        }
      });
      this.ps.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) console.error('  ✗ PowerShell input bridge:', message);
      });
      this.ps.on('error', (error) => {
        this.gamepadAvailable = false;
        this.gamepadError = error.message;
        this.keyboardAvailable = false;
        console.error('  ✗ PowerShell input bridge failed:', error.message);
        this.onStatusChange?.(this.getStatus());
      });
      this.ps.stdin.write(psScript + '\n');
      
      // Gamepad availability is set only after the ViGEm client assembly loads.
      this.keyboardAvailable = true;
      console.log('  ✓ Input simulation bridge initialized (Keyboard)');
    } catch (e) {
      this.keyboardAvailable = false;
      this.gamepadAvailable = false;
      console.log('  ✗ Input simulation failed:', e.message);
    }
  }

  // --- Player Management ---
  addPlayer(socketId) {
    // A repeated registration from the same live socket must not allocate a second controller.
    const existing = this.players.get(socketId);
    if (existing) return existing;
    if (this.players.size >= this.maxPlayers) return null;
    const num = this._nextPlayerNum();
    const colors = ['#00e5ff', '#ff1744', '#00e676', '#ffd600'];
    const player = {
      id: socketId, number: num,
      color: colors[num - 1] || colors[0],
      latency: null,
      pressedKeys: new Set(),
      keyMapping: { ...config.keyMappings[config.defaultPreset || 'default'] },
      hasController: false,
      controllerRequested: false,
      controllerStatus: this.gamepadAvailable ? 'connecting' : 'waiting',
      controllerError: null
    };
    this.players.set(socketId, player);
    this._createPlayerController(player);
    return player;
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    this._releasePlayerInput(p);
    
    if (p.controllerRequested && this.ps && this.ps.stdin.writable) {
      this.ps.stdin.write(`
        try {
          $c = $global:xctrls[${p.number}]
          if ($c) { $c.Disconnect(); $global:xctrls.Remove(${p.number}) }
        } catch { }
      \n`);
    }
    
    this.players.delete(socketId);
  }

  _nextPlayerNum() {
    const used = new Set([...this.players.values()].map(p => p.number));
    for (let i = 1; i <= this.maxPlayers; i++) { if (!used.has(i)) return i; }
    return this.players.size + 1;
  }

  getPlayerInfo(socketId) {
    const p = this.players.get(socketId);
    return p ? { number: p.number, color: p.color } : null;
  }

  getPlayersInfo() {
    return [...this.players.values()].map(p => ({
      id: p.id, number: p.number, color: p.color, latency: p.latency,
      controllerStatus: p.controllerStatus, controllerError: p.controllerError
    }));
  }

  _notifyStatusChange() {
    this.onStatusChange?.(this.getStatus());
  }

  _createPlayerController(player) {
    if (!player || player.controllerRequested) return false;
    if (!this.gamepadAvailable) {
      player.controllerStatus = 'waiting';
      return false;
    }
    if (!this.ps?.stdin?.writable) {
      player.controllerStatus = 'error';
      player.controllerError = 'Windows input bridge is not writable';
      this._notifyStatusChange();
      return false;
    }
    player.controllerRequested = true;
    player.controllerStatus = 'connecting';
    player.controllerError = null;
    const number = player.number;
    this.ps.stdin.write(`
try {
  $global:inputAck.Remove(${number})
  $global:inputFailureReported.Remove(${number})
  $c = $global:vigemClient.CreateXbox360Controller()
  $c.AutoSubmitReport = $false
  $c.Connect()
  $global:xctrls[${number}] = $c
  Write-Host "VIGEM_PLAYER_READY[${number}]"
} catch {
  Write-Host "VIGEM_PLAYER_FAILED[${number}]: $_"
}
`);
    return true;
  }

  // --- Input Handling ---
  handleInput(socketId, data) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (this.mode === 'gamepad') {
      if (player.hasController) this._handleGamepadInput(player, data);
      return;
    }
    if (this.keyboardAvailable) {
      this._handleKeyboardInput(player, data);
    }
  }

  _handleGamepadInput(player, data) {
    if (!this.ps || !this.ps.stdin.writable) return;
    const pid = player.number;
    let cmds = `$c = $global:xctrls[${pid}]; if($c) { try { `;
    
    if (data.axes) {
      if (data.axes.leftX !== undefined) {
         const val = sanitizeNumber(data.axes.leftX * 32767, -32768, 32767);
         cmds += `$c.SetAxisValue($global:XA::LeftThumbX, [int16]${Math.round(val)}); `;
      }
      if (data.axes.leftY !== undefined) {
         const val = sanitizeNumber(-data.axes.leftY * 32767, -32768, 32767);
         cmds += `$c.SetAxisValue($global:XA::LeftThumbY, [int16]${Math.round(val)}); `;
      }
      if (data.axes.rightX !== undefined) {
         const val = sanitizeNumber(data.axes.rightX * 32767, -32768, 32767);
         cmds += `$c.SetAxisValue($global:XA::RightThumbX, [int16]${Math.round(val)}); `;
      }
      if (data.axes.rightY !== undefined) {
         const val = sanitizeNumber(-data.axes.rightY * 32767, -32768, 32767);
         cmds += `$c.SetAxisValue($global:XA::RightThumbY, [int16]${Math.round(val)}); `;
      }
    }
    if (data.triggers) {
      if (data.triggers.lt !== undefined) {
          const val = sanitizeNumber(data.triggers.lt * 255, 0, 255);
          cmds += `$c.SetSliderValue($global:XS::LeftTrigger, [byte]${Math.round(val)}); `;
      }
      if (data.triggers.rt !== undefined) {
          const val = sanitizeNumber(data.triggers.rt * 255, 0, 255);
          cmds += `$c.SetSliderValue($global:XS::RightTrigger, [byte]${Math.round(val)}); `;
      }
    }
    if (data.buttons) {
      const map = { A:'A', B:'B', X:'X', Y:'Y', lb:'LeftShoulder', rb:'RightShoulder',
        back:'Back', start:'Start', home:'Guide', ls:'LeftThumb', rs:'RightThumb',
        dpadUp:'Up', dpadDown:'Down', dpadLeft:'Left', dpadRight:'Right' };
      for (const [k, v] of Object.entries(data.buttons)) {
        if (map[k]) cmds += `$c.SetButtonState($global:XB::${map[k]}, $${v ? 'true' : 'false'}); `;
      }
    }
    
    cmds += `$c.SubmitReport(); if (-not $global:inputAck.ContainsKey(${pid})) { $global:inputAck[${pid}] = $true; Write-Host "VIGEM_INPUT_REPORT[${pid}]" } } catch { if (-not $global:inputFailureReported.ContainsKey(${pid})) { $global:inputFailureReported[${pid}] = $true; Write-Host "VIGEM_INPUT_FAILED[${pid}]: $_" } } } else { if (-not $global:inputFailureReported.ContainsKey(${pid})) { $global:inputFailureReported[${pid}] = $true; Write-Host "VIGEM_INPUT_FAILED[${pid}]: virtual controller target missing" } }\n`;
    this.ps.stdin.write(cmds);
  }

  _handleKeyboardInput(player, data) {
    if (!this.keyboardAvailable) return;
    const m = player.keyMapping;
    if (data.buttons) {
      for (const [btn, pressed] of Object.entries(data.buttons)) {
        const vk = m[btn]; if (vk === undefined) continue;
        const was = player.pressedKeys.has(btn);
        if (pressed && !was) { this._keyDown(vk); player.pressedKeys.add(btn); }
        else if (!pressed && was) { this._keyUp(vk); player.pressedKeys.delete(btn); }
      }
    }
    if (data.axes) {
      const t = config.axisThreshold;
      this._axisKey(player, data.axes.leftX, 'axisLeftRight', 'axisLeftLeft', t);
      this._axisKey(player, data.axes.leftY, 'axisLeftDown', 'axisLeftUp', t);
      this._axisKey(player, data.axes.rightX, 'axisRightRight', 'axisRightLeft', t);
      this._axisKey(player, data.axes.rightY, 'axisRightDown', 'axisRightUp', t);
    }
    if (data.triggers) {
      const tt = config.triggerThreshold;
      this._trigKey(player, data.triggers.lt, 'lt', tt);
      this._trigKey(player, data.triggers.rt, 'rt', tt);
    }
  }

  _axisKey(player, val, posK, negK, t) {
    const m = player.keyMapping;
    const pv = m[posK], nv = m[negK];
    if (pv !== undefined) {
      if (val > t && !player.pressedKeys.has(posK)) { this._keyDown(pv); player.pressedKeys.add(posK); }
      else if (val <= t && player.pressedKeys.has(posK)) { this._keyUp(pv); player.pressedKeys.delete(posK); }
    }
    if (nv !== undefined) {
      if (val < -t && !player.pressedKeys.has(negK)) { this._keyDown(nv); player.pressedKeys.add(negK); }
      else if (val >= -t && player.pressedKeys.has(negK)) { this._keyUp(nv); player.pressedKeys.delete(negK); }
    }
  }

  _trigKey(player, val, key, t) {
    const vk = player.keyMapping[key]; if (vk === undefined) return;
    if (val > t && !player.pressedKeys.has(key)) { this._keyDown(vk); player.pressedKeys.add(key); }
    else if (val <= t && player.pressedKeys.has(key)) { this._keyUp(vk); player.pressedKeys.delete(key); }
  }

  _keyDown(vk) { 
    const code = parseInt(vk, 10);
    if (isNaN(code) || !this.ps?.stdin?.writable) return;
    this.ps.stdin.write(`[KBSim]::keybd_event(${code},0,0,[UIntPtr]::Zero)\n`); 
  }
  
  _keyUp(vk) { 
    const code = parseInt(vk, 10);
    if (isNaN(code) || !this.ps?.stdin?.writable) return;
    this.ps.stdin.write(`[KBSim]::keybd_event(${code},0,2,[UIntPtr]::Zero)\n`); 
  }

  // Release state without removing the session. Used when a client pauses or its
  // input stream goes stale, so held controls cannot remain latched on the host.
  releasePlayerInput(socketId) {
    const player = this.players.get(socketId);
    if (!player) return false;
    this._releasePlayerInput(player);
    return true;
  }

  _releasePlayerInput(player) {
    this._releasePlayer(player);
    if (!player.hasController || !this.ps || !this.ps.stdin.writable) return;

    const pid = player.number;
    this.ps.stdin.write(`
$c = $global:xctrls[${pid}]
if ($c) {
  $c.SetAxisValue($global:XA::LeftThumbX, [int16]0)
  $c.SetAxisValue($global:XA::LeftThumbY, [int16]0)
  $c.SetAxisValue($global:XA::RightThumbX, [int16]0)
  $c.SetAxisValue($global:XA::RightThumbY, [int16]0)
  $c.SetSliderValue($global:XS::LeftTrigger, [byte]0)
  $c.SetSliderValue($global:XS::RightTrigger, [byte]0)
  $c.SetButtonState($global:XB::A, $false)
  $c.SetButtonState($global:XB::B, $false)
  $c.SetButtonState($global:XB::X, $false)
  $c.SetButtonState($global:XB::Y, $false)
  $c.SetButtonState($global:XB::LeftShoulder, $false)
  $c.SetButtonState($global:XB::RightShoulder, $false)
  $c.SetButtonState($global:XB::Back, $false)
  $c.SetButtonState($global:XB::Start, $false)
  $c.SetButtonState($global:XB::Guide, $false)
  $c.SetButtonState($global:XB::LeftThumb, $false)
  $c.SetButtonState($global:XB::RightThumb, $false)
  $c.SetButtonState($global:XB::Up, $false)
  $c.SetButtonState($global:XB::Down, $false)
  $c.SetButtonState($global:XB::Left, $false)
  $c.SetButtonState($global:XB::Right, $false)
  $c.SubmitReport()
}
`);
  }

  _releasePlayer(player) {
    for (const btn of player.pressedKeys) {
      const vk = player.keyMapping[btn]; if (vk !== undefined) this._keyUp(vk);
    }
    player.pressedKeys.clear();
  }

  setMode(mode) {
    if (mode === 'gamepad' && !this.gamepadAvailable) return false;
    this.players.forEach(p => this._releasePlayerInput(p));
    this.mode = mode;
    return true;
  }

  setPlayerMapping(socketId, mapping) {
    const p = this.players.get(socketId);
    if (p) { this._releasePlayer(p); p.keyMapping = { ...mapping }; }
  }

  setGlobalMapping(mapping) {
    this.players.forEach(p => {
      this._releasePlayer(p);
      p.keyMapping = { ...mapping };
    });
    // Update the default config so new players get it
    config.keyMappings.default = { ...mapping };
  }

  getMode() { return this.mode; }
  getKeyMapping(socketId) {
    const p = this.players.get(socketId);
    return p ? { ...p.keyMapping } : { ...config.keyMappings.default };
  }

  getStatus() {
    return { mode: this.mode, gamepadAvailable: this.gamepadAvailable,
      gamepadError: this.gamepadError, keyboardAvailable: this.keyboardAvailable,
      players: this.getPlayersInfo() };
  }

  cleanup() {
    this.players.forEach(p => {
      this._releasePlayerInput(p);
      if (p.controllerRequested && this.ps && this.ps.stdin.writable) {
        this.ps.stdin.write(`
          try {
            $c = $global:xctrls[${p.number}]
            if ($c) { $c.Disconnect(); $global:xctrls.Remove(${p.number}) }
          } catch { }
        \n`);
      }
    });
    if (this.ps) try { this.ps.kill(); } catch(e) {}
  }
}

module.exports = { InputHandler };
