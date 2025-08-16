import { $ } from "bun";
import { Component } from "./component.js";
import { createBox, decolorize } from "./utils.js";
import { styles, colors } from "./constants.js";
import os from "os";

const SHELL_PROMPT_SYMBOL = "❯";
export const SHELL_HEIGHT = 10;

export class Shell extends Component {
  constructor(options) {
    super(options);
    this.state = {
      isOpen: false,
      command: "",
      history: [],
      scrollOffset: 0,
      isExecuting: false,
      cwd: process.cwd(),
    };
    this.screen = null;
  }

  open(focusManager) {
    if (this.state.isOpen) {
      return;
    }
    this.setState({
      isOpen: true,
      command: "",
      history: [],
      scrollOffset: 0,
      isExecuting: false,
      cwd: process.cwd(),
    });
    focusManager.requestFocus(this);
  }

  close(focusManager) {
    this.setState({ isOpen: false });
    focusManager.releaseFocus(this);
  }

  async executeCommand(focusManager) {
    const { command, history, cwd } = this.state;
    const trimmedCommand = command.trim();

    if (!trimmedCommand) return;

    if (trimmedCommand === "exit") {
      this.close(focusManager);
      return;
    }

    const fullPrompt = this.getPromptText();
    const newHistory = [...history, `${fullPrompt}${trimmedCommand}`];
    this.setState({
      command: "",
      isExecuting: true,
      history: newHistory,
    });

    if (trimmedCommand === "clear") {
      this.setState({ history: [], scrollOffset: 0, isExecuting: false });
      return;
    }

    try {
      const output = await $`${{ raw: trimmedCommand }}`.cwd(cwd).text();
      const outputLines = output.trim().split("\n");
      this.setState((prevState) => ({
        history: [...newHistory, ...outputLines],
      }));
    } catch (error) {
      const errorLines = error.stderr?.toString().trim().split("\n") || [
        error.message,
      ];
      this.setState((prevState) => ({
        history: [...newHistory, ...errorLines.map((l) => `Error: ${l}`)],
      }));
    } finally {
      this.setState({
        isExecuting: false,
        cwd: process.cwd(),
      });
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    const listHeight = this.getListHeight();
    if (listHeight === 0) return;
    const newScrollOffset = Math.max(0, this.state.history.length - listHeight);
    this.setState({ scrollOffset: newScrollOffset });
  }

  getPromptText() {
    const { cwd } = this.state;
    const homeDir = os.homedir();
    let displayCwd = cwd.startsWith(homeDir)
      ? `~${cwd.substring(homeDir.length)}`
      : cwd;
    return `${displayCwd} ${SHELL_PROMPT_SYMBOL} `;
  }

  getListHeight() {
    return SHELL_HEIGHT - 3;
  }

  handleKey(key, focusManager) {
    if (!this.state.isOpen) return false;

    const listHeight = this.getListHeight();

    switch (key.name) {
      case "escape":
        this.close(focusManager);
        break;
      case "up":
        this.setState({
          scrollOffset: Math.max(0, this.state.scrollOffset - 1),
        });
        break;
      case "down":
        this.setState({
          scrollOffset: Math.min(
            this.state.scrollOffset + 1,
            Math.max(0, this.state.history.length - listHeight),
          ),
        });
        break;
      case "return":
        if (!this.state.isExecuting) {
          this.executeCommand(focusManager);
        }
        break;
      case "backspace":
        this.setState({
          command: this.state.command.slice(0, -1),
        });
        break;
      default:
        if (
          key.sequence &&
          !key.ctrl &&
          !key.meta &&
          key.sequence.length === 1
        ) {
          this.setState({
            command: this.state.command + key.sequence,
          });
        }
        break;
    }
    return true;
  }

  render(screen) {
    this.screen = screen;
    if (!this.state.isOpen) return { buffer: [], cursor: { show: false } };

    const { cols, rows } = screen;
    const y = rows - SHELL_HEIGHT;

    let buffer = createBox(0, y, cols, SHELL_HEIGHT, "Shell");

    const listHeight = this.getListHeight();
    const { history, scrollOffset, command, isExecuting } = this.state;

    for (let i = 0; i < listHeight; i++) {
      const historyIndex = i + scrollOffset;
      const row = y + 1 + i;
      if (historyIndex < history.length) {
        let line = decolorize(history[historyIndex]).replace(/\t/g, "  ");
        if (line.length > cols - 2) {
          line = line.substring(0, cols - 3) + "…";
        }
        buffer.push({
          row: row,
          col: 1,
          text: line,
          style: styles.text,
        });
      }
    }

    const inputY = y + SHELL_HEIGHT - 2;
    const promptText = this.getPromptText();
    let inputLineX = 1;

    if (isExecuting) {
      const executingText = "Executing...";
      buffer.push({
        row: inputY,
        col: inputLineX,
        text: executingText,
        style: { fg: colors.gray },
      });
    } else {
      const fullPrompt = `${promptText}${command}`;
      buffer.push({
        row: inputY,
        col: inputLineX,
        text: fullPrompt,
        style: styles.text,
      });
    }

    const cursor = {
      row: inputY,
      col: inputLineX + decolorize(promptText).length + command.length,
      show: !isExecuting,
    };

    return { buffer, cursor };
  }
}

