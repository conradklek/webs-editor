import { motions } from "./motions.js";

function getKeyString(event) {
  if (event.ctrlKey) return `Ctrl+${event.key.toLowerCase()}`;
  return event.key;
}

function handleInputModeKeys(editor, event) {
  const { mode } = editor.state;
  const { key } = event;
  if (key === "Escape" || (event.ctrlKey && event.key === "c")) {
    editor.actions.enterNormalMode();
    return;
  }
  if (event.ctrlKey && (event.key === "e" || event.key === "p")) {
    return;
  }

  switch (mode) {
    case "INSERT":
      if (key === "ArrowUp") {
        editor.actions.moveCursor(motions.up);
      } else if (key === "ArrowDown") {
        editor.actions.moveCursor(motions.down);
      } else if (key === "ArrowLeft") {
        editor.actions.moveCursor(motions.left);
      } else if (key === "ArrowRight") {
        editor.actions.moveCursor(motions.right);
      } else if (key === "Enter") {
        editor.actions.insertText("\n");
      } else if (key === "Backspace") {
        editor.actions.deleteCharBackwards();
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
        editor.actions.insertText(key);
      }
      break;
    case "VISUAL_COMMAND":
    case "COMMAND_LINE":
      if (key === "Enter") editor.actions.executeCommand();
      else if (key === "Backspace") {
        editor.setState((state) => ({
          commandLine: {
            ...state.commandLine,
            input: state.commandLine.input.slice(0, -1),
          },
        }));
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
        editor.setState((state) => ({
          commandLine: {
            ...state.commandLine,
            input: state.commandLine.input + key,
          },
        }));
      }
      break;
    case "AWAITING_MOTION_CHAR":
    case "AWAITING_REPLACE_CHAR":
      if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
        editor.actions.processAwaitedChar(key);
      }
      break;
    case "GENERATING_TEXT":
      break;
  }
}

export function processKeyEvent(editor, event) {
  const { mode } = editor.state;
  if (
    [
      "INSERT",
      "COMMAND_LINE",
      "VISUAL_COMMAND",
      "AWAITING_MOTION_CHAR",
      "AWAITING_REPLACE_CHAR",
      "GENERATING_TEXT",
    ].includes(mode)
  ) {
    handleInputModeKeys(editor, event);
    return;
  }
  const key = getKeyString(event);
  const keymap = editor.keymaps[mode];
  if (!keymap) return;
  if (
    (key >= "1" && key <= "9") ||
    (key === "0" && editor.state.motionCount > 0)
  ) {
    const newCount = editor.state.motionCount * 10 + parseInt(key, 10);
    editor.setState({ motionCount: newCount });
    return;
  }
  const newKeyBuffer = editor.state.keyBuffer + key;
  clearTimeout(editor.bufferClearTimer);
  editor.bufferClearTimer = setTimeout(
    () => editor.setState({ keyBuffer: "", motionCount: 0 }),
    1000,
  );
  const commandLookupKey = newKeyBuffer.replace(/^\d+/, "");
  const command = keymap[commandLookupKey] || keymap[key];
  if (command) {
    command(editor);
    editor.setState({ keyBuffer: "", motionCount: 0 });
    clearTimeout(editor.bufferClearTimer);
  } else if (Object.keys(keymap).some((k) => k.startsWith(commandLookupKey))) {
    editor.setState({ keyBuffer: newKeyBuffer });
  } else {
    editor.setState({ keyBuffer: "", motionCount: 0 });
  }
}
