const { InputHandler } = require('../input-handler');
const config = require('../config');

describe('InputHandler player lifecycle', () => {
  let handler;

  beforeEach(() => {
    jest.spyOn(InputHandler.prototype, '_initEmulation').mockImplementation(function () {
      this.ps = {
        stdin: { writable: true, write: jest.fn() },
        kill: jest.fn()
      };
      this.keyboardAvailable = true;
      this.gamepadAvailable = true;
    });
    handler = new InputHandler(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('registering the same socket twice reuses its player and virtual controller', () => {
    const first = handler.addPlayer('socket-a');
    const writesAfterFirstRegistration = handler.ps.stdin.write.mock.calls.length;

    const second = handler.addPlayer('socket-a');

    expect(second).toBe(first);
    expect(handler.players.size).toBe(1);
    expect(handler.ps.stdin.write).toHaveBeenCalledTimes(writesAfterFirstRegistration);
  });

  test('releasing stale input clears pressed keyboard state and neutralizes only that player gamepad', () => {
    const a = handler.addPlayer('socket-a');
    const b = handler.addPlayer('socket-b');
    a.keyMapping.A = 65;
    a.pressedKeys.add('A');
    b.pressedKeys.add('B');
    handler.ps.stdin.write.mockClear();

    expect(handler.releasePlayerInput('socket-a')).toBe(true);

    expect(a.pressedKeys.size).toBe(0);
    expect(b.pressedKeys.has('B')).toBe(true);
    const commands = handler.ps.stdin.write.mock.calls.map(([command]) => command).join('\n');
    expect(commands).toContain('keybd_event(65,0,2');
    expect(commands).toContain('$c = $global:xctrls[1]');
    expect(commands).toContain('SetAxisValue($global:XA::LeftThumbX, [int16]0)');
    expect(commands).not.toContain('$c = $global:xctrls[2]');
  });

  test('removing a player twice is safe and disconnects its virtual controller once', () => {
    handler.addPlayer('socket-a');
    handler.ps.stdin.write.mockClear();

    handler.removePlayer('socket-a');
    handler.removePlayer('socket-a');

    expect(handler.players.has('socket-a')).toBe(false);
    const commands = handler.ps.stdin.write.mock.calls.map(([command]) => command).join('\n');
    expect(commands.match(/\.Disconnect\(\)/g)).toHaveLength(1);
  });
});
