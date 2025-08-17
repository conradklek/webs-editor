# **webs-editor**

A text editor.

## **Philosophy**

The webs-editor is predicated on a rejection of the modern GUI-centric paradigm, which we contend introduces an unnecessary layer of cognitive overhead and a fundamental haptic dissonance between the user and the machine. Our design philosophy is rooted in the conviction that the terminal is not a legacy interface but a pristine, distraction-free environment for focused work.

We posit that true efficiency in text manipulation is achieved not through graphical pointers and cascading menus, but through a modal, keyboard-driven grammar. This approach transforms the editor from a mere passive receptacle for characters into an active, ergonomic instrument for thought. By internalizing a compositional language of motions, actions, and text objects, the user transcends the role of a typist to become a true manipulator of structured text.

## **Features**

- **Modal Editing:** A robust, VIM-inspired modal interface for rapid, keyboard-centric navigation and manipulation.
- **File & Project Navigation:** Fuzzy file finding and a project tree for quick navigation.
- **Tabbed Interface:** Manage multiple files in tabs.
- **Compositional Grammar:** A logical and extensible system of actions, motions, and text objects that combine to form complex commands.
- **Terminal-Native UI:** A meticulously crafted TUI layer that renders efficiently and reliably across modern terminal emulators.
- **Extensible Architecture:** A modular design that facilitates straightforward extension and customization.

## **Keymaps & Commands**

### **Global**

| Keybinding     | Action                           |
| :------------- | :------------------------------- |
| Ctrl+p         | Open File Palette (fuzzy finder) |
| Ctrl+e         | Toggle Project File Tree         |
| Ctrl+Tab       | Switch to the next tab           |
| Ctrl+Shift+Tab | Switch to the previous tab       |
| Ctrl+c         | Quit the editor                  |

### **Editor Modes**

The editor operates in several modes, each with its own set of keybindings.

#### **Normal Mode**

This is the default mode for navigation and manipulation.

| Keybinding | Action                                  |
| :--------- | :-------------------------------------- |
| h, j, k, l | Move cursor left, down, up, right       |
| w, b, e    | Word-wise motions                       |
| 0, $       | Move to start/end of line               |
| gg, G      | Go to start/end of file                 |
| i, a       | Enter Insert Mode (before/after cursor) |
| I, A       | Enter Insert Mode (start/end of line)   |
| o, O       | Open new line below/above               |
| v, V       | Enter Visual / Visual Line Mode         |
| d, c, y    | Delete, change, yank (copy) operators   |
| dd, cc, yy | Delete, change, yank current line       |
| p, P       | Paste after/before cursor               |
| u          | Undo                                    |
| Ctrl+r     | Redo                                    |
| /          | Start search                            |
| n, N       | Next/previous search result             |
| :          | Enter Command Line Mode                 |

#### **Insert Mode**

For inserting and editing text.

| Keybinding     | Action                |
| :------------- | :-------------------- |
| Escape, Ctrl+c | Return to Normal Mode |

#### **Visual Mode**

For selecting text to operate on.

| Keybinding     | Action                                |
| :------------- | :------------------------------------ |
| Escape, Ctrl+c | Return to Normal Mode                 |
| d, c, y        | Delete, change, or yank selection     |
| :              | Enter Command Line Mode for selection |

### **Command Line Mode (:)**

Execute commands on files and the editor itself.

| Command              | Description                    |
| :------------------- | :----------------------------- |
| :w \[filename\]      | Write (save) the current file. |
| :q                   | Quit the current tab/file.     |
| :wq                  | Write and quit.                |
| :e \<filename\>      | Edit a file.                   |
| :tabnew \[filename\] | Open a new tab.                |
| :tabnext / :tn       | Go to the next tab.            |
| :tabprev / :tp       | Go to the previous tab.        |
| :tabclose            | Close the current tab.         |
| :tab \<number\>      | Go to a specific tab number.   |

## **Architecture**

The editor's architecture is decoupled into several distinct, high-cohesion modules:

- **cli.js / screen.js / terminal.js:** The Terminal User Interface layer, responsible for all low-level rendering, input, and screen buffer management.
- **editor.js:** The core controller, managing the file buffer, cursor position, and all other facets of the editor's state.
- **input.js:** The input and keymap layer, responsible for translating raw terminal keypress events into recognized commands based on the current mode.
- **commands.js:** The command execution engine. This is where the editor's "grammar" is defined, implementing the logic for all text manipulation and navigation.

## **Usage**

You can also use Bun to build webs from source:

bun run build

\# Launch the editor from anywhere by typing "webs" in your terminal  
sudo mv ./webs /usr/local/bin/

## **License**

This project is distributed under the MIT License. See the LICENSE file for details.
