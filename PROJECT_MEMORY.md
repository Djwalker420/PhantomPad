# PhantomPad — Project Memory

Last updated: 2026-10-18
Desktop release: 1.6.0; Android release: 1.6.0 (versionCode 4)
Working branch: `main`
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
- Legacy trackpad movement used volatile transport; the trackpad and mouse input path is removed in the current UI update.
- Clear/restart the latency ping interval safely on reconnect.
- Probe actual ViGEmBus connectivity by connecting a temporary virtual Xbox 360 target; report the driver/client exception in the dashboard and `/api/info` when unavailable.
- Log per-player virtual-controller creation failures instead of swallowing them.
- Disable ViGEm auto-submit and submit one complete controller report per input snapshot and one after neutralization, reducing bus updates from one per field to one per snapshot.
- Keep mobile latency visible as `RTT: --` before the first response, ping immediately after connect, and refresh the server round-trip measurement once per second.
- Added Jest tests for watchdog timing, duplicate registration, player-isolated release, and repeated removal.
- Added GitHub Actions workflow to run Jest on branch pushes and pull requests.

## Verification
- JavaScript syntax compilation checks passed for the changed source and test files.
- GitHub Actions run 38929697195: Jest PASS — https://github.com/Djwalker420/PhantomPad/actions/runs/38929697195
- GitHub Actions run 38930197380 (PR run): Jest PASS; Android debug APK build and upload PASS; Windows installer packaging step FAILED at electron-builder publishing because `GH_TOKEN` was not set. The Windows upload step was skipped.
- Later run 38930205379 on the same PR head commit `b999fd1169a8b153e849a6d743334f6c7c703476`: Jest PASS, Android debug APK build/upload PASS, Windows installer build/upload PASS — https://github.com/Djwalker420/PhantomPad/actions/runs/38930205379
- Uploaded artifacts from run 38930205379: `PhantomPad-Android-APK` (4,623,140 bytes; expires 2026-10-30) and `PhantomPad-Windows-Installer` (84,710,506 bytes; expires 2026-10-30). Both are available from the workflow run's Artifacts section.
- No source-code fix was needed for the Windows issue: a later run succeeded on the same commit.
- Follow-up report: user installed ViGEmBus, but Windows Game Controllers remained empty. Source inspection found the packaged app loaded the ViGEm client DLL from the current working directory, although electron-builder places app files inside ASAR by default. Fixed this by unpacking the DLL and loading it from `process.resourcesPath/app.asar.unpacked`; added PowerShell bridge status/error reporting and corrected the startup script newline.
- GitHub Actions run 38945296006 on commit `646d70d6fcd77fa0b40dee09d983fcb9154c239d`: Jest PASS; Android APK build/upload PASS; Windows installer build/upload PASS — https://github.com/Djwalker420/PhantomPad/actions/runs/38945296006
- Windows installer artifact `PhantomPad-Windows-Installer` (84,836,609 bytes) and Android APK artifact `PhantomPad-Android-APK` (4,623,137 bytes) uploaded; expire 2026-10-30.
- This packaged-path fix is CI-verified, but it has not yet been tested on the user's Windows device; ask the user to install the new installer and recheck `joy.cpl`.
- No local tests were run from this chat environment.
- No physical two-device/Windows hardware test has been performed.
- GitHub Actions run 39006262243 on commit `81bd0ca1b863a42f50935f17a1ccb137868e5a05`: Jest PASS, Android APK build/upload PASS, Windows installer build/upload PASS. Artifacts: Android ID `12090699996` (4,623,140 bytes) and Windows ID `12091506212` (84,837,634 bytes); both expire 2026-10-31. This verifies the ViGEm probe/report batching and mobile RTT changes at that commit.
- Desktop app version `1.2.1` is set in `package.json` and the root metadata in `package-lock.json`.
- Android app version is now `3.0.1` (`versionCode 2`) so it can update an existing install; build artifacts are labeled with their desktop/mobile versions.
- GitHub Actions run `39007198529` on commit `3a3c7725f11387f554bca5a7af585921d66fdd6a`: Jest PASS, Android APK build/upload PASS, Windows installer build/upload PASS. Android artifact `PhantomPad-Android-v3.0.1-APK` (4,623,132 bytes; ID `12091307274`) and Windows artifact `PhantomPad-Windows-v1.2.1-Installer` (84,837,625 bytes; ID `12090459672`) expire 2026-10-31.
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

