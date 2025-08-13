import { createBox, decolorize } from "./utils.js";
import { Component } from "./component.js";
import {
  styles,
  colors,
  PALETTE_MAX_WIDTH,
  PALETTE_MAX_HEIGHT,
  PALETTE_INPUT_PROMPT,
  PALETTE_SELECTED_INDICATOR,
  FRAME_CHARS,
} from "./constants.js";

export class Palette extends Component {
  constructor(options) {
    super(options);
    this.state = {
      isOpen: false,
      items: [],
      filteredItems: [],
      selectedIndex: 0,
      scrollOffset: 0,
      title: "",
      onSelect: null,
      onCancel: null,
      getItems: null,
      filterText: "",
    };
    this.screen = null;
  }
  async open(title, getItems, onSelect, focusManager, onCancel) {
    this.setState({
      isOpen: true,
      filterText: "",
      title,
      onSelect,
      onCancel,
      getItems,
      selectedIndex: 0,
      scrollOffset: 0,
    });
    focusManager.requestFocus(this);
    await this.refresh();
  }
  async refresh() {
    if (!this.state.getItems) return;
    try {
      const items = await this.state.getItems();
      this.setState({
        items,
        filteredItems: items,
        filterText: "",
        selectedIndex: 0,
        scrollOffset: 0,
      });
    } catch (e) {
      this.setState({
        items: [{ name: "Error", description: e.message }],
        filteredItems: [{ name: "Error", description: e.message }],
      });
    }
  }
  close(focusManager, wasCancelled = false) {
    if (!this.state.isOpen) return;
    if (wasCancelled && this.state.onCancel) this.state.onCancel();
    this.setState({ isOpen: false, onSelect: null, onCancel: null });
    focusManager.releaseFocus(this);
  }
  async handleKey(key, focusManager) {
    if (!this.state.isOpen || !this.screen) return false;
    const { rows } = this.screen;
    const { selectedIndex, filteredItems, scrollOffset } = this.state;
    const height = Math.min(rows - 6, PALETTE_MAX_HEIGHT);
    const listHeight = height - 4;
    switch (key.name) {
      case "escape":
        this.close(focusManager, true);
        break;
      case "up":
        const newUpIndex =
          (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
        this.setState({
          selectedIndex: newUpIndex,
          scrollOffset: newUpIndex < scrollOffset ? newUpIndex : scrollOffset,
        });
        break;
      case "down":
        const newDownIndex = (selectedIndex + 1) % filteredItems.length;
        let newScrollOffset = scrollOffset;
        if (newDownIndex >= scrollOffset + listHeight)
          newScrollOffset = newDownIndex - listHeight + 1;
        if (newScrollOffset > filteredItems.length - listHeight)
          newScrollOffset = Math.max(0, filteredItems.length - listHeight);
        this.setState({
          selectedIndex: newDownIndex,
          scrollOffset: newScrollOffset,
        });
        break;
      case "return":
        const selected = filteredItems[selectedIndex];
        if (selected && this.state.onSelect) {
          const shouldClose = await this.state.onSelect(selected);
          if (shouldClose) this.close(focusManager, false);
          else await this.refresh();
        } else {
          this.close(focusManager, false);
        }
        break;
      case "backspace":
        this.updateFilter(this.state.filterText.slice(0, -1));
        break;
      default:
        if (
          key.sequence &&
          !key.ctrl &&
          !key.meta &&
          key.sequence.length === 1
        ) {
          this.updateFilter(this.state.filterText + key.sequence);
        }
        break;
    }
    return true;
  }
  updateFilter(filterText) {
    const lowerCaseFilter = filterText.toLowerCase();
    const filteredItems = filterText
      ? this.state.items.filter((item) =>
        item.name?.toLowerCase().includes(lowerCaseFilter),
      )
      : this.state.items;
    this.setState({
      filterText,
      filteredItems,
      selectedIndex: 0,
      scrollOffset: 0,
    });
  }
  render(screen) {
    this.screen = screen;
    if (!this.state.isOpen) return { buffer: [], cursor: { show: false } };
    const { cols, rows } = screen;
    const width = Math.min(cols - 6, PALETTE_MAX_WIDTH);
    const height = Math.min(rows - 6, PALETTE_MAX_HEIGHT);
    const x = Math.floor((cols - width) / 2);
    const y = Math.floor((rows - height) / 2);
    let buffer = createBox(x, y, width, height, this.state.title, {
      style: styles.palette.box,
      bg: styles.palette.bg,
      hasShadow: false,
    });
    buffer.push({
      row: y + 1,
      col: x + 2,
      text: PALETTE_INPUT_PROMPT + this.state.filterText,
      style: styles.palette.input,
    });
    buffer.push({
      row: y + 2,
      col: x + 1,
      text: FRAME_CHARS.HORIZONTAL.repeat(width - 2),
      style: styles.palette.box,
    });

    const listHeight = height - 4;
    const contentWidth = width - 4;
    const { filteredItems, selectedIndex, scrollOffset } = this.state;
    for (
      let i = 0;
      i < listHeight && i + scrollOffset < filteredItems.length;
      i++
    ) {
      const itemIndex = i + scrollOffset;
      const item = filteredItems[itemIndex];
      const isSelected = itemIndex === selectedIndex;
      const indicator = isSelected ? PALETTE_SELECTED_INDICATOR + " " : "  ";
      let displayName = item.name || "";
      if (displayName.length > contentWidth - 2)
        displayName = displayName.substring(0, contentWidth - 3) + "…";
      const lineStyle = isSelected
        ? styles.palette.itemActive
        : styles.palette.item;
      const lineY = y + 3 + i;
      buffer.push({
        row: lineY,
        col: x + 2,
        text: " ".repeat(width - 4),
        style: lineStyle,
      });
      buffer.push({
        row: lineY,
        col: x + 2,
        text: indicator,
        style: { ...lineStyle, ...styles.palette.itemIndicator },
      });
      buffer.push({
        row: lineY,
        col: x + 4,
        text: displayName,
        style: lineStyle,
      });
    }
    const cursor = {
      row: y + 1,
      col:
        x +
        2 +
        decolorize(PALETTE_INPUT_PROMPT).length +
        this.state.filterText.length,
      show: true,
    };
    return { buffer, cursor };
  }
}

export class Alert extends Component {
  constructor(options) {
    super(options);
    this.state = { isOpen: false, message: "", onResolve: null };
  }
  open(message, focusManager) {
    this.setState({ isOpen: true, message });
    focusManager.requestFocus(this);
    return new Promise((resolve) => {
      this.setState({ onResolve: resolve });
    });
  }
  close(resolution, focusManager) {
    if (this.state.onResolve) this.state.onResolve(resolution);
    this.setState({ isOpen: false, message: "", onResolve: null });
    focusManager.releaseFocus(this);
  }
  handleKey(key, focusManager) {
    if (!this.state.isOpen) return false;
    const keyName = key.name || key.sequence;
    if (keyName === "y") this.close(true, focusManager);
    else if (keyName === "n" || keyName === "escape")
      this.close(false, focusManager);
    return true;
  }
  render(screen) {
    if (!this.state.isOpen) return { buffer: [], cursor: { show: false } };
    const { cols, rows } = screen;
    const lines = this.state.message.split("\n");
    const width = Math.min(
      cols - 6,
      Math.max(40, ...lines.map(decolorize).map((l) => l.length)) + 4,
    );
    const height = lines.length + 4;
    const x = Math.floor((cols - width) / 2);
    const y = Math.floor((rows - height) / 2);
    let buffer = createBox(x, y, width, height, "Confirm", {
      style: styles.alert.box,
      bg: colors.black,
      hasShadow: true,
    });
    lines.forEach((msgLine, i) => {
      buffer.push({
        row: y + 1 + i,
        col: x + 2,
        text: msgLine,
        style: { ...styles.alert.message, bg: colors.black },
      });
    });
    const confirmText = " (y/n) ";
    buffer.push({
      row: y + height - 2,
      col: x + Math.floor((width - confirmText.length) / 2),
      text: confirmText,
      style: { ...styles.alert.prompt, bg: colors.black },
    });
    return { buffer, cursor: { show: false } };
  }
}
