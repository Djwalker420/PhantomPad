# Directory Structure

## Repository Root
- `server/`: Core Node.js backend logic.
- `android-app/`: Native Java Android application source and resources.
- `controller/`: Client-side logic for the touch controller.
- `mobile/`: Web landing and connection interface for the mobile browser.
- `dashboard/`: PC-side management interface.
- `electron/`: Desktop application main and preload scripts.
- `data/`: Local storage for profiles, mappings, and macros (created at runtime).
- `dist/`: Build artifacts (Electron installers).

## Core Logic (server/)
- `index.js`: Server initialization and Socket.io event handling.
- `input-handler.js`: High-level translation of network events to OS inputs.
- `macro-handler.js`: Logic for recording and playing back input sequences.
- `config.js`: Configuration constants, key codes, and game presets.
- `lib/`: Binary dependencies (e.g., `Nefarius.ViGEm.Client.dll`).

## Mobile UI (mobile/ & controller/)
- `index.html`: Landing page for server connection.
- `manifest.json`: PWA configuration.
- `sw.js`: Service worker for offline/standalone support.
- Shared assets like images and fonts.

## Native Mobile (android-app/)
- `app/src/main/java/`: Java source code for the Android wrapper.
- `app/src/main/res/`: Layouts, icons, and string resources.

## Desktop Wrapper (electron/)
- `main.js`: Electron main process (lifecycle and window management).
- `icon.png`: Application icon.

## Project Metadata
- `package.json`: Dependency and script management.
- `LICENSE`: MIT License.
- `README.md`: Project overview and usage instructions.
