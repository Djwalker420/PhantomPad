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
const fs = require('fs');
const path = require('path');
const config = require('./config');
const PLAYER_CONTROLLER_TIMEOUT_MS = 60000;

const sanitizeNumber = (val, min, max) => {
  const n = Number(val);
  return (Number.isFinite(n)) ? Math.max(min, Math.min(max, n)) : 0;
};

class InputHandler {
  constructor(cfg) {
    this.mode = cfg.defaultMode || 'keyboard';
    this.modeSelection = 'auto';
    this.autoGameMode = 'gamepad';
    this.players = new Map();
    this.maxPlayers = 4;
    this.ps = null;
    this.gamepadAvailable = false;
    this.gamepadError = 'Checking ViGEmBus availability';
    this.racepadAvailable = false;
    this.racepadError = 'Checking vJoy availability';
    this.onStatusChange = null;
    this.keyboardAvailable = false;
    this.psOutputBuffer = '';
    this.isCleaningUp = false;

    this._initEmulation();
  }

  _writePowerShell(script, callback) {
    if (!this.ps?.stdin?.writable) return false;
    // PowerShell can leave a complete multi-line block buffered when stdin is
    // kept open for the lifetime of the app. A blank line commits that block
    // so controller setup markers are emitted immediately.
    const command = `${String(script).replace(/\s*$/, '')}\n\n`;
    return this.ps.stdin.write(command, callback);
  }

