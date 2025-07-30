import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Admin Authentication Tests', () => {
  let clientWithAdmin: Client;
  let transportAdmin: StdioClientTransport;

  describe('Admin Credentials', () => {
    beforeAll(async () => {
      // Create client with admin credentials
      transportAdmin = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        env: {
          ...process.env,
          STRAPI_URL: process.env.STRAPI_URL,
          STRAPI_ADMIN_EMAIL: process.env.STRAPI_ADMIN_EMAIL,
          STRAPI_ADMIN_PASSWORD: process.env.STRAPI_ADMIN_PASSWORD
        }
      });

      clientWithAdmin = new Client({
        name: 'test-admin-auth',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await clientWithAdmin.connect(transportAdmin);
    });

    afterAll(async () => {
      if (transportAdmin) {
        await transportAdmin.close();
      }
    });

    it('should connect successfully with admin credentials', async () => {
      const result = await clientWithAdmin.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const contentTypes = JSON.parse(result.content[0].text);
      expect(contentTypes).toBeInstanceOf(Array);
    });

    it('should be able to perform component operations with admin credentials', async () => {
      const result = await clientWithAdmin.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = JSON.parse(result.content[0].text);
      expect(components).toBeInstanceOf(Array);
    });

    it('should get component schema with admin credentials', async () => {
      // First list components to get a valid UID
      const listResult = await clientWithAdmin.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = JSON.parse(listResult.content[0].text);
      
      if (components.length > 0) {
        const result = await clientWithAdmin.callTool({
          name: 'get_component_schema',
          arguments: {
            componentUid: components[0].uid
          }
        });

        const schema = JSON.parse(result.content[0].text);
        expect(schema).toHaveProperty('uid');
        expect(schema).toHaveProperty('schema');
        expect(schema.schema).toHaveProperty('attributes');
      }
    });

    it('should create a new component with admin credentials', async () => {
      const timestamp = Date.now();
      const result = await clientWithAdmin.callTool({
        name: 'create_component',
        arguments: {
          displayName: `TestComponent${timestamp}`,
          category: 'test',
          icon: 'star',
          attributes: {
            title: {
              type: 'string',
              required: true
            },
            description: {
              type: 'text'
            }
          }
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toBeDefined();
      // Component creation might trigger Strapi restart or return the component directly
      // The response should either have a message, data property, or uid (for created component)
      expect(response.message || response.data || response.uid || response.component).toBeTruthy();
    });

    it('should get paginated components with admin credentials', async () => {
      const result = await clientWithAdmin.callTool({
        name: 'strapi_get_components',
        arguments: {
          page: 1,
          pageSize: 10
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('meta');
      expect(response.meta).toHaveProperty('pagination');
      expect(response.meta.pagination).toHaveProperty('page', 1);
      expect(response.meta.pagination).toHaveProperty('pageSize', 10);
    });
  });


  describe('Missing Authentication (Should Fail)', () => {
    it('should fail to connect without any authentication', async () => {
      // Create client without any credentials
      const noAuthTransport = new StdioClientTransport({
        command: process.execPath,
        args: ['build/index.js'],
        env: {
          ...process.env,
          STRAPI_URL: process.env.STRAPI_URL,
          // No authentication
          STRAPI_ADMIN_EMAIL: undefined,
          STRAPI_ADMIN_PASSWORD: undefined
        }
      });

      const noAuthClient = new Client({
        name: 'test-no-auth',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      try {
        await noAuthClient.connect(noAuthTransport);
        // Should not reach here
        expect.fail('Expected connection to fail without authentication');
      } catch (error: any) {
        // Connection should fail due to missing authentication
        expect(error.message.toLowerCase()).toMatch(/connection closed|authentication/);
      } finally {
        await noAuthTransport.close();
      }
    });
  });
});