# PhantomPad — Project Memory

Last updated: 2026-10-23
Desktop source: 1.10.0; Android source: 1.10.0 (versionCode 14)
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

## Android connection repair (2026-10-19)
- User reports the Android controller UI opens but remains disconnected and sends no input, while the Android connect screen reaches the Windows app.
- Changed the shared controller Socket.IO client to start with HTTP long-polling and upgrade to WebSocket. The previous WebSocket-first ordering did not automatically fall back when the initial WebSocket attempt failed. Socket.IO's official client options document recommends polling-first by default and describes `tryAllTransports` for WebSocket-first fallback.
- Added a visible retrying status and console diagnostic for Socket.IO connection errors; bumped the browser service-worker cache to v6.
- Bumped Windows package metadata and Android package metadata to v1.6.2; Android `versionCode` is 6. Updated CI artifact labels to v1.6.2.
- This is a code-based repair hypothesis supported by the reported two-stage connection behavior and the documented transport fallback behavior. It has not been built or tested on the user's phone/hotspot. Rebuild and reinstall the Android APK; the Windows app does not need reinstalling for this client-side change.

## L3/R3 stuck input repair (2026-10-19)
- User reports the PhantomPad live visualizer receives input, but L3/R3 remain active after pressing them. This confirms the phone-to-server input path is working; the stuck state is in the controller page's pointer handling.
- Root cause: L3/R3 buttons are nested inside joystick zones. Their `pointerdown` bubbled to the parent joystick, which captured the pointer. Then `pointerup` targeted the joystick zone and skipped the button's release handler, leaving the L3/R3 state held.
- Stop propagation at the button's `pointerdown`, so the button keeps pointer capture and receives its release. Bumped the controller service-worker cache to v7 so browser clients refresh the corrected JS.
- Bumped desktop and Android package metadata to 1.6.3; Android `versionCode` is 7. Gradle syncs the shared controller source into APK assets.
- This source fix has not yet been built, run through CI, or tested on the user's phone/Windows device. Verify that pressing and releasing L3/R3 causes both the PhantomPad visualizer and `joy.cpl` buttons to turn off immediately.

## Windows gamepad report diagnostics (2026-10-19)
- User confirms the phone events appear in PhantomPad's live visualizer, but Windows Game Controllers does not show ordinary button/axis changes. The dashboard's ViGEmBus availability check has no warning, which only verifies a temporary probe controller, not the per-player controller or its reports.
- Changed per-player ViGEm allocation to acknowledge successful target connection before marking the player ready; controllers that connected before the driver probe completes are now allocated after readiness.
- Added per-player dashboard status for waiting, connecting, ready, first accepted input report, or a caught PowerShell/ViGEm error. Input snapshots now report the first backend failure instead of silently disappearing when the target is missing or report commands fail. Gamepad mode no longer silently routes a player without a virtual controller into keyboard mode.
- Player controller creation now times out visibly after five seconds. Dashboard player rows update latency/status in place; routine RTT refreshes no longer rebuild the full player list.
- Bumped Windows source version to 1.6.4 and CI installer label. Android remains 1.6.3; no Android behavior changed for this backend diagnostics update.
- This change is a diagnostic and race-safety improvement, not yet a verified repair of Windows game input. No Windows installer build, CI run, or user-hardware test has completed. After building/installing v1.6.4, read the per-player status in the dashboard and use any reported error to target the remaining issue.
- Follow-up after the user reports a player-controller creation timeout and no device in joy.cpl: added progress markers for PowerShell command start, target allocation, and ViGEm connection; buffered stdout until complete lines so split marker chunks are not missed; the timeout includes the last confirmed stage. Windows source version is 1.6.5.
- User screenshot from the diagnostic build reports timeout at `Waiting for Windows input bridge`, indicating no per-player PowerShell acknowledgment was observed before target creation. Added persistent PowerShell stdout/stderr, stdin-pipe errors, process-exit details, and timeout stage logging to `PhantomPad_debug.log`; pending player setup now reports an early bridge failure instead of timing out. Bumped Windows version to 1.6.6 and its CI artifact label. This is diagnostic instrumentation, not a verified controller fix; no Windows device test or build has been run.
- The 1.6.6 debug log confirms the ViGEm startup probe reports ready, but no per-player PowerShell acknowledgment arrives. It also captures an invalid trailing `DllImport` attribute in the keyboard helper's C# declaration; this is fixed, though the log does not prove that issue caused the missing per-player acknowledgment. For v1.6.7, the long-lived PowerShell process now uses `-NoExit`, protocol markers use the success/output stream, and each player command logs whether its pipe write completed. This is a targeted repair/diagnostic attempt; installer build and device verification remain outstanding.
- Follow-up log from the 1.6.7 Windows app shows the controller request was written at 16:41:26 India time; the five-second timeout fired at 16:41:31, then PowerShell emitted START, ALLOCATED, CONNECTING, and READY markers at 16:42:05. That attempt reached READY about 39 seconds after request. A later retry was closed 19 seconds after request, before its result appeared. Increased the player setup timeout to 60 seconds and changed protocol markers to direct flushed stdout so the UI can show progress while ViGEm connects. Bumped Windows source/CI artifact label to 1.6.8. This is based on the captured log; no physical Windows game test has been completed.
- Local v1.6.8 installer build initially failed while rebuilding the unused optional `vigemclient` package because Python is unavailable. Disabled native dependency rebuild in the Electron config; the retry downloaded Electron successfully but Windows NSIS packaging could not spawn `makensis.exe` in this sandbox (`spawn UNKNOWN`). No installer artifact was produced here. A retry with electron-builder 24.6.3 reached the same NSIS execution restriction.
- Follow-up on 2026-10-19: the local `%APPDATA%\\phantompad\\PhantomPad_debug.log` confirms the installed build waited the full 60 seconds. PowerShell initialized the ViGEm probe (`VIGEM_READY`) and accepted the player command write, but emitted no `VIGEM_PLAYER_START` marker before timeout. This isolates the failure before per-player ViGEm allocation; extending the timeout did not solve it. Updated PowerShell command submission to append a blank-line terminator for every script block sent over the persistent stdin pipe, so PowerShell commits multiline blocks immediately. Bumped Windows source/CI artifact to 1.6.9. This is a targeted transport repair hypothesis; source has not been built, CI has not run, and Windows/joy.cpl has not yet verified controller creation.
- After the user confirmed the 1.6.9 Windows fix works, aligned the Android package versionName to 1.6.9 and incremented Android versionCode from 7 to 8. Updated the Android CI artifact label to `PhantomPad-Android-v1.6.9-APK`; Android application behavior was otherwise unchanged. Android build has not yet run.

