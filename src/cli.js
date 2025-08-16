import { Terminal } from "./terminal.js";
import { Editor } from "./editor.js";
import { CommandHandler } from "./commands.js";
import { Component } from "./component.js";
import { Shell, SHELL_HEIGHT } from "./shell.js";
import { FileTree, FILE_TREE_WIDTH } from "./file-tree.js";
import { Scratchpad, SCRATCHPAD_WIDTH } from "./scratchpad.js";
import {
  getLineCol,
  adjustScrollView,
  createBox,
  decolorize,
} from "./utils.js";
import {
  KEY_NAME_MAP,
  GUTTER_WIDTH,
  TAB_BAR_HEIGHT,
  styles,
  colors,
  SCROLLBAR_CHARS,
  FRAME_CHARS,
  POWERLINE_CHARS,
} from "./constants.js";
import path from "path";
import { highlight } from "./highlight.js";

export class TerminalApp extends Component {
  constructor(props) {
    super(props);
    this.tabs = [];
    this.buffers = new Map();
    this.activeTabId = null;
    this.isHandlingCommand = false;
    this.state = {
      activeEditorUiState: null,
      scroll: { row: 0, col: 0 },
      tabInfo: { tabIds: [], activeId: null },
    };
    this.focusManager = null;
    this.shell = this.addChild(new Shell());
    this.scratchpad = this.addChild(new Scratchpad());
    this.fileTree = this.addChild(
      new FileTree({
        props: {
          onOpenFile: (filePath) =>
            this.commandHandler.openFile(
              filePath,
              false,
              this.focusManager,
              true,
            ),
          onCancel: () => {
            if (this.tabs.length === 0) {
              this.commandHandler.newTab([]);
            }
          },
        },
      }),
    );
    this.editor = new Editor("", async (editorState) => {
      if (
        this.state.activeEditorUiState?.mode.startsWith("COMMAND") &&
        editorState.mode === "NORMAL" &&
        this.state.activeEditorUiState?.commandLine?.input
      ) {
        if (this.isHandlingCommand) return;
        this.isHandlingCommand = true;
        try {
          const commandLine = this.state.activeEditorUiState.commandLine;
          const fullCommand = `${commandLine.prefix}${commandLine.input}`;
          if (fullCommand.startsWith(":")) {
            const result = await this.commandHandler.handleCommand(
              fullCommand,
              this.focusManager,
            );
            if (result?.status) {
              this.editor.setState({ statusMessage: result.status });
            }
          }
        } finally {
          this.isHandlingCommand = false;
        }
      }
      if (!this.activeTabId) {
        this.setState({ activeEditorUiState: null });
        return;
      }
      this.calculateAndSetScroll(editorState, this.props.screen);
      const activeBuffer = this.buffers.get(this.activeTabId);
      if (activeBuffer) {
        activeBuffer.text = editorState.text;
        activeBuffer.isDirty = editorState.isDirty;
      }
      this.setState({ activeEditorUiState: this.editor.state });
    });
    this.commandHandler = new CommandHandler(this);
  }

  findTabByPath(filePath) {
    return this.tabs.find((t) => t.filePath === filePath);
  }

  getTab(tabId) {
    return this.tabs.find((t) => t.id === tabId);
  }

  getActiveTab() {
    if (!this.activeTabId) return null;
    return this.getTab(this.activeTabId);
  }

  addTab(filePath, content) {
    const newTabId = filePath || `Untitled-${Date.now()}`;
    if (this.buffers.has(newTabId)) {
      this.switchTab(newTabId);
      return;
    }
    const tab = {
      id: newTabId,
      filePath: filePath,
      fileName: filePath ? path.basename(filePath) : "[Untitled]",
    };
    this.tabs.push(tab);
    this.buffers.set(newTabId, { text: content, isDirty: false });
    this.switchTab(newTabId);
  }

  switchTab(tabId) {
    if (!this.buffers.has(tabId)) return;
    this.activeTabId = tabId;
    const tab = this.getTab(tabId);
    const buffer = this.buffers.get(tabId);
    this.editor.reset(buffer.text, {
      fileName: tab.fileName,
      filePath: tab.filePath,
    });
    this.updateTabInfoState();
  }

