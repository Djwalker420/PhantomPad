# PhantomPad — Project Memory

Last updated: 2026-10-16
Working branch: `fix/input-stale-state-watchdog`
Pull request: https://github.com/Djwalker420/PhantomPad/pull/1 (draft)
Base branch: `main`

## Mission
Fix input lag, dropped input, and stuck controls; preserve two-device isolation; verify changes with automated tests and real-device testing.

## Verified architecture
- Node.js server: `server/index.js`
- Input emulation and per-socket player sessions: `server/input-handler.js`
- Stale-input watchdog helper: `server/input-watchdog.js`
- Browser/mobile controller: `controller/js/controller.js`
- Socket.IO input; up to four player sessions.
- Controller sends button/axis/trigger snapshots at a default 60 Hz using volatile Socket.IO input events.
- Server rate-limits input events per socket at an 8 ms minimum interval.
- Windows virtual gamepad and keyboard emulation is bridged through PowerShell.
- Test runner: Jest via `npm test`; `package-lock.json` exists.

## Changes on the working branch
- Made `InputHandler.addPlayer(socketId)` idempotent for duplicate registration from the same live socket.
- Added `releasePlayerInput(socketId)` and full neutralization of virtual gamepad axes, triggers, and buttons.
- Use full input release during player removal, mode change, and shutdown.
- Added a 300 ms per-socket input inactivity watchdog. Accepted controller snapshots refresh it; stale input is neutralized. The watchdog stops on disconnect.
- Reset local mobile input state on connect/disconnect and when the document becomes hidden; send a non-volatile neutral snapshot when still connected.
- Use volatile transport for trackpad movement/scroll to avoid replaying obsolete movement after network interruption. Click events remain non-volatile.
- Clear/restart the latency ping interval safely on reconnect.
- Added Jest tests for watchdog timing, duplicate registration, player-isolated release, and repeated removal.
- Added GitHub Actions workflow to run Jest on branch pushes and pull requests.

## Verification
- JavaScript syntax compilation checks passed for the changed source and test files.
- GitHub Actions run: PASS — https://github.com/Djwalker420/PhantomPad/actions/runs/38929697195
- Jest step completed successfully in CI.
- No local tests were run from this chat environment.
- No physical two-device/Windows hardware test has been performed.
- Main branch has not been modified; changes are in the draft PR above.
- The 300 ms watchdog is an initial safety value, not a measured optimum.

## Known risks / follow-up
- Confirm ViGEm PowerShell API calls work on the installed ViGEm version.
- Verify keyboard mode and gamepad mode separately on Windows.
- Test two physical clients concurrently; disconnect one and verify the other continues unaffected.
- Measure input latency/jitter under one- and two-device load before changing the 60 Hz send rate or 8 ms server gate.
- Review shared/global mode and preset settings separately after confirming intended behavior.
- Authentication/pairing remains a security concern on untrusted networks and is outside this focused input repair.

## Continuation instructions
1. Read this file and inspect the current PR diff.
2. Keep the PR unmerged until the code is reviewed and real-device checks are complete.
3. Fix any future CI failures and record actual results.
4. Perform Windows/two-device tests when hardware is available.
5. Update this file after each meaningful milestone.
