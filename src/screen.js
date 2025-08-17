import { ANSI, colors } from "./shared.js";

class Cell {
  constructor(char = " ", style = {}) {
    this.char = char;
    this.fg = style.fg === undefined ? colors.white : style.fg;
    this.bg = style.bg === undefined ? colors.transparent : style.bg;
    this.bold = style.bold || false;
    this.inverse = style.inverse || false;
  }
  set(char, style) {
    this.char = char;
    this.fg = style.fg === undefined ? colors.white : style.fg;
    this.bg = style.bg === undefined ? colors.transparent : style.bg;
    this.bold = style.bold || false;
    this.inverse = style.inverse || false;
  }
  reset() {
    this.char = " ";
    this.fg = colors.white;
    this.bg = colors.transparent;
    this.bold = false;
    this.inverse = false;
  }
  equals(other) {
    return (
      this.char === other.char &&
      this.fg === other.fg &&
      this.bg === other.bg &&
      this.bold === other.bold &&
      this.inverse === other.inverse
    );
  }
}

export class Screen {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.activeBuffer = this.createBuffer();
    this.renderBuffer = this.createBuffer();
    this.modalMask = null;
  }
  setModalMask(mask) {
    this.modalMask = mask;
  }
  createBuffer() {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => new Cell()),
    );
  }
  clearRenderBuffer() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.renderBuffer[y][x].reset();
    }
  }
  draw(componentBuffer) {
    if (!componentBuffer) return;
    componentBuffer.forEach(({ row, col, text, style = {} }) => {
      if (row < 0 || row >= this.height) return;
      const chars = text.split("");
      for (let i = 0; i < chars.length; i++) {
        const x = col + i;
        if (x < 0 || x >= this.width) continue;
        if (this.modalMask && this.modalMask[row][x]) continue;
        this.renderBuffer[row][x].set(chars[i], style);
      }
    });
  }
  commit() {
    let output = "";
    const fgColors = {
      [colors.black]: ANSI.SGR_FG_BLACK,
      [colors.blue]: ANSI.SGR_FG_BLUE,
      [colors.white]: ANSI.SGR_FG_WHITE,
      [colors.gray]: ANSI.SGR_FG_GRAY,
    };
    const bgColors = {
      [colors.black]: ANSI.SGR_BG_BLACK,
      [colors.blue]: ANSI.SGR_BG_BLUE,
      [colors.gray]: ANSI.SGR_BG_GRAY,
    };
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const oldCell = this.activeBuffer[y][x];
        const newCell = this.renderBuffer[y][x];
        if (oldCell.equals(newCell)) continue;
        output += ANSI.CURSOR_TO(y + 1, x + 1);
        let styleOutput = ANSI.SGR_RESET;
        if (newCell.inverse) styleOutput += ANSI.SGR_INVERSE;
        if (newCell.bold) styleOutput += ANSI.SGR_BOLD;
        styleOutput += fgColors[newCell.fg] || ANSI.SGR_FG_WHITE;
        if (newCell.bg !== colors.transparent)
          styleOutput += bgColors[newCell.bg] || "";
        output += styleOutput + newCell.char;
      }
    }
    if (output) process.stdout.write(output);
    const temp = this.activeBuffer;
    this.activeBuffer = this.renderBuffer;
    this.renderBuffer = temp;
  }
}
