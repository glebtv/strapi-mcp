// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Dynamic Zone Component Validation', () => {
  let client: Client;
  let transport: StdioClientTransport;
  
  // Use the test Strapi instance credentials
  const STRAPI_URL = 'http://localhost:1337';
  const STRAPI_ADMIN_EMAIL = 'admin@test.com';
  const STRAPI_ADMIN_PASSWORD = 'Admin123!';

  beforeAll(async () => {
    // Create a new transport and client for this test suite
    transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      env: {
        ...process.env,
        STRAPI_URL,
        STRAPI_ADMIN_EMAIL,
        STRAPI_ADMIN_PASSWORD
      }
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
  }, 60000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('create_entry with dynamic zone validation', () => {
    it('should prevent creation with unregistered dynamic zone components', async () => {
      // Data with invalid components that would be silently dropped
      const dataWithInvalidComponents = {
        title: "Test Validation Page",
        slug: "test-validation-" + Date.now(),
        sections: [
          {
            __component: "sections.hero", // Valid ✓
            title: "Valid Hero Section",
            subtitle: "Test subtitle"
          },
          {
            __component: "sections.stats", // Invalid ✗
            title: "Invalid Stats Section",
            stats: []
          },
          {
            __component: "sections.features", // Invalid ✗
            title: "Invalid Features Section",
            features: []
          }
        ]
      };

      try {
        await client.callTool({
          name: 'create_draft_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
            data: dataWithInvalidComponents,
            locale: 'en',
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('Validation error:', error.message);
        
        // Verify we get a validation error from Strapi
        expect(error.message).toContain('Validation errors:');
        expect(error.message).toContain('sections[1].__component must be one of the following values');
        expect(error.message).toContain('sections[2].__component must be one of the following values');
        expect(error.message).toContain('sections.hero');
        expect(error.message).toContain('sections.columns');
        expect(error.message).toContain('sections.prices');
        
        // The error should contain the MCP error code
        expect(error.message).toContain('MCP error -32603');
      }
    });

    it('should succeed with only valid dynamic zone components', async () => {
      const validData = {
        title: "Test Valid Components Page",
        slug: "test-valid-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Hero Section",
            subtitle: "Valid component"
          }
        ]
      };

      const result = await client.callTool({
        name: 'create_draft_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          data: validData,
          locale: 'en',
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.documentId).toBeDefined();
      expect(response.sections).toHaveLength(1);
      expect(response.sections[0].__component).toBe('sections.hero');

      // Clean up
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: response.documentId,
          locale: 'en'
        }
      });
    });

    it('should catch missing __component field in dynamic zone', async () => {
      const dataWithMissingComponent = {
        title: "Test Missing Component Page",
        slug: "test-missing-component-" + Date.now(),
        sections: [
          {
            // Missing __component field!
            title: "Section without component",
            subtitle: "This should fail"
          }
        ]
      };

      try {
        await client.callTool({
          name: 'create_draft_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
            data: dataWithMissingComponent,
            locale: 'en',
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Validation errors:');
        expect(error.message).toContain('sections[0].__component is a required field');
        expect(error.message).toContain('MCP error -32603');
      }
    });
  });

  describe('update_entry with dynamic zone validation', () => {
    let testEntryId: string;

    beforeAll(async () => {
      // Create a valid entry to update
      const validData = {
        title: "Test Update Entry Page",
        slug: "test-update-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Initial Hero",
            subtitle: "Initial subtitle"
          }
        ]
      };

      const result = await client.callTool({
        name: 'create_draft_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          data: validData,
          locale: 'en',
        }
      });

      const response = JSON.parse(result.content[0].text);
      testEntryId = response.documentId;
    });

    afterAll(async () => {
      // Clean up
      if (testEntryId) {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testEntryId,
            locale: 'en'
          }
        });
      }
    });

    it('should prevent update with invalid dynamic zone components', async () => {
      const updateWithInvalid = {
        sections: [
          {
            __component: "sections.hero", // Valid
            title: "Updated Hero",
            subtitle: "Updated subtitle"
          },
          {
            __component: "sections.cta", // Invalid!
            title: "Invalid CTA",
            buttons: []
          }
        ]
      };

      try {
        await client.callTool({
          name: 'update_entry_draft',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testEntryId,
            data: updateWithInvalid,
            locale: 'en'
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Validation errors:');
        expect(error.message).toContain('sections[1].__component must be one of the following values');
        expect(error.message).toContain('sections.hero');
        expect(error.message).toContain('sections.columns');
        expect(error.message).toContain('sections.prices');
        expect(error.message).toContain('MCP error -32603');
      }
    });

    it('should succeed with valid dynamic zone components', async () => {
      const validUpdate = {
        title: "Updated Title",
        sections: [
          {
            __component: "sections.hero",
            title: "Successfully Updated Hero",
            subtitle: "This update should work"
          }
        ]
      };

      const result = await client.callTool({
        name: 'update_entry_draft',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testEntryId,
          data: validUpdate,
          locale: 'en'
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.title).toBe("Updated Title");
      expect(response.sections[0].title).toBe("Successfully Updated Hero");
    });
  });
});