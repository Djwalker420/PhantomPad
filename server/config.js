// PhantomPad - Configuration
// Windows Virtual Key Codes & Default Mappings

const VK = {
  BACKSPACE: 0x08, TAB: 0x09, ENTER: 0x0D, SHIFT: 0x10,
  CTRL: 0x11, ALT: 0x12, ESCAPE: 0x1B, SPACE: 0x20,
  LEFT: 0x25, UP: 0x26, RIGHT: 0x27, DOWN: 0x28,
  KEY_0: 0x30, KEY_1: 0x31, KEY_2: 0x32, KEY_3: 0x33,
  KEY_4: 0x34, KEY_5: 0x35, KEY_6: 0x36, KEY_7: 0x37,
  KEY_8: 0x38, KEY_9: 0x39,
  A: 0x41, B: 0x42, C: 0x43, D: 0x44, E: 0x45, F: 0x46,
  G: 0x47, H: 0x48, I: 0x49, J: 0x4A, K: 0x4B, L: 0x4C,
  M: 0x4D, N: 0x4E, O: 0x4F, P: 0x50, Q: 0x51, R: 0x52,
  S: 0x53, T: 0x54, U: 0x55, V: 0x56, W: 0x57, X: 0x58,
  Y: 0x59, Z: 0x5A,
  F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75,
  F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B,
  CAPSLOCK: 0x14,
  SEMICOLON: 0xBA, EQUAL: 0xBB, COMMA: 0xBC, MINUS: 0xBD,
  PERIOD: 0xBE, SLASH: 0xBF, GRAVE: 0xC0,
  LBRACKET: 0xDB, BACKSLASH: 0xDC, RBRACKET: 0xDD, QUOTE: 0xDE
};

// Human-readable key names for the UI
const VK_NAMES = {};
for (const [name, code] of Object.entries(VK)) {
  VK_NAMES[code] = name;
}