## Controller UI update (2026-10-18)
- Controller UI update from the supplied source snapshot is being applied to `main`.
- Desktop package version set to `1.6.0`; Android Gradle version set to `1.6.0` (`versionCode 4`).
- Mobile controller buttons and triggers now use independent Pointer Events so simultaneous fingers can press separate controls; each analog stick independently tracks its own active pointer.
- Added saved controller scale and Standard / Left-handed / Compact layout choices. Existing theme, opacity, stick size, and button-label customization remain available. Theme updates preserve the selected physical layout.
- Moved the player badge into the status row and kept latency in a non-shrinking, no-wrap chip so P1/P2 no longer covers RTT. Bumped the controller service-worker cache to v3 so clients replace older cached controller files.
- No CI run or APK/Windows installer build has completed for this update yet. The old `android-app/app/release/app-release.apk` in the repository is from an earlier version; the supplied source archive did not include it.
- No physical-device or two-device test has been performed for this update.

## 1.6.0 publication
- Local commit `8940324` contains the updated source and version metadata on `main`; it is ahead of `origin/main` and has not been published yet.
- The Actions workflow labels the Windows artifact `PhantomPad-Windows-v1.6.0-Installer`; Jest stays limited to pull-request runs to avoid running tests for this installer build request.
- A publish attempt failed before authentication because this Windows environment could not start Git Credential Manager (`NtCreateDirectoryObject` access denied); GitHub did not receive the commit, so no build workflow or new installer artifact has been produced.
- The Windows installer is not available locally because the ViGEm native dependency requires Visual Studio C++ build tools absent from this environment. Connect the GitHub integration or restore Git credential-helper access, then publish `main` and verify the Actions build/artifact before sharing an installer link.
- No Jest, Android APK, or Windows installer build was run for this 1.6.0 update; no physical-device testing has been performed.

## Controller and dashboard update (2026-10-18, local working copy)
- Made the phone settings panel scrollable with a visible scrollbar and sticky header.
- Added a layout-edit mode that lets users drag individual buttons and control groups to positions saved locally on each phone; added a reset action.
- Removed the mobile mouse/trackpad UI and its server and Windows mouse-input handlers.
- Updated the Windows dashboard to create a live input visualizer per connected player, show each controller's reported RTT beside its name, and disconnect a selected controller.
- Set Gamepad as the default server mode.
- Routed haptics directly through the Android native vibration bridge when the Android app is used, with the browser vibration API as fallback. This is a code-path improvement; it has not yet been confirmed on the CMF phone.
- These source changes have not been built into a new APK or Windows installer, and physical-device behavior remains unverified.

## Bundled Android controller UI (2026-10-18, local working copy)
- Android now loads the controller page from APK assets via `WebViewAssetLoader`; the connect screen passes the Windows server address as the Socket.IO target instead of loading `/controller/` from Windows.
- The Android Gradle build syncs the shared root `controller/` source into APK assets, so Android and desktop-browser controller screens share the same HTML/CSS/behavior source. Per-device layout settings remain in that phone's WebView storage and are not transferred.
- Bundled pages use the vendored Socket.IO 4.8.3 browser client. The Windows app continues serving the same controller page and client JS to browser users. Server CORS allows the Android app-assets origin for its Socket.IO connection.
- The Android screen no longer depends on Windows to serve its UI, but both still need the Windows server for input delivery and the existing connection, latency, player assignment, and vibration events. This changes interface delivery, not the input transport or expected latency.
- Android and desktop package metadata are set to 1.6.1 (Android versionCode 5). No local build or physical-device test has been performed for this source update; CI results still need to be checked.