## Pairing and client hardening update (2026-10-21)
- Added an ephemeral pairing code for remote controller sockets, local-only access for dashboard management, bounded input payloads, and validation for controller snapshots and saved names. QR/copy links carry the pairing code; Android now requests it and validates the PhantomPad server response.
- Hardened Android WebView file/content access and top-level navigation, bounded the vibration/toast bridge, and clarified that latency is phone-to-server network RTT while the Windows visualizer shows input received by the server.
- Rendered macro names as text, corrected the ADB instructions, and made the Windows tray copy a usable controller URL.
- Bumped Windows and Android metadata together to 1.7.0 because the mandatory pairing handshake changes client/server compatibility; Android `versionCode` is 9. Updated CI artifact labels. Source syntax and whitespace checks passed; no application build, Jest run, or device test has been performed. The pairing code gates access but LAN traffic remains unencrypted HTTP.

## Shorter pairing code update (2026-10-22)
- Changed the temporary pairing credential to an eight-digit numeric code. Failed remote pairing attempts are limited to five distinct codes per source address in a 60-second window, followed by a 60-second lockout. Repeated automatic retries of the same stale code count once, so a Windows restart does not cause reconnect retries to lock out the phone; successful pairing clears that address's failure counter.
- Updated Android entry validation and keyboard, dashboard instructions, and the controller assets bundled in the Android app. The credential is sent only during Socket.IO connection/authentication; existing automatic reconnections reuse it and input packets remain unchanged.
- Bumped Windows and Android metadata to 1.7.2; Android `versionCode` is 11. No APK/installer build, automated tests, or device tests have been run for this update. Eight digits are shorter but reduce the secret space compared with the former 16-character hexadecimal code; attempt limiting mitigates online guessing.

## Remembered Android phone trust (2026-10-22)
- Bumped Windows and Android source versions to 1.8.0; Android `versionCode` is 12. CI artifact names now include v1.8.0.
- Android creates a P-256 signing key in Android Keystore. Its private key stays on the phone; Windows stores only the public key in `trusted-devices.json` under its persistent PhantomPad data folder (`%APPDATA%` for the packaged app, `data/` for development).
- First pairing still requires the current 8-digit Windows code. After successful controller registration, Windows trusts that Android device for 30 days. Each successful reconnect renews the expiry to 30 days from that connection. Restarting Windows PhantomPad does not erase the trusted-device list.
- Later Android connections request a short-lived, one-use challenge and sign it with the Keystore key. The client requests a fresh challenge for each Socket.IO connection/reconnection. Verification happens only during connection setup, not on controller input packets.
- The local Windows dashboard lists remembered Android phones and can revoke one immediately, disconnecting any active controller session. Expired trust is removed when accessed/listed and requires the current pairing code again.
- The Android Connect screen permits an empty code for a remembered phone. If trust is missing, expired, or revoked, it asks the user to return and enter the current code. Clearing app data or reinstalling loses the Android Keystore key and requires pairing again.
- Browser/PWA controller clients still use the pairing code for each new connection; only the native Android app uses remembered Keystore trust in this update.
- `node --check` passed for `server/index.js`, `server/device-trust.js`, `controller/js/controller.js`, and `dashboard/js/dashboard.js`; `git diff --check` passed. No Jest tests, Android Java compilation, APK/installer builds, or physical-device tests have been run for this change.

