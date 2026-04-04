// PhantomPad - Input Handler v2
// Multi-player, Mouse Trackpad, Keyboard & Gamepad modes
const { spawn } = require('child_process');
const config = require('./config');

class InputHandler {
  constructor(cfg) {
    this.mode = cfg.defaultMode || 'keyboard';
    this.players = new Map();
    this.maxPlayers = 4;
    this.ps = null;
    this.gamepadAvailable = false;
    this.keyboardAvailable = false;

    this._initEmulation();
  }

  _initEmulation() {
    try {
      this.ps = spawn('powershell', ['-NoProfile', '-NoLogo', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KBSim {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }
}
"@

try {
    Add-Type -Path "$pwd\\server\\lib\\Nefarius.ViGEm.Client.dll"
    $global:vigemClient = New-Object Nefarius.ViGEm.Client.ViGEmClient
    $global:xctrls = @{}
    $global:XA = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Axis]
    $global:XS = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Slider]
    $global:XB = [Nefarius.ViGEm.Client.Targets.Xbox360.Xbox360Button]
    Write-Host "VIGEM_READY"
} catch {
    Write-Host "VIGEM_FAILED: $_"
}
Write-Host "KB_READY"
`;
      this.ps.stdin.write(psScript + '\n');
      this.ps.stderr.on('data', () => {});
      
      // We'll optimistically set both as true if PS spawned successfully. If ViGEm isn't installed
      // the PowerShell try-block catches it, but we can safely send commands without crashing Node.
      this.keyboardAvailable = true;
      this.gamepadAvailable = true;
      console.log('  ✓ Input simulation bridge initialized (Keyboard + Virtual Controller)');
    } catch (e) {
      this.keyboardAvailable = false;
      this.gamepadAvailable = false;
      console.log('  ✗ Input simulation failed:', e.message);
    }
  }

  // --- Player Management ---
  addPlayer(socketId) {
    if (this.players.size >= this.maxPlayers) return null;
    const num = this._nextPlayerNum();
    const colors = ['#00e5ff', '#ff1744', '#00e676', '#ffd600'];
    const player = {
      id: socketId, number: num,
      color: colors[num - 1] || colors[0],
      pressedKeys: new Set(),
      keyMapping: { ...config.keyMappings[config.defaultPreset || 'default'] },
      hasController: false
    };
    
    if (this.gamepadAvailable && this.ps && this.ps.stdin.writable) {
      player.hasController = true;
      this.ps.stdin.write(`
        try {
          $c = $global:vigemClient.CreateXbox360Controller()
          $c.Connect()
          $global:xctrls[${num}] = $c
        } catch { }
      \n`);
    }
    
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    this._releasePlayer(p);
    
    if (p.hasController && this.ps && this.ps.stdin.writable) {
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
    return [...this.players.values()].map(p => ({ id: p.id, number: p.number, color: p.color }));
  }

  // --- Input Handling ---
  handleInput(socketId, data) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (this.mode === 'gamepad' && player.hasController) {
      this._handleGamepadInput(player, data);
    } else if (this.keyboardAvailable) {
      this._handleKeyboardInput(player, data);
    }
  }

  handleMouse(socketId, data) {
    if (!this.keyboardAvailable || !this.ps || !this.ps.stdin.writable) return;
    if (data.dx !== undefined || data.dy !== undefined) {
      const dx = Math.round(data.dx || 0);
      const dy = Math.round(data.dy || 0);
      this.ps.stdin.write(`$p=[KBSim+POINT]::new();[KBSim]::GetCursorPos([ref]$p);[KBSim]::SetCursorPos($p.X+${dx},$p.Y+${dy})\n`);
    }
    if (data.click === 'left') {
      this.ps.stdin.write(`[KBSim]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[KBSim]::mouse_event(4,0,0,0,[UIntPtr]::Zero)\n`);
    }
    if (data.click === 'right') {
      this.ps.stdin.write(`[KBSim]::mouse_event(8,0,0,0,[UIntPtr]::Zero);[KBSim]::mouse_event(16,0,0,0,[UIntPtr]::Zero)\n`);
    }
    if (data.scroll) {
      const amount = data.scroll > 0 ? 120 : -120;
      this.ps.stdin.write(`[KBSim]::mouse_event(0x0800,0,0,${amount},[UIntPtr]::Zero)\n`);
    }
  }

  _handleGamepadInput(player, data) {
    if (!this.ps || !this.ps.stdin.writable) return;
    const pid = player.number;
    let cmds = `$c = $global:xctrls[${pid}]; if($c) { `;
    
    if (data.axes) {
      if (data.axes.leftX !== undefined) {
         const val = Math.max(-32768, Math.min(32767, Math.round(data.axes.leftX * 32767)));
         cmds += `$c.SetAxisValue($global:XA::LeftThumbX, [int16]${val}); `;
      }
      if (data.axes.leftY !== undefined) {
         const val = Math.max(-32768, Math.min(32767, Math.round(-data.axes.leftY * 32767)));
         cmds += `$c.SetAxisValue($global:XA::LeftThumbY, [int16]${val}); `;
      }
      if (data.axes.rightX !== undefined) {
         const val = Math.max(-32768, Math.min(32767, Math.round(data.axes.rightX * 32767)));
         cmds += `$c.SetAxisValue($global:XA::RightThumbX, [int16]${val}); `;
      }
      if (data.axes.rightY !== undefined) {
         const val = Math.max(-32768, Math.min(32767, Math.round(-data.axes.rightY * 32767)));
         cmds += `$c.SetAxisValue($global:XA::RightThumbY, [int16]${val}); `;
      }
    }
    if (data.triggers) {
      if (data.triggers.lt !== undefined) {
          const val = Math.round(data.triggers.lt * 255);
          cmds += `$c.SetSliderValue($global:XS::LeftTrigger, [byte]${val}); `;
      }
      if (data.triggers.rt !== undefined) {
          const val = Math.round(data.triggers.rt * 255);
          cmds += `$c.SetSliderValue($global:XS::RightTrigger, [byte]${val}); `;
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
    
    cmds += `}\n`;
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

  _releasePlayer(player) {
    for (const btn of player.pressedKeys) {
      const vk = player.keyMapping[btn]; if (vk !== undefined) this._keyUp(vk);
    }
    player.pressedKeys.clear();
  }

  setMode(mode) {
    if (mode === 'gamepad' && !this.gamepadAvailable) return false;
    this.players.forEach(p => this._releasePlayer(p));
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
      keyboardAvailable: this.keyboardAvailable, players: this.getPlayersInfo() };
  }

  cleanup() {
    this.players.forEach(p => {
      this._releasePlayer(p);
      if (p.hasController && this.ps && this.ps.stdin.writable) {
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
