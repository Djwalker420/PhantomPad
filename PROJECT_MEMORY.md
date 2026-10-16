# PhantomPad — Project Memory

Last updated: 2026-10-16
Working branch: `fix/input-stale-state-watchdog`
Base branch: `main`

## Mission
Fix input lag, dropped input, and stuck controls; preserve two-device isolation; verify changes with automated tests and real-device testing.

## Verified architecture
- Node.js server: `server/index.js`
- Input emulation and per-socket player sessions: `server/input-handler.js`
- New stale-input watchdog helper: `server/input-watchdog.js`
- Browser/mobile controller: `controller/js/controller.js`
- Socket.IO is used for controller input; the server accepts up to four player sessions.
- Controller sends full button/axis/trigger snapshots at a default 60 Hz using volatile Socket.IO input events.
- The server rate-limits input events per socket at an 8 ms minimum interval.
- Virtual gamepad and keyboard emulation is bridged through PowerShell on Windows.
- Test runner: Jest via `npm test`; lockfile exists.

## Changes proposed on the working branch
- Make `InputHandler.addPlayer(socketId)` idempotent for duplicate registration from the same live socket.
- Add `releasePlayerInput(socketId)` and a helper that releases keyboard state and neutralizes virtual gamepad axes, triggers, and buttons without deleting the session.
- Use full input release during player removal, mode change, and shutdown.
- Add a 300 ms per-socket input inactivity watchdog. Accepted controller snapshots refresh it; stale input is neutralized. The watchdog is stopped on disconnect.
- Reset local mobile input state on connect/disconnect and when the document becomes hidden; send a non-volatile neutral snapshot when still connected.
- Use volatile transport for trackpad movement and scroll, avoiding replay of obsolete movement after a network interruption. Click events remain non-volatile.
- Clear/restart the latency ping interval safely on reconnect.
- Add Jest coverage for watchdog timing, duplicate player registration, input release isolation, and repeated removal.
- Add CI to run the existing Jest suite on the repair branch and pull requests.

## Verification status
- Source reviewed from public GitHub repository.
- Changes are on a dedicated branch; main has not been modified.
- Tests have not yet been executed in this chat environment.
- CI result must be checked after workflow/PR creation.
- Physical two-device testing has not been performed.
- The 300 ms watchdog is a conservative initial value; adjust only after measuring behavior on real devices.

## Known risks / follow-up
- Confirm ViGEm PowerShell API calls accept the neutral-state operations on the installed ViGEm version.
- Verify keyboard mode and gamepad mode separately on Windows.
- Run two physical clients concurrently and verify disconnecting one leaves the other unaffected.
- Measure input latency/jitter under one- and two-device load before changing the 60 Hz send rate or 8 ms server gate.
- Review shared/global mode and preset settings in a separate change after confirming intended product behavior.
- Authentication/pairing remains a security concern for untrusted networks and is outside this focused input repair.

## Continuation instructions
1. Read this file and inspect the current branch diff.
2. Verify GitHub Actions status for the test workflow.
3. Fix any failing tests before treating the branch as ready.
4. Do not merge into `main` until CI passes and the patch is reviewed.
5. Perform real Windows/two-device tests when hardware is available.
6. Update this file with actual test results, PR status, and remaining work.
