/**
 * Test Helper Utilities for Footprint Server
 */

import type { FootprintServer } from './index.js';

export interface ToolInfo {
  name: string;
  description: string;
}

export interface ResourceInfo {
  name: string;
  uriTemplate: string;
  description: string;
  mimeType: string;
}

type RegistryItem = Record<string, unknown>;

function getFromRegistry<T>(
  registry: unknown,
  finder: (key: string, value: RegistryItem) => T | null
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
  } else if (typeof registry === 'object') {
    for (const [key, value] of Object.entries(registry)) {
      const result = finder(key, value as RegistryItem);
      if (result) return result;
    }
  }

  return null;
}

function mapRegistry<T>(
  registry: unknown,
  mapper: (key: string, value: RegistryItem) => T
): T[] {
  if (!registry) return [];

  if (registry instanceof Map) {
    return Array.from(registry.entries()).map(([key, value]) =>
      mapper(key, value as RegistryItem)
    );
  }

  if (Array.isArray(registry)) {
    return registry.map((item) => mapper(item.name, item as RegistryItem));
  }

  if (typeof registry === 'object') {
    return Object.entries(registry).map(([key, value]) =>
      mapper(key, value as RegistryItem)
    );
  }

  return [];
}

export class FootprintTestHelpers {
  constructor(private server: FootprintServer) {}

  private getServerInternal(): { server: Record<string, unknown> } {
    return this.server as unknown as { server: Record<string, unknown> };
  }

  async getTools(): Promise<ToolInfo[]> {
    const tools = Reflect.get(this.getServerInternal().server, '_registeredTools');

    return mapRegistry(tools, (name, tool) => ({
      name,
      description: (tool.description || tool.title) as string
    }));
  }

  async getResources(): Promise<ResourceInfo[]> {
    const templates = Reflect.get(this.getServerInternal().server, '_registeredResourceTemplates');

    return mapRegistry(templates, (name, template) => ({
      name,
      uriTemplate: ((template.resourceTemplate as RegistryItem)?._uriTemplate as RegistryItem)?.template as string
        || template.uriTemplate as string
        || '',
      description: (template.metadata as RegistryItem)?.description as string
        || template.description as string
        || '',
      mimeType: (template.metadata as RegistryItem)?.mimeType as string
        || template.mimeType as string
        || 'text/plain'
    }));
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
    const templates = Reflect.get(this.getServerInternal().server, '_registeredResourceTemplates');
    const match = uri.match(/^(\w+):\/\/(.+)$/);

    if (!match) {
      throw new Error('Unknown resource');
    }

    const [, resourceName, id] = match;

    const handler = getFromRegistry(templates, (key, value) =>
      key === resourceName ? value : null
    );

    if (!handler) {
      throw new Error('Unknown resource');
    }

    const handlerFn = handler.readCallback || handler.handler;
    if (!handlerFn || typeof handlerFn !== 'function') {
      throw new Error('Unknown resource');
    }

    return handlerFn({ href: uri }, { id });
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tools = Reflect.get(this.getServerInternal().server, '_registeredTools');

    if (!tools) {
      throw new Error('No tools registered');
    }

    const tool = getFromRegistry(tools, (key, value) =>
      key === toolName ? value : null
    );

    if (!tool || !tool.handler || typeof tool.handler !== 'function') {
      throw new Error(`Tool ${toolName} not found`);
    }

    const result = await tool.handler(params);
    return (result.structuredContent || result) as Record<string, unknown>;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<{ structuredContent: Record<string, unknown> }> {
    const result = await this.executeTool(name, params);
    return { structuredContent: result };
  }
}