const keyMappings = {
  default: {
    A: VK.SPACE, B: VK.E, X: VK.Q, Y: VK.R,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.TAB, rb: VK.F, lt: VK.CTRL, rt: VK.SHIFT,
    start: VK.ENTER, back: VK.ESCAPE, home: VK.TAB,
    ls: VK.C, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },
  fps: {
    A: VK.SPACE, B: VK.C, X: VK.R, Y: VK.F,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.Q, rb: VK.E, lt: VK.CTRL, rt: VK.SHIFT,
    start: VK.ESCAPE, back: VK.TAB, home: VK.M,
    ls: VK.CTRL, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },
  racing: {
    A: VK.SPACE, B: VK.B, X: VK.X, Y: VK.Y,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.Q, rb: VK.E, lt: VK.S, rt: VK.W,
    start: VK.ENTER, back: VK.ESCAPE, home: VK.TAB,
    ls: VK.C, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },
  platformer: {
    A: VK.SPACE, B: VK.X, X: VK.Z, Y: VK.C,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.Q, rb: VK.E, lt: VK.A, rt: VK.S,
    start: VK.ENTER, back: VK.ESCAPE, home: VK.TAB,
    ls: VK.SHIFT, rs: VK.CTRL,
    axisLeftUp: VK.UP, axisLeftDown: VK.DOWN, axisLeftLeft: VK.LEFT, axisLeftRight: VK.RIGHT,
    axisRightUp: VK.W, axisRightDown: VK.S, axisRightLeft: VK.A, axisRightRight: VK.D
  },
  ryujinx: {
    A: VK.X, B: VK.Z, X: VK.V, Y: VK.C,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.Q, rb: VK.E, lt: VK.SHIFT, rt: VK.SPACE,
    start: VK.EQUAL, back: VK.MINUS, home: VK.ESCAPE,
    ls: VK.F, rs: VK.G,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.I, axisRightDown: VK.K, axisRightLeft: VK.J, axisRightRight: VK.L
  },
  retroarch: {
    A: VK.X, B: VK.Z, X: VK.S, Y: VK.A,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.Q, rb: VK.W, lt: VK.E, rt: VK.R,
    start: VK.ENTER, back: VK.SHIFT, home: VK.ESCAPE,
    ls: VK.F, rs: VK.G,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.I, axisRightDown: VK.K, axisRightLeft: VK.J, axisRightRight: VK.L
  },

  // === AAA Game Presets ===
  // Xbox Controller Button → Game Action → Keyboard Key

  // GTA V — Xbox: A=Sprint, B=Reload, X=Jump, Y=Enter Vehicle
  gtav: {
    A: VK.SHIFT, B: VK.R, X: VK.SPACE, Y: VK.F,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.TAB, rb: VK.Q, lt: VK.C, rt: VK.CTRL,
    start: VK.ESCAPE, back: VK.M, home: VK.P,
    ls: VK.CTRL, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Elden Ring — Xbox: A=Interact, B=Dodge, X=Use Item, Y=Event Action
  eldenring: {
    A: VK.E, B: VK.SPACE, X: VK.R, Y: VK.F,
    dpadUp: VK.UP, dpadDown: VK.DOWN, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.SHIFT, rb: VK.CTRL, lt: VK.Q, rt: VK.C,
    start: VK.ESCAPE, back: VK.G, home: VK.ESCAPE,
    ls: VK.X, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Minecraft — Xbox: A=Jump, B=Drop, X=Sneak, Y=Inventory
  minecraft: {
    A: VK.SPACE, B: VK.Q, X: VK.SHIFT, Y: VK.E,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_5, dpadRight: VK.KEY_2,
    lb: VK.KEY_7, rb: VK.KEY_8, lt: VK.CTRL, rt: VK.F,
    start: VK.ESCAPE, back: VK.TAB, home: VK.F5,
    ls: VK.CTRL, rs: VK.SHIFT,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Fortnite — Xbox: A=Jump, B=Crouch, X=Reload, Y=Interact
  fortnite: {
    A: VK.SPACE, B: VK.CTRL, X: VK.R, Y: VK.E,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.Q, rb: VK.G, lt: VK.SHIFT, rt: VK.F,
    start: VK.ESCAPE, back: VK.M, home: VK.TAB,
    ls: VK.CTRL, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Red Dead Redemption 2 — Xbox: A=Sprint, B=Reload, X=Jump, Y=Mount/Interact
  rdr2: {
    A: VK.SHIFT, B: VK.R, X: VK.SPACE, Y: VK.E,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_5, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.Q, lt: VK.B, rt: VK.F,
    start: VK.ESCAPE, back: VK.M, home: VK.P,
    ls: VK.CTRL, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // The Witcher 3 — Xbox: A=Roll/Jump, B=Dodge, X=Sign Cast, Y=Heavy Attack
  witcher3: {
    A: VK.SPACE, B: VK.ALT, X: VK.Q, Y: VK.SHIFT,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_5, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.R, lt: VK.CTRL, rt: VK.C,
    start: VK.ESCAPE, back: VK.J, home: VK.M,
    ls: VK.X, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // === Gacha / Action-RPG Presets ===

  // Genshin Impact — Xbox: A=Jump, B=Sprint, X=(Attack), Y=Burst, RB=Skill, LT=Aim, RT=Sprint
  genshin: {
    A: VK.SPACE, B: VK.SHIFT, X: VK.F, Y: VK.Q,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.Z, rb: VK.E, lt: VK.R, rt: VK.SHIFT,
    start: VK.ESCAPE, back: VK.B, home: VK.M,
    ls: VK.X, rs: VK.C,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Honkai: Star Rail — Xbox: A=Interact, B=Sprint, RB=Attack, X=Skill, Y=Ultimate
  starrail: {
    A: VK.F, B: VK.SHIFT, X: VK.E, Y: VK.Q,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.Z, rb: VK.X, lt: VK.V, rt: VK.TAB,
    start: VK.ESCAPE, back: VK.B, home: VK.M,
    ls: VK.C, rs: VK.CTRL,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Wuthering Waves — Xbox: A=Jump, B=Dodge, RB=Skill, Y=Liberation
  wuwa: {
    A: VK.SPACE, B: VK.SHIFT, X: VK.F, Y: VK.R,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.E, lt: VK.Q, rt: VK.CTRL,
    start: VK.ESCAPE, back: VK.B, home: VK.M,
    ls: VK.X, rs: VK.G,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Tower of Fantasy — Xbox: A=Jump, B=Dodge, X=Interact, Y=Weapon Skill
  tof: {
    A: VK.SPACE, B: VK.SHIFT, X: VK.E, Y: VK.R,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.Q, lt: VK.CTRL, rt: VK.F,
    start: VK.ESCAPE, back: VK.B, home: VK.M,
    ls: VK.X, rs: VK.C,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // === Additional AAA Presets ===

  // Cyberpunk 2077 — Xbox: A=Interact, B=Crouch, X=Reload, Y=Weapon Wheel
  cyberpunk: {
    A: VK.F, B: VK.C, X: VK.R, Y: VK.ALT,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.E, lt: VK.Q, rt: VK.CTRL,
    start: VK.ESCAPE, back: VK.M, home: VK.I,
    ls: VK.SHIFT, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Forza Horizon — Xbox: A=Handbrake, B=Nitro, LT=Brake, RT=Accelerate
  forza: {
    A: VK.SPACE, B: VK.E, X: VK.SHIFT, Y: VK.R,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_2, dpadLeft: VK.LEFT, dpadRight: VK.RIGHT,
    lb: VK.TAB, rb: VK.Q, lt: VK.S, rt: VK.W,
    start: VK.ESCAPE, back: VK.M, home: VK.TAB,
    ls: VK.C, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  },

  // Starfield — Xbox: A=Jump, B=Crouch, X=Reload, Y=Interact
  starfield: {
    A: VK.SPACE, B: VK.CTRL, X: VK.R, Y: VK.E,
    dpadUp: VK.KEY_1, dpadDown: VK.KEY_3, dpadLeft: VK.KEY_4, dpadRight: VK.KEY_2,
    lb: VK.TAB, rb: VK.G, lt: VK.Q, rt: VK.SHIFT,
    start: VK.ESCAPE, back: VK.M, home: VK.P,
    ls: VK.SHIFT, rs: VK.V,
    axisLeftUp: VK.W, axisLeftDown: VK.S, axisLeftLeft: VK.A, axisLeftRight: VK.D,
    axisRightUp: VK.UP, axisRightDown: VK.DOWN, axisRightLeft: VK.LEFT, axisRightRight: VK.RIGHT
  }
};

// Automatic game detection mappings (Process Name -> Preset Name)
const processMappings = {
  'GTA5': 'gtav',
  'EldenRing': 'eldenring',
  'Minecraft': 'minecraft',
  'Fortnite': 'fortnite',
  'RDR2': 'rdr2',
  'witcher3': 'witcher3',
  'GenshinImpact': 'genshin',
  'StarRail': 'starrail',
  'WuWa': 'wuwa',
  'Cyberpunk2077': 'cyberpunk',
  'ForzaHorizon5': 'forza',
  'Starfield': 'starfield'
};

module.exports = {
  port: 3000,
  defaultMode: 'keyboard',
  defaultPreset: 'default',
  axisThreshold: 0.5,
  triggerThreshold: 0.3,
  VK,
  VK_NAMES,
  keyMappings,
  processMappings
};
