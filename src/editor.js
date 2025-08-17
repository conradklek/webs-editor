import { UndoRedoHistory } from "./history.js";
import { CommandRegistry } from "./commands.js";
import { processKeyEvent } from "./input.js";
import { createKeymaps } from "./keymaps.js";
import { actions } from "./actions.js";

export function updateView(editor) {
  editor.callback(editor.state);
}

export function createInitialState(initialValue, language = "js") {
  return {
    mode: "NORMAL",
    text: initialValue,
    selection: { start: 0, end: 0, anchor: 0 },
    visualSelection: null,
    search: { term: "", lastMatch: null },
    targetColumn: 0,
    yankRegister: { text: "", type: "char" },
    commandLine: { prefix: "", input: "" },
    keyBuffer: "",
    motionCount: 0,
    pendingOperator: null,
    lastAction: null,
    lastFindMotion: null,
    language: language,
    isDirty: false,
    statusMessage: "",
    generation: 0,
  };
}

export class Editor {
  constructor(initialValue, callback, language = "js") {
    this.callback = callback;
    this.language = language;
    this.fileName = null;
    this.filePath = null;
    this.state = createInitialState(initialValue, language);
    this.actions = {};
    for (const key in actions) {
      this.actions[key] = actions[key].bind(null, this);
    }
    this.history = new UndoRedoHistory(initialValue);
    this.keymaps = createKeymaps();
    this.bufferClearTimer = null;
    this.commandRegistry = new CommandRegistry(this);
    this.setMode("NORMAL");
  }

  registerCommand(name, handler) {
    this.commandRegistry.register(name, handler);
  }

  setState(updater) {
    const oldState = { ...this.state };
    const newState =
      typeof updater === "function" ? updater(oldState) : updater;
    this.state = { ...oldState, ...newState };
    this.notify();
  }

  notify() {
    updateView(this);
  }

  processKeyEvent(event) {
    processKeyEvent(this, event);
  }

  setMode(newMode, options = {}) {
    this.setState((state) => ({
      mode: newMode,
      selection: options.selection || state.selection,
      visualSelection: null,
      commandLine: { prefix: "", input: "" },
      keyBuffer: "",
      motionCount: 0,
      pendingOperator: null,
      ...options.state,
    }));
  }

  reset(initialValue = "", { fileName, filePath } = {}) {
    this.language = filePath && filePath.endsWith(".js") ? "js" : "plaintext";
    this.state = createInitialState(initialValue, this.language);
    this.history.clear();
    this.history.record(this.state.text, { immediate: true });
    this.fileName = fileName || "[Untitled]";
    this.filePath = filePath;
    this.state.isDirty = false;
    this.notify();
  }
}
