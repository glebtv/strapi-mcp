import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Operations with Admin Authentication', () => {
  let clientWithAdmin: Client;
  let clientWithToken: Client;
  let transportAdmin: StdioClientTransport;
  let transportToken: StdioClientTransport;
  let testImagePath: string;

  beforeAll(async () => {
    // Create test image file
    testImagePath = path.join(process.cwd(), 'test-image.png');
    // Create a simple 1x1 PNG
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
      0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
      0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngBuffer);

    // Create clients
    const adminResult = await createTestClient({ useAdminAuth: true, useApiToken: true });
    clientWithAdmin = adminResult.client;
    transportAdmin = adminResult.transport;

    const tokenResult = await createTestClient({ useAdminAuth: false, useApiToken: true });
    clientWithToken = tokenResult.client;
    transportToken = tokenResult.transport;
  });

  afterAll(async () => {
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    
    await closeTestClient(transportAdmin);
    await closeTestClient(transportToken);
  });

  describe('Media Upload with Different Auth Methods', () => {
    it('should upload media with admin credentials', async () => {
      const result = await clientWithAdmin.callTool({
        name: 'upload_media_from_path',
        arguments: {
          filePath: testImagePath,
          fileName: 'test-admin-upload.png',
          fileType: 'image/png'
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('url');
      expect(response.name).toBe('test-admin-upload.png');
    });

    it('should upload media with API token', async () => {
      const result = await clientWithToken.callTool({
        name: 'upload_media_from_path',
        arguments: {
          filePath: testImagePath,
          fileName: 'test-token-upload.png',
          fileType: 'image/png'
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('url');
      expect(response.name).toBe('test-token-upload.png');
    });

    it('should handle base64 upload with admin credentials', async () => {
      // Create a small base64 image
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const result = await clientWithAdmin.callTool({
        name: 'upload_media',
        arguments: {
          fileData: base64Data,
          fileName: 'test-base64-admin.png',
          fileType: 'image/png'
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('url');
    });
  });

  describe('Media Error Handling', () => {
    it('should handle non-existent file path', async () => {
      try {
        await clientWithAdmin.callTool({
          name: 'upload_media_from_path',
          arguments: {
            filePath: '/non/existent/file.png'
          }
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should handle invalid base64 data', async () => {
      try {
        await clientWithAdmin.callTool({
          name: 'upload_media',
          arguments: {
            fileData: 'invalid-base64-data!!!',
            fileName: 'test.png',
            fileType: 'image/png'
          }
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Invalid base64');
      }
    });
  });
});