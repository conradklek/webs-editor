import { TerminalApp } from "./app.js";
import { Terminal } from "./terminal.js";

const terminal = new Terminal(
  new TerminalApp({
    props: {
      screen: {
        cols: process.stdout.columns,
        rows: process.stdout.rows,
      },
    },
  }),
);

terminal.run();
