import { FRAME_CHARS, styles, colors } from "./constants.js";

export const decolorize = (text) =>
  typeof text !== "string" ? "" : text.replace(/\x1b\[[0-9;]*m/g, "");

export function getLineCol(text, pos) {
  const textBefore = text.substring(0, pos);
  const row = (textBefore.match(/\n/g) || []).length;
  const lineStartPos = text.lastIndexOf("\n", textBefore.length - 1) + 1;
  const col = pos - lineStartPos;
  return { row, col };
}

export function adjustScrollView(
  cursorRow,
  scrollRow,
  viewportHeight,
  totalLines,
) {
  let newScrollRow = scrollRow;
  const margin = 2;
  const maxScroll = Math.max(0, totalLines - viewportHeight);

  if (cursorRow < newScrollRow + margin) {
    newScrollRow = Math.max(0, cursorRow - margin);
  } else if (cursorRow >= newScrollRow + viewportHeight - margin) {
    newScrollRow = cursorRow - viewportHeight + margin + 1;
  }

  return Math.max(0, Math.min(newScrollRow, maxScroll));
}

export function createBox(x, y, width, height, title, options = {}) {
  const { style, bg, hasShadow = false } = options;
  const boxStyle = style || styles.frame;
  const {
    HORIZONTAL,
    VERTICAL,
    TOP_LEFT,
    TOP_RIGHT,
    BOTTOM_LEFT,
    BOTTOM_RIGHT,
  } = FRAME_CHARS;
  const h_bar = HORIZONTAL.repeat(width - 2);
  const box = [];
  const bgStyle = { bg: bg === undefined ? colors.transparent : bg };

  if (hasShadow) {
    for (let i = 1; i < height; i++) {
      box.push({ row: y + i, col: x + width, text: " ", style: styles.shadow });
    }
    box.push({
      row: y + height,
      col: x + 1,
      text: " ".repeat(width),
      style: styles.shadow,
    });
  }

  for (let i = 0; i < height; i++) {
    box.push({ row: y + i, col: x, text: " ".repeat(width), style: bgStyle });
  }
  box.push({
    row: y,
    col: x,
    text: TOP_LEFT + h_bar + TOP_RIGHT,
    style: boxStyle,
  });
  for (let i = 1; i < height - 1; i++) {
    box.push({ row: y + i, col: x, text: VERTICAL, style: boxStyle });
    box.push({
      row: y + i,
      col: x + width - 1,
      text: VERTICAL,
      style: boxStyle,
    });
  }
  box.push({
    row: y + height - 1,
    col: x,
    text: BOTTOM_LEFT + h_bar + BOTTOM_RIGHT,
    style: boxStyle,
  });

  if (title) {
    const titleText = ` ${title} `;
    const titleStartCol =
      x + Math.floor((width - decolorize(titleText).length) / 2);
    box.push({
      row: y,
      col: titleStartCol,
      text: titleText,
      style: { ...styles.boxTitle, bg: bgStyle.bg },
    });
  }
  return box;
}