  _initEmulation() {
    try {
      this.ps = spawn('powershell', ['-NoProfile', '-NoLogo', '-NoExit', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const packagedDllPath = process.versions.electron && require('electron').app?.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'lib', 'Nefarius.ViGEm.Client.dll')
        : path.join(__dirname, 'lib', 'Nefarius.ViGEm.Client.dll');
      const psDllPath = packagedDllPath.replace(/'/g, "''");
      const psScript = `
function global:Write-PhantomPadMarker([string]$Message) {
    [Console]::Out.WriteLine($Message)
    [Console]::Out.Flush()
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KBSim {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
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
    # The client constructor already connects to the ViGEm bus. Do not plug
    # and unplug a temporary Xbox target on every app launch: that can cause
    # device-list churn and the archived .NET wrapper can report a misleading
    # Win32Exception after the target was successfully plugged in.
    Write-PhantomPadMarker "VIGEM_READY"
} catch {
    Write-PhantomPadMarker "VIGEM_FAILED: $_"
}

try {
    $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    $vJoyDll = @("$env:ProgramFiles\\vJoy\\x64\\vJoyInterface.dll", "$env:ProgramFiles\\vJoy\\vJoyInterface.dll", "$programFilesX86\\vJoy\\x86\\vJoyInterface.dll") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $vJoyDll) { throw 'vJoy is not installed' }
    $env:PATH = (Split-Path $vJoyDll) + ';' + $env:PATH
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PhantomPadVJoy {
  [DllImport("vJoyInterface.dll", EntryPoint="vJoyEnabled", CallingConvention=CallingConvention.Cdecl)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool Enabled();
  [DllImport("vJoyInterface.dll", EntryPoint="GetVJDStatus", CallingConvention=CallingConvention.Cdecl)] public static extern int Status(uint id);
  [DllImport("vJoyInterface.dll", EntryPoint="GetVJDButtonNumber", CallingConvention=CallingConvention.Cdecl)] public static extern int ButtonCount(uint id);
  [DllImport("vJoyInterface.dll", EntryPoint="GetVJDAxisExist", CallingConvention=CallingConvention.Cdecl)] public static extern uint HasAxis(uint id, uint axis);
  [DllImport("vJoyInterface.dll", EntryPoint="AcquireVJD", CallingConvention=CallingConvention.Cdecl)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool Acquire(uint id);
  [DllImport("vJoyInterface.dll", EntryPoint="RelinquishVJD", CallingConvention=CallingConvention.Cdecl)] public static extern void Relinquish(uint id);
  [DllImport("vJoyInterface.dll", EntryPoint="ResetVJD", CallingConvention=CallingConvention.Cdecl)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool Reset(uint id);
  [DllImport("vJoyInterface.dll", EntryPoint="SetAxis", CallingConvention=CallingConvention.Cdecl)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool SetAxis(int value, uint id, uint axis);
  [DllImport("vJoyInterface.dll", EntryPoint="SetBtn", CallingConvention=CallingConvention.Cdecl)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool SetButton([MarshalAs(UnmanagedType.Bool)] bool value, uint id, byte button);
}
"@
    if (-not [PhantomPadVJoy]::Enabled()) { throw 'vJoy driver is disabled' }
    Write-PhantomPadMarker "VJOY_READY"
} catch {
    Write-PhantomPadMarker "VJOY_FAILED: $_"
}
Write-PhantomPadMarker "KB_READY"
`;
      this.ps.stdout.on('data', (data) => {
        const bufferedOutput = this.psOutputBuffer + data.toString();
        const completeOutputLength = bufferedOutput.lastIndexOf('\n') + 1;
        if (completeOutputLength === 0) {
          this.psOutputBuffer = bufferedOutput;
          return;
        }
        const output = bufferedOutput.slice(0, completeOutputLength);
        this.psOutputBuffer = bufferedOutput.slice(completeOutputLength);
        this._logBridge(`PowerShell stdout: ${output.trim()}`);
        if (output.includes('VIGEM_READY')) {
          this.gamepadAvailable = true;
          this.gamepadError = null;
          console.log('  ✓ ViGEm bus connection established; player targets will be checked when connected');
          for (const player of this.players.values()) this._createPlayerController(player);
          this.onStatusChange?.(this.getStatus());
        }
        if (output.includes('VJOY_READY')) {
          this.racepadAvailable = true;
          this.racepadError = null;
          if (this.mode === 'racepad') for (const player of this.players.values()) this._createRacepadController(player);
          this.onStatusChange?.(this.getStatus());
        }
        const racepadFailure = output.match(/VJOY_FAILED:\s*([^\r\n]+)/);
        if (racepadFailure) {
          this.racepadAvailable = false;
          this.racepadError = racepadFailure[1];
          this.onStatusChange?.(this.getStatus());
        }
        const playerStarted = output.match(/VIGEM_PLAYER_START\[(\d+)\]/);
        if (playerStarted) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(playerStarted[1]));
          if (player) {
            player.controllerStage = 'PowerShell received the request';
            this._notifyStatusChange();
          }
        }
        const racepadStarted = output.match(/VJOY_PLAYER_START\[(\d+)\]/);
        if (racepadStarted) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(racepadStarted[1]));
          if (player) { player.controllerStage = 'Connecting to vJoy'; this._notifyStatusChange(); }
        }
        const playerAllocated = output.match(/VIGEM_PLAYER_ALLOCATED\[(\d+)\]/);
        if (playerAllocated) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(playerAllocated[1]));
          if (player) {
            player.controllerStage = 'Virtual pad allocated; waiting for ViGEm';
            this._notifyStatusChange();
          }
        }
        const playerConnecting = output.match(/VIGEM_PLAYER_CONNECTING\[(\d+)\]/);
        if (playerConnecting) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(playerConnecting[1]));
          if (player) {
            player.controllerStage = 'Connecting virtual pad to ViGEm';
            this._notifyStatusChange();
          }
        }
        const playerReady = output.match(/VIGEM_PLAYER_READY\[(\d+)\]/);
        if (playerReady) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(playerReady[1]));
          if (player) {
            clearTimeout(player.controllerTimeout);
            player.hasController = true;
            player.controllerType = 'gamepad';
            player.controllerStatus = 'ready';
            player.controllerStage = null;
            player.controllerError = null;
            console.log(`  ✓ ViGEm controller ready for player ${player.number}`);
            this._notifyStatusChange();
          }
        }
        const playerNotice = output.match(/VIGEM_PLAYER_NOTICE\[(\d+)\]:\s*([^\r\n]+)/);
        if (playerNotice) {
          const message = `Player ${playerNotice[1]} controller connected; ${playerNotice[2]}`;
          this._logBridge(message);
          console.warn(`  ⚠ ${message}`);
        }
        const playerFailure = output.match(/VIGEM_PLAYER_FAILED\[(\d+)\]:\s*([^\r\n]+)/);
        if (playerFailure) {
          const failedNumber = Number(playerFailure[1]);
          const player = [...this.players.values()].find((entry) => entry.number === failedNumber);
          if (player) {
            clearTimeout(player.controllerTimeout);
            player.hasController = false;
            player.controllerStatus = 'error';
            player.controllerStage = null;
            player.controllerError = playerFailure[2];
            this._notifyStatusChange();
          }
          console.error(`  ✗ ViGEm could not create player ${failedNumber}:`, playerFailure[2]);
        }
        const racepadReady = output.match(/VJOY_PLAYER_READY\[(\d+)\]/);
        if (racepadReady) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(racepadReady[1]));
          if (player) {
            clearTimeout(player.controllerTimeout);
            player.hasController = true;
            player.controllerType = 'racepad';
            player.controllerStatus = 'ready';
            player.controllerStage = null;
            player.controllerError = null;
            this._notifyStatusChange();
          }
        }
        const racepadFailed = output.match(/VJOY_PLAYER_FAILED\[(\d+)\]:\s*([^\r\n]+)/);
        if (racepadFailed) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(racepadFailed[1]));
          if (player) {
            clearTimeout(player.controllerTimeout);
            player.controllerStatus = 'error';
            player.controllerStage = null;
            player.controllerError = racepadFailed[2];
            this._notifyStatusChange();
          }
        }
        const racepadInput = output.match(/VJOY_INPUT_REPORT\[(\d+)\]/);
        if (racepadInput) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(racepadInput[1]));
          if (player) { player.controllerStatus = 'active'; player.controllerError = null; this._notifyStatusChange(); }
        }
        const racepadInputFailure = output.match(/VJOY_INPUT_FAILED\[(\d+)\]:\s*([^\r\n]+)/);
        if (racepadInputFailure) {
          const player = [...this.players.values()].find((entry) => entry.number === Number(racepadInputFailure[1]));
          if (player) { player.hasController = false; player.controllerStatus = 'error'; player.controllerError = racepadInputFailure[2]; this._notifyStatusChange(); }
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
        if (message) {
          console.error('  ✗ PowerShell input bridge:', message);
          this._logBridge(`PowerShell stderr: ${message}`);
        }
      });
      this.ps.stdin.on('error', (error) => {
        this._logBridge(`PowerShell stdin error: ${error.message}`);
        this._failPendingControllers(`Windows input bridge pipe failed: ${error.message}`);
      });
      this.ps.on('error', (error) => {
        this.gamepadAvailable = false;
        this.gamepadError = error.message;
        this.keyboardAvailable = false;
        console.error('  ✗ PowerShell input bridge failed:', error.message);
        this._logBridge(`PowerShell process error: ${error.message}`);
        this._failPendingControllers(`Windows input bridge failed: ${error.message}`);
        this.onStatusChange?.(this.getStatus());
      });
      this.ps.on('exit', (code, signal) => {
        this._logBridge(`PowerShell process exited (code=${code}, signal=${signal || 'none'}).`);
        if (this.isCleaningUp) return;
        this.gamepadAvailable = false;
        this.keyboardAvailable = false;
        this.gamepadError = `Windows input bridge exited (code ${code ?? 'unknown'}).`;
        this._failPendingControllers(this.gamepadError);
        this.onStatusChange?.(this.getStatus());
      });
      this._writePowerShell(psScript);
      
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
    const colors = ['#00f5d4', '#4f46e5', '#00e676', '#ffd600'];
    const player = {
      id: socketId, number: num,
      color: colors[num - 1] || colors[0],
      latency: null,
      pressedKeys: new Set(),
      keyMapping: { ...config.keyMappings[config.defaultPreset || 'default'] },
      hasController: false,
      controllerRequested: false,
      controllerType: null,
      vJoyId: num,
      controllerStatus: this.mode === 'racepad' || (this.mode === 'gamepad' && this.gamepadAvailable) ? 'connecting' : 'waiting',
      controllerStage: null,
      controllerError: null
    };
    this.players.set(socketId, player);
    this._createActiveController(player);
    return player;
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    clearTimeout(p.controllerTimeout);
    this._releasePlayerInput(p);
    
    this._destroyPlayerController(p);
    
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
      controllerType: p.controllerType,
      controllerStatus: p.controllerStatus, controllerStage: p.controllerStage,
      controllerError: p.controllerError
    }));
  }

  _notifyStatusChange() {
    this.onStatusChange?.(this.getStatus());
  }

  _logBridge(message) {
    try {
      if (!process.versions.electron) return;
      const { app } = require('electron');
      const logPath = path.join(app.getPath('userData'), 'PhantomPad_debug.log');
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] [InputBridge] ${message}\n`);
    } catch (error) {
      console.error('  ✗ Could not write input bridge diagnostic:', error.message);
    }
  }

  _failPendingControllers(message) {
    for (const player of this.players.values()) {
      if (player.controllerStatus !== 'connecting') continue;
      clearTimeout(player.controllerTimeout);
      player.controllerStatus = 'error';
      player.controllerStage = null;
      player.controllerError = message;
    }
    this._notifyStatusChange();
  }

  _createPlayerController(player) {
    if (this.mode !== 'gamepad') return false;
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
    player.controllerStage = 'Waiting for Windows input bridge';
    player.controllerError = null;
    const number = player.number;
    this._logBridge(`Sending controller creation request for player ${number} to PowerShell.`);
      this._writePowerShell(`
try {
  Write-PhantomPadMarker "VIGEM_PLAYER_START[${number}]"
  $global:inputAck.Remove(${number})
  $global:inputFailureReported.Remove(${number})
  $c = $global:vigemClient.CreateXbox360Controller()
  Write-PhantomPadMarker "VIGEM_PLAYER_ALLOCATED[${number}]"
  $c.AutoSubmitReport = $false
  Write-PhantomPadMarker "VIGEM_PLAYER_CONNECTING[${number}]"
  try {
    $c.Connect()
  } catch {
    # Xbox360Controller.Connect() first plugs the target into the bus, then
    # registers its optional vibration callback. The bundled ViGEm.NET
    # wrapper can throw a generic Win32Exception (The operation completed
    # successfully) for that second step. Trust the wrapper's own connected
    # state so a successfully plugged-in controller remains usable.
    $targetConnected = $false
    $targetType = $c.GetType()
    $connectedField = $null
    $bindingFlags = [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic
    while ($targetType -and -not $connectedField) {
      $connectedField = $targetType.GetField('_isConnected', $bindingFlags)
      $targetType = $targetType.BaseType
    }
    if ($connectedField) { $targetConnected = [bool]$connectedField.GetValue($c) }
    if (-not $targetConnected) { throw }
    Write-PhantomPadMarker "VIGEM_PLAYER_NOTICE[${number}]: vibration feedback registration was unavailable"
  }
  $global:xctrls[${number}] = $c
  Write-PhantomPadMarker "VIGEM_PLAYER_READY[${number}]"
} catch {
  Write-PhantomPadMarker "VIGEM_PLAYER_FAILED[${number}]: $_"
}
`, (error) => {
      if (error) this._logBridge(`Player ${number} command could not be written to PowerShell: ${error.message}`);
      else this._logBridge(`Player ${number} command was written to the PowerShell pipe.`);
    });
    player.controllerTimeout = setTimeout(() => {
      if (player.controllerStatus !== 'connecting') return;
      player.controllerStatus = 'error';
      player.controllerError = `Timed out during setup: ${player.controllerStage || 'waiting for PowerShell response'}.`;
      player.controllerStage = null;
      if (this.psOutputBuffer.trim()) this._logBridge(`Unterminated PowerShell stdout at timeout: ${this.psOutputBuffer.trim()}`);
      this._logBridge(`Player ${number} creation timed out. Last confirmed stage: ${player.controllerError}`);
      console.error(`  ✗ ViGEm controller creation timed out for player ${number}`);
      this._notifyStatusChange();
    }, PLAYER_CONTROLLER_TIMEOUT_MS);
    return true;
  }

  _createActiveController(player) {
    if (this.mode === 'racepad') return this._createRacepadController(player);
    if (this.mode === 'gamepad') return this._createPlayerController(player);
    player.controllerStatus = this.mode === 'keyboard' ? 'keyboard' : 'ready';
    player.controllerType = null;
    player.controllerError = null;
    return true;
  }

  _createRacepadController(player) {
    if (this.mode !== 'racepad' || player.racepadRequested) return false;
    if (!this.racepadAvailable) {
      player.controllerStatus = 'error';
      player.controllerError = this.racepadError || 'Install and enable vJoy to use Racepad mode.';
      this._notifyStatusChange();
      return false;
    }
    if (!this.ps?.stdin?.writable) return false;
    player.racepadRequested = true;
    player.controllerStatus = 'connecting';
    player.controllerStage = 'Connecting to vJoy';
    player.controllerError = null;
    const id = player.vJoyId;
    this._writePowerShell(`
try {
  Write-PhantomPadMarker "VJOY_PLAYER_START[${player.number}]"
  if (-not [PhantomPadVJoy]::Acquire(${id})) { throw "vJoy device ${id} is disabled or already in use" }
  $global:vjoyAck${id} = $false
  $global:vjoyFailure${id} = $false
  foreach ($axis in @(48,49,50,51,52)) { if ([PhantomPadVJoy]::HasAxis(${id}, $axis) -ne 1) { throw 'Enable vJoy axes X, Y, Z, Rx and Ry in Configure vJoy' } }
  $buttonCount = [PhantomPadVJoy]::ButtonCount(${id})
  if ($buttonCount -lt 32) { throw "vJoy device ${id} has $buttonCount buttons. Open Configure vJoy, select device ${id}, set Buttons to at least 32, and click Apply." }
  [PhantomPadVJoy]::Reset(${id}) | Out-Null
  Write-PhantomPadMarker "VJOY_PLAYER_READY[${player.number}]"
} catch {
  Write-PhantomPadMarker "VJOY_PLAYER_FAILED[${player.number}]: $_"
  try { [PhantomPadVJoy]::Relinquish(${id}) } catch { }
}`);
    player.controllerTimeout = setTimeout(() => {
      if (player.controllerStatus !== 'connecting') return;
      player.controllerStatus = 'error';
      player.controllerStage = null;
      player.controllerError = 'Timed out while creating the vJoy Racepad device.';
      this._notifyStatusChange();
    }, 15000);
    return true;
  }

  _destroyPlayerController(player) {
    if (this.ps?.stdin?.writable) {
      if (player.controllerRequested) this._writePowerShell(`try { $c = $global:xctrls[${player.number}]; if ($c) { $c.Disconnect(); $global:xctrls.Remove(${player.number}) } } catch { }`);
      if (player.racepadRequested) this._writePowerShell(`try { [PhantomPadVJoy]::Reset(${player.vJoyId}) | Out-Null; [PhantomPadVJoy]::Relinquish(${player.vJoyId}) } catch { }`);
    }
    player.controllerRequested = false;
    player.racepadRequested = false;
    player.hasController = false;
    player.controllerType = null;
    clearTimeout(player.controllerTimeout);
  }

  // --- Input Handling ---
  handleInput(socketId, data) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (this.mode === 'gamepad') {
      if (player.hasController) this._handleGamepadInput(player, data);
      return;
    }
    if (this.mode === 'racepad') {
      if (player.hasController && player.racepadRequested) this._handleRacepadInput(player, data);
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
    
    cmds += `$c.SubmitReport(); if (-not $global:inputAck.ContainsKey(${pid})) { $global:inputAck[${pid}] = $true; Write-PhantomPadMarker "VIGEM_INPUT_REPORT[${pid}]" } } catch { if (-not $global:inputFailureReported.ContainsKey(${pid})) { $global:inputFailureReported[${pid}] = $true; Write-PhantomPadMarker "VIGEM_INPUT_FAILED[${pid}]: $_" } } } else { if (-not $global:inputFailureReported.ContainsKey(${pid})) { $global:inputFailureReported[${pid}] = $true; Write-PhantomPadMarker "VIGEM_INPUT_FAILED[${pid}]: virtual controller target missing" } }\n`;
      this._writePowerShell(cmds);
  }

  _handleRacepadInput(player, data) {
    if (!this.ps?.stdin?.writable) return;
    const id = player.vJoyId;
    const axes = data.axes || {};
    const axisValue = (value, signed = false) => Math.round(signed ? (sanitizeNumber(value, -1, 1) + 1) * 16383.5 : sanitizeNumber(value, 0, 1) * 32767);
    const axisMap = { steering: [48, true], throttle: [49], brake: [50], clutch: [51], handbrake: [52] };
    let script = `try { `;
    for (const [name, [usage, signed]] of Object.entries(axisMap)) {
      script += `if (-not [PhantomPadVJoy]::SetAxis(${axisValue(axes[name], signed)}, ${id}, ${usage})) { throw 'vJoy rejected ${name}' }; `;
    }
    const buttonMap = { A: 1, B: 2, X: 3, Y: 4, lb: 5, rb: 6, back: 7, start: 8, home: 9, ls: 10, rs: 11,
      dpadUp: 12, dpadDown: 13, dpadLeft: 14, dpadRight: 15, gearUp: 16, gearDown: 17,
      gear1: 18, gear2: 19, gear3: 20, gear4: 21, gear5: 22, gear6: 23, gearReverse: 24,
      pitLimiter: 25, headlights: 26, wipers: 27, horn: 28, camera: 29, ignition: 30,
      absToggle: 31, tractionToggle: 32 };
    for (const [name, index] of Object.entries(buttonMap)) {
      if (data.buttons?.[name] !== undefined) script += `if (-not [PhantomPadVJoy]::SetButton($${data.buttons[name] ? 'true' : 'false'}, ${id}, [byte]${index})) { throw 'vJoy rejected button ${index}' }; `;
    }
    script += `if (-not $global:vjoyAck${id}) { $global:vjoyAck${id} = $true; Write-PhantomPadMarker "VJOY_INPUT_REPORT[${player.number}]" } } catch { try { [PhantomPadVJoy]::Reset(${id}) | Out-Null } catch { }; if (-not $global:vjoyFailure${id}) { $global:vjoyFailure${id} = $true; Write-PhantomPadMarker "VJOY_INPUT_FAILED[${player.number}]: $_" } }`;
    this._writePowerShell(script);
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
    this._writePowerShell(`[KBSim]::keybd_event(${code},0,0,[UIntPtr]::Zero)`);
  }
  
  _keyUp(vk) { 
    const code = parseInt(vk, 10);
    if (isNaN(code) || !this.ps?.stdin?.writable) return;
    this._writePowerShell(`[KBSim]::keybd_event(${code},0,2,[UIntPtr]::Zero)`);
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

    if (player.controllerType === 'racepad') {
      this._writePowerShell(`[PhantomPadVJoy]::Reset(${player.vJoyId}) | Out-Null`);
      return;
    }

    const pid = player.number;
    this._writePowerShell(`
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

  setDetectedMode(mode) {
    this.autoGameMode = mode === 'racepad' ? 'racepad' : 'gamepad';
    return this.modeSelection === 'auto' ? this._switchMode(this.autoGameMode) : true;
  }

  setMode(selection) {
    if (!['auto', 'gamepad', 'racepad', 'keyboard'].includes(selection)) return false;
    if (selection === 'racepad' && !this.racepadAvailable) return false;
    this.modeSelection = selection;
    if (selection === 'auto') return this._switchMode(this.autoGameMode);
    return this._switchMode(selection);
  }

  _switchMode(mode) {
    const target = mode === 'racepad' && !this.racepadAvailable ? 'gamepad' : mode;
    if (target === 'gamepad' && !this.gamepadAvailable) return false;
    if (target === 'racepad' && !this.racepadAvailable) return false;
    if (target === this.mode) return true;
    this.players.forEach((player) => {
      this._releasePlayerInput(player);
      this._destroyPlayerController(player);
    });
    this.mode = target;
    this.players.forEach((player) => this._createActiveController(player));
    this.onStatusChange?.(this.getStatus());
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

  getMode() { return this.modeSelection; }
  getActiveMode() { return this.mode; }
  getKeyMapping(socketId) {
    const p = this.players.get(socketId);
    return p ? { ...p.keyMapping } : { ...config.keyMappings.default };
  }

  getStatus() {
    return { mode: this.modeSelection, activeMode: this.mode, autoGameMode: this.autoGameMode,
      gamepadAvailable: this.gamepadAvailable, gamepadError: this.gamepadError,
      racepadAvailable: this.racepadAvailable, racepadError: this.racepadError,
      keyboardAvailable: this.keyboardAvailable,
      players: this.getPlayersInfo() };
  }

  cleanup() {
    this.isCleaningUp = true;
    this.players.forEach(p => {
      this._releasePlayerInput(p);
      if (p.controllerRequested && this.ps && this.ps.stdin.writable) {
        this._writePowerShell(`
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
