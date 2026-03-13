/**
 * Test Helper Utilities for Footprint Server
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { FootprintServer } from "../src/index.js";

export interface ToolInfo {
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface ResourceInfo {
  name: string;
  uriTemplate: string;
  description: string;
  mimeType: string;
}

export interface AppResourceInfo {
  name: string;
  mimeType: string;
  enabled: boolean;
}

export class FootprintMcpTestClient {
  constructor(
    private client: Client,
    private server: FootprintServer,
  ) {}

  async listTools(): Promise<{
    tools: Array<Record<string, unknown>>;
  }> {
    return (await this.client.listTools()) as {
      tools: Array<Record<string, unknown>>;
    };
  }

  async listResources(): Promise<{
    resources: Array<Record<string, unknown>>;
  }> {
    return (await this.client.listResources()) as {
      resources: Array<Record<string, unknown>>;
    };
  }

  async listResourceTemplates(): Promise<{
    resourceTemplates: Array<Record<string, unknown>>;
  }> {
    return (await this.client.listResourceTemplates()) as {
      resourceTemplates: Array<Record<string, unknown>>;
    };
  }

  async readResource(uri: string): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string }>;
  }> {
    return (await this.client.readResource({ uri })) as {
      contents: Array<{ uri: string; mimeType?: string; text?: string }>;
    };
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    structuredContent?: Record<string, unknown>;
    content?: Array<Record<string, unknown>>;
  }> {
    return (await this.client.callTool({ name, arguments: args })) as {
      structuredContent?: Record<string, unknown>;
      content?: Array<Record<string, unknown>>;
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.client.close(), this.server.shutdown()]);
  }
}

type RegistryItem = Record<string, unknown>;

function getFromRegistry<T>(
  registry: unknown,
  finder: (key: string, value: RegistryItem) => T | null,
): T | null {
  if (!registry) return null;

  if (registry instanceof Map) {
    for (const [key, value] of registry.entries()) {
      const result = finder(key, value as RegistryItem);
      if (result) return result;
    }
  } else if (Array.isArray(registry)) {
    for (const item of registry) {
      const result = finder(item.name, item as RegistryItem);
      if (result) return result;
    }
  } else if (typeof registry === "object") {
    for (const [key, value] of Object.entries(registry)) {
      const result = finder(key, value as RegistryItem);
      if (result) return result;
    }
  }

  return null;
}

function mapRegistry<T>(
  registry: unknown,
  mapper: (key: string, value: RegistryItem) => T,
): T[] {
  if (!registry) return [];

  if (registry instanceof Map) {
    return Array.from(registry.entries()).map(([key, value]) =>
      mapper(key, value as RegistryItem),
    );
  }

  if (Array.isArray(registry)) {
    return registry.map((item) => mapper(item.name, item as RegistryItem));
  }

  if (typeof registry === "object") {
    return Object.entries(registry).map(([key, value]) =>
      mapper(key, value as RegistryItem),
    );
  }

  return [];
}

export class FootprintTestHelpers {
  constructor(private server: FootprintServer) {}

  private getServerInternal(): { server: Record<string, unknown> } {
    return this.server as unknown as { server: Record<string, unknown> };
  }

  async connectMcpClient(): Promise<FootprintMcpTestClient> {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await this.server.connect(serverTransport);

    const client = new Client(
      {
        name: "footprint-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );
    await client.connect(clientTransport);

    return new FootprintMcpTestClient(client, this.server);
  }

  async getTools(): Promise<ToolInfo[]> {
    const tools = Reflect.get(
      this.getServerInternal().server,
      "_registeredTools",
    );

    return mapRegistry(tools, (name, tool) => ({
      name,
      description: (tool.description || tool.title) as string,
      metadata:
        tool && typeof tool === "object"
          ? (tool as Record<string, unknown>)
          : undefined,
    }));
  }

  async getToolDefinition(name: string): Promise<Record<string, unknown>> {
    const tools = Reflect.get(
      this.getServerInternal().server,
      "_registeredTools",
    );

    const tool = getFromRegistry(tools, (key, value) =>
      key === name ? value : null,
    );

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return tool;
  }

  async getResources(): Promise<ResourceInfo[]> {
    const templates = Reflect.get(
      this.getServerInternal().server,
      "_registeredResourceTemplates",
    );

    return mapRegistry(templates, (name, template) => ({
      name,
      uriTemplate:
        ((
          (template.resourceTemplate as RegistryItem)
            ?._uriTemplate as RegistryItem
        )?.template as string) ||
        (template.uriTemplate as string) ||
        "",
      description:
        ((template.metadata as RegistryItem)?.description as string) ||
        (template.description as string) ||
        "",
      mimeType:
        ((template.metadata as RegistryItem)?.mimeType as string) ||
        (template.mimeType as string) ||
        "text/plain",
    }));
  }

  async getAppResources(): Promise<AppResourceInfo[]> {
    const resources = Reflect.get(
      this.getServerInternal().server,
      "_registeredResources",
    );

    return mapRegistry(resources, (name, resource) => ({
      name,
      mimeType:
        ((resource.metadata as RegistryItem)?.mimeType as string) ||
        "text/plain",
      enabled: Boolean(resource.enabled),
    }));
  }

  async readResource(uri: string): Promise<{
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  }> {
    const resources = Reflect.get(
      this.getServerInternal().server,
      "_registeredResources",
    );
    const directResource = getFromRegistry(resources, (key, value) =>
      key === uri ? value : null,
    );

    if (directResource) {
      const handlerFn = directResource.readCallback || directResource.handler;
      if (!handlerFn || typeof handlerFn !== "function") {
        throw new Error("Unknown resource");
      }

      return handlerFn();
    }

    const templates = Reflect.get(
      this.getServerInternal().server,
      "_registeredResourceTemplates",
    );
    const match = uri.match(/^(\w+):\/\/(.+)$/);

    if (!match) {
      throw new Error("Unknown resource");
    }

    const [, resourceName, id] = match;

    const handler = getFromRegistry(templates, (key, value) =>
      key === resourceName ? value : null,
    );

    if (!handler) {
      throw new Error("Unknown resource");
    }

    const handlerFn = handler.readCallback || handler.handler;
    if (!handlerFn || typeof handlerFn !== "function") {
      throw new Error("Unknown resource");
    }

    return handlerFn({ href: uri }, { id });
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const tools = Reflect.get(
      this.getServerInternal().server,
      "_registeredTools",
    );

    if (!tools) {
      throw new Error("No tools registered");
    }

    const tool = getFromRegistry(tools, (key, value) =>
      key === toolName ? value : null,
    );

    if (!tool || !tool.handler || typeof tool.handler !== "function") {
      throw new Error(`Tool ${toolName} not found`);
    }

    const result = await tool.handler(params);
    return (result.structuredContent || result) as Record<string, unknown>;
  }

  async callTool(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{
    structuredContent: Record<string, unknown>;
    textContent?: string;
  }> {
    const tools = Reflect.get(
      this.getServerInternal().server,
      "_registeredTools",
    );

    if (!tools) {
      throw new Error("No tools registered");
    }

    const tool = getFromRegistry(tools, (key, value) =>
      key === name ? value : null,
    );

    if (!tool || !tool.handler || typeof tool.handler !== "function") {
      throw new Error(`Tool ${name} not found`);
    }

    const result = await tool.handler(params);
    const structuredContent = (result.structuredContent || result) as Record<
      string,
      unknown
    >;
    const textContent = Array.isArray(result.content)
      ? (result.content as Array<{ type: string; text: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n")
      : undefined;

    return { structuredContent, textContent };
  }
}