  closeTab(tabId) {
    if (!this.buffers.has(tabId)) return;
    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;
    this.tabs.splice(tabIndex, 1);
    this.buffers.delete(tabId);
    if (this.activeTabId === tabId) {
      if (this.tabs.length === 0) {
        this.activeTabId = null;
        this.editor.reset("");
      } else {
        const newIndex = Math.max(0, tabIndex - 1);
        this.activeTabId = this.tabs[newIndex].id;
        this.switchTab(this.activeTabId);
      }
    }
    this.updateTabInfoState();
  }

  switchNextTab() {
    if (this.tabs.length < 2) return;
    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.switchTab(this.tabs[nextIndex].id);
  }

  switchPrevTab() {
    if (this.tabs.length < 2) return;
    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    this.switchTab(this.tabs[prevIndex].id);
  }

  renameTab(oldId, newFilePath) {
    if (!this.buffers.has(oldId)) return;
    const tab = this.getTab(oldId);
    const buffer = this.buffers.get(oldId);
    tab.id = newFilePath;
    tab.filePath = newFilePath;
    tab.fileName = path.basename(newFilePath);
    this.buffers.delete(oldId);
    this.buffers.set(newFilePath, buffer);
    if (this.activeTabId === oldId) {
      this.activeTabId = newFilePath;
    }
    this.editor.fileName = tab.fileName;
    this.editor.filePath = tab.filePath;
    this.updateTabInfoState();
    this.editor.notify();
  }

  updateTabInfoState() {
    this.setState({
      tabInfo: {
        tabIds: this.tabs.map((t) => t.id),
        activeId: this.activeTabId,
      },
    });
  }

  calculateAndSetScroll(editorState, screen) {
    const { selection, text } = editorState;
    const logicalCursor = getLineCol(text, selection.end);
    const totalLines = text.split("\n").length;

    let editorHeight = screen.rows - TAB_BAR_HEIGHT - 1;
    if (this.shell.state.isOpen) {
      editorHeight -= SHELL_HEIGHT;
    }

    let editorWidth = screen.cols;
    if (this.fileTree.state.isOpen) {
      editorWidth -= FILE_TREE_WIDTH;
    }
    if (this.scratchpad.state.isOpen) {
      editorWidth -= SCRATCHPAD_WIDTH;
    }

    const frameHeight = editorHeight;
    const contentHeight = frameHeight - 2;
    const contentWidth = editorWidth - GUTTER_WIDTH - 2;

    let newScrollRow = adjustScrollView(
      logicalCursor.row,
      this.state.scroll.row,
      contentHeight,
      totalLines,
    );

    let newScrollCol = this.state.scroll.col;
    const margin = 5;
    if (logicalCursor.col < this.state.scroll.col + margin) {
      newScrollCol = Math.max(0, logicalCursor.col - margin);
    } else if (
      logicalCursor.col >=
      this.state.scroll.col + contentWidth - margin
    ) {
      newScrollCol = logicalCursor.col - contentWidth + margin + 1;
    }

    if (
      newScrollRow !== this.state.scroll.row ||
      newScrollCol !== this.state.scroll.col
    ) {
      this.setState({ scroll: { row: newScrollRow, col: newScrollCol } });
    }
  }

  setFocusManager(focusManager) {
    this.focusManager = focusManager;
  }

  onMount() {
    this.fileTree.open(this.focusManager);
  }

  onResize(screen) {
    if (this.state.activeEditorUiState) {
      this.calculateAndSetScroll(this.state.activeEditorUiState, screen);
    }
  }

  async handleKey(key, focusManager) {
    if (this.fileTree.state.isOpen)
      return this.fileTree.handleKey(key, focusManager);
    if (this.shell.state.isOpen) return this.shell.handleKey(key, focusManager);
    if (this.scratchpad.state.isOpen)
      return this.scratchpad.handleKey(key, focusManager);

    if (key.ctrl && key.name === "b") {
      if (this.shell.state.isOpen) {
        this.shell.close(focusManager);
        focusManager.requestFocus(this);
      } else {
        this.shell.open(focusManager);
      }
      return true;
    }

    if (key.ctrl && key.name === "e") {
      this.fileTree.open(focusManager);
      return true;
    }

    if (key.ctrl && key.name === "n") {
      this.scratchpad.open(focusManager);
      return true;
    }

    if (key.name === "tab" && key.ctrl) {
      if (this.tabs.length > 1) {
        if (key.shift) {
          this.switchPrevTab();
        } else {
          this.switchNextTab();
        }
        return true;
      }
    }

    if (this.activeTabId) {
      const keyName =
        KEY_NAME_MAP[key.name] ||
        (key.sequence?.length === 1 && !key.ctrl && !key.meta
          ? key.sequence
          : key.name);
      if (keyName) {
        this.editor.processKeyEvent({
          key: keyName,
          ctrlKey: key.ctrl,
          metaKey: key.meta,
          shiftKey: key.shift,
        });
      }
      return true;
    }
    return false;
  }

