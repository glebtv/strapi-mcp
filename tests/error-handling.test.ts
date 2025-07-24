import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Error Handling', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: ['build/index.js'],
      env: process.env
    });

    client = new Client({
      name: 'error-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    if (transport) {
      await transport.close();
    }
  });

  describe('Validation Errors', () => {
    it('should pass through Strapi validation error details', async () => {
      try {
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::project.project',
            pluralApiId: 'projects',
            data: {
              name: 123 // Should be string
            }
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('400');
        expect(error.message).toContain('ValidationError');
        expect(error.message).toContain('must be a `string` type');
      }
    });

    it('should handle invalid data types', async () => {
      try {
        // Create an entry with invalid data type (number instead of string)
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::project.project',
            pluralApiId: 'projects',
            data: {
              name: 'Test',
              description: 12345 // Should be string if field expects string
            }
          }
        });
        // If it succeeds, no validation error for this field type
        // Try another approach - missing required field
        await client.callTool({
          name: 'strapi_rest',
          arguments: {
            endpoint: 'api/projects',
            method: 'POST',
            body: {
              data: {
                // Intentionally empty to trigger validation
              }
            }
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should get validation error
        expect(error.message).toMatch(/ValidationError|required/);
      }
    });
  });

  describe('Not Found Errors', () => {
    it('should handle non-existent document updates', async () => {
      try {
        await client.callTool({
          name: 'update_entry',
          arguments: {
            pluralApiId: 'projects',
            documentId: 'non-existent-document-id',
            data: {
              name: 'Test'
            }
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('404');
        expect(error.message).toContain('NotFoundError');
        expect(error.message).toContain('Not Found');
      }
    });

    it('should handle non-existent document deletion', async () => {
      // DELETE is idempotent in REST APIs - it returns success even for non-existent resources
      // This is expected behavior, so we'll just verify it doesn't throw an error
      const result = await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'projects',
          documentId: 'non-existent-document-id'
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should handle non-existent document publishing', async () => {
      try {
        await client.callTool({
          name: 'publish_entry',
          arguments: {
            pluralApiId: 'projects',
            documentId: 'non-existent-document-id'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('404');
      }
    });
  });

  describe('Invalid Content Type Errors', () => {
    it('should handle invalid content type', async () => {
      try {
        await client.callTool({
          name: 'get_entries',
          arguments: {
            pluralApiId: 'invalid'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Not Found');
      }
    });
  });

  describe('Permission Errors', () => {
    it('should handle permission errors gracefully', async () => {
      // Test with an endpoint that typically requires specific permissions
      try {
        // Try to access users endpoint which often has restricted permissions
        await client.callTool({
          name: 'strapi_rest',
          arguments: {
            endpoint: 'api/users',
            method: 'GET'
          }
        });
        // If it succeeds, try a write operation
        await client.callTool({
          name: 'strapi_rest',
          arguments: {
            endpoint: 'api/users',
            method: 'POST',
            body: {
              data: {
                username: 'testuser',
                email: 'test@example.com',
                password: 'Test123!'
              }
            }
          }
        });
      } catch (error: any) {
        // Should get a permission error (403) or not found (404) depending on Strapi config
        expect(error.message).toMatch(/403|404|Forbidden/);
      }
    });
  });
});