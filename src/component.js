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
    this.children.forEach((child) => {
      const childRender = child.render(screen);
      if (childRender?.buffer) buffer.push(...childRender.buffer);
    });
    return { buffer, cursor: { show: false } };
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