  render(screen) {
    let buffer = [];
    let cursor = { show: false };
    let editorMode = "NORMAL";

    let editorXOffset = 0;
    if (this.fileTree.state.isOpen) {
      const fileTreeRender = this.fileTree.render(screen);
      buffer.push(...fileTreeRender.buffer);
      editorXOffset = FILE_TREE_WIDTH;
    }

    if (this.scratchpad.state.isOpen) {
      const scratchpadRender = this.scratchpad.render(screen);
      buffer.push(...scratchpadRender.buffer);
      if (scratchpadRender.cursor.show) {
        cursor = scratchpadRender.cursor;
      }
    }

    buffer.push(...this.renderTabBar(screen, editorXOffset));

    const { activeEditorUiState } = this.state;
    if (activeEditorUiState) {
      const { buffer: editorBuffer, cursor: editorCursor } = this.renderEditor(
        screen,
        activeEditorUiState,
        editorXOffset,
      );
      buffer.push(...editorBuffer);
      if (!cursor.show) {
        cursor = editorCursor;
      }
      buffer.push(
        ...this.renderStatusBar(screen, activeEditorUiState, editorXOffset),
      );
      editorMode = activeEditorUiState.mode;
    }

    if (this.shell.state.isOpen) {
      const shellRender = this.shell.render(screen);
      buffer.push(...shellRender.buffer);
      if (shellRender.cursor.show) {
        cursor = shellRender.cursor;
      }
    }

    if (
      activeEditorUiState &&
      (activeEditorUiState.mode === "COMMAND_LINE" ||
        activeEditorUiState.mode === "VISUAL_COMMAND")
    ) {
      const { commandLine } = activeEditorUiState;
      cursor = {
        row: screen.rows - 1 - (this.shell.state.isOpen ? SHELL_HEIGHT : 0),
        col:
          editorXOffset +
          decolorize(commandLine.prefix + commandLine.input).length,
        show: true,
      };
    }

    return {
      buffer,
      cursor,
      modals: [],
      editorMode,
    };
  }

  renderTabBar(screen, xOffset = 0) {
    const buffer = [];
    const { tabIds, activeId } = this.state.tabInfo;
    let currentX = xOffset;
    let width = screen.cols - xOffset;
    if (this.scratchpad.state.isOpen) {
      width -= SCRATCHPAD_WIDTH;
    }
    const defaultStyle = styles.tabBar;

    buffer.push({
      row: 0,
      col: xOffset,
      text: " ".repeat(width),
      style: { bg: defaultStyle.bg },
    });

    tabIds.forEach((id, index) => {
      const tab = this.getTab(id);
      if (!tab) return;
      const bufferInfo = this.buffers.get(id);
      if (!bufferInfo) return;

      const isActive = id === activeId;
      const style = isActive ? defaultStyle.active : defaultStyle.inactive;
      const tabText = ` ${index + 1}:${tab.fileName}${bufferInfo.isDirty ? "*" : ""
        } `;

      if (currentX + decolorize(tabText).length >= screen.cols) return;

      buffer.push({ row: 0, col: currentX, text: tabText, style });
      currentX += decolorize(tabText).length;

      const nextTab = this.getTab(tabIds[index + 1]);
      const nextIsActive = nextTab && nextTab.id === activeId;
      const nextStyle = nextIsActive
        ? defaultStyle.active
        : defaultStyle.inactive;
      const nextBg = index < tabIds.length - 1 ? nextStyle.bg : defaultStyle.bg;

      buffer.push({
        row: 0,
        col: currentX,
        text: POWERLINE_CHARS.SEPARATOR,
        style: { fg: style.bg, bg: nextBg },
      });
      currentX++;
    });
    return buffer;
  }

