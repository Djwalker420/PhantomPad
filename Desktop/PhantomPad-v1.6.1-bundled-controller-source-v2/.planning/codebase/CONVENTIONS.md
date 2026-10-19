# Coding Conventions

## JavaScript (Server & Client)
- **Style**: Standard CommonJS (`require`) for server side; Vanilla JS for client side.
- **Naming**: 
    - Variables/Functions: `camelCase`.
    - Classes: `PascalCase`.
    - Constants: `UPPER_SNAKE_CASE`.
- **Async**: Prefer `async/await` for asynchronous operations (e.g., in `MacroHandler`).
- **Input Patterns**:
    - Input objects follow a standard schema: `{ buttons: {}, axes: {}, triggers: {} }`.
    - Button states are boolean.
    - Axis values are normalized between `-1.0` and `1.0`.

## Java (Android)
- Follows standard Android/Java conventions.
- Use of `WebView` for the primary interface.
- Basic Android lifecycle management in `MainActivity`.

## Error Handling
- **Server**: Try-catch blocks around file I/O and Socket.io events.
- **Client**: Connection status feedback in the UI (e.g., `connect-status` on the login screen).
- **Graceful Degradation**: Gamepad mode is optional; the system falls back to keyboard emulation if the ViGEm driver is missing.

## UI/UX Patterns
- Dark mode by default.
- Use of `Inter` for general text and `JetBrains Mono` for technical/IP details.
- High-contrast primary colors (`#00e5ff` cyan).
