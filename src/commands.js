import { COMMAND_LINE_REGEX, EDITOR_MESSAGES } from "./shared.js";
import path from "path";
import fs from "fs";

export class CommandRegistry {
  constructor(editor) {
    this.editor = editor;
    this.commands = {};
    this.registerBuiltinCommands();
  }
  register(name, handler) {
    if (this.commands[name]) {
      console.warn(`Command "${name}" is already registered. Overwriting.`);
    }
    this.commands[name] = handler;
  }

  execute(commandString) {
    const commandName = commandString.split(" ")[0];
    const command = this.commands[commandName];
    if (command) {
      command(this.editor);
    } else {
      this.editor.actions.enterNormalMode();
    }
  }

  registerBuiltinCommands() {
    this.register("w", (editor) => {
      editor.callback({ ...editor.state, command: "save" });
      editor.actions.enterNormalMode();
    });

    this.register("g", (editor) => {
      editor.callback({ ...editor.state, command: "generate" });
      editor.actions.enterNormalMode();
    });

    this.register("q", (editor) => {
      editor.actions.enterNormalMode();
    });
  }
}

export class CommandHandler {
  constructor(app) {
    this.app = app;

    this.commands = {
      e: this.editFile.bind(this),
      w: this.writeFile.bind(this),
      q: this.quit.bind(this),
      wq: this.writeAndQuit.bind(this),
      tabnew: this.newTab.bind(this),
      tabnext: this.nextTab.bind(this),
      tabprev: this.prevTab.bind(this),
      tabclose: this.quit.bind(this),
      tab: this.switchTabByArg.bind(this),
      b: this.switchTabByArg.bind(this),
    };
    this.aliasMap = new Map([
      ["tn", "tabnext"],
      ["tp", "tabprev"],
    ]);
  }

  async handleCommand(line, focusManager) {
    const parts = line.trim().match(COMMAND_LINE_REGEX) || [];
    if (parts.length === 0) return {};
    let commandInput = parts[0].replace(/^:/, "");
    const args = parts.slice(1).map((a) => a.replace(/^["']|["']$/g, ""));
    let force = false;
    if (commandInput.endsWith("!")) {
      force = true;
      commandInput = commandInput.slice(0, -1);
    }
    const commandName = this.aliasMap.get(commandInput) || commandInput;
    const command = this.commands[commandName];
    if (command) {
      try {
        return (
          (await Promise.resolve(command(args, force, focusManager))) || {}
        );
      } catch (e) {
        return { status: `Error: ${e.message}` };
      }
    }
    return { status: `Unknown command: "${commandInput}"` };
  }

  async newTab(args) {
    const filePath = args[0];
    if (!filePath) {
      this.app.addTab(null, "");
      return { status: "New buffer created." };
    }
    return this.openFile(filePath, false, null, true);
  }

  nextTab = () => {
    this.app.switchNextTab();
    return {};
  };

  prevTab = () => {
    this.app.switchPrevTab();
    return {};
  };

  async switchTabByArg(args) {
    if (!args || args.length === 0) {
      return { status: "Usage: :tab <number>" };
    }
    const tabIndex = parseInt(args[0], 10) - 1;
    if (isNaN(tabIndex) || tabIndex < 0 || tabIndex >= this.app.tabs.length) {
      return {
        status: `Invalid tab number. Use 1 to ${this.app.tabs.length}.`,
      };
    }
    const tabId = this.app.tabs[tabIndex].id;
    this.app.switchTab(tabId);
    return {};
  }

  editFile = (args, force, focusManager) =>
    this.openFile(args[0], force, focusManager, true);

  async openFile(filePathArg, force = false, _, inNewTab = false) {
    if (!filePathArg) return { status: EDITOR_MESSAGES.NO_FILE_NAME };

    const activeTab = this.app.getActiveTab();
    const activeBuffer = activeTab ? this.app.buffers.get(activeTab.id) : null;

    if (activeBuffer && !force && activeBuffer.isDirty) {
      force = true;
    }

    const newFilePath = path.resolve(process.cwd(), filePathArg);
    const existingTab = this.app.findTabByPath(newFilePath);
    if (existingTab) {
      this.app.switchTab(existingTab.id);
      return {
        status: `Switched to open buffer for "${path.basename(newFilePath)}"`,
      };
    }

    try {
      let content = "";
      try {
        content = fs.readFileSync(newFilePath, "utf8");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }

      if (inNewTab || !activeTab) {
        this.app.addTab(newFilePath, content);
      } else {
        const oldId = this.app.activeTabId;
        const tab = this.app.getTab(oldId);
        const buffer = this.app.buffers.get(oldId);

        buffer.text = content;

        tab.id = newFilePath;
        tab.filePath = newFilePath;
        tab.fileName = path.basename(newFilePath);

        this.app.buffers.delete(oldId);
        this.app.buffers.set(newFilePath, buffer);

        this.app.activeTabId = newFilePath;

        this.app.editor.reset(content, {
          fileName: tab.fileName,
          filePath: tab.filePath,
        });

        this.app.updateTabInfoState();
      }

      const newFileName = path.basename(newFilePath);
      return {
        status: `"${newFileName}" ${content.split("\n").length
          }L, ${Buffer.byteLength(content)}B`,
      };
    } catch (e) {
      return { status: `Error opening file: ${e.message}` };
    }
  }

  async writeFile(args) {
    const editor = this.app.editor;
    if (!editor || !this.app.activeTabId)
      return { status: "Error: No active editor." };

    let targetFilePath = editor.filePath;
    if (args && args[0]) {
      targetFilePath = path.resolve(process.cwd(), args[0]);
    }

    if (!targetFilePath) return { status: EDITOR_MESSAGES.NO_FILE_NAME };

    if (targetFilePath !== editor.filePath) {
      this.app.renameTab(this.app.activeTabId, targetFilePath);
    }

    try {
      const content = editor.state.text;
      fs.writeFileSync(targetFilePath, content, "utf8");
      editor.actions.setDirty(false);
      return {
        status: `"${editor.fileName}" written (${content.split("\n").length
          }L, ${Buffer.byteLength(content)}B)`,
      };
    } catch (e) {
      return { status: `Save Error: ${e.message}` };
    }
  }

  async quit(_, force) {
    const activeTab = this.app.getActiveTab();
    if (!activeTab) {
      if (this.app.tabs.length === 0) process.exit(0);
      return { status: EDITOR_MESSAGES.NO_EDITOR_TO_CLOSE };
    }

    const activeBuffer = this.app.buffers.get(activeTab.id);
    if (!force && activeBuffer.isDirty) {
      force = true;
    }

    this.app.closeTab(this.app.activeTabId);
    if (this.app.tabs.length === 0) process.exit(0);
    return { status: "Tab closed." };
  }

  async writeAndQuit(args, force, focusManager) {
    const writeResult = await this.writeFile(args);
    if (writeResult.status && writeResult.status.startsWith("Error"))
      return writeResult;
    return this.quit([], force, focusManager);
  }
}
