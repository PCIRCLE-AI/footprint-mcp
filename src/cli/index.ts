#!/usr/bin/env node
/* global console, process */

import { runSetup } from "./setup.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "setup": {
      await runSetup();
      break;
    }

    default: {
      // No command or unknown command - start MCP server
      // Import and run server
      const { main: startServer } = await import("../index.js");
      await startServer();
      break;
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
