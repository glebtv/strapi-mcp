import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Configuration Validation', () => {
  describe('Authentication Configuration', () => {
    it('should reject connection without any authentication', async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        env: {
          STRAPI_URL: 'http://localhost:1337',
          // Explicitly set to empty to prevent loading from .env.test
          STRAPI_ADMIN_EMAIL: '',
          STRAPI_ADMIN_PASSWORD: '',
          NODE_ENV: 'test'
        }
      });

      const client = new Client({
        name: 'test-no-auth',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await expect(client.connect(transport)).rejects.toThrow();
      await transport.close();
    });


    it('should accept admin credentials only', async () => {
      if (!process.env.STRAPI_ADMIN_EMAIL || !process.env.STRAPI_ADMIN_PASSWORD) {
        console.log('Skipping admin-only test - admin credentials not available');
        return;
      }

      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        env: {
          ...process.env,
          STRAPI_URL: process.env.STRAPI_URL,
          STRAPI_ADMIN_EMAIL: process.env.STRAPI_ADMIN_EMAIL,
          STRAPI_ADMIN_PASSWORD: process.env.STRAPI_ADMIN_PASSWORD
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

  });

  describe('Invalid Credentials', () => {
    it('should reject invalid admin credentials', async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        env: {
          STRAPI_URL: 'http://localhost:1337',
          STRAPI_ADMIN_EMAIL: 'invalid@example.com',
          STRAPI_ADMIN_PASSWORD: 'wrongpassword',
          NODE_ENV: 'production' // Don't use test mode to avoid token caching
        }
      });

      const client = new Client({
        name: 'test-invalid-creds',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      
      // Try an operation that requires admin auth
      try {
        await client.callTool({
          name: 'list_components',
          arguments: {}
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Should fail with authentication error
        expect(error.message).toMatch(/authentication|401|403|credentials|invalid.*credentials/i);
      }
      
      await transport.close();
    });
  });
});