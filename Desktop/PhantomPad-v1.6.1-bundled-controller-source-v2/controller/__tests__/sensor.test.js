const Utils = require('../js/utils');

describe('Sensor Utilities', () => {
  describe('normalizeSensor', () => {
    test('should map 0 degrees to 0.0', () => {
      expect(Utils.normalizeSensor(0, 45)).toBe(0);
    });

    test('should map max degrees to 1.0', () => {
      expect(Utils.normalizeSensor(45, 45)).toBe(1);
      expect(Utils.normalizeSensor(-45, 45)).toBe(-1);
    });

    test('should clamp values exceeding max degrees', () => {
      expect(Utils.normalizeSensor(60, 45)).toBe(1);
      expect(Utils.normalizeSensor(-60, 45)).toBe(-1);
    });

    test('should respect deadzone', () => {
      // With 45deg max and 0.1 deadzone: 0.1 * 45 = 4.5 degrees
      expect(Utils.normalizeSensor(4, 45, 1.0, 0.1)).toBe(0);
      expect(Utils.normalizeSensor(5, 45, 1.0, 0.1)).toBe(0.111);
    });

    test('should apply sensitivity multiplier', () => {
      expect(Utils.normalizeSensor(22.5, 45, 2.0)).toBe(1.0);
    });

    test('should round to 3 decimal places', () => {
      expect(Utils.normalizeSensor(10, 45)).toBe(0.222);
    });
  });
});
