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
