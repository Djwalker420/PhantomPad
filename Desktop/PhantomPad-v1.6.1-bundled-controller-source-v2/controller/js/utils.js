// PhantomPad Controller Utilities
const Utils = {
  /**
   * Normalizes tilt data into a -1 to 1 range for joysticks
   * @param {number} tilt - The difference in degrees from the base orientation
   * @param {number} maxDeg - The degree value that maps to 1.0 (e.g. 30 or 45)
   * @param {number} sens - Sensitivity multiplier
   * @param {number} deadzone - Deadzone threshold
   * @returns {number} Normalized value rounded to 3 decimal places
   */
  normalizeSensor: (tilt, maxDeg, sens = 1.0, deadzone = 0.1) => {
    let n = (tilt / maxDeg) * sens;
    n = Math.max(-1, Math.min(1, n));
    if (Math.abs(n) < deadzone) n = 0;
    return Math.round(n * 1000) / 1000;
  }
};

if (typeof module !== 'undefined') {
  module.exports = Utils;
}