## ViGEm startup false alarm (2026-10-22)
- User reports the Windows app displays `Exception calling "Connect" with "0" argument(s): "The operation completed successfully"` and links to Install / repair. Repairing ViGEmBus does not prevent the warning from returning.
- Source inspection found startup creates a temporary Xbox target, calls `Connect()`, then `Disconnect()` as a probe. The bundled archived ViGEm.NET wrapper calls base target plug-in first, then separately registers vibration feedback; for unexpected ViGEm error codes it throws `Win32Exception(Marshal.GetLastWin32Error())`, which can produce the misleading success text. A failed probe could also skip Disconnect and leave the temporary target plugged in. This is a likely code-path explanation, not yet confirmed from the user's debug log.
- Windows source is updated to rely on the ViGEm client constructor for bus connection status and avoid plugging/unplugging a throwaway controller every app launch. For real player targets, if Connect throws but the wrapper's internal connected state confirms the target was plugged into the bus, PhantomPad keeps that controller active and logs that vibration feedback registration was unavailable. Actual target plug-in failures still remain errors.
- Kept the Windows package version and CI installer artifact label at 1.8.0 when the user deferred version changes. The later UI refresh bumps both applications to 1.9.0.
- No tests, build, CI, or user-device validation were run for the ViGEm fix before the UI refresh. The new 1.9.0 Windows package should be installed to confirm the warning no longer appears and game input continues. No ViGEm repair/reinstall should be needed unless the bus client itself reports a real missing/access/version failure.

## Control Deck UI refresh (2026-10-22)
- Reorganized the Windows dashboard into distinct Play and Customize workspaces. The Play view contains connection, player slots, mode, and input telemetry; Customize contains key mappings and macros. The view switch updates its heading and keeps existing DOM ids and handlers intact.
- Restyled Windows around a quieter graphite workbench, with a branded monogram, connection/player hierarchy, responsive cards, and no remote Google Fonts request.
- Redesigned Android's Connect screen around a branded PC connection panel. Recent PCs now appear above manual entry and can still be tapped to reconnect. View IDs consumed by `ConnectActivity.java` are preserved; connection/authentication behavior is unchanged.
- Reworked the shared Android/browser controller into a hardware-style control deck with a framed tactile surface, compact status capsule, and grouped expandable settings for controls, appearance, game presets, and motion. Controller input DOM ids, pointer handling, socket transport, and input payload behavior remain unchanged.
- Bumped Windows and Android versions together to 1.9.0, Android `versionCode` to 13, CI artifact labels to v1.9.0, and the controller service-worker cache to v10.
- Included the pending Windows ViGEm startup false-alarm fix from the prior section. No tests, builds, CI, or visual/device checks have been run for this UI update; rebuild Windows installer and Android APK before using it.

## PhantomPad brand and tray visualizer update (2026-10-23)
- Bumped Windows and Android app versions together to `1.10.0`; Android `versionCode` is `14`; CI artifact names now use `v1.10.0`. Bumped the shared controller service-worker cache from `v10` to `v11` so the logo and theme changes refresh on phones.
- Added the supplied six SVG brand variants under `assets/brand/`. The color lockup now brands the Windows dashboard; the color mark appears in the mobile connect page, controller status bar, Windows tray visualizer, Android connect screen, Android launcher icon, and Windows application icon. Mono black/white variants are included for future high-contrast use.
- Changed the default PhantomPad palette to the supplied cyan/teal `#00F5D4` and indigo `#4F46E5` across dashboard, controller, mobile connect page, and Android native UI. Other controller themes remain available.
- Replaced the fixed-only Electron tray entry with a live tray visualizer. The dashboard includes a tray enable switch (default enabled and saved in Electron user data as `settings.json`). Closing the main window hides it while the server and input bridge remain running if the tray option is on. Clicking the tray icon opens a live player view with actual server RTT, ViGEm/player state, button activity, and both stick positions. The tray menu can reopen the dashboard or explicitly quit PhantomPad.
- Added an explicit server shutdown export used by Electron's Quit action so the input handler and game monitor clean up when the user truly exits; ordinary window close continues to hide while tray mode is enabled.
- The supplied `ai_studio_code.txt` was treated as a visual prototype. Its hardcoded sample phone, fake 1.4 ms latency, random ping simulation, and pretend taskbar were not ported. The live view reads current state from `server/index.js` through a narrow Electron IPC bridge in `electron/preload.js`.
- Added a reproducible `scripts/generate-brand-art.ps1`; it generated the matching `electron/icon.png`, `build/installerHeader.bmp`, and `build/installerSidebar.bmp`. Configured the NSIS assisted installer to use the custom branded header and sidebar, including its uninstall sidebar.
- Mirrored shared controller assets into `android-app/app/src/main/assets/controller`; Gradle continues to synchronize these from `controller/` during `preBuild`.
- Source changes and artwork are present locally. Jest, Android APK build, Windows installer build, CI, tray runtime behavior, and device behavior have not been run or verified in this update. Nothing was committed, pushed, or merged. No physical two-device test is claimed.
