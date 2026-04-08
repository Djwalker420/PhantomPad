# Tech Stack

## Core Technologies
- **Server Runtime**: Node.js (v18+)
- **Desktop Wrapper**: Electron (v30+)
- **Mobile Foundation**: Capacitor (used in `mobile-app/`)
- **Native Android**: Java-based native app wrapper in `android-app/`

## Backend Frameworks
- **Web Server**: Express.js
- **Real-time Communication**: Socket.io (using WebSockets and Polling)

## Frontend Technologies
- **Controller UI**: Vanilla HTML5, CSS3, and JavaScript
- **Dashboard UI**: Vanilla HTML5, CSS3, and JavaScript
- **Styling**: Pre-defined CSS variables for a dark, "cyberpunk" aesthetic

## Systems Integration
- **Input Emulation**: 
    - **Keyboard/Mouse**: Windows User32.dll via PowerShell bridge (`keybd_event`, `mouse_event`).
    - **Virtual Controller**: ViGEm Bus Driver (via `Nefarius.ViGEm.Client.dll` and PowerShell).
- **Communication**: 
    - WebSocket for low-latency input.
    - REST for info/configuration.
    - QR Codes for easy phone connection.

## Key Dependencies
- `express`: Web server
- `socket.io`: Low-latency data sync
- `qrcode`: Connection setup
- `vigemclient`: Optional native bridge to ViGEm
- `electron-builder`: Packaging for Windows
