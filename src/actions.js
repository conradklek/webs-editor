import { motions } from "./motions.js";

function getLineCol(text, pos) {
  const textBefore = text.substring(0, pos);
  const row = (textBefore.match(/\n/g) || []).length;
  const lineStartPos = text.lastIndexOf("\n", textBefore.length - 1) + 1;
  const col = pos - lineStartPos;
  return { row, col };
}

function normalizeSelection(selection) {
  if (selection.start > selection.end) {
    return { start: selection.end, end: selection.start };
  }
  return selection;
}

export const createModesActions = (actions) => ({
  enterNormalMode: (ctx) => {
    const pos = ctx.state.selection.end;
    ctx.setMode("NORMAL", {
      selection: { start: pos, end: pos, anchor: pos },
      state: { visualSelection: null },
    });
  },

  enterVisualMode: (ctx) => {
    const pos = ctx.state.selection.start;
    const coords = getLineCol(ctx.state.text, pos);
    ctx.setMode("VISUAL", {
      selection: { start: pos, end: pos, anchor: pos },
      state: {
        visualSelection: {
          start: coords,
          end: coords,
        },
      },
    });
  },

  move: (ctx, motionFn, extend = false) => {
    const { selection, text, targetColumn, motionCount, visualLayout } =
      ctx.state;
    const count = motionCount || 1;
    let head = extend ? selection.end : selection.start;

    for (let i = 0; i < count; i++) {
      head = motionFn(head, text, { targetColumn, visualLayout });
    }

    const newSelection = {
      start: extend ? selection.anchor : head,
      end: head,
      anchor: selection.anchor,
    };
    if (!extend) newSelection.anchor = head;

    let newTargetColumn = head - motions.lineStart(head, text);

    const newState = {
      selection: newSelection,
      targetColumn: newTargetColumn,
      visualSelection: null,
    };

    if (ctx.state.mode.startsWith("VISUAL")) {
      const { start, end } = normalizeSelection({
        start: newSelection.start,
        end: newSelection.end,
      });
      const startCoords = getLineCol(text, start);
      const endCoords = getLineCol(text, end);
      newState.visualSelection = { start: startCoords, end: endCoords };
    }

    ctx.setState(newState);
  },

  enterInsertMode: (ctx, pos) => {
    const newPos = pos !== undefined ? pos : ctx.state.selection.start;
    ctx.setMode("INSERT", {
      selection: { start: newPos, end: newPos, anchor: newPos },
    });
  },

  insertLineBelow: (ctx) => {
    const { text, selection } = ctx.state;
    const currentLineEnd = motions.lineEnd(selection.end, text);
    const newText =
      text.slice(0, currentLineEnd) + "\n" + text.slice(currentLineEnd);
    const newPos = currentLineEnd + 1;
    ctx.history.record(newText);
    ctx.setMode("INSERT", {
      selection: { start: newPos, end: newPos, anchor: newPos },
      state: { text: newText, isDirty: true },
    });
  },

  insertLineAbove: (ctx) => {
    const { text, selection } = ctx.state;
    const currentLineStart = motions.lineStart(selection.end, text);
    const newText =
      text.slice(0, currentLineStart) + "\n" + text.slice(currentLineStart);
    ctx.history.record(newText);
    ctx.setMode("INSERT", {
      selection: {
        start: currentLineStart,
        end: currentLineStart,
        anchor: currentLineStart,
      },
      state: { text: newText, isDirty: true },
    });
  },

  enterVisualLineMode: (ctx) => {
    const { selection, text } = ctx.state;
    const { end } = selection;
    const lineStart = motions.lineStart(end, text);
    let lineEnd = motions.lineEnd(end, text);
    if (lineEnd < text.length) {
      lineEnd++;
    }
    const startCoords = getLineCol(text, lineStart);
    const endCoords = getLineCol(text, lineEnd - 1);

    ctx.setMode("VISUAL_LINE", {
      selection: {
        start: lineStart,
        end: lineEnd,
        anchor: end,
      },
      state: {
        visualSelection: { start: startCoords, end: endCoords },
      },
    });
  },

  enterOperatorPendingMode: (ctx, operator) =>
    ctx.setMode("OPERATOR_PENDING", { state: { pendingOperator: operator } }),
  enterAwaitingMotionChar: (ctx, motion, type) => {
    ctx.setMode("AWAITING_MOTION_CHAR", {
      state: { pendingMotion: { motion, type } },
    });
  },
  enterAwaitingReplaceChar: (ctx) => {
    ctx.setMode("AWAITING_REPLACE_CHAR");
  },
  enterCommandLineMode: (ctx, prefix) =>
    ctx.setMode("COMMAND_LINE", {
      state: { commandLine: { prefix, input: "" } },
    }),
  enterVisualCommandMode: (ctx) => {
    const { selection } = ctx.state;
    const commandPrefix = ":";
    ctx.setMode("VISUAL_COMMAND", {
      state: {
        commandLine: { prefix: commandPrefix, input: "" },
        visualSelection: selection,
      },
    });
  },
  exitSearchMode: (ctx) => {
    const pos = ctx.state.selection.start;
    ctx.setMode("NORMAL", {
      state: { search: { term: ctx.state.search.term, lastMatch: null } },
      selection: { start: pos, end: pos, anchor: pos },
    });
  },
  processAwaitedChar: (ctx, char) => {
    const { mode, pendingMotion, pendingOperator, selection, text } = ctx.state;

    if (mode === "AWAITING_REPLACE_CHAR") {
      actions.replaceChar(ctx, char);
      actions.enterNormalMode(ctx);
    } else if (mode === "AWAITING_MOTION_CHAR") {
      const { motion, type } = pendingMotion;
      ctx.setState({ lastFindMotion: { motion, type, char, reversed: false } });
      const motionFn = (pos, text) => motion(pos, text, char);
      if (pendingOperator) {
        actions.executeOperator(ctx, motionFn);
      } else {
        let newPos = motionFn(selection.end, text);
        if (type === "t" || type === "T") {
          if (newPos > selection.end) newPos--;
          else if (newPos < selection.end) newPos++;
        }
        ctx.setState({
          selection: { start: newPos, end: newPos, anchor: newPos },
          targetColumn: newPos - motions.lineStart(newPos, text),
        });
        actions.enterNormalMode(ctx);
      }
    }
  },
  executeOperator: (ctx, motionFn) => {
    const { pendingOperator, selection, text, motionCount, lastFindMotion } =
      ctx.state;
    const count = motionCount || 1;
    let start = selection.start;
    let end = start;
    for (let i = 0; i < count; i++) {
      end = motionFn(end, text);
    }
    const motionType = lastFindMotion?.type;
    const isInclusive = motionType === "f" || motionType === "F";
    if (isInclusive && end >= start) end++;
    const opStart = Math.min(start, end);
    let opEnd = Math.max(start, end);
    const affectedText = text.substring(opStart, opEnd);
    const yankState = { yankRegister: { text: affectedText, type: "char" } };
    if (pendingOperator === "y") {
      ctx.setState(yankState);
      actions.enterNormalMode(ctx);
      return;
    }
    if (pendingOperator === "d" || pendingOperator === "c") {
      const newText = actions.deleteRange(ctx, opStart, opEnd);
      ctx.history.record(newText, { immediate: true });
      if (pendingOperator === "d") {
        ctx.setMode("NORMAL", {
          selection: { start: opStart, end: opStart, anchor: opStart },
          state: { ...yankState, text: newText, isDirty: true },
        });
      } else {
        ctx.setMode("INSERT", {
          selection: { start: opStart, end: opStart, anchor: opStart },
          state: { ...yankState, text: newText, isDirty: true },
        });
      }
    } else {
      actions.enterNormalMode(ctx);
    }
  },
  executeOperatorOnTextObject: (ctx, textObjectFn) => {
    const { pendingOperator, selection, text } = ctx.state;
    const range = textObjectFn(selection.start, text);
    if (!range) {
      actions.enterNormalMode(ctx);
      return;
    }
    const { start: opStart, end: opEnd } = range;
    const affectedText = text.substring(opStart, opEnd);
    const yankState = { yankRegister: { text: affectedText, type: "char" } };
    if (pendingOperator === "y") {
      ctx.setState(yankState);
      actions.enterNormalMode(ctx);
      return;
    }
    if (pendingOperator === "d" || pendingOperator === "c") {
      const newText = actions.deleteRange(ctx, opStart, opEnd);
      ctx.history.record(newText, { immediate: true });
      if (pendingOperator === "d") {
        ctx.setMode("NORMAL", {
          selection: { start: opStart, end: opStart, anchor: opStart },
          state: { ...yankState, text: newText, isDirty: true },
        });
      } else {
        ctx.setMode("INSERT", {
          selection: { start: opStart, end: opStart, anchor: opStart },
          state: { ...yankState, text: newText, isDirty: true },
        });
      }
    } else {
      actions.enterNormalMode(ctx);
    }
  },
  selectTextObject: (ctx, textObjectFn) => {
    const { selection, text } = ctx.state;
    const range = textObjectFn(selection.end, text);
    if (range) {
      actions.move(ctx, () => range.end, true);
    }
  },
  executeCommand: (ctx) => {
    const { prefix, input } = ctx.state.commandLine;
    if (prefix === "/") {
      actions.executeSearch(ctx, input);
    } else if (prefix === ":") {
      ctx.commandRegistry.execute(input);
    }
  },
  executeSearch: (ctx, term) => {
    if (!term) {
      actions.enterNormalMode(ctx);
      return;
    }
    ctx.setMode("SEARCH", { state: { search: { term, lastMatch: null } } });
    actions.navigateSearchResults(ctx, 1);
  },
  navigateSearchResults: (ctx, direction) => {
    const { search, text, selection } = ctx.state;
    const { term } = search;
    if (!term) return;
    let newPos = -1;
    const currentPos = selection.start;
    try {
      const regex = new RegExp(term, "g");
      if (direction === 1) {
        regex.lastIndex = selection.end;
        const match = regex.exec(text);
        if (match) {
          newPos = match.index;
        } else {
          regex.lastIndex = 0;
          const wrapMatch = regex.exec(text);
          if (wrapMatch) newPos = wrapMatch.index;
        }
      } else {
        let lastMatch = null;
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (match.index < currentPos) {
            lastMatch = match;
          } else {
            break;
          }
        }
        if (lastMatch) {
          newPos = lastMatch.index;
        } else {
          let wrapMatch = null;
          while ((match = regex.exec(text)) !== null) {
            wrapMatch = match;
          }
          if (wrapMatch) newPos = wrapMatch.index;
        }
      }
      if (newPos !== -1) {
        ctx.setState({
          search: { ...search, lastMatch: { index: newPos, direction } },
          selection: {
            start: newPos,
            end: newPos + term.length,
            anchor: newPos,
          },
        });
      }
    } catch (e) {
      console.error("Invalid search regex:", e);
      actions.enterNormalMode(ctx);
    }
  },
});