  calculateViewportContent(uiState, screen) {
    const { text, selection, mode, language } = uiState;
    const { scroll } = this.state;

    let editorHeight = screen.rows - TAB_BAR_HEIGHT - 1;
    if (this.shell.state.isOpen) {
      editorHeight -= SHELL_HEIGHT;
    }
    const frameHeight = editorHeight;

    let editorWidth = screen.cols;
    if (this.fileTree.state.isOpen) {
      editorWidth -= FILE_TREE_WIDTH;
    }
    if (this.scratchpad.state.isOpen) {
      editorWidth -= SCRATCHPAD_WIDTH;
    }

    const contentHeight = frameHeight - 2;
    const contentWidth = editorWidth - GUTTER_WIDTH - 2;
    const logicalLines = text.split("\n");
    const totalLines = logicalLines.length;
    const visibleLines = [];
    for (let i = 0; i < contentHeight; i++) {
      const logicalLineIndex = scroll.row + i;
      if (logicalLineIndex < totalLines) {
        visibleLines.push({
          text: logicalLines[logicalLineIndex],
          logicalLine: logicalLineIndex,
        });
      }
    }
    const content = visibleLines.map((vLine) => {
      const viewportStartCol = scroll.col;
      const viewportEndCol = scroll.col + contentWidth;
      let selStartCol = -1,
        selEndCol = -1;
      const isVisual = mode.startsWith("VISUAL");
      const isSearch = mode === "SEARCH" && selection.start !== selection.end;
      if (isVisual || isSearch) {
        const selStart = Math.min(selection.start, selection.end);
        const selEnd = Math.max(selection.start, selection.end);
        const selStartCoords = getLineCol(text, selStart);
        const selEndCoords = getLineCol(text, selEnd);
        if (
          vLine.logicalLine >= selStartCoords.row &&
          vLine.logicalLine <= selEndCoords.row
        ) {
          selStartCol =
            vLine.logicalLine === selStartCoords.row ? selStartCoords.col : 0;
          selEndCol =
            vLine.logicalLine === selEndCoords.row
              ? selEndCoords.col
              : vLine.text.length;
          if (mode === "VISUAL_LINE") {
            selEndCol = vLine.text.length;
          }
        }
      }

      const initialSegments = [];
      if (selStartCol !== -1) {
        if (selStartCol > 0)
          initialSegments.push({ start: 0, end: selStartCol, style: "text" });
        initialSegments.push({
          start: selStartCol,
          end: selEndCol,
          style: "selection",
        });
        if (selEndCol < vLine.text.length)
          initialSegments.push({
            start: selEndCol,
            end: vLine.text.length,
            style: "text",
          });
      } else {
        initialSegments.push({
          start: 0,
          end: vLine.text.length,
          style: "text",
        });
      }

      const lineSegments = [];
      initialSegments.forEach((seg) => {
        if (seg.style === "selection") {
          lineSegments.push(seg);
        } else {
          const segmentText = vLine.text.substring(seg.start, seg.end);
          const highlighted = highlight(segmentText, language);
          let currentPos = seg.start;
          highlighted.forEach((hSeg) => {
            lineSegments.push({
              start: currentPos,
              end: currentPos + hSeg.text.length,
              style: hSeg.style,
            });
            currentPos += hSeg.text.length;
          });
        }
      });

      const viewportSegments = [];
      lineSegments.forEach((seg) => {
        const segStart = seg.start;
        const segEnd = seg.end;
        const overlapStart = Math.max(segStart, viewportStartCol);
        const overlapEnd = Math.min(segEnd, viewportEndCol);
        if (overlapStart < overlapEnd) {
          viewportSegments.push({
            text: vLine.text.substring(overlapStart, overlapEnd),
            style: seg.style,
            startCol: overlapStart - viewportStartCol,
          });
        }
      });
      return {
        type: "line",
        lineNumber: vLine.logicalLine + 1,
        segments: viewportSegments,
      };
    });
    while (content.length < contentHeight) {
      content.push({ type: "tilde" });
    }
    return content;
  }

