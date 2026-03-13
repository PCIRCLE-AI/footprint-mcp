#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.resolve(currentDir, "../dist/src/cli/index.js");

if (!existsSync(distEntry)) {
  process.stderr.write(
    'Footprint CLI is not built yet. Run "pnpm --dir packages/mcp-server build" first.\n',
  );
  process.exit(1);
}

await import(pathToFileURL(distEntry).href);
