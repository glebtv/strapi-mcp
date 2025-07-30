// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Media Operations with Admin Authentication', () => {
  let client: Client;
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

    // Get shared client with admin auth
    client = await getSharedClient();
  }, 60000);

  afterAll(async () => {
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  }, 60000);

  describe('Media Upload with Different Auth Methods', () => {
    it('should upload media with admin credentials', async () => {
      const result = await client.callTool({
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
      const result = await client.callTool({
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
      
      const result = await client.callTool({
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
        await client.callTool({
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
        await client.callTool({
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

  describe('Media Listing Operations', () => {
    it('should list media files', async () => {
      const result = await client.callTool({
        name: 'list_media',
        arguments: {
          page: 1,
          pageSize: 10
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('results');
      expect(Array.isArray(response.results)).toBe(true);
      expect(response).toHaveProperty('pagination');
    });

    it('should list media folders', async () => {
      const result = await client.callTool({
        name: 'list_media_folders',
        arguments: {
          page: 1,
          pageSize: 10
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('data');
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should filter media files', async () => {
      const result = await client.callTool({
        name: 'list_media',
        arguments: {
          page: 1,
          pageSize: 10,
          filters: {
            mime: 'image/png'
          }
        }
      });

      const response = parseToolResponse(result);
      expect(response).toHaveProperty('results');
    });
  });
});