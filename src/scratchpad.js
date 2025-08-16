import { Component } from "./component.js";
import { createBox, decolorize } from "./utils.js";
import { styles } from "./constants.js";
import fs from "fs";
import path from "path";
import os from "os";

export const SCRATCHPAD_WIDTH = 40;
const SCRATCHPAD_FILE = path.join(os.homedir(), ".scratchpad.txt");

export class Scratchpad extends Component {
  constructor(options) {
    super(options);
    this.state = {
      isOpen: false,
      content: [],
      cursor: { row: 0, col: 0 },
      scroll: { row: 0, col: 0 },
    };
    this.loadContent();
  }

  loadContent() {
    try {
      if (fs.existsSync(SCRATCHPAD_FILE)) {
        const fileContent = fs.readFileSync(SCRATCHPAD_FILE, "utf8");
        this.state.content = fileContent.split("\n");
      } else {
        this.state.content = [""];
      }
    } catch (e) {
      this.state.content = ["Error loading scratchpad."];
    }
  }

  saveContent() {
    try {
      fs.writeFileSync(SCRATCHPAD_FILE, this.state.content.join("\n"), "utf8");
    } catch { }
  }

  open(focusManager) {
    if (this.state.isOpen) {
      this.close(focusManager);
      return;
    }
    this.setState({ isOpen: true });
    focusManager.requestFocus(this);
  }

  close(focusManager) {
    this.setState({ isOpen: false });
    this.saveContent();
    focusManager.releaseFocus(this);
  }

  handleKey(key, focusManager) {
    if (!this.state.isOpen) return false;

    const { content, cursor } = this.state;
    let { row, col } = cursor;

    switch (key.name) {
      case "escape":
        this.close(focusManager);
        break;
      case "up":
        row = Math.max(0, row - 1);
        col = Math.min(col, content[row].length);
        break;
      case "down":
        row = Math.min(content.length - 1, row + 1);
        col = Math.min(col, content[row].length);
        break;
      case "left":
        col = Math.max(0, col - 1);
        break;
      case "right":
        col = Math.min(content[row].length, col + 1);
        break;
      case "return":
        const lineAfterCursor = content[row].substring(col);
        content[row] = content[row].substring(0, col);
        content.splice(row + 1, 0, lineAfterCursor);
        row++;
        col = 0;
        break;
      case "backspace":
        if (col > 0) {
          content[row] =
            content[row].slice(0, col - 1) + content[row].slice(col);
          col--;
        } else if (row > 0) {
          const prevLineLength = content[row - 1].length;
          content[row - 1] += content[row];
          content.splice(row, 1);
          row--;
          col = prevLineLength;
        }
        break;
      default:
        if (
          key.sequence &&
          !key.ctrl &&
          !key.meta &&
          key.sequence.length === 1
        ) {
          content[row] =
            content[row].slice(0, col) + key.sequence + content[row].slice(col);
          col += key.sequence.length;
        }
        break;
    }

    this.setState({ content, cursor: { row, col } });
    this.adjustScrollView();
    return true;
  }

  adjustScrollView() {
    const { cursor, scroll } = this.state;
    const contentHeight = this.screen.rows - 2;
    let newScrollRow = scroll.row;

    if (cursor.row < newScrollRow) {
      newScrollRow = cursor.row;
    } else if (cursor.row >= newScrollRow + contentHeight) {
      newScrollRow = cursor.row - contentHeight + 1;
    }
    this.setState({ scroll: { ...scroll, row: newScrollRow } });
  }

  render(screen) {
    this.screen = screen;
    if (!this.state.isOpen) return { buffer: [], cursor: { show: false } };

    const { rows, cols } = screen;
    const x = cols - SCRATCHPAD_WIDTH;
    const buffer = createBox(x, 0, SCRATCHPAD_WIDTH, rows, "Scratchpad", {
      style: styles.scratchpad.frame,
    });

    const { content, scroll, cursor } = this.state;
    const contentHeight = rows - 2;
    const contentWidth = SCRATCHPAD_WIDTH - 4;

    for (let i = 0; i < contentHeight; i++) {
      const lineIndex = i + scroll.row;
      if (lineIndex < content.length) {
        let line = decolorize(content[lineIndex]).replace(/\t/g, "  ");
        if (line.length > contentWidth) {
          line = line.substring(0, contentWidth);
        }
        buffer.push({
          row: i + 1,
          col: x + 2,
          text: line,
          style: styles.base,
        });
      }
    }

    const renderCursor = {
      row: cursor.row - scroll.row + 1,
      col: x + cursor.col + 2,
      show: true,
    };

    return { buffer, cursor: renderCursor };
  }
}
