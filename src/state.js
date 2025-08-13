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
