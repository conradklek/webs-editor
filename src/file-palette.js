import {
  createBox,
  styles,
  colors,
  decolorize,
  NERD_FONT_ICONS,
} from "./shared.js";
import { Component, Emitter } from "./component.js";
import path from "path";
import fs from "fs";

const MAX_VISIBLE_FILES = 10;
const CACHE_DURATION_MS = 5000;

function getFileIcon(filename) {
  if (!filename) return NERD_FONT_ICONS.default;
  const extension = path.extname(filename).substring(1);
  return NERD_FONT_ICONS[extension] || NERD_FONT_ICONS.default;
}

export class FilePalette extends Component {
  constructor(options) {
    super(options);
    this.state = {
      isOpen: false,
      files: [],
      filteredFiles: [],
      inputValue: "",
      selectedIndex: 0,
      scrollOffset: 0,
      searchPath: process.cwd(),
    };
    this.rootPath = process.cwd();
    this.emitter = new Emitter();
    this.fileCache = new Map();
    this.lastCacheTime = new Map();
  }

  on(event, callback) {
    this.emitter.on(event, callback);
  }

  async open(focusManager) {
    const searchPath = this.rootPath;
    const files = await this.getFilesForPath(searchPath);

    this.setState({
      isOpen: true,
      files: files,
      filteredFiles: files,
      inputValue: "",
      selectedIndex: 0,
      scrollOffset: 0,
      searchPath: searchPath,
    });
    focusManager.requestFocus(this);
  }

  close(focusManager) {
    this.setState({ isOpen: false });
    focusManager.releaseFocus(this);
  }

