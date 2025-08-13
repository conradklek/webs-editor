import { ANSI, UI_RENDER_INTERVAL_MS } from "./constants.js";
import { FocusManager } from "./component.js";
import { decolorize } from "./utils.js";
import { Screen } from "./screen.js";
import readline from "readline";

export class Terminal {
  constructor(rootComponent) {
    this.rootComponent = rootComponent;
    this.screen = new Screen(process.stdout.columns, process.stdout.rows);
    this.focusManager = new FocusManager(rootComponent);
    this.isRunning = false;
    this.cursorPos = { row: 0, col: 0, show: false };
    this.isResizing = false;
    this.loopTimeout = null;
    if (typeof this.rootComponent.setFocusManager === "function") {
      this.rootComponent.setFocusManager(this.focusManager);
    }
  }

  run() {
    this.isRunning = true;
    this.setupProcessHooks();
    this.rootComponent.mount();
    this.mainLoop();
  }

  stop() {
    if (this.loopTimeout) clearTimeout(this.loopTimeout);
    this.isRunning = false;
    this.cleanupAndExit();
  }

  setupProcessHooks() {
    process.stdout.write(ANSI.CURSOR_HIDE + ANSI.CLEAR_SCREEN);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (str, key) => {
      if (key?.ctrl && key.name === "c") this.stop();
      else this.focusManager.handleKey(key || { name: str, sequence: str });
    });
    process.stdout.on("resize", () => {
      this.isResizing = true;
      setTimeout(() => {
        process.stdout.write(ANSI.CLEAR_SCREEN);
        this.screen = new Screen(process.stdout.columns, process.stdout.rows);
        this.rootComponent.props.screen = this.getScreenInfo();
        if (this.rootComponent.onResize)
          this.rootComponent.onResize(this.getScreenInfo());
        this.isResizing = false;
      }, 100);
    });
  }

  mainLoop() {
    if (!this.isRunning || this.isResizing) {
      this.loopTimeout = setTimeout(
        () => this.mainLoop(),
        UI_RENDER_INTERVAL_MS,
      );
      return;
    }
    this.screen.clearRenderBuffer();
    this.screen.setModalMask(null);

    const renderData = this.rootComponent.render(this.getScreenInfo());

    if (renderData.base) {
      const modalMask = Array.from({ length: this.screen.height }, () =>
        Array(this.screen.width).fill(false),
      );
      if (renderData.modals) {
        renderData.modals.forEach((modal) => {
          if (!modal?.buffer) return;
          modal.buffer.forEach((cell) => {
            const len = decolorize(cell.text).length;
            for (let i = 0; i < len; i++) {
              const x = cell.col + i;
              const y = cell.row;
              if (
                y >= 0 &&
                y < this.screen.height &&
                x >= 0 &&
                x < this.screen.width
              )
                modalMask[y][x] = true;
            }
          });
        });
      }
      this.screen.setModalMask(modalMask);
      this.screen.draw(renderData.base.buffer);
    }
    this.screen.setModalMask(null);
    if (renderData.modals)
      renderData.modals.forEach((modal) => this.screen.draw(modal.buffer));
    if (renderData.buffer) this.screen.draw(renderData.buffer);

    let finalCursor = { show: false };
    if (renderData.base?.cursor?.show) finalCursor = renderData.base.cursor;
    if (renderData.modals)
      renderData.modals.forEach((modal) => {
        if (modal?.cursor?.show) finalCursor = modal.cursor;
      });
    if (renderData.cursor?.show) finalCursor = renderData.cursor;
    this.cursorPos = finalCursor;

    this.screen.commit();

    const cursorRow = (this.cursorPos.row || 0) + 1;
    const cursorCol = (this.cursorPos.col || 0) + 1;
    let cursorAnsi = this.cursorPos.show ? ANSI.CURSOR_SHOW : ANSI.CURSOR_HIDE;
    if (this.cursorPos.show) {
      cursorAnsi +=
        renderData.editorMode === "INSERT"
          ? ANSI.CURSOR_STYLE_LINE
          : ANSI.CURSOR_STYLE_BLOCK;
    }
    cursorAnsi += ANSI.CURSOR_TO(cursorRow, cursorCol);
    process.stdout.write(cursorAnsi);
    this.loopTimeout = setTimeout(() => this.mainLoop(), UI_RENDER_INTERVAL_MS);
  }

  cleanupAndExit() {
    process.stdout.write(
      ANSI.CURSOR_STYLE_BLOCK +
      ANSI.CLEAR_SCREEN +
      ANSI.CURSOR_HOME +
      ANSI.CURSOR_SHOW +
      ANSI.SGR_RESET,
    );
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.exit(0);
  }

  getScreenInfo() {
    return { cols: this.screen.width, rows: this.screen.height };
  }
}
