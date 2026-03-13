import type { SessionDashboardApp } from "./session-dashboard-view";
import type { SessionDetailApp } from "./session-detail-view";
import { t } from "./i18n";

interface ToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  structuredContent?: unknown;
}

interface BootstrapResponse {
  defaultSessionId: string | null;
  totalSessions: number;
  latestSessionLabel: string | null;
}

function buildDetailHref(
  sessionId: string,
  rootWindow: Window & typeof globalThis,
): string {
  const url = new URL("./session-detail-live.html", rootWindow.location.href);
  url.searchParams.set("id", sessionId);
  return url.toString();
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType.includes("text/html") ||
        text.trimStart().startsWith("<!DOCTYPE")
      ) {
        throw new Error(t("liveDemo.error.hostRequired"));
      }
      throw new Error(
        error instanceof Error
          ? t("liveDemo.error.invalidJson", { message: error.message })
          : t("liveDemo.error.invalidJson", {
              message: t("common.unknownError"),
            }),
      );
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : response.status === 404 || response.status === 405
          ? t("liveDemo.error.hostRequired")
          : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload as T;
}

async function callLiveTool(request: ToolRequest): Promise<ToolResult> {
  const response = await fetch("/api/tool", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return readJsonResponse<ToolResult>(response);
}

async function fetchLiveBootstrap(): Promise<BootstrapResponse> {
  const response = await fetch("/api/bootstrap");
  return readJsonResponse<BootstrapResponse>(response);
}

function extractSessionId(result: ToolResult): string | null {
  const structured = result.structuredContent;
  if (
    structured &&
    typeof structured === "object" &&
    typeof (structured as { session?: { id?: unknown } }).session?.id ===
      "string"
  ) {
    return (structured as { session: { id: string } }).session.id;
  }

  return null;
}

function renderNoSessionState(rootDocument: Document): void {
  const subtitle = rootDocument.getElementById("subtitle");
  if (subtitle) {
    subtitle.textContent = t("liveDemo.empty.subtitle");
  }

  const error = rootDocument.getElementById("error");
  if (error) {
    error.innerHTML = `<div class="error">${t("liveDemo.empty.body")}</div>`;
  }
}

export function createDashboardLiveDemoApp(
  rootWindow: Window & typeof globalThis = window,
): SessionDashboardApp {
  const app: SessionDashboardApp = {
    ontoolresult: null,
    async connect(): Promise<void> {
      return;
    },
    async callServerTool(request: ToolRequest): Promise<ToolResult> {
      if (
        request.name === "get-session" &&
        typeof request.arguments.id === "string"
      ) {
        rootWindow.location.assign(
          buildDetailHref(request.arguments.id, rootWindow),
        );
        return { structuredContent: {} };
      }

      const result = await callLiveTool(request);
      app.ontoolresult?.(result);
      return result;
    },
  };

  return app;
}

export function createDetailLiveDemoApp(
  rootDocument: Document = document,
  rootWindow: Window & typeof globalThis = window,
): SessionDetailApp {
  const app: SessionDetailApp = {
    ontoolresult: null,
    async connect(): Promise<void> {
      let sessionId = new URL(rootWindow.location.href).searchParams.get("id");

      if (!sessionId) {
        const bootstrap = await fetchLiveBootstrap();
        sessionId = bootstrap.defaultSessionId;
      }

      if (!sessionId) {
        renderNoSessionState(rootDocument);
        return;
      }

      const result = await callLiveTool({
        name: "get-session",
        arguments: { id: sessionId },
      });
      const resolvedSessionId = extractSessionId(result) ?? sessionId;
      rootWindow.history.replaceState(
        null,
        "",
        buildDetailHref(resolvedSessionId, rootWindow),
      );
      app.ontoolresult?.(result);
    },
    async callServerTool(request: ToolRequest): Promise<ToolResult> {
      const result = await callLiveTool(request);
      if (
        request.name === "get-session" &&
        typeof request.arguments.id === "string"
      ) {
        const resolvedSessionId =
          extractSessionId(result) ?? request.arguments.id;
        rootWindow.history.replaceState(
          null,
          "",
          buildDetailHref(resolvedSessionId, rootWindow),
        );
      }
      app.ontoolresult?.(result);
      return result;
    },
  };

  return app;
}