const recordable = (fn) => {
  return (ctx, ...args) => {
    ctx.setState({ isDirty: true });
    const result = fn(ctx, ...args);
    if (fn.name !== "repeatLastAction") {
      ctx.setState({ lastAction: { fn: recordable(fn), args } });
    }
    actions.updateVisualLayout(ctx);
    return result;
  };
};

export const createEditingActions = (actions) => ({
  updateVisualLayout: (ctx) => {
    ctx.setState({
      visualLayout: {
        lines: [],
        posToVisualMap: new Map(),
        visualToPosMap: new Map(),
        width: 0,
      },
    });
  },

  setDirty: (ctx, isDirty) => {
    ctx.setState({ isDirty });
  },

  insertText: recordable((ctx, textChunk) => {
    const { start } = ctx.state.selection;
    const newText =
      ctx.state.text.slice(0, start) + textChunk + ctx.state.text.slice(start);
    const newPos = start + textChunk.length;
    ctx.history.record(newText);
    ctx.setState({
      text: newText,
      selection: { start: newPos, end: newPos, anchor: newPos },
    });
  }),

  moveCursor: (ctx, motionFn) => {
    const { selection, text, targetColumn } = ctx.state;
    const newPos = motionFn(selection.start, text, { targetColumn });
    ctx.setState({
      selection: { start: newPos, end: newPos, anchor: newPos },
      targetColumn: newPos - motions.lineStart(newPos, text),
    });
  },

  appendText: (ctx, textChunk) => {
    actions.insertText(ctx, textChunk);
  },

  deleteRange: (ctx, start, end) => {
    return ctx.state.text.slice(0, start) + ctx.state.text.slice(end);
  },

  deleteSelection: recordable((ctx) => {
    const { start, end } = ctx.state.selection;
    if (start === end) return;
    const selStart = Math.min(start, end);
    const selEnd = Math.max(start, end);
    const newText = actions.deleteRange(ctx, selStart, selEnd);
    ctx.history.record(newText, { immediate: true });
    ctx.setState({
      text: newText,
      selection: { start: selStart, end: selStart, anchor: selStart },
    });
  }),

  deleteCharBackwards: recordable((ctx) => {
    let { start, end } = ctx.state.selection;
    if (start !== end) {
      actions.deleteSelection(ctx);
    } else if (start > 0) {
      const newText = actions.deleteRange(ctx, start - 1, start);
      const newPos = start - 1;
      ctx.history.record(newText);
      ctx.setState({
        text: newText,
        selection: { start: newPos, end: newPos, anchor: newPos },
      });
    }
  }),

  yankSelection: (ctx) => {
    const { mode, selection } = ctx.state;
    const { start, end } = selection;
    const selStart = Math.min(start, end);
    const selEnd = Math.max(start, end);
    const text = ctx.state.text.substring(selStart, selEnd);
    const type = mode === "VISUAL_LINE" ? "line" : "char";
    ctx.setState({ yankRegister: { text, type } });
    actions.enterNormalMode(ctx);
  },

  deleteAndYankSelection: recordable((ctx) => {
    const { mode, selection } = ctx.state;
    const { start, end } = selection;
    if (selection.start === selection.end) {
      actions.enterNormalMode(ctx);
      return;
    }
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(start, end);

    const yankedText = ctx.state.text.substring(selStart, selEnd);
    const type = mode === "VISUAL_LINE" ? "line" : "char";
    const yankState = { yankRegister: { text: yankedText, type } };

    const newText = actions.deleteRange(ctx, selStart, selEnd);
    ctx.history.record(newText, { immediate: true });

    ctx.setMode("NORMAL", {
      selection: { start: selStart, end: selStart, anchor: selStart },
      state: { ...yankState, text: newText },
    });
  }),

  changeSelection: recordable((ctx) => {
    const { mode, selection } = ctx.state;
    if (selection.start === selection.end) {
      actions.enterNormalMode(ctx);
      return;
    }
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selStart, selection.end);

    const yankedText = ctx.state.text.substring(selStart, selEnd);
    const type = mode === "VISUAL_LINE" ? "line" : "char";
    const yankState = { yankRegister: { text: yankedText, type } };

    const newText = actions.deleteRange(ctx, selStart, selEnd);
    ctx.history.record(newText, { immediate: true });

    ctx.setMode("INSERT", {
      selection: { start: selStart, end: selStart, anchor: selStart },
      state: { ...yankState, text: newText },
    });
  }),

  paste: recordable((ctx, before = false) => {
    const { text, type } = ctx.state.yankRegister;
    const count = ctx.state.motionCount || 1;
    if (!text) return;

    let { start } = ctx.state.selection;
    let textToInsert = text.repeat(count);
    let newPos = start;

    if (type === "line") {
      if (before) {
        start = motions.lineStart(start, ctx.state.text);
        textToInsert = textToInsert
          .split("\n")
          .map((l) => l + "\n")
          .join("")
          .slice(0, -1);
      } else {
        start = motions.lineEnd(start, ctx.state.text) + 1;
        textToInsert = "\n" + textToInsert;
      }
      newPos = start;
    } else {
      if (!before) start++;
      newPos = start + textToInsert.length;
    }

    const newFullText =
      ctx.state.text.slice(0, start) +
      textToInsert +
      ctx.state.text.slice(start);
    ctx.history.record(newFullText, { immediate: true });
    ctx.setState({
      text: newFullText,
      selection: { start: newPos, end: newPos, anchor: newPos },
    });
  }),

  joinLines: recordable((ctx) => {
    const { text, selection } = ctx.state;
    const count = Math.max(1, ctx.state.motionCount || 1);
    let lineStartPos = motions.lineStart(selection.start, text);
    let newText = text;
    let finalCursorPos = -1;

    for (let i = 0; i < count; i++) {
      const currentLineEnd = motions.lineEnd(lineStartPos, newText);
      if (currentLineEnd >= newText.length) break;

      const nextLineStart = currentLineEnd + 1;
      let nextLineContentStart = nextLineStart;
      while (
        nextLineContentStart < newText.length &&
        /\s/.test(newText[nextLineContentStart])
      ) {
        nextLineContentStart++;
      }

      const textBefore = newText.substring(0, currentLineEnd);
      const textAfter = newText.substring(nextLineContentStart);

      const space =
        textBefore.length > 0 && !/\s/.test(textBefore.slice(-1)) ? " " : "";

      finalCursorPos = textBefore.length;
      newText = textBefore + space + textAfter;
      lineStartPos = motions.lineStart(finalCursorPos, newText);
    }

    if (finalCursorPos !== -1) {
      ctx.history.record(newText, { immediate: true });
      ctx.setState({
        text: newText,
        selection: {
          start: finalCursorPos,
          end: finalCursorPos,
          anchor: finalCursorPos,
        },
      });
    }
  }),

  replaceChar: recordable((ctx, newChar) => {
    const { start } = ctx.state.selection;
    if (start >= ctx.state.text.length || newChar === "Escape") return;
    const newText =
      ctx.state.text.slice(0, start) +
      newChar +
      ctx.state.text.slice(start + 1);
    ctx.history.record(newText, { immediate: true });
    ctx.setState({
      text: newText,
      selection: { start, end: start, anchor: start },
    });
  }),

  acceptAutocomplete: recordable((ctx, selectedWord) => {
    const { selection, text } = ctx.state;
    const cursorPosition = selection.end;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const wordMatch = textBeforeCursor.match(/\b([a-zA-Z0-9_]+)$/);
    if (!wordMatch) return;
    const currentWord = wordMatch[1];
    const wordStartPos = cursorPosition - currentWord.length;
    const textBeforeWord = text.substring(0, wordStartPos);
    const textAfterCursor = text.substring(cursorPosition);
    const newText = textBeforeWord + selectedWord + textAfterCursor;
    const newPos = wordStartPos + selectedWord.length;
    ctx.history.record(newText, { immediate: true });
    ctx.setState({
      text: newText,
      selection: { start: newPos, end: newPos, anchor: newPos },
    });
  }),

  repeatLastAction: (ctx) => {
    const { lastAction } = ctx.state;
    if (lastAction && lastAction.fn) {
      lastAction.fn(ctx, ...lastAction.args);
    }
  },

  repeatLastFind: (ctx, reverse = false) => {
    const { lastFindMotion } = ctx.state;
    if (!lastFindMotion) return;

    let { char, type, reversed } = lastFindMotion;
    if (reverse) reversed = !reversed;

    let motionFn;
    if (type === "f")
      motionFn = reversed ? motions.findCharPrev : motions.findCharNext;
    if (type === "F")
      motionFn = reversed ? motions.findCharNext : motions.findCharPrev;
    if (type === "t")
      motionFn = reversed ? motions.toCharPrev : motions.toCharNext;
    if (type === "T")
      motionFn = reversed ? motions.toCharNext : motions.toCharPrev;

    if (motionFn) {
      actions.move(ctx, (pos, text) => motionFn(pos, text, char));
    }
  },

  undo: (ctx) => {
    const newState = ctx.history.undo();
    if (newState !== null) {
      ctx.setState({ text: newState, isDirty: true });
      actions.updateVisualLayout(ctx);
    }
  },

  redo: (ctx) => {
    const newState = ctx.history.redo();
    if (newState !== null) {
      ctx.setState({ text: newState, isDirty: true });
      actions.updateVisualLayout(ctx);
    }
  },
});

export const actions = {};

const editingActions = createEditingActions(actions);
const modesActions = createModesActions(actions);

Object.assign(actions, editingActions, modesActions);
