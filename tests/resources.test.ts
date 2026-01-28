import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FootprintServer, FootprintTestHelpers } from '../src/index.js';
import type { ServerConfig } from '../src/types.js';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP Resources', () => {
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  const testDbPath = path.join(process.cwd(), 'test-resources.db');
  const testPassword = 'test-password-123';

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const config: ServerConfig = {
      dbPath: testDbPath,
      password: testPassword
    };

    server = new FootprintServer(config);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Resource Registration', () => {
    it('should register footprint resource with template', async () => {
      const resources = await helpers.getResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);

      const footprintResource = resources.find(r => r.name === 'footprint');
      expect(footprintResource).toBeDefined();
      expect(footprintResource?.uriTemplate).toBe('footprint://{id}');
      expect(footprintResource?.description).toContain('encrypted footprint record');
      expect(footprintResource?.mimeType).toBe('text/plain');
    });

    it('should read footprint resource with valid ID', async () => {
      // First create footprint using capture-footprint tool
      const result = await helpers.executeTool('capture-footprint', {
        conversationId: 'test-resource-footprint',
        llmProvider: 'Claude Sonnet 4.5',
        content: JSON.stringify({
          method: 'GET',
          url: 'https://api.example.com/data',
          headers: { 'Authorization': 'Bearer token' }
        }),
        messageCount: 1,
        tags: 'resource-test'
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Read through resource using the returned ID
      const footprintId = result.id;
      const resourceContent = await helpers.readResource(`footprint://${footprintId}`);

      expect(resourceContent).toBeDefined();
      expect(resourceContent.contents).toBeDefined();
      expect(resourceContent.contents[0].uri).toBe(`footprint://${footprintId}`);
      expect(resourceContent.contents[0].mimeType).toBe('text/plain');
      expect(resourceContent.contents[0].text).toContain('method');
      expect(resourceContent.contents[0].text).toContain('GET');
      expect(resourceContent.contents[0].text).toContain('https://api.example.com/data');
    });

    it('should return error for non-existent footprint ID', async () => {
      await expect(
        helpers.readResource('footprint://non-existent-id')
      ).rejects.toThrow('Footprint with ID non-existent-id not found');
    });

    it('should return error for invalid URI format', async () => {
      await expect(
        helpers.readResource('invalid://format')
      ).rejects.toThrow('Unknown resource');
    });
  });
});
