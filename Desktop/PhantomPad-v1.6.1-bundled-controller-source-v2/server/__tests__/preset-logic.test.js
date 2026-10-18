const config = require('../config');
// Mocking the behavior of the switching logic in index.js
// Since index.js is a large entry point, we test the core logic:
// mapping process name -> preset -> key mapping.

describe('Server Preset Logic', () => {
  test('should return correct preset for known games', () => {
    expect(config.processMappings['GTA5']).toBe('gtav');
    expect(config.processMappings['EldenRing']).toBe('eldenring');
    expect(config.processMappings['Cyberpunk2077']).toBe('cyberpunk');
  });

  test('should have valid key mappings for new AAA presets', () => {
    const cp = config.keyMappings['cyberpunk'];
    expect(cp).toBeDefined();
    expect(cp.A).toBe(config.VK.F);
    
    const forza = config.keyMappings['forza'];
    expect(forza).toBeDefined();
    expect(forza.rt).toBe(config.VK.W); // Gas
    expect(forza.lt).toBe(config.VK.S); // Brake
  });

  test('should handle unknown processes gracefully', () => {
    expect(config.processMappings['UnknownGame.exe']).toBeUndefined();
  });
});
