const { spawn } = require('child_process');
const EventEmitter = require('events');

class GameMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.interval = options.interval || 3000;
    this.ps = null;
    this.activeProcess = null;
    this.timer = null;
    this.running = false;

    this._setupPS();
  }

  _setupPS() {
    try {
      this.ps = spawn('powershell', ['-NoProfile', '-NoLogo', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const setupScript = `
        $code = @'
            [DllImport("user32.dll")]
            public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")]
            public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
'@
        Add-Type -MemberDefinition $code -Name "WindowUtils" -Namespace "Utils" -ErrorAction SilentlyContinue
      `;
      this.ps.stdin.write(setupScript + '\n');

      this.ps.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output && output !== this.activeProcess && output !== 'Antigravity' && output !== 'powershell') {
          this.activeProcess = output;
          this.emit('game-changed', output);
        }
      });

    } catch (e) {
      console.error('Failed to initialize GameMonitor PS:', e.message);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      if (this.ps && this.ps.stdin.writable) {
        const query = `
          $handle = [Utils.WindowUtils]::GetForegroundWindow()
          $processId = 0
          [Utils.WindowUtils]::GetWindowThreadProcessId($handle, [ref]$processId)
          if ($processId -gt 0) {
            (Get-Process -Id $processId -ErrorAction SilentlyContinue).Name
          }
        `;
        this.ps.stdin.write(query + '\n');
      }
    }, this.interval);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
  }

  cleanup() {
    this.stop();
    if (this.ps) this.ps.kill();
  }
}

module.exports = { GameMonitor };
