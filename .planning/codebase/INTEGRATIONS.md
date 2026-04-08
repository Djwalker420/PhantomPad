# External Integrations

## Core Bridges

### 1. ViGEm Bus (Virtual Gamepad Emulation)
- **Library**: `Nefarius.ViGEm.Client.dll`
- **Method**: Loaded in a PowerShell child process via `Add-Type`.
- **Purpose**: Emulates a real Xbox 360 controller recognized by Windows and AAA games.
- **Requirement**: The ViGEm Bus Driver must be installed on the host PC.

### 2. Windows User32 API (Keyboard/Mouse Emulation)
- **Library**: `user32.dll` (System native)
- **Method**: P/Invoke via `Add-Type` in PowerShell.
- **Functions used**:
    - `keybd_event`: Injecting keyboard button presses.
    - `mouse_event`: Injecting mouse clicks and scrolls.
    - `GetCursorPos` / `SetCursorPos`: Getting/setting the local mouse coordinates.

## Network Services

### 1. Socket.io
- **Role**: Bi-directional communication.
- **Transports**: WebSocket and Polling.
- **Data**: Real-time controller packets, player registration, and status updates.

### 2. Express API
- **Endpoint /api/info**: Information for connection discovery.
- **Endpoint /api/qr**: Generates a base64 DataURL for a connection QR code.
- **Endpoint /api/mappings**: Returns default and custom button presets.

## Platform Integration

### 1. Electron
- **Integration**: Used for packaging as a Windows application.
- **Capabilities**: Used to get the system's `userData` path for persistent storage of custom profiles.

### 2. Cordova / Capacitor
- **Status**: Referenced in `package.json` scripts (`cap:init`, `cap:android`).
- **Use Case**: Used for packaging the web-based mobile UI into a native Android app wrapper.

### 3. Native Android
- **Component**: Native `MainActivity.java` with a `WebView`.
- **Focus**: Providing a fullscreen, immersive experience without browser UI chrome.
