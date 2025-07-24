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
        // Use strapi_rest to ensure we hit the REST API which has stricter validation
        await client.callTool({
          name: 'strapi_rest',
          arguments: {
            endpoint: 'api/projects',
            method: 'POST',
            body: {
              data: {
                description: 'Missing required name field'
              }
            }
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('400');
        expect(error.message).toContain('ValidationError');
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
      try {
        await client.callTool({
          name: 'delete_entry',
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
        expect(error.message).toMatch(/400|404/);
      }
    });
  });

  describe('Permission Errors', () => {
    it('should handle permission errors gracefully', async () => {
      // This test assumes certain permissions are not granted
      // Adjust based on your Strapi setup
      try {
        await client.callTool({
          name: 'create_content_type',
          arguments: {
            displayName: 'Test Type',
            singularName: 'test-type',
            pluralName: 'test-types',
            attributes: {
              name: { type: 'string' }
            }
          }
        });
        // If this succeeds, it means admin has full permissions
        // Delete the created content type
        await client.callTool({
          name: 'delete_content_type',
          arguments: {
            contentType: 'api::test-type.test-type'
          }
        });
      } catch (error: any) {
        // If it fails, check that the error is properly formatted
        expect(error.message).toMatch(/403|401/);
      }
    });
  });
});