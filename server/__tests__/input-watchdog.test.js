const { createInputWatchdog } = require('../input-watchdog');

describe('Input watchdog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('releases stale input after inactivity and refreshes on new input', () => {
    const releasePlayerInput = jest.fn();
    const watchdog = createInputWatchdog('socket-a', { releasePlayerInput }, 300);

    watchdog.refresh();
    jest.advanceTimersByTime(250);
    watchdog.refresh();
    jest.advanceTimersByTime(299);
    expect(releasePlayerInput).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(releasePlayerInput).toHaveBeenCalledTimes(1);
    expect(releasePlayerInput).toHaveBeenCalledWith('socket-a');

    watchdog.stop();
  });

  test('stop cancels a pending stale-input release', () => {
    const releasePlayerInput = jest.fn();
    const watchdog = createInputWatchdog('socket-a', { releasePlayerInput }, 300);

    watchdog.refresh();
    watchdog.stop();
    jest.advanceTimersByTime(300);

    expect(releasePlayerInput).not.toHaveBeenCalled();
  });
});
