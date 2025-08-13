export const motions = {
  left: (pos) => Math.max(0, pos - 1),

  right: (pos, text) => Math.min(text.length, pos + 1),

  lineStart: (pos, text) => {
    return text.lastIndexOf("\n", pos - 1) + 1;
  },

  lineEnd: (pos, text) => {
    const nextNewline = text.indexOf("\n", pos);
    return nextNewline === -1 ? text.length : nextNewline;
  },

  up: (pos, text, { targetColumn, visualLayout, wordWrap }) => {
    if (!wordWrap) {
      const currentLineStart = motions.lineStart(pos, text);
      if (currentLineStart === 0) return pos;
      const prevLineEnd = currentLineStart - 1;
      const prevLineStart = motions.lineStart(prevLineEnd, text);
      return Math.min(prevLineStart + targetColumn, prevLineEnd);
    }

    const visualPos = visualLayout.posToVisualMap.get(pos);
    if (!visualPos || visualPos.row === 0) return pos;

    const targetVisualRow = visualPos.row - 1;
    const targetVisualCol = Math.min(
      targetColumn,
      visualLayout.lines[targetVisualRow].text.length,
    );

    return (
      visualLayout.visualToPosMap.get(
        `${targetVisualRow}:${targetVisualCol}`,
      ) || 0
    );
  },

  down: (pos, text, { targetColumn, visualLayout, wordWrap }) => {
    if (!wordWrap) {
      const currentLineEnd = motions.lineEnd(pos, text);
      if (currentLineEnd >= text.length) return pos;
      const nextLineStart = currentLineEnd + 1;
      const nextLineEnd = motions.lineEnd(nextLineStart, text);
      return Math.min(nextLineStart + targetColumn, nextLineEnd);
    }

    const visualPos = visualLayout.posToVisualMap.get(pos);
    if (!visualPos || visualPos.row >= visualLayout.lines.length - 1)
      return pos;

    const targetVisualRow = visualPos.row + 1;
    const targetVisualCol = Math.min(
      targetColumn,
      visualLayout.lines[targetVisualRow].text.length,
    );

    return (
      visualLayout.visualToPosMap.get(
        `${targetVisualRow}:${targetVisualCol}`,
      ) || text.length
    );
  },

  nextWord: (pos, text) => {
    let i = pos;
    if (i >= text.length) return pos;
    const isWordChar = (c) => /\w/.test(c);
    while (i < text.length && /\s/.test(text[i])) i++;
    if (isWordChar(text[i])) {
      while (i < text.length && isWordChar(text[i])) i++;
    } else {
      while (i < text.length && !isWordChar(text[i]) && !/\s/.test(text[i]))
        i++;
    }
    return i;
  },

  prevWord: (pos, text) => {
    if (pos === 0) return 0;
    let i = pos - 1;
    while (i > 0 && /\s/.test(text[i])) i--;
    const isWordChar = (c) => /\w/.test(c);
    if (isWordChar(text[i])) {
      while (i > 0 && isWordChar(text[i - 1])) i--;
    } else {
      while (i > 0 && !isWordChar(text[i - 1]) && !/\s/.test(text[i - 1])) i--;
    }
    return i;
  },

  wordEnd: (pos, text) => {
    let i = pos;
    if (i >= text.length - 1) return pos;
    i++;
    while (i < text.length && /\s/.test(text[i])) i++;
    const isWordChar = (c) => /\w/.test(c);
    if (isWordChar(text[i])) {
      while (i < text.length - 1 && isWordChar(text[i + 1])) i++;
    } else {
      while (
        i < text.length - 1 &&
        !isWordChar(text[i + 1]) &&
        !/\s/.test(text[i + 1])
      )
        i++;
    }
    return i;
  },

  documentStart: () => 0,

  documentEnd: (_, text) => text.length,

  nextParagraph: (pos, text) => {
    const nextMatch = text.indexOf("\n\n", pos);
    if (nextMatch === -1) {
      return text.length;
    }
    let p = nextMatch;
    while (p < text.length && text[p] === "\n") p++;
    return p;
  },

  prevParagraph: (pos, text) => {
    if (pos === 0) return 0;
    const searchFrom = pos - 1;
    const prevMatch = text.lastIndexOf("\n\n", searchFrom);
    if (prevMatch === -1) {
      return 0;
    }
    let p = prevMatch;
    while (p < searchFrom && text[p] === "\n") p++;
    return p;
  },

  pageDown: (
    pos,
    text,
    { targetColumn, visualLayout, wordWrap },
    linesToScroll = 10,
  ) => {
    let newPos = pos;
    for (let i = 0; i < linesToScroll; i++) {
      newPos = motions.down(newPos, text, {
        targetColumn,
        visualLayout,
        wordWrap,
      });
    }
    return newPos;
  },

  pageUp: (
    pos,
    text,
    { targetColumn, visualLayout, wordWrap },
    linesToScroll = 10,
  ) => {
    let newPos = pos;
    for (let i = 0; i < linesToScroll; i++) {
      newPos = motions.up(newPos, text, {
        targetColumn,
        visualLayout,
        wordWrap,
      });
    }
    return newPos;
  },

  findCharNext: (pos, text, char) => {
    const findPos = text.indexOf(char, pos + 1);
    return findPos === -1 ? pos : findPos;
  },

  findCharPrev: (pos, text, char) => {
    const findPos = text.lastIndexOf(char, pos - 1);
    return findPos === -1 ? pos : findPos;
  },

  toCharNext: (pos, text, char) => {
    const findPos = text.indexOf(char, pos + 1);
    return findPos === -1 ? pos : findPos;
  },

  toCharPrev: (pos, text, char) => {
    const findPos = text.lastIndexOf(char, pos - 1);
    return findPos === -1 ? pos : findPos;
  },
};
