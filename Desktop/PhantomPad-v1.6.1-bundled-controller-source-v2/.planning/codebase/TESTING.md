# Testing Practices

## Automated Testing
- **Current State**: No formal automated test suites (Jest, Mocha, etc.) were found in the codebase.
- **Recommendations**: 
    - Implement unit tests for `InputHandler` and `MacroHandler`.
    - Use a mock for the PowerShell child process during testing.

## Manual Testing Workflow
1. **Connectivity**: Test phone-to-PC connection via Wi-Fi, Ethernet, and USB Tethering.
2. **Latency**: Use the `ping-check` event to measure RTT.
3. **Accuracy**: Verify that button presses on the mobile UI translate to the correct keys/actions in Windows.
4. **ViGEm Integration**: Use "Game Controllers" (Joy.cpl) in Windows to verify the virtual Xbox 360 controller is detected and responding to inputs.

## Debugging Tools
- Node.js console logs for backend events.
- Browser DevTools for mobile/dashboard UI debugging.
- PowerShell error output for input emulation failures.
