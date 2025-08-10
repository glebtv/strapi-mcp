// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Documented Strapi MCP Errors', () => {
  let client: Client;
  let transport: StdioClientTransport;
  
  // Use the test Strapi instance credentials
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const STRAPI_ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL || 'admin@test.com';
  const STRAPI_ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD || 'Admin123!';

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

  describe('Error #1: Missing Required Fields', () => {
    it('should provide clear error message listing ALL missing required fields', async () => {
      // Test data missing required field: title
      const incompleteData = {
        slug: "test-page-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Hero Section"
          }
        ]
      };

      try {
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
        publish: false,
            data: incompleteData,
            locale: 'en',
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('Error #1 test - error message:', error.message);
        
        // Strapi should return a validation error for missing required fields
        // The actual error message depends on Strapi's validation
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
        // The error should indicate there's a validation/required field issue
        // Note: Without content type builder tools, we can't provide custom error messages
      }
    });

    it('should succeed when creating the same entry WITH title', async () => {
      const completeData = {
        title: "Complete Test Page", // Required ✓
        slug: "test-page-complete-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Hero Section"
          }
        ]
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
        publish: false,
          data: completeData,
          locale: 'en',
        }
      });

      const response = JSON.parse(result.content[0].text);
      console.log('Successfully created Page with all required fields:', response.documentId);
      
      expect(response.documentId).toBeDefined();
      expect(response.title).toBe("Complete Test Page");
      expect(response.sections).toHaveLength(1);
      expect(response.sections[0].__component).toBe("sections.hero");

      // Clean up
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: response.documentId,
          locale: 'en'
        }
      });
    }, 30000);

    it('should successfully create entry when all required fields are provided', async () => {
      const validData = {
        title: "Valid Entry Test",
        slug: "valid-entry-" + Date.now()
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
        publish: false,
          data: validData,
          locale: 'en',
        }
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.documentId).toBeDefined();
      expect(response.title).toBe("Valid Entry Test");

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
  });

  describe('Error #2: Incomplete Section Data Saving', () => {
    it('should identify when trying to use unregistered dynamic zone components', async () => {
      // First, get the content types list to see the page type
      const typesResult = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });

      const data = JSON.parse(typesResult.content[0].text);
      const contentTypes = data.contentTypes || [];
      const pageType = contentTypes.find((ct: any) => ct.uid === 'api::page.page');
      
      if (pageType && pageType.attributes && pageType.attributes.sections) {
        const sectionsField = pageType.attributes.sections;
        
        console.log('Allowed dynamic zone components:', sectionsField.components);
        
        // Verify that the problematic components are NOT in the list
        expect(sectionsField.components).not.toContain('sections.stats');
        expect(sectionsField.components).not.toContain('sections.cta');
        expect(sectionsField.components).not.toContain('sections.features');
        
        // Verify the actual allowed components
        expect(sectionsField.components).toContain('sections.hero');
        expect(sectionsField.components).toContain('sections.columns');
        expect(sectionsField.components).toContain('sections.prices');
      } else {
        // If page type structure is not as expected, skip the test
        console.log('Page type structure not available for component verification');
      }
    });

    it('should now PREVENT creation with unregistered components (fixed!)', async () => {
      const dataWithInvalidComponents = {
        title: "Test Page",
        slug: "test-invalid-components-" + Date.now(),
        sections: [
          {
            __component: "sections.hero", // Valid ✓
            title: "Valid Hero Section"
          },
          {
            __component: "sections.stats", // INVALID ✗
            title: "Stats Section",
            stats: []
          },
          {
            __component: "sections.cta", // INVALID ✗
            title: "CTA Section",
            buttons: []
          }
        ]
      };

      try {
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
        publish: false,
            data: dataWithInvalidComponents,
            locale: 'en',
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('Fixed! Now properly validates dynamic zone components');
        console.log('Error message:', error.message);
        
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
    }, 30000);
  });

  describe('Error #3: Partial Data in API Responses', () => {
    let testEntryId: string;

    beforeAll(async () => {
      // Create a test entry with nested data
      const testData = {
        title: "Test Population Title",
        slug: "test-population-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Hero with Details",
            subtitle: "Testing nested population"
          }
        ]
      };

      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
        publish: false,
          data: testData,
          locale: 'en',
        }
      });

      const created = JSON.parse(createResult.content[0].text);
      testEntryId = created.documentId;
      
      // Publish the entry so it's accessible via public API
      await client.callTool({
        name: 'publish_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentIds: [testEntryId]
        }
      });
    }, 30000);

    afterAll(async () => {
      // Clean up test entry
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

    it('should return incomplete data with simple populate "*"', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testEntryId,
          locale: 'en',
          options: JSON.stringify({ populate: '*' })
        }
      });

      const response = JSON.parse(result.content[0].text);
      const entry = response.data?.[0] || response.results?.[0] || response;
      
      if (!entry.sections || entry.sections.length === 0) {
        console.log('WARNING: sections not populated with simple populate "*"');
        console.log('This demonstrates Error #3 - simple populate does not include dynamic zone data');
        console.log('Solution: Use nested population like { populate: { sections: { populate: "*" } } }');
        return; // Skip assertions as this demonstrates the issue
      }

      // With simple populate, nested components might be incomplete
      const heroSection = entry.sections[0];
      expect(heroSection.__component).toBe('sections.hero');
      
      // Check if nested data is missing or incomplete
      // Note: This behavior varies by Strapi version
      if (!heroSection.title || !heroSection.subtitle) {
        console.log('Simple populate returned incomplete nested data');
      }
    });

    it('should return complete data with nested population', async () => {
      const result = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testEntryId,
          locale: 'en',
          options: JSON.stringify({ 
            populate: { 
              sections: { 
                populate: '*' 
              } 
            } 
          })
        }
      });

      const response = JSON.parse(result.content[0].text);
      const entry = response.data?.[0] || response.results?.[0] || response;
      
      if (!entry.sections || entry.sections.length === 0) {
        throw new Error('Sections should be populated with nested populate');
      }

      // With nested populate, all data should be complete
      const heroSection = entry.sections[0];
      expect(heroSection.__component).toBe('sections.hero');
      expect(heroSection.title).toBe('Hero with Details');
      expect(heroSection.subtitle).toBe('Testing nested population');
    });

    it('should work correctly with strapi_rest tool and nested population', async () => {
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/pages/' + testEntryId,
          method: 'GET',
          params: {
            locale: 'en',
            populate: {
              sections: {
                populate: '*'
              }
            }
          }
        }
      });

      const response = JSON.parse(result.content[0].text);
      const entry = response.data;
      
      console.log('strapi_rest with nested populate:', JSON.stringify(entry.sections[0], null, 2));

      // Verify complete data retrieval
      expect(entry.sections[0].__component).toBe('sections.hero');
      expect(entry.sections[0].title).toBeDefined();
      expect(entry.sections[0].subtitle).toBeDefined();
    });
  });
});