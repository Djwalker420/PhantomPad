# PhantomPad

<p align="center">
  <img src="assets/brand/phantompad-lockup-color.svg" alt="PhantomPad" width="420">
</p>

<p align="center">
  <strong>Your phone, your controller.</strong><br>
  Turn one or two Android phones into customizable controllers for games on a Windows PC.
</p>

<p align="center">
  <img alt="Windows app version 1.10.0" src="https://img.shields.io/badge/Windows-1.10.0-4F46E5?style=for-the-badge">
  <img alt="Android app version 1.10.0" src="https://img.shields.io/badge/Android-1.10.0-00BFA6?style=for-the-badge">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-20252D?style=for-the-badge">
</p>

PhantomPad connects a mobile controller interface to a desktop app over your local network. Use the Android app or a phone browser, customize the on-screen layout, and send input to Windows as an Xbox 360 controller or mapped keyboard input.

## What’s included

- **Windows desktop app** with a live dashboard, player status, input visualization, and connection controls.
- **Android controller app** with touch controls, customizable layouts, themes, and latency display.
- **Two input modes:** virtual Xbox 360 gamepad through ViGEmBus, or keyboard mappings.
- **Multiple players:** connect up to two phones and assign them as players.
- **Pairing protection:** an eight-digit pairing code, rate-limited failed attempts, and an Android device trust period that renews after a successful reconnect.
- **Tray visualizer:** see connected-player input and status from the Windows tray. With the tray option enabled, closing the main window hides it while the server continues running; choose **Quit** from the tray menu to stop it.
- **Branded installer:** the Windows installer uses PhantomPad’s logo and visual theme.

Latency readings help diagnose the network connection. They can vary with Wi-Fi conditions, hotspot load, and the number of connected devices; PhantomPad does not promise a fixed latency.

## Requirements

### To use PhantomPad

- Windows 10 or 11 for the desktop app.
- An Android phone running Android 7.0 (API 24) or newer, or a mobile browser.
- A shared local connection between the phone and PC, such as the same Wi-Fi network, a laptop hotspot, or USB tethering.
- **ViGEmBus** installed on Windows for virtual gamepad mode. Keyboard mode does not use the virtual gamepad driver.

### To build from source

- Node.js 20 and npm for the desktop app.
- Android Studio with JDK 17 and Android SDK 35 for the Android app.
- Windows is required to produce the Windows installer with the project’s current build configuration.

## Quick start: Windows development app

From the project root, install dependencies and start the desktop app:

```powershell
npm ci
npm run start:pc
```

The dashboard runs on the PC, normally at `http://localhost:3000`. Open its connection view to find the phone URL and pairing code. Keep the phone and PC on the same local network, open the controller on the phone, and complete pairing.

To run the server without the Electron desktop wrapper, use `npm start`. The dashboard is then available in a browser on the PC.

## Connect a phone

1. Start PhantomPad on Windows and make sure the server is running.
2. On the phone, open the controller URL shown by the dashboard, or enter the PC’s local address in the Android app.
3. Enter the current eight-digit pairing code for the first pairing.
4. Choose the player and input mode, then confirm that the dashboard shows the phone’s live input.

The Android app can remember a paired device for 30 days. A successful reconnect renews that period. A mobile browser may require pairing again when it creates a new connection. The dashboard provides controls for managing trusted devices.

## Build the Android APK

In Android Studio, open the `android-app` folder and build the app. Or, from PowerShell at the repository root:

```powershell
Set-Location android-app
.\gradlew.bat assembleDebug
```

The debug APK is written to:

```text
android-app/app/build/outputs/apk/debug/app-debug.apk
```

The Android application ID is `com.phantompad.controller`. For a release APK, use Android Studio’s **Generate Signed Bundle / APK** flow and sign it with your own securely stored keystore.

## Build the Windows installer

On Windows, run from the repository root:

```powershell
npm ci
npm run build:pc
```

The installer is created under `dist/electron/`. The build uses the NSIS installer target and the custom artwork in `build/`.

## Tests

Run the Jest suite from the repository root:

```powershell
npm test -- --runInBand
```

The GitHub Actions workflow also builds a debug Android APK and Windows installer and uploads them as workflow artifacts. Artifact availability depends on a successful workflow run; the files are not stored in the source repository by this README.

## Project map

| Path | Purpose |
| --- | --- |
| `electron/` | Windows desktop shell, tray visualizer, and Electron integration |
| `server/` | Local server, pairing, device trust, and input handling |
| `dashboard/` | Desktop dashboard and player status UI |
| `controller/` | Browser-based mobile controller |
| `mobile/` | Mobile web interface and shared branding |
| `android-app/` | Native Android application and its bundled controller interface |
| `assets/brand/` | PhantomPad logo assets |
| `build/` | Windows installer artwork |
| `scripts/` | Branding and asset-generation helper scripts |

## Troubleshooting

- **The phone connects, but a game receives no controller input:** select gamepad mode, confirm ViGEmBus is installed, and check whether Windows lists a PhantomPad Xbox 360 controller in **Set up USB game controllers** (`joy.cpl`). The dashboard’s live input confirms that the phone is reaching PhantomPad; it does not by itself confirm that Windows created a virtual controller.
- **The controller cannot connect:** verify both devices are on the same reachable network, allow PhantomPad through Windows Firewall on the private network, and use the current address and pairing code shown by the desktop dashboard.
- **Latency varies:** test with fewer network-heavy apps and devices, and compare the phone’s displayed latency while both phones are connected. Hotspot performance depends on the host PC and radio conditions.
- **The tray visualizer does not appear:** check the tray visualizer option in the desktop app. Closing the main window hides it only while the tray feature is enabled.

For security, keep the server on a trusted local network and do not expose its port directly to the public internet.

## License

PhantomPad is distributed under the [MIT License](LICENSE).
