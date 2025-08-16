export const UI_RENDER_INTERVAL_MS = 1000 / 30;
export const GUTTER_WIDTH = 6;
export const STATUS_BAR_PILL_SPACING = 1;
export const TAB_BAR_HEIGHT = 1;

export const FRAME_CHARS = {
  TOP_LEFT: "╭",
  TOP_RIGHT: "╮",
  BOTTOM_LEFT: "╰",
  BOTTOM_RIGHT: "╯",
  HORIZONTAL: "─",
  VERTICAL: "│",
};

export const SCROLLBAR_CHARS = {
  VERTICAL_TRACK: "│",
  VERTICAL_INDICATOR: "┴",
  HORIZONTAL_TRACK: "─",
  HORIZONTAL_INDICATOR: "┤",
};

export const POWERLINE_CHARS = {
  SEPARATOR: "",
  SEPARATOR_LEFT: "",
};

export const EDITOR_MESSAGES = {
  NO_FILE_NAME: "E32: No file name",
  UNSAVED_CHANGES: "E37: No write since last change (add ! to override)",
  FILE_OPEN_CANCELED: "File open canceled.",
  NO_EDITOR_TO_CLOSE: "No editor to close.",
};

export const KEY_NAME_MAP = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  return: "Enter",
  backspace: "Backspace",
  escape: "Escape",
  tab: "Tab",
};

export const COMMAND_LINE_REGEX = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;

export const ANSI = {
  CLEAR_SCREEN: "\x1b[2J",
  CURSOR_HOME: "\x1b[H",
  CURSOR_HIDE: "\x1b[?25l",
  CURSOR_SHOW: "\x1b[?25h",
  CURSOR_TO: (r, c) => `\x1b[${r};${c}H`,
  SGR_RESET: "\x1b[0m",
  SGR_BOLD: "\x1b[1m",
  SGR_INVERSE: "\x1b[7m",
  SGR_FG_BLACK: "\x1b[30m",
  SGR_FG_BLUE: "\x1b[34m",
  SGR_FG_WHITE: "\x1b[37m",
  SGR_FG_GRAY: "\x1b[90m",
  SGR_BG_BLACK: "\x1b[40m",
  SGR_BG_BLUE: "\x1b[44m",
  CURSOR_STYLE_BLOCK: "\x1b[2 q",
  CURSOR_STYLE_LINE: "\x1b[6 q",
};

export const colors = {
  black: "black",
  white: "white",
  blue: "blue",
  gray: "gray",
  green: "green",
  yellow: "yellow",
  transparent: null,
};

export const styles = {
  base: { fg: colors.white, bg: colors.transparent },
  inverse: { inverse: true },
  frame: { fg: colors.blue, bg: colors.transparent },
  boxTitle: { bold: true },
  gutterActive: { fg: colors.blue, bold: true },
  gutterInactive: { fg: colors.gray },
  tilde: { fg: colors.blue },
  specialChar: { fg: colors.gray },
  scrollbar: {
    track: { fg: colors.gray },
    indicator: { fg: colors.blue, bold: true },
    scrolled: { fg: colors.blue },
  },
  statusBar: {
    default: { bg: colors.gray, fg: colors.black },
    mode: {
      NORMAL: { bg: colors.blue, fg: colors.black, bold: true },
      INSERT: { bg: colors.green, fg: colors.black, bold: true },
      VISUAL: { bg: colors.yellow, fg: colors.black, bold: true },
    },
    file: { bg: colors.gray, fg: colors.white },
    cursor: { bg: colors.gray, fg: colors.white },
  },
  commandLine: { bg: colors.black, fg: colors.white },
  tabBar: {
    bg: colors.black,
    fg: colors.white,
    active: { bg: colors.blue, fg: colors.black, bold: true },
    inactive: { bg: colors.gray, fg: colors.black },
  },
  scratchpad: {
    frame: { fg: colors.blue, bold: true },
  },
};
