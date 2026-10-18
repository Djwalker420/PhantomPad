# PhantomPad

## What This Is
PhantomPad is a wireless PC game controller system that allows you to use your smartphone as a virtual Xbox 360 controller or a keyboard/mouse emulator. It consists of a Node.js server running on a PC and a responsive mobile web interface (or native Android app) that communicates over Wi-Fi or USB tethering.

## Core Value
Provides a low-latency, immersive, and highly customizable gaming experience by turning any modern smartphone into a fully-functional PC game controller.

## Requirements

### Validated
- ✓ **PC Server Backbone**: Node.js server handling WebSocket connections and API requests. — *existing*
- ✓ **Virtual Controller Emulation**: Integration with ViGEm Bus driver for native Xbox 360 controller support. — *existing*
- ✓ **Keyboard/Mouse Emulation**: Emulating Windows inputs via a PowerShell/User32.dll bridge. — *existing*
- ✓ **Multi-player Support**: Handling up to 4 simultaneous controller connections. — *existing*
- ✓ **Mobile Controller Interface**: Responsive PWA with touch-controls and haptic feedback. — *existing*
- ✓ **Native Android Wrapper**: Immersive fullscreen experience via a dedicated Android app. — *existing*
- ✓ **Preset System**: Pre-defined and custom mappings for popular games (GTA V, Elden Ring, etc.). — *existing*
- ✓ **In-app Macros**: Recording and playing back input sequences. — *existing*

### Active
- [ ] Support for gyroscopic steering — *sensor integration*
- [ ] Presets for popular AAA games — *game support*
- [ ] Universal game compatibility improvements — *input bridge optimization*

### Out of Scope
- [Streaming Video] — This is a controller-only app; use Moonlight/Steam Link for video. — *design-choice*
- [External Server Hosting] — Designed for local network use only to minimize latency. — *design-choice*

## Context
- **Technical Environment**: Windows PC (Server), Android/iOS (Client).
- **Core Pattern**: Event-driven input translation (WebSocket -> Node -> PowerShell -> Win32/ViGEm).
- **Established Patterns**: Cyberpunk-inspired dark UI, centralized configuration in `config.js`.

## Constraints
- **Platform**: PC Server is Windows-only due to ViGEm and User32.dll dependencies.
- **Network**: Requires a local network connection (Wi-Fi or USB) for low latency.
- **Driver Dependency**: Gamepad mode requires the ViGEm Bus Driver to be installed on the PC.

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PowerShell Bridge | Allows accessing Win32 APIs and ViGEm from Node.js without writing a native C++ addon. | ✓ Good |
| Vanilla JS Frontend | Minimizes payload size and ensures maximum compatibility across mobile browsers. | ✓ Good |

## Evolution
This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: April 8, 2026 after codebase mapping*
