// PhantomPad - Macro Recording & Playback
class MacroHandler {
  constructor(inputHandler) {
    this.inputHandler = inputHandler;
    this.macros = new Map(); // name -> { steps: [], duration }
    this.recording = null; // { name, steps: [], startTime }
    this.playing = new Set(); // currently playing macro names
  }

  startRecording(name) {
    if (this.recording) return false;
    this.recording = { name, steps: [], startTime: Date.now() };
    return true;
  }

  recordInput(data) {
    if (!this.recording) return;
    this.recording.steps.push({
      timestamp: Date.now() - this.recording.startTime,
      data: JSON.parse(JSON.stringify(data))
    });
  }

  stopRecording() {
    if (!this.recording) return null;
    const macro = {
      name: this.recording.name,
      steps: this.recording.steps,
      duration: Date.now() - this.recording.startTime,
      created: Date.now()
    };
    this.macros.set(macro.name, macro);
    this.recording = null;
    return macro;
  }

  async playMacro(name, socketId) {
    const macro = this.macros.get(name);
    if (!macro || this.playing.has(name)) return false;

    this.playing.add(name);
    const startTime = Date.now();

    for (const step of macro.steps) {
      if (!this.playing.has(name)) break; // cancelled
      const waitTime = step.timestamp - (Date.now() - startTime);
      if (waitTime > 0) await this._sleep(waitTime);
      if (!this.playing.has(name)) break;
      this.inputHandler.handleInput(socketId, step.data);
    }

    this.playing.delete(name);
    return true;
  }

  stopMacro(name) {
    this.playing.delete(name);
  }

  stopAll() {
    this.playing.clear();
  }

  deleteMacro(name) {
    this.macros.delete(name);
    this.playing.delete(name);
  }

  getMacrosList() {
    return [...this.macros.entries()].map(([name, m]) => ({
      name, steps: m.steps.length, duration: m.duration, created: m.created
    }));
  }

  exportMacro(name) {
    return this.macros.get(name) || null;
  }

  importMacro(data) {
    if (!data || !data.name || !data.steps) return false;
    this.macros.set(data.name, data);
    return true;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = { MacroHandler };
