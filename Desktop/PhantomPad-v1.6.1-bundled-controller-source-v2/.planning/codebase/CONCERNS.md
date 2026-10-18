# Technical Concerns & Debt

## Engineering Challenges

### 1. PowerShell Bridge Latency
- **Issue**: Input is routed through Node.js → stdin → PowerShell → .NET/Win32. 
- **Impact**: While usable for many games, this context-switching adds millisecond-level overhead that may be noticeable in highly competitive frame-perfect games.
- **Goal**: Investigate a native Node.js addon (C++) for direct ViGEm/User32 access to reduce overhead.

### 2. ViGEm Dependency
- **Issue**: Gamepad mode only works if the ViGEm Bus Driver is installed on the host PC. 
- **Impact**: Users who don't follow the prerequisites will see "gamepad failed" errors. 
- **Goal**: Improved error messaging and automated installer checks.

### 3. Security
- **Issue**: The server listens on `0.0.0.0` to allow mobile connection, but there is no authentication mechanism.
- **Impact**: Anyone on the local network could potentially send inputs to the PC or access the dashboard.
- **Goal**: Add a simple pairing pin or password protection.

### 4. Code Duplication
- **Issue**: There appear to be two mobile app approaches (`android-app/` and `mobile-app/` with Capacitor).
- **Impact**: Increased maintenance burden.
- **Goal**: Standardize on one approach or clarify the use case for both.

## Technical Debt
- **No Automated Tests**: Lack of unit/integration tests makes refactoring the `InputHandler` risky.
- **In-process Persistence**: Profiles and Mappings are read/written synchronously at runtime. As the files grow, this could cause temporary event-loop blocking.
- **PowerShell stdio usage**: Relying on piping strings to PowerShell is fragile compared to using a structured API.
