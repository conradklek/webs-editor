import { actions } from "./actions.js";
import { motions } from "./motions.js";

const getWordBounds = (pos, text) => {
  const isWordChar = (c) => /\w/.test(c);
  if (!isWordChar(text[pos])) return null;
  let start = pos;
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }
  let end = pos;
  while (end < text.length - 1 && isWordChar(text[end + 1])) {
    end++;
  }
  return { start, end: end + 1 };
};

const getParagraphBounds = (pos, text) => {
  let paraStart = text.lastIndexOf("\n\n", pos - 1);
  paraStart = paraStart === -1 ? 0 : paraStart + 2;
  let paraEnd = text.indexOf("\n\n", pos);
  if (paraEnd === -1) {
    paraEnd = text.length;
  }
  while (paraStart < paraEnd && text[paraStart] === "\n") paraStart++;
  while (paraEnd > paraStart && text[paraEnd - 1] === "\n") paraEnd--;
  return { start: paraStart, end: paraEnd };
};

const findMatchingPair = (pos, text, openChar, closeChar) => {
  let level = 0;
  let searchPos = pos;
  let openPos = -1,
    closePos = -1;
  while (searchPos >= 0) {
    if (text[searchPos] === closeChar) level++;
    if (text[searchPos] === openChar) {
      if (level === 0) {
        openPos = searchPos;
        break;
      }
      level--;
    }
    searchPos--;
  }
  if (openPos === -1) return null;
  searchPos = openPos + 1;
  level = 0;
  while (searchPos < text.length) {
    if (text[searchPos] === openChar) level++;
    if (text[searchPos] === closeChar) {
      if (level === 0) {
        closePos = searchPos;
        break;
      }
      level--;
    }
    searchPos++;
  }
  if (closePos === -1) return null;
  return { start: openPos, end: closePos };
};

const getLineNumber = (pos, text) => {
  return (text.substring(0, pos).match(/\n/g) || []).length + 1;
};

export const textObjects = {
  innerWord: (pos, text) => {
    return getWordBounds(pos, text);
  },

  aWord: (pos, text) => {
    const bounds = getWordBounds(pos, text);
    if (!bounds) return null;
    let { start, end } = bounds;
    while (end < text.length && /\s/.test(text[end])) {
      end++;
    }
    return { start, end };
  },

  innerQuote: (pos, text, quoteChar) => {
    const prevQuote = text.lastIndexOf(quoteChar, pos - 1);
    if (prevQuote === -1) return null;
    const nextQuote = text.indexOf(quoteChar, pos);
    if (nextQuote === -1) return null;
    return { start: prevQuote + 1, end: nextQuote };
  },

  aQuote: (pos, text, quoteChar) => {
    const bounds = textObjects.innerQuote(pos, text, quoteChar);
    if (!bounds) return null;
    return { start: bounds.start - 1, end: bounds.end + 1 };
  },

  innerParagraph: (pos, text) => {
    return getParagraphBounds(pos, text);
  },

  aParagraph: (pos, text) => {
    const bounds = getParagraphBounds(pos, text);
    if (!bounds) return null;
    let { start, end } = bounds;
    if (text.substring(end, end + 2) === "\n\n") {
      end += 2;
    } else if (text.substring(end, end + 1) === "\n") {
      end += 1;
    }
    return { start, end };
  },

  paragraphLines: (pos, text) => {
    const bounds = getParagraphBounds(pos, text);
    if (!bounds) return null;
    const startLine = getLineNumber(bounds.start, text);
    const endLine = getLineNumber(bounds.end, text);
    return { startLine, endLine };
  },

  innerBracket: (pos, text, openChar, closeChar) => {
    const bounds = findMatchingPair(pos, text, openChar, closeChar);
    if (!bounds) return null;
    return { start: bounds.start + 1, end: bounds.end };
  },

  aBracket: (pos, text, openChar, closeChar) => {
    const bounds = findMatchingPair(pos, text, openChar, closeChar);
    if (!bounds) return null;
    return { start: bounds.start, end: bounds.end + 1 };
  },
};

