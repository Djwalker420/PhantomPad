# PhantomPad
Turn your phone into a wireless PC game controller. 

This is just a fun side project I threw together. It runs a local Node.js server that connects to a responsive mobile web-interface (or native Android app), allowing you to play PC games and emulators using your smartphone over Wi-Fi or USB tethering.

**Disclaimer:** This is highly experimental, not completely tested, and **might contain unknown bugs**. Don't expect it to be perfectly polished!

## Features 
* **Virtual Gamepad:** Emulates a real Xbox 360 controller on your PC using the ViGEm Bus.
* **Keyboard Emulation:** Maps joystick axes and buttons to keys for emulators (includes basic presets for Ryujinx, RetroArch, etc.).
* **Haptics:** Phone vibrates natively when pressing buttons.
* **Low Latency:** Works nicely locally over USB Tethering or Wi-Fi.

## Prerequisites
To get this working, your PC needs:
* [Node.js](https://nodejs.org/en/) installed.
* [ViGEmBus Driver](https://github.com/nefarius/ViGEmBus/releases) installed (required for Windows to recognize the virtual controller).

## Getting Started

1. Clone or download this repository.
2. Install the required Node dependencies:
   ```bash
   npm install
   ```
3. Run the PC Server:
   ```bash
   npm start
   ```
4. Find the IP Address shown in your terminal (or open `http://localhost:3000` on your PC for the Dashboard).
5. Open that IP link inside your phone's browser, connect, and start playing!

### Using the Android App
There's an `android-app` folder containing a dedicated native Android wrapper. If you'd rather not use a web browser on your phone, you can build this project in Android Studio and run it natively. The app hides the system UI and provides a fully immersive landscape experience.

## Warning
Again, it's just a weekend side project! It probably has some memory issues or edge-case bugs, so feel free to tweak the source code if something breaks.

## License
MIT License.
