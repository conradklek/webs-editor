import {
  decolorize,
  createBox,
  styles,
  colors,
  NERD_FONT_ICONS,
} from "./shared.js";
import { Component } from "./component.js";
import path from "path";
import fs from "fs";

export const FILE_TREE_WIDTH = 30;

function getFileIcon(filename) {
  if (!filename) return NERD_FONT_ICONS.default;
  const extension = path.extname(filename).substring(1);
  return NERD_FONT_ICONS[extension] || NERD_FONT_ICONS.default;
}

export class FileTree extends Component {
  constructor(options) {
    super(options);
    this.state = {
      isOpen: false,
      tree: [],
      selectedIndex: 0,
      scrollOffset: 0,
      expanded: new Set(["."]),
    };
    this.rootPath = process.cwd();
  }

  async open(focusManager) {
    if (this.state.isOpen) {
      this.close(focusManager);
      return;
    }
    const tree = await this.getDirectoryTree(this.rootPath, ".");
    this.setState({ isOpen: true, tree, selectedIndex: 0, scrollOffset: 0 });
    focusManager.requestFocus(this);
  }

  close(focusManager) {
    this.setState({ isOpen: false });
    focusManager.releaseFocus(this);
  }

  async getDirectoryTree(basePath, relativePath) {
    const fullPath = path.join(basePath, relativePath);
    const entries = await fs.promises.readdir(fullPath, {
      withFileTypes: true,
    });
    const items = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const entryRelativePath = path.join(relativePath, entry.name);
      const item = {
        name: entry.name,
        path: entryRelativePath,
        isDirectory: entry.isDirectory(),
        children: [],
      };
      if (item.isDirectory && this.state.expanded.has(item.path)) {
        item.children = await this.getDirectoryTree(basePath, item.path);
      }
      items.push(item);
    }
    return items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  flattenTree() {
    const flattened = [];
    const traverse = (nodes, depth) => {
      for (const node of nodes) {
        flattened.push({ ...node, depth });
        if (node.isDirectory && this.state.expanded.has(node.path)) {
          traverse(node.children, depth + 1);
        }
      }
    };
    traverse(this.state.tree, 0);
    return flattened;
  }

  adjustScroll(selectedIndex, _, screen) {
    let { scrollOffset } = this.state;
    const contentHeight = screen.rows - 2;
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + contentHeight) {
      scrollOffset = selectedIndex - contentHeight + 1;
    }
    this.setState({ scrollOffset });
  }

  async handleKey(key, focusManager) {
    if (!this.state.isOpen) return false;

    const flattenedTree = this.flattenTree();
    const { selectedIndex } = this.state;

    switch (key.name) {
      case "escape":
        this.close(focusManager);
        if (this.props.onCancel) {
          this.props.onCancel();
        }
        break;
      case "up":
      case "k":
        const newUpIndex = Math.max(0, selectedIndex - 1);
        this.setState({ selectedIndex: newUpIndex });
        this.adjustScroll(newUpIndex, flattenedTree, this.screen);
        break;
      case "down":
      case "j":
        const newDownIndex = Math.min(
          flattenedTree.length - 1,
          selectedIndex + 1,
        );
        this.setState({ selectedIndex: newDownIndex });
        this.adjustScroll(newDownIndex, flattenedTree, this.screen);
        break;
      case "return":
        const selectedItem = flattenedTree[selectedIndex];
        if (selectedItem) {
          if (selectedItem.isDirectory) {
            const newExpanded = new Set(this.state.expanded);
            if (newExpanded.has(selectedItem.path)) {
              newExpanded.delete(selectedItem.path);
            } else {
              newExpanded.add(selectedItem.path);
            }
            this.setState({ expanded: newExpanded });
            const tree = await this.getDirectoryTree(this.rootPath, ".");
            this.setState({ tree });
          } else {
            if (this.props.onOpenFile) {
              this.props.onOpenFile(
                path.join(this.rootPath, selectedItem.path),
              );
            }
            this.close(focusManager);
          }
        }
        break;
    }
    return true;
  }

  render(screen) {
    this.screen = screen;
    if (!this.state.isOpen) return { buffer: [], cursor: { show: false } };

    const { rows } = screen;
    const buffer = createBox(0, 0, FILE_TREE_WIDTH, rows, "Project");

    const flattenedTree = this.flattenTree();
    const contentHeight = rows - 2;
    const contentWidth = FILE_TREE_WIDTH - 4;

    for (let i = 0; i < contentHeight; i++) {
      const itemIndex = i + this.state.scrollOffset;
      const item = flattenedTree[itemIndex];

      if (!item) continue;

      const isSelected = itemIndex === this.state.selectedIndex;
      const indentation = "  ".repeat(item.depth);

      let icon;
      if (item.isDirectory) {
        icon = this.state.expanded.has(item.path)
          ? NERD_FONT_ICONS.directory_open
          : NERD_FONT_ICONS.directory;
      } else {
        icon = getFileIcon(item.name);
      }

      let text = `${indentation}${icon} ${item.name}`;
      if (decolorize(text).length > contentWidth) {
        text = text.substring(0, contentWidth - 1) + "…";
      }

      buffer.push({
        row: i + 1,
        col: 2,
        text: text.padEnd(contentWidth, " "),
        style: isSelected
          ? styles.inverse
          : { ...styles.base, bg: colors.transparent },
      });
    }

    return { buffer, cursor: { show: false } };
  }
}