  renderEditor(screen, uiState, xOffset = 0) {
    const { scroll } = this.state;
    const { text, selection } = uiState;
    const buffer = [];

    let editorWidth = screen.cols - xOffset;
    if (this.scratchpad.state.isOpen) {
      editorWidth -= SCRATCHPAD_WIDTH;
    }
    const frameWidth = editorWidth;

    let editorHeight = screen.rows - TAB_BAR_HEIGHT - 1;
    if (this.shell.state.isOpen) {
      editorHeight -= SHELL_HEIGHT;
    }

    const frameHeight = editorHeight;
    const contentHeight = frameHeight - 2;
    const frameYOffset = TAB_BAR_HEIGHT;
    const contentWidth = frameWidth - GUTTER_WIDTH - 2;
    const viewportContent = this.calculateViewportContent(uiState, screen);
    const totalLines = text.split("\n").length;
    const maxLineWidth = text
      .split("\n")
      .reduce((max, line) => Math.max(max, line.length), 0);
    const logicalCursor = getLineCol(text, selection.end);
    const scrollableHeight = Math.max(0, totalLines - contentHeight);
    const canScrollDown = scrollableHeight > 0;
    const vScrollPercent = canScrollDown
      ? scroll.row / Math.max(1, totalLines - contentHeight)
      : 0;
    const vIndicatorY =
      frameYOffset + 1 + Math.floor(vScrollPercent * (contentHeight - 1));
    const scrollableWidth = Math.max(0, maxLineWidth - contentWidth);
    const canScrollRight = scrollableWidth > 0;
    const hScrollPercent = canScrollRight ? scroll.col / scrollableWidth : 0;
    const hIndicatorX =
      xOffset +
      1 +
      GUTTER_WIDTH +
      Math.floor(hScrollPercent * (contentWidth - 1));
    buffer.push(
      ...createBox(xOffset, frameYOffset, frameWidth, frameHeight, null, {
        style: styles.frame,
      }),
    );

    if (canScrollDown) {
      for (let i = 0; i < contentHeight; i++) {
        const y = frameYOffset + 1 + i;
        const isIndicator = y === vIndicatorY;
        const isScrolledPast = y < vIndicatorY;
        const char = isIndicator
          ? SCROLLBAR_CHARS.VERTICAL_INDICATOR
          : isScrolledPast
            ? FRAME_CHARS.VERTICAL
            : SCROLLBAR_CHARS.VERTICAL_TRACK;
        const style = isIndicator
          ? styles.scrollbar.indicator
          : isScrolledPast
            ? styles.frame
            : styles.scrollbar.track;
        buffer.push({
          row: y,
          col: xOffset + frameWidth - 1,
          text: char,
          style: style,
        });
      }
    }
    if (canScrollRight) {
      for (let i = 0; i < contentWidth; i++) {
        const x = xOffset + 1 + GUTTER_WIDTH + i;
        const isIndicator = x === hIndicatorX;
        const isScrolledPast = x < hIndicatorX;
        const char = isIndicator
          ? SCROLLBAR_CHARS.HORIZONTAL_INDICATOR
          : isScrolledPast
            ? FRAME_CHARS.HORIZONTAL
            : SCROLLBAR_CHARS.HORIZONTAL_TRACK;
        const style = isIndicator
          ? styles.scrollbar.indicator
          : isScrolledPast
            ? styles.frame
            : styles.scrollbar.track;
        buffer.push({
          row: frameYOffset + frameHeight - 1,
          col: x,
          text: char,
          style: style,
        });
      }
    }

    viewportContent.forEach((line, screenRow) => {
      if (screenRow >= contentHeight) return;
      const y = frameYOffset + screenRow + 1;
      buffer.push({
        row: y,
        col: xOffset + 1,
        text: " ".repeat(frameWidth - 2),
        style: styles.base,
      });
      if (line.type === "tilde") {
        buffer.push({
          row: y,
          col: xOffset + 1,
          text: "~",
          style: styles.tilde,
        });
        return;
      }
      const isCurrentLine = line.lineNumber - 1 === logicalCursor.row;
      const gutterStyle = isCurrentLine
        ? styles.gutterActive
        : styles.gutterInactive;
      const gutterNumber = isCurrentLine
        ? line.lineNumber
        : Math.abs(line.lineNumber - 1 - logicalCursor.row);
      const gutterText = String(gutterNumber).padStart(GUTTER_WIDTH - 2) + "  ";
      buffer.push({
        row: y,
        col: xOffset + 1,
        text: gutterText,
        style: gutterStyle,
      });

      line.segments.forEach((segment) => {
        let style;
        switch (segment.style) {
          case "selection":
            style = styles.inverse;
            break;
          case "string":
            style = { fg: colors.blue };
            break;
          case "keyword":
            style = { fg: colors.blue, bold: true };
            break;
          case "specialChar":
            style = styles.specialChar;
            break;
          default:
            style = {};
            break;
        }

        buffer.push({
          row: y,
          col: xOffset + 1 + GUTTER_WIDTH + segment.startCol,
          text: segment.text,
          style,
        });
      });
    });
    const editorCursor = {
      row: frameYOffset + logicalCursor.row - scroll.row + 1,
      col: xOffset + logicalCursor.col - scroll.col + GUTTER_WIDTH + 1,
      show:
        !this.shell.state.isOpen &&
        !this.fileTree.state.isOpen &&
        !this.scratchpad.state.isOpen,
    };
    return { buffer, cursor: editorCursor };
  }

