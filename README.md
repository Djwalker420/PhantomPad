# PhantomPad

<p align="center">
  <img src="assets/brand/phantompad-lockup-color.svg" alt="PhantomPad" width="420">
</p>

<p align="center">
  <strong>Your phone, your controller.</strong><br>
  Play PC games with one or two customizable Android controllers.
</p>

<p align="center">
  <img alt="Windows app version 1.10.0" src="https://img.shields.io/badge/Windows-1.10.0-4F46E5?style=for-the-badge">
  <img alt="Android app version 1.10.0" src="https://img.shields.io/badge/Android-1.10.0-00BFA6?style=for-the-badge">
</p>

## Download

Download the latest **Windows installer** and **Android APK** from [PhantomPad Releases](https://github.com/Djwalker420/PhantomPad/releases). Install the Windows app on your PC and the Android app on each phone you want to use.

## What you need

- A Windows 10 or 11 PC.
- An Android phone running Android 7.0 or newer. A phone browser can also be used.
- A local connection between the PC and phone, such as the same Wi-Fi, your laptop’s hotspot, or USB tethering.
- **ViGEmBus** on Windows if you want to use gamepad mode. Keyboard mode does not require it.

## Connect your phone

1. Open PhantomPad on the PC.
2. Connect the phone and PC to the same local network.
3. Open the Android app and enter the PC address and pairing code shown in the Windows app.
4. Choose a player and input mode, then check the Windows app to confirm input is arriving.

The Android app can remember a paired phone for 30 days. Reconnecting successfully renews that period. The Windows app also shows player input and connection latency.

## Features

- Customizable touch controller layouts and themes.
- Gamepad mode and keyboard mode.
- Support for two connected players.
- Live input and latency indicators.
- A Windows tray visualizer that can keep PhantomPad running when its main window is closed. Choose **Quit** from the tray menu to exit completely.

Latency depends on your network and may change while using a hotspot or connecting multiple phones.

## Troubleshooting

- **Phone will not connect:** Check that both devices are on the same network, then use the current PC address and pairing code shown in PhantomPad.
- **The game does not see a controller:** Select gamepad mode, check that ViGEmBus is installed, and look for an Xbox controller in Windows’ **Set up USB game controllers** window (`joy.cpl`).
- **Input appears in PhantomPad but not in the game:** The phone is reaching the PC, but Windows may not have created the virtual controller. Check the Windows app for a virtual controller error.
- **Latency changes:** Hotspot and Wi-Fi conditions affect latency. If possible, reduce other network activity and compare with one phone connected.

For safety, use PhantomPad on a trusted local network and do not expose it directly to the public internet.

## License

PhantomPad is available under the [MIT License](LICENSE).
