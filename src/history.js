const MAX_HISTORY_SIZE = 10;

export class UndoRedoHistory {
  constructor(initialState) {
    this.history = [initialState];
    this.currentIndex = 0;
    this.debounceTimer = null;
  }

  record(newState, options = {}) {
    if (newState === this.history[this.currentIndex]) {
      return;
    }
    clearTimeout(this.debounceTimer);
    if (options.immediate) {
      this._addState(newState);
    } else {
      this.debounceTimer = setTimeout(() => {
        this._addState(newState);
      }, 300);
    }
  }

  _addState(newState) {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    this.history.push(newState);
    this.currentIndex = this.history.length - 1;
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
    clearTimeout(this.debounceTimer);
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }
}
