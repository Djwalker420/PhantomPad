# PhantomPad

<p align="center">
  <img src="assets/brand/phantompad-lockup-color.svg" alt="PhantomPad" width="420">
</p>

<p align="center">
  <strong>Your phone, your controller.</strong><br>
  Play PC games with one or two customizable Android controllers.
</p>

<p align="center">
  <img alt="Windows app version 1.12.0" src="https://img.shields.io/badge/Windows-1.12.0-4F46E5?style=for-the-badge">
  <img alt="Android app version 1.12.0" src="https://img.shields.io/badge/Android-1.12.0-00BFA6?style=for-the-badge">
</p>

## Download

Download the latest **Windows installer** and **Android APK** from [PhantomPad Releases](https://github.com/Djwalker420/PhantomPad/releases). During Windows installation, PhantomPad checks for ViGEmBus and vJoy. If either driver is missing, setup asks to download and install it from its official GitHub release. Both drivers are required; setup cannot finish if they are declined or unavailable. Existing drivers are left alone.

## What you need

- A Windows 10 or 11 PC.
- An Android phone running Android 7.0 or newer. A phone browser can also be used.
- A local connection between the PC and phone, such as the same Wi-Fi, your laptop’s hotspot, or USB tethering.
- ViGEmBus and vJoy are installed or checked during Windows setup. Internet access is needed during installation when either driver is missing.

## Connect your phone

1. Open PhantomPad on the PC.
2. Connect the phone and PC to the same Wi-Fi or USB-tethered network.
3. Open the Android app and tap the PC name when it appears.
4. The first time, approve the phone in PhantomPad on Windows. Later connections are remembered for 30 days, renewed after each successful connection.
5. Choose a player and input mode, then check the Windows app to confirm input is arriving.

The Windows app also shows player input and connection latency. **Auto** switches to Racepad for recognized racing simulations and Gamepad for other apps; you can choose either mode manually. Browser controllers can still connect using the URL and pairing code shown in the Windows app.

Racepad uses the [vJoy virtual joystick](https://github.com/jshafer817/vJoy/releases). In **Configure vJoy**, enable a device with X, Y, Z, Rx and Ry axes and 32 buttons. For multiple racing players, configure one device per phone (IDs 1–4). Racepad sends steering, throttle, brake, clutch and handbrake as separate axes, plus wheel and gear buttons. Bind them in each game's controls screen. Game detection selects the output mode; it cannot set each game's own bindings, and games differ in their support for generic DirectInput devices. Games that only accept Xbox-style input should use Gamepad mode. A phone cannot provide the steering torque of a physical force-feedback wheel.

The Racepad idea—using a phone as a racing controller with motion-based steering—was inspired by [Gyropad](https://github.com/BilalShakoor/Gyropad), an open-source phone steering project for PC sim racing. PhantomPad's Racepad controls, connection flow, and vJoy output are implemented in this project. See the [Gyropad repository](https://github.com/BilalShakoor/Gyropad) for its project and source.

## Features

- Customizable touch controller layouts and themes.
- Gamepad mode and keyboard mode.
- Support for two connected players.
- Live input and latency indicators.
- A Windows tray visualizer that can keep PhantomPad running when its main window is closed. Choose **Quit** from the tray menu to exit completely.

Latency depends on your network and may change while using a hotspot or connecting multiple phones.

## Troubleshooting

- **Phone does not find the PC:** Check that both devices are on the same local network, and allow PhantomPad through Windows Firewall for private networks.
- **Phone is waiting for approval:** Open the Windows app and allow the request under **New phone requests**.
- **The game does not see a controller:** Select gamepad mode, check that ViGEmBus is installed, and look for an Xbox controller in Windows’ **Set up USB game controllers** window (`joy.cpl`).
- **Input appears in PhantomPad but not in the game:** The phone is reaching the PC, but Windows may not have created the virtual controller. Check the Windows app for a virtual controller error.
- **Latency changes:** Hotspot and Wi-Fi conditions affect latency. If possible, reduce other network activity and compare with one phone connected.

For safety, use PhantomPad on a trusted local network and do not expose it directly to the public internet.

## License

PhantomPad is available under the [MIT License](LICENSE).
