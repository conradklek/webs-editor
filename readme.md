# webs-editor

A text editor.

## Philosophy

The `webs-editor` is predicated on a rejection of the modern GUI-centric paradigm, which we contend introduces an unnecessary layer of cognitive overhead and a fundamental haptic dissonance between the user and the machine. Our design philosophy is rooted in the conviction that the terminal is not a legacy interface but a pristine, distraction-free environment for focused work.

We posit that true efficiency in text manipulation is achieved not through graphical pointers and cascading menus, but through a modal, keyboard-driven grammar. This approach transforms the editor from a mere passive receptacle for characters into an active, ergonomic instrument for thought. By internalizing a compositional language of motions, actions, and text objects, the user transcends the role of a typist to become a true manipulator of structured text.

## Features

- **Modal Editing:** A robust, VIM-inspired modal interface for rapid, keyboard-centric navigation and manipulation.
- **Compositional Grammar:** A logical and extensible system of actions, motions, and text objects that combine to form complex commands.
- **Terminal-Native UI:** A meticulously crafted TUI layer that renders efficiently and reliably across modern terminal emulators.
- **Extensible Architecture:** A modular design (`actions.js`, `motions.js`, `commands.js`) that facilitates straightforward extension and customization.
- **State Management:** A centralized state machine (`state.js`) with an integrated history buffer (`history.js`) for reliable undo/redo functionality.
- **Syntax Highlighting:** A dedicated engine (`highlight.js`) to provide contextual visual feedback without compromising performance.

## Architecture

The editor's architecture is decoupled into several distinct, high-cohesion modules:

- **`tui.js` / `screen.js`:** The Terminal User Interface layer, responsible for all low-level rendering and screen buffer management. It acts as the presentation view, completely unaware of editor logic.
- **`editor.js` / `state.js`:** The core controller and model, managing the file buffer, cursor position, and all other facets of the editor's state.
- **`input.js` / `keymaps.js`:** The input and keymap layer, responsible for translating raw terminal keypress events into recognized commands based on the current mode.
- **`actions.js` / `motions.js` / `commands.js`:** The command execution engine. This is where the editor's "grammar" is defined, implementing the logic for all text manipulation and navigation.

## Usage

You can also use Bun to build webs from source:

```bash
bun run build

// To make run the built unix executable from anywhere:

sudo mv ./webs /usr/local/bin/
```

## License

This project is distributed under the MIT License. See the `LICENSE` file for details.