  async _recursiveScan(dirPath, arrayOfFiles) {
    try {
      const dirents = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });
      for (const dirent of dirents) {
        if (dirent.name === "node_modules" || dirent.name.startsWith(".")) {
          continue;
        }
        const fullPath = path.join(dirPath, dirent.name);
        if (dirent.isDirectory()) {
          await this._recursiveScan(fullPath, arrayOfFiles);
        } else {
          arrayOfFiles.push(fullPath);
        }
      }
    } catch (e) {
    }
  }

  async getFilesForPath(scanPath) {
    const now = Date.now();
    const cachedFiles = this.fileCache.get(scanPath);
    const lastCache = this.lastCacheTime.get(scanPath) || 0;

    if (cachedFiles && now - lastCache < CACHE_DURATION_MS) {
      return cachedFiles;
    }

    const fullPaths = [];
    await this._recursiveScan(scanPath, fullPaths);
    const relativePaths = fullPaths.map((f) => path.relative(this.rootPath, f));

    this.fileCache.set(scanPath, relativePaths);
    this.lastCacheTime.set(scanPath, now);
    return relativePaths;
  }

  fuzzyMatch(pattern, str) {
    let patternIdx = 0;
    let strIdx = 0;
    let score = 0;
    let consecutiveMatches = 0;

    while (strIdx < str.length) {
      if (pattern[patternIdx]?.toLowerCase() === str[strIdx]?.toLowerCase()) {
        score += 1 + consecutiveMatches * 2;
        if (str[strIdx - 1] === path.sep || str[strIdx - 1] === ".") score += 5;
        if (strIdx === 0) score += 10;
        patternIdx += 1;
        consecutiveMatches++;
      } else {
        consecutiveMatches = 0;
      }
      strIdx += 1;
    }

    return patternIdx === pattern.length ? score : 0;
  }

  filterFiles() {
    const { files, inputValue } = this.state;
    if (!inputValue) {
      this.setState({
        filteredFiles: files,
        selectedIndex: 0,
        scrollOffset: 0,
      });
      return;
    }

    const filtered = files
      .map((file) => ({ file, score: this.fuzzyMatch(inputValue, file) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.file);

    this.setState({
      filteredFiles: filtered,
      selectedIndex: 0,
      scrollOffset: 0,
    });
  }

  async navigateUp() {
    const newSearchPath = path.resolve(this.state.searchPath, "..");
    if (!newSearchPath.startsWith(this.rootPath)) {
      return;
    }
    const files = await this.getFilesForPath(newSearchPath);
    this.setState({
      searchPath: newSearchPath,
      inputValue: "",
      files: files,
      filteredFiles: files,
      selectedIndex: 0,
      scrollOffset: 0,
    });
  }

  handleKey(key, focusManager) {
    if (!this.state.isOpen) return false;

    const showParentDirOption = this.state.searchPath !== this.rootPath;
    const listLength =
      this.state.filteredFiles.length + (showParentDirOption ? 1 : 0);

    if (key.name === "escape") {
      this.close(focusManager);
      return true;
    }

    if (key.name === "return") {
      if (showParentDirOption && this.state.selectedIndex === 0) {
        this.navigateUp();
      } else {
        const fileIndex =
          this.state.selectedIndex - (showParentDirOption ? 1 : 0);
        const selectedFile = this.state.filteredFiles[fileIndex];
        if (selectedFile) {
          this.emitter.emit("file-selected", selectedFile);
          this.close(focusManager);
        }
      }
      return true;
    }

    if (key.name === "up" || (key.ctrl && key.name === "k")) {
      const newIndex = Math.max(0, this.state.selectedIndex - 1);
      this.setState({ selectedIndex: newIndex });
      this.adjustScroll(newIndex);
      return true;
    }

    if (key.name === "down" || (key.ctrl && key.name === "j")) {
      const newIndex = Math.min(listLength - 1, this.state.selectedIndex + 1);
      this.setState({ selectedIndex: newIndex });
      this.adjustScroll(newIndex);
      return true;
    }

    if (key.name === "backspace") {
      this.setState({ inputValue: this.state.inputValue.slice(0, -1) });
      this.filterFiles();
      return true;
    }

    if (key.sequence && !key.ctrl && !key.meta) {
      this.setState({ inputValue: this.state.inputValue + key.sequence });
      this.filterFiles();
      return true;
    }

    return true;
  }

  adjustScroll(selectedIndex) {
    const { scrollOffset } = this.state;
    const listHeight = MAX_VISIBLE_FILES;
    if (selectedIndex < scrollOffset) {
      this.setState({ scrollOffset: selectedIndex });
    } else if (selectedIndex >= scrollOffset + listHeight) {
      this.setState({ scrollOffset: selectedIndex - listHeight + 1 });
    }
  }

  render(screen) {
    if (!this.state.isOpen) return null;

    const width = Math.floor(screen.cols * 0.8);
    const height = Math.min(MAX_VISIBLE_FILES + 4, screen.rows - 4);
    const x = Math.floor((screen.cols - width) / 2);
    const y = Math.floor((screen.rows - height) / 2);

    const buffer = createBox(x, y, width, height, "Find File", {
      bg: colors.transparent,
    });

    const relativeSearchPath =
      path.relative(this.rootPath, this.state.searchPath) || ".";
    const searchPathText = ` ${relativeSearchPath} `;
    buffer.push({
      row: y,
      col: x + 2,
      text: searchPathText,
      style: styles.filePalette.pathHeader,
    });

    const prompt = "❯ ";
    const inputText = this.state.inputValue;
    buffer.push({
      row: y + 1,
      col: x + 2,
      text: prompt,
      style: styles.filePalette.prompt,
    });
    buffer.push({
      row: y + 1,
      col: x + 2 + decolorize(prompt).length,
      text: inputText.padEnd(width - 4 - decolorize(prompt).length),
      style: {},
    });

    buffer.push({
      row: y + 2,
      col: x + 1,
      text: "─".repeat(width - 2),
      style: styles.frame,
    });

    const { filteredFiles, selectedIndex, scrollOffset } = this.state;
    const listHeight = height - 4;
    const showParentDirOption = this.state.searchPath !== this.rootPath;

    if (showParentDirOption) {
      const isSelected = selectedIndex === 0;
      const lineStyle = isSelected
        ? styles.filePalette.selected
        : styles.filePalette.item;
      const iconStyle = { ...lineStyle, fg: colors.blue, bold: true };
      const text = ` ${NERD_FONT_ICONS.directory} ../`;
      buffer.push({
        row: y + 3,
        col: x + 1,
        text: " ".repeat(width - 2),
        style: lineStyle,
      });
      buffer.push({ row: y + 3, col: x + 2, text, style: iconStyle });
    }

    const fileListHeight = listHeight - (showParentDirOption ? 1 : 0);

    for (let i = 0; i < fileListHeight; i++) {
      const visualIndex = scrollOffset + i;
      if (showParentDirOption && visualIndex === 0) continue;

      const fileIndex = visualIndex - (showParentDirOption ? 1 : 0);

      if (fileIndex >= 0 && fileIndex < filteredFiles.length) {
        const file = filteredFiles[fileIndex];
        const isSelected = selectedIndex === visualIndex;

        const dirname = path.dirname(file);
        const basename = path.basename(file);
        const icon = getFileIcon(basename);

        let fileText = ` ${icon} ${basename}`;
        let pathText = dirname === "." ? "" : ` ${dirname}`;

        const availableWidth = width - 4;
        const totalLen =
          decolorize(fileText).length + decolorize(pathText).length;

        if (totalLen > availableWidth) {
          const pathLen = Math.max(
            0,
            availableWidth - decolorize(fileText).length,
          );
          pathText = "..." + pathText.slice(-pathLen + 3);
        }

        const lineStyle = isSelected
          ? styles.filePalette.selected
          : styles.filePalette.item;
        const fileStyle = isSelected
          ? styles.filePalette.selectedFile
          : styles.filePalette.file;
        const pathStyle = isSelected
          ? styles.filePalette.selectedPath
          : styles.filePalette.path;

        const renderY = y + 3 + i;

        buffer.push({
          row: renderY,
          col: x + 1,
          text: " ".repeat(width - 2),
          style: lineStyle,
        });
        buffer.push({
          row: renderY,
          col: x + 2,
          text: fileText,
          style: fileStyle,
        });
        buffer.push({
          row: renderY,
          col: x + 2 + decolorize(fileText).length,
          text: pathText,
          style: pathStyle,
        });
      }
    }

    return {
      buffer,
      cursor: {
        row: y + 1,
        col: x + 2 + decolorize(prompt).length + inputText.length,
        show: true,
      },
    };
  }
}
