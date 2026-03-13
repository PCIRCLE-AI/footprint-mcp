import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function run(command, args, options = {}) {
  const result = runResult(command, args, options);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  return result.stdout;
}

function installTarball(tarballPath, installDir) {
  const installArgs = ["install", tarballPath];
  const installResult = runResult(npmCommand, installArgs, {
    cwd: installDir,
    env: {
      npm_config_fetch_retries: "0",
      npm_config_fetch_retry_mintimeout: "1000",
      npm_config_fetch_retry_maxtimeout: "2000",
    },
  });

  if (!installResult.error && installResult.status === 0) {
    return;
  }

  if (installResult.error) {
    throw installResult.error;
  }

  throw new Error(
    `${npmCommand} ${installArgs.join(" ")} failed with exit code ${installResult.status}\nSTDOUT:\n${installResult.stdout}\nSTDERR:\n${installResult.stderr}`,
  );
}

function assertTarballContents(entries) {
  const entrySet = new Set(entries);
  const requiredEntries = [
    "package/bin/footprint.js",
    "package/dist/src/index.js",
    "package/dist/src/cli/index.js",
    "package/dist/src/cli/live-demo.js",
    "package/dist/ui/dashboard.html",
    "package/dist/ui/session-dashboard.html",
    "package/dist/ui/session-detail.html",
    "package/dist/ui/session-dashboard-live.html",
    "package/dist/ui/session-detail-live.html",
    "package/README.md",
    "package/SKILL.md",
  ];

  for (const entry of requiredEntries) {
    assert.ok(entrySet.has(entry), `Expected ${entry} in published tarball`);
  }

  for (const entry of entries) {
    assert.ok(
      !entry.startsWith("package/dist/src/test-helpers"),
      `Did not expect test helper artifact in tarball: ${entry}`,
    );
  }
}

function writeInstallProject(dir) {
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "footprint-pack-smoke",
        private: true,
        type: "module",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function getInstalledCliPath(installDir) {
  return path.join(
    installDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "footprint.cmd" : "footprint",
  );
}

function writeImportSmokeScript(dir) {
  writeFileSync(
    path.join(dir, "verify-installed-package.mjs"),
    `import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FootprintServer } from "@pcircle/footprint";

const server = new FootprintServer({
  dbPath: process.env.FOOTPRINT_DB_PATH,
  password: process.env.FOOTPRINT_PASSWORD,
});

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client(
  { name: "footprint-pack-smoke-client", version: "1.0.0" },
  { capabilities: {} },
);

try {
  await client.connect(clientTransport);

  const toolsResponse = await client.listTools();
  assert.ok(
    (toolsResponse.tools ?? []).some((tool) => tool.name === "list-sessions"),
    "Expected list-sessions tool from installed package",
  );

  const dashboardResponse = await client.readResource({
    uri: "ui://footprint/session-dashboard.html",
  });
  const detailResponse = await client.readResource({
    uri: "ui://footprint/session-detail.html",
  });

  const dashboardHtml = dashboardResponse.contents?.[0]?.text ?? "";
  const detailHtml = detailResponse.contents?.[0]?.text ?? "";

  assert.ok(
    dashboardHtml.includes("Session Dashboard"),
    "Expected built session dashboard HTML from installed package",
  );
  assert.ok(
    detailHtml.includes("Session Detail"),
    "Expected built session detail HTML from installed package",
  );
  assert.ok(
    !dashboardHtml.includes("Please build the UI first"),
    "Installed package served fallback dashboard HTML instead of built UI",
  );
  assert.ok(
    !detailHtml.includes("Please build the UI first"),
    "Installed package served fallback detail HTML instead of built UI",
  );
} finally {
  await Promise.allSettled([client.close(), server.shutdown()]);
}
`,
    "utf8",
  );
}

function main() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "footprint-pack-smoke-"));
  const packDir = path.join(tempRoot, "pack");
  const installDir = path.join(tempRoot, "install");
  mkdirSync(packDir);
  mkdirSync(installDir);

  try {
    run(pnpmCommand, ["pack", "--pack-destination", packDir], {
      cwd: packageRoot,
    });

    const tarballs = readdirSync(packDir).filter((entry) => entry.endsWith(".tgz"));
    assert.equal(tarballs.length, 1, "Expected exactly one packed tarball");

    const tarballPath = path.join(packDir, tarballs[0]);
    assert.ok(existsSync(tarballPath), `Missing tarball at ${tarballPath}`);

    const tarEntries = run("tar", ["-tzf", tarballPath], {
      cwd: packDir,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    assertTarballContents(tarEntries);

    writeInstallProject(installDir);
    installTarball(tarballPath, installDir);

    const installedCli = getInstalledCliPath(installDir);
    assert.ok(existsSync(installedCli), `Missing installed CLI at ${installedCli}`);

    const listOutput = run(installedCli, ["sessions", "list", "--json"], {
      cwd: installDir,
      env: {
        FOOTPRINT_DB_PATH: path.join(installDir, "pack-smoke.db"),
      },
    });
    const parsedList = JSON.parse(listOutput);
    assert.equal(parsedList.total, 0);
    assert.deepEqual(parsedList.sessions, []);

    writeImportSmokeScript(installDir);
    run(process.execPath, [path.join(installDir, "verify-installed-package.mjs")], {
      cwd: installDir,
      env: {
        FOOTPRINT_DB_PATH: path.join(installDir, "pack-smoke-import.db"),
        FOOTPRINT_PASSWORD: "pack-smoke-passphrase",
      },
    });

    console.log("Package install smoke passed");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
