import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FootprintServer } from "../index.js";
import { resolveDefaultUIDistDir } from "../ui/register.js";

export interface LiveDemoOptions {
  host?: string;
  port?: number;
  open?: boolean;
  dbPath?: string;
  password?: string;
  uiDistDir?: string;
}

export interface LiveDemoServerHandle {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

export interface LiveDemoBackend {
  bootstrap(): Promise<BootstrapResponse>;
  callTool(request: ToolRequestPayload): Promise<unknown>;
  readHtml(filename: string): Promise<string>;
  close(): Promise<void>;
}

interface ToolRequestPayload {
  name: string;
  arguments: Record<string, unknown>;
}

interface BootstrapResponse {
  defaultSessionId: string | null;
  totalSessions: number;
  latestSessionLabel: string | null;
}

const LIVE_DEMO_FILES = new Set([
  "session-dashboard-live.html",
  "session-detail-live.html",
]);

function resolveDbPath(options: LiveDemoOptions): string {
  if (options.dbPath) {
    return path.resolve(options.dbPath);
  }

  if (process.env.FOOTPRINT_DATA_DIR) {
    return path.resolve(process.env.FOOTPRINT_DATA_DIR, "footprint.db");
  }

  return path.resolve(process.env.FOOTPRINT_DB_PATH || "./evidence.db");
}

function resolvePassword(options: LiveDemoOptions): string {
  return (
    options.password ||
    process.env.FOOTPRINT_PASSPHRASE ||
    process.env.FOOTPRINT_PASSWORD ||
    "footprint-demo-passphrase"
  );
}

async function ensureDemoAssets(uiDistDir: string): Promise<void> {
  for (const filename of LIVE_DEMO_FILES) {
    try {
      await fs.access(path.join(uiDistDir, filename));
    } catch {
      throw new Error(
        `Missing ${filename} in ${uiDistDir}. Build the package UI first with "pnpm --dir packages/mcp-server build".`,
      );
    }
  }
}

function writeJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "darwin"
      ? [url]
      : process.platform === "win32"
        ? ["/c", "start", "", url]
        : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function resolveBootstrap(client: Client): Promise<BootstrapResponse> {
  const result = (await client.callTool({
    name: "list-sessions",
    arguments: {
      limit: 1,
      offset: 0,
    },
  })) as {
    structuredContent?: {
      total?: number;
      sessions?: Array<{ id?: string; label?: string }>;
    };
  };

  const sessions = result.structuredContent?.sessions ?? [];
  const latest = sessions[0];
  return {
    defaultSessionId: typeof latest?.id === "string" ? latest.id : null,
    totalSessions:
      typeof result.structuredContent?.total === "number"
        ? result.structuredContent.total
        : sessions.length,
    latestSessionLabel: typeof latest?.label === "string" ? latest.label : null,
  };
}

export async function createLiveDemoBackend(
  options: LiveDemoOptions = {},
): Promise<LiveDemoBackend> {
  const uiDistDir = path.resolve(
    options.uiDistDir || resolveDefaultUIDistDir(),
  );

  await ensureDemoAssets(uiDistDir);

  const footprintServer = new FootprintServer({
    dbPath: resolveDbPath(options),
    password: resolvePassword(options),
    uiDistDir,
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await footprintServer.connect(serverTransport);

  const client = new Client(
    {
      name: "footprint-live-demo-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );
  await client.connect(clientTransport);

  return {
    async bootstrap(): Promise<BootstrapResponse> {
      return resolveBootstrap(client);
    },
    async callTool(request: ToolRequestPayload): Promise<unknown> {
      return client.callTool({
        name: request.name,
        arguments: request.arguments,
      });
    },
    async readHtml(filename: string): Promise<string> {
      if (!LIVE_DEMO_FILES.has(filename)) {
        throw new Error("Not found.");
      }
      return fs.readFile(path.join(uiDistDir, filename), "utf8");
    },
    async close(): Promise<void> {
      await Promise.allSettled([client.close(), footprintServer.shutdown()]);
    },
  };
}

export async function startLiveDemoServer(
  options: LiveDemoOptions = {},
): Promise<LiveDemoServerHandle> {
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 0;
  const backend = await createLiveDemoBackend(options);
  const httpServer = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${host}`);

      if (request.method === "GET" && url.pathname === "/") {
        response.statusCode = 302;
        response.setHeader("location", "/session-dashboard-live.html");
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        writeJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.statusCode = 204;
        response.setHeader("cache-control", "no-store");
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        writeJson(response, 200, await backend.bootstrap());
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tool") {
        const bodyText = await readBody(request);
        const payload = JSON.parse(bodyText) as Partial<ToolRequestPayload>;
        if (!payload.name || typeof payload.name !== "string") {
          writeJson(response, 400, { error: "Tool name is required." });
          return;
        }

        const result = await backend.callTool({
          name: payload.name,
          arguments:
            payload.arguments && typeof payload.arguments === "object"
              ? payload.arguments
              : {},
        });
        writeJson(response, 200, result);
        return;
      }

      if (request.method === "GET") {
        const requested = url.pathname.replace(/^\/+/, "");
        if (!LIVE_DEMO_FILES.has(requested)) {
          writeJson(response, 404, { error: "Not found." });
          return;
        }

        const html = await backend.readHtml(requested);
        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(html);
        return;
      }

      writeJson(response, 405, { error: "Method not allowed." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Live demo request failed.";
      writeJson(response, 500, { error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  }).catch(async (error) => {
    await backend.close();
    throw error;
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine live demo server address.");
  }

  const resolvedPort = address.port;
  const resolvedHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const resolvedUrl = `http://${resolvedHost}:${resolvedPort}`;

  return {
    host: resolvedHost,
    port: resolvedPort,
    url: resolvedUrl,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await backend.close();
    },
  };
}

export async function runLiveDemoCli(
  options: LiveDemoOptions = {},
): Promise<void> {
  const handle = await startLiveDemoServer(options);
  const dbPath = resolveDbPath(options);
  const usingFallbackPassword =
    !options.password &&
    !process.env.FOOTPRINT_PASSPHRASE &&
    !process.env.FOOTPRINT_PASSWORD;

  console.log(`Footprint live product: ${handle.url}`);
  console.log(`Dashboard: ${handle.url}/session-dashboard-live.html`);
  console.log(`Detail: ${handle.url}/session-detail-live.html`);
  console.log(`Database: ${dbPath}`);
  if (usingFallbackPassword) {
    console.log(
      "Passphrase: using demo fallback for session surfaces because FOOTPRINT_PASSPHRASE is not set.",
    );
  }
  console.log("Press Ctrl+C to stop.");

  if (options.open) {
    openBrowser(handle.url);
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await handle.close();
  };

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  await new Promise<void>(() => {});
}
