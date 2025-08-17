export class Emitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(...args));
    }
  }
}

export class Component {
  constructor(options = {}) {
    this.props = options.props || {};
    this.state = {};
    this.parent = null;
    this.children = [];
    this.isMounted = false;
  }
  setState(newState) {
    this.state = { ...this.state, ...newState };
  }
  addChild(component) {
    component.parent = this;
    this.children.push(component);
    return component;
  }
  mount() {
    this.isMounted = true;
    this.onMount();
    this.children.forEach((c) => c.mount());
  }
  onMount() { }
  handleKey(key, focusManager) {
    for (const child of this.children) {
      if (child.handleKey(key, focusManager)) return true;
    }
    return false;
  }
  render(screen) {
    let buffer = [];
    let modals = [];
    let cursor = { show: false };

    this.children.forEach((child) => {
      const childRender = child.render(screen);
      if (childRender) {
        if (childRender.buffer) {
          if (child.isModal) {
            modals.push(childRender);
          } else {
            buffer.push(...childRender.buffer);
          }
        }
        if (childRender.cursor && childRender.cursor.show) {
          cursor = childRender.cursor;
        }
      }
    });
    return { buffer, modals, cursor };
  }
}

export class FocusManager {
  constructor(rootComponent) {
    this.focusStack = [rootComponent];
  }
  get current() {
    return this.focusStack[this.focusStack.length - 1];
  }
  requestFocus(component) {
    if (this.current !== component) this.focusStack.push(component);
  }
  releaseFocus(component) {
    if (this.current === component && this.focusStack.length > 1)
      this.focusStack.pop();
  }
  handleKey(key) {
    if (this.current?.handleKey) this.current.handleKey(key, this);
  }
}
