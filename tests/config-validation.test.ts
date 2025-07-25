import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Configuration Validation', () => {
  describe('Authentication Configuration', () => {
    it('should reject connection without any authentication', async () => {
      const transport = new StdioClientTransport({
        command: 'node',
        args: ['build/index.js'],
        env: {
          STRAPI_URL: 'http://localhost:1337',
          // No authentication provided
        }
      });

      const client = new Client({
        name: 'test-no-auth',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      try {
        await client.connect(transport);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('authentication');
      } finally {
        await transport.close();
      }
    });

    it('should accept API token only', async () => {
      const transport = new StdioClientTransport({
        command: 'node',
        args: ['build/index.js'],
        env: {
          STRAPI_URL: process.env.STRAPI_URL,
          STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN,
          // No admin credentials
        }
      });

      const client = new Client({
        name: 'test-token-only',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      
      // Should be able to perform basic operations
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });
      
      expect(result).toBeDefined();
      await transport.close();
    });

    it('should accept admin credentials only', async () => {
      if (!process.env.STRAPI_ADMIN_EMAIL || !process.env.STRAPI_ADMIN_PASSWORD) {
        console.log('Skipping admin-only test - admin credentials not available');
        return;
      }

      const transport = new StdioClientTransport({
        command: 'node',
        args: ['build/index.js'],
        env: {
          STRAPI_URL: process.env.STRAPI_URL,
          STRAPI_ADMIN_EMAIL: process.env.STRAPI_ADMIN_EMAIL,
          STRAPI_ADMIN_PASSWORD: process.env.STRAPI_ADMIN_PASSWORD,
          // No API token
        }
      });

      const client = new Client({
        name: 'test-admin-only',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      
      // Should be able to perform component operations
      const result = await client.callTool({
        name: 'list_components',
        arguments: {}
      });
      
      expect(result).toBeDefined();
      await transport.close();
    });

    it('should prioritize admin credentials when both are provided', async () => {
      if (!process.env.STRAPI_ADMIN_EMAIL || !process.env.STRAPI_ADMIN_PASSWORD) {
        console.log('Skipping priority test - admin credentials not available');
        return;
      }

      const transport = new StdioClientTransport({
        command: 'node',
        args: ['build/index.js'],
        env: {
          STRAPI_URL: process.env.STRAPI_URL,
          STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN,
          STRAPI_ADMIN_EMAIL: process.env.STRAPI_ADMIN_EMAIL,
          STRAPI_ADMIN_PASSWORD: process.env.STRAPI_ADMIN_PASSWORD,
        }
      });

      const client = new Client({
        name: 'test-both-auth',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      
      // Should be able to perform component operations (admin-only)
      const result = await client.callTool({
        name: 'list_components',
        arguments: {}
      });
      
      expect(result).toBeDefined();
      await transport.close();
    });
  });

  describe('Placeholder Token Rejection', () => {
    it('should reject placeholder API tokens', async () => {
      const placeholderTokens = [
        'strapi_token',
        'your-api-token-here',
        'placeholder-token'
      ];

      for (const token of placeholderTokens) {
        const transport = new StdioClientTransport({
          command: 'node',
          args: ['build/index.js'],
          env: {
            STRAPI_URL: 'http://localhost:1337',
            STRAPI_API_TOKEN: token
          }
        });

        const client = new Client({
          name: 'test-placeholder',
          version: '1.0.0'
        }, {
          capabilities: {}
        });

        try {
          await client.connect(transport);
          expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
          expect(error.message).toContain('placeholder');
        } finally {
          await transport.close();
        }
      }
    });
  });
});