export function createKeymaps() {
  const motionKeys = {
    h: motions.left,
    j: motions.down,
    k: motions.up,
    l: motions.right,
    w: motions.nextWord,
    b: motions.prevWord,
    e: motions.wordEnd,
    $: motions.lineEnd,
    0: motions.lineStart,
    G: motions.documentEnd,
    gg: motions.documentStart,
    "}": motions.nextParagraph,
    "{": motions.prevParagraph,
  };

  const textObjectPairs = {
    "(": [textObjects.innerBracket, textObjects.aBracket, "(", ")"],
    ")": [textObjects.innerBracket, textObjects.aBracket, "(", ")"],
    "{": [textObjects.innerBracket, textObjects.aBracket, "{", "}"],
    "}": [textObjects.innerBracket, textObjects.aBracket, "{", "}"],
    "[": [textObjects.innerBracket, textObjects.aBracket, "[", "]"],
    "]": [textObjects.innerBracket, textObjects.aBracket, "[", "]"],
    '"': [textObjects.innerQuote, textObjects.aQuote, '"'],
    "'": [textObjects.innerQuote, textObjects.aQuote, "'"],
    w: [textObjects.innerWord, textObjects.aWord],
    p: [textObjects.innerParagraph, textObjects.aParagraph],
  };

  const textObjectKeys = {};
  const operatorTextObjectKeys = {};

  for (const [key, fns] of Object.entries(textObjectPairs)) {
    const [innerFn, outerFn, ...args] = fns;
    textObjectKeys["i" + key] = (ctx) =>
      actions.selectTextObject(ctx, (pos, text) => innerFn(pos, text, ...args));
    textObjectKeys["a" + key] = (ctx) =>
      actions.selectTextObject(ctx, (pos, text) => outerFn(pos, text, ...args));
    operatorTextObjectKeys["i" + key] = (ctx) =>
      actions.executeOperatorOnTextObject(ctx, (pos, text) =>
        innerFn(pos, text, ...args),
      );
    operatorTextObjectKeys["a" + key] = (ctx) =>
      actions.executeOperatorOnTextObject(ctx, (pos, text) =>
        outerFn(pos, text, ...args),
      );
  }

  const normal = {
    ...Object.entries(motionKeys).reduce((acc, [key, motion]) => {
      acc[key] = (ctx) => actions.move(ctx, motion);
      return acc;
    }, {}),
    i: (ctx) => actions.enterInsertMode(ctx),
    a: (ctx) => actions.enterInsertMode(ctx, ctx.state.selection.start + 1),
    I: (ctx) =>
      actions.enterInsertMode(
        ctx,
        motions.lineStart(ctx.state.selection.start, ctx.state.text),
      ),
    A: (ctx) =>
      actions.enterInsertMode(
        ctx,
        motions.lineEnd(ctx.state.selection.start, ctx.state.text),
      ),
    o: (ctx) => actions.insertLineBelow(ctx),
    O: (ctx) => actions.insertLineAbove(ctx),
    v: (ctx) => actions.enterVisualMode(ctx),
    V: (ctx) => actions.enterVisualLineMode(ctx),
    d: (ctx) => actions.enterOperatorPendingMode(ctx, "d"),
    c: (ctx) => actions.enterOperatorPendingMode(ctx, "c"),
    y: (ctx) => actions.enterOperatorPendingMode(ctx, "y"),
    p: (ctx) => actions.paste(ctx, false),
    P: (ctx) => actions.paste(ctx, true),
    u: (ctx) => actions.undo(ctx),
    "Ctrl+r": (ctx) => actions.redo(ctx),
    "Ctrl+d": (ctx) => actions.move(ctx, motions.pageDown),
    "Ctrl+u": (ctx) => actions.move(ctx, motions.pageUp),
    x: (ctx) => {
      const { start } = ctx.state.selection;
      ctx.setState({ selection: { start, end: start + 1, anchor: start } });
      actions.deleteSelection(ctx);
    },
    "/": (ctx) => actions.enterCommandLineMode(ctx, "/"),
    ":": (ctx) => actions.enterCommandLineMode(ctx, ":"),
    n: (ctx) => ctx.state.search.term && actions.navigateSearchResults(ctx, 1),
    N: (ctx) => ctx.state.search.term && actions.navigateSearchResults(ctx, -1),
    ".": (ctx) => actions.repeatLastAction(ctx),
    J: (ctx) => actions.joinLines(ctx),
    r: (ctx) => actions.enterAwaitingReplaceChar(ctx),
    f: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.findCharNext, "f"),
    F: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.findCharPrev, "F"),
    t: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.toCharNext, "t"),
    T: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.toCharPrev, "T"),
    ";": (ctx) => actions.repeatLastFind(ctx, false),
    ",": (ctx) => actions.repeatLastFind(ctx, true),
  };

  const visual = {
    Escape: (ctx) => actions.enterNormalMode(ctx),
    "Ctrl+c": (ctx) => actions.enterNormalMode(ctx),
    v: (ctx) => actions.enterNormalMode(ctx),
    d: (ctx) => actions.deleteAndYankSelection(ctx),
    c: (ctx) => actions.changeSelection(ctx),
    y: (ctx) => actions.yankSelection(ctx),
    "Ctrl+d": (ctx) => actions.move(ctx, motions.pageDown, true),
    "Ctrl+u": (ctx) => actions.move(ctx, motions.pageUp, true),
    ...Object.entries(motionKeys).reduce((acc, [key, motion]) => {
      acc[key] = (ctx) => actions.move(ctx, motion, true);
      return acc;
    }, {}),
    ...textObjectKeys,
    ":": (ctx) => actions.enterVisualCommandMode(ctx),
  };

  const visual_line = {
    Escape: (ctx) => actions.enterNormalMode(ctx),
    "Ctrl+c": (ctx) => actions.enterNormalMode(ctx),
    V: (ctx) => actions.enterNormalMode(ctx),
    v: (ctx) => actions.enterVisualMode(ctx),
    d: (ctx) => actions.deleteAndYankSelection(ctx),
    c: (ctx) => actions.changeSelection(ctx),
    y: (ctx) => actions.yankSelection(ctx),
    j: (ctx) => actions.move(ctx, motions.down, true),
    k: (ctx) => actions.move(ctx, motions.up, true),
    G: (ctx) => actions.move(ctx, motions.documentEnd, true),
    gg: (ctx) => actions.move(ctx, motions.documentStart, true),
    "}": (ctx) => actions.move(ctx, motions.nextParagraph, true),
    "{": (ctx) => actions.move(ctx, motions.prevParagraph, true),
    ":": (ctx) => actions.enterVisualCommandMode(ctx),
  };

  const operator_pending = {
    Escape: (ctx) => actions.enterNormalMode(ctx),
    "Ctrl+c": (ctx) => actions.enterNormalMode(ctx),
    ...Object.entries(motionKeys).reduce((acc, [key, motion]) => {
      acc[key] = (ctx) => actions.executeOperator(ctx, motion);
      return acc;
    }, {}),
    d: (ctx) =>
      ctx.state.pendingOperator === "d"
        ? actions.executeOperator(
          ctx,
          (pos, text) => motions.lineEnd(pos, text) + 1,
        )
        : null,
    c: (ctx) =>
      ctx.state.pendingOperator === "c"
        ? actions.executeOperator(
          ctx,
          (pos, text) => motions.lineEnd(pos, text) + 1,
        )
        : null,
    y: (ctx) =>
      ctx.state.pendingOperator === "y"
        ? actions.executeOperator(
          ctx,
          (pos, text) => motions.lineEnd(pos, text) + 1,
        )
        : null,
    ...operatorTextObjectKeys,
    f: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.findCharNext, "f"),
    F: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.findCharPrev, "F"),
    t: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.toCharNext, "t"),
    T: (ctx) => actions.enterAwaitingMotionChar(ctx, motions.toCharPrev, "T"),
  };

  const search = {
    Escape: (ctx) => actions.exitSearchMode(ctx),
    "Ctrl+c": (ctx) => actions.exitSearchMode(ctx),
    Enter: (ctx) => actions.exitSearchMode(ctx),
    n: (ctx) => actions.navigateSearchResults(ctx, 1),
    N: (ctx) => actions.navigateSearchResults(ctx, -1),
  };

  return {
    NORMAL: normal,
    VISUAL: visual,
    VISUAL_LINE: visual_line,
    OPERATOR_PENDING: operator_pending,
    SEARCH: search,
  };
}
