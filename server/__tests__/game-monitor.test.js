const { GameMonitor } = require('../game-monitor');
const { spawn } = require('child_process');
const EventEmitter = require('events');

jest.mock('child_process');

describe('GameMonitor', () => {
  let monitor;
  let mockPs;

  beforeEach(() => {
    mockPs = {
      stdin: { write: jest.fn(), writable: true },
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: jest.fn()
    };
    spawn.mockReturnValue(mockPs);
    monitor = new GameMonitor({ interval: 100 });
  });

  afterEach(() => {
    monitor.cleanup();
  });

  test('should detect a new game process', (done) => {
    monitor.on('game-changed', (name) => {
      expect(name).toBe('GTA5');
      done();
    });

    // Simulate PowerShell output
    mockPs.stdout.emit('data', Buffer.from('GTA5\n'));
  });

  test('should ignore housekeeping processes', (done) => {
    const changedSpy = jest.fn();
    monitor.on('game-changed', changedSpy);

    mockPs.stdout.emit('data', Buffer.from('Antigravity\n'));
    mockPs.stdout.emit('data', Buffer.from('powershell\n'));

    setTimeout(() => {
      expect(changedSpy).not.toHaveBeenCalled();
      done();
    }, 50);
  });

  test('should not emit if process name has not changed', (done) => {
    const changedSpy = jest.fn();
    monitor.on('game-changed', changedSpy);

    mockPs.stdout.emit('data', Buffer.from('GTA5\n'));
    mockPs.stdout.emit('data', Buffer.from('GTA5\n'));

    setTimeout(() => {
      expect(changedSpy).toHaveBeenCalledTimes(1);
      done();
    }, 50);
  });
});
