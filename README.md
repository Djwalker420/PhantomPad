# PhantomPad

<p align="center">
  <img src="assets/brand/phantompad-lockup-color.svg" alt="PhantomPad" width="420">
</p>

<p align="center">
  <strong>Your phone, your controller.</strong><br>
  Play PC games with customizable Android controllers over USB tethering or Wi-Fi.
</p>

<p align="center">
  <img alt="Windows app version 1.16.0" src="https://img.shields.io/badge/Windows-1.16.0-4F46E5?style=for-the-badge">
  <img alt="Android app version 1.16.0" src="https://img.shields.io/badge/Android-1.16.0-00BFA6?style=for-the-badge">
</p>

## Download

Download the latest **Windows installer** (`PhantomPad Setup 1.16.0.exe`) and **Android APK** from [PhantomPad Releases](https://github.com/Djwalker420/PhantomPad/releases).

During Windows installation, PhantomPad checks for the ViGEmBus driver. If missing, setup prompts to download and install it automatically. Existing drivers are preserved.

## What you need

- A Windows 10 or 11 PC.
- An Android phone running Android 7.0 or newer (or a mobile web browser).
- A connection between the PC and phone:
  - **USB Tethering (Recommended):** USB cable for zero-configuration, plug-and-play connection with sub-millisecond latency.
  - **Wi-Fi / Hotspot:** Same local Wi-Fi or laptop mobile hotspot.
- ViGEmBus driver installed on Windows (checked during setup).

---

## How to Connect

### Option A: USB Tethering (Plug & Play — Recommended)
1. Open PhantomPad on your PC.
2. Connect your phone to your PC using a USB cable.
3. Turn on **USB Tethering** in your phone's Android Settings (`Settings > Network & internet > Hotspot & tethering > USB tethering`).
4. Open the PhantomPad app on your phone:
   - The app instantly detects the PC over the USB link.
   - It bypasses all pairing screens and auto-authorizes immediately.
   - You are greeted with a tactile connection rumble and a floating HUD banner indicating your assigned player slot (P1 / P2).

### Option B: Wi-Fi / Local Network
1. Open PhantomPad on your PC.
2. Connect both phone and PC to the same Wi-Fi network or laptop hotspot.
3. Open the PhantomPad app on your phone.
4. Tap your PC's name when it appears in the scan list.
5. On first connection, approve the request in the Windows app. Approved phones are remembered for 30 days.

*Browser controllers can also connect by scanning the QR code or visiting the URL and entering the 8-digit pairing code shown in the Windows dashboard.*

---

## Features

- **Plug & Play USB Tethering:** Zero-step auto-detection and auto-authorization for wired gaming with < 1 ms latency.
- **Force Feedback / Rumble:** Real-time PC game motor vibration transmitted to your phone's haptic motor via ViGEmBus.
- **Multi-Player Support:** Simultaneous connection for multiple phones with independent virtual Xbox 360 controllers.
- **Low Latency Architecture:** `TCP_NODELAY` network delivery, high-priority Windows input bridge, differential button caching, and 0 ms immediate button dispatch.
- **Customizable Layouts & Themes:** Fully customizable button positions, adjustable stick sizes, deadzone tuning, and four color themes (Phantom, Neon, Crimson, Emerald).
- **Notchless Fullscreen Immersion:** Edge-to-edge layout utilizing the full display width across front camera cutouts with sticky system bar hiding.
- **Gamepad & Keyboard Modes:** Standard Xbox 360 controller emulation via ViGEmBus or configurable keyboard key mapping.
- **Windows Tray Visualizer:** Live input activity and latency monitor running discreetly in the system tray.

---

## Troubleshooting

- **USB Tethering not connecting automatically:** Ensure **USB Tethering** is toggled ON in Android Settings. If prompted on the phone, select "File Transfer / Tethering" rather than "Charging only".
- **Phone cannot find the PC over Wi-Fi:** Verify that both devices are on the same Wi-Fi network, and ensure PhantomPad is permitted through Windows Firewall for private networks.
- **Games do not recognize the controller:** Confirm that ViGEmBus is installed and verify that an Xbox 360 controller appears in Windows' **Set up USB game controllers** utility (`joy.cpl`).
- **Input lag or latency spikes over Wi-Fi:** Switch to a 5 GHz Wi-Fi band or use USB Tethering for optimal 0.5–1 ms input response.

---

## License

PhantomPad is available under the [MIT License](LICENSE).