  renderStatusBar(screen, uiState, xOffset = 0) {
    const { mode, isDirty, selection, text, statusMessage, commandLine } =
      uiState;
    const activeTab = this.getActiveTab();
    const fileName = activeTab ? activeTab.fileName : "";
    const { cols, rows } = screen;
    const buffer = [];

    let y = rows - 1;
    if (this.shell.state.isOpen) {
      y -= SHELL_HEIGHT;
    }

    let width = cols - xOffset;
    if (this.scratchpad.state.isOpen) {
      width -= SCRATCHPAD_WIDTH;
    }
    const defaultStyle = styles.statusBar.default;

    buffer.push({
      row: y,
      col: xOffset,
      text: " ".repeat(width),
      style: defaultStyle,
    });

    if (mode === "COMMAND_LINE" || mode === "VISUAL_COMMAND") {
      buffer.push({
        row: y,
        col: xOffset,
        text: `${commandLine.prefix}${commandLine.input || ""}`,
        style: styles.commandLine,
      });
      return buffer;
    }
    if (statusMessage) {
      buffer.push({
        row: y,
        col: xOffset + 1,
        text: decolorize(statusMessage),
        style: { ...styles.statusBar.file, bold: true },
      });
      return buffer;
    }

    const modeStyle =
      styles.statusBar.mode[mode] || styles.statusBar.mode.NORMAL;
    const leftSegments = [
      { text: ` ${mode} `, style: modeStyle },
      {
        text: ` ${fileName || "[Untitled]"}${isDirty ? " [+]" : ""} `,
        style: styles.statusBar.file,
      },
    ];

    const logicalCursor = getLineCol(text, selection.end);
    const rightSegments = [
      {
        text: ` ${logicalCursor.row + 1}:${logicalCursor.col} `,
        style: styles.statusBar.cursor,
      },
    ];

    let currentX = xOffset;
    leftSegments.forEach((segment, i) => {
      buffer.push({
        row: y,
        col: currentX,
        text: segment.text,
        style: segment.style,
      });
      currentX += decolorize(segment.text).length;

      const nextBg =
        i + 1 < leftSegments.length
          ? leftSegments[i + 1].style.bg
          : defaultStyle.bg;
      buffer.push({
        row: y,
        col: currentX,
        text: POWERLINE_CHARS.SEPARATOR,
        style: { fg: segment.style.bg, bg: nextBg },
      });
      currentX++;
    });

    let currentRightX = xOffset + width;
    let nextBgForRight = defaultStyle.bg;
    [...rightSegments].reverse().forEach((segment) => {
      const textLen = decolorize(segment.text).length;
      currentRightX -= textLen;

      buffer.push({
        row: y,
        col: currentRightX,
        text: segment.text,
        style: segment.style,
      });

      buffer.push({
        row: y,
        col: currentRightX - 1,
        text: POWERLINE_CHARS.SEPARATOR_LEFT,
        style: { fg: segment.style.bg, bg: nextBgForRight },
      });
      currentRightX--;
      nextBgForRight = segment.style.bg;
    });

    return buffer;
  }
}

const terminal = new Terminal(
  new TerminalApp({
    props: {
      screen: {
        cols: process.stdout.columns,
        rows: process.stdout.rows,
      },
    },
  }),
);

terminal.run();
