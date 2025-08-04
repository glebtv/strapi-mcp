// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Documented Strapi MCP Errors', () => {
  let client: Client;
  let transport: StdioClientTransport;
  
  // Use the specific Strapi instance credentials
  const STRAPI_URL = 'http://localhost:1337';
  const STRAPI_ADMIN_EMAIL = 'glebtv@gmail.com';
  const STRAPI_ADMIN_PASSWORD = 'sT123654';

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
      // Test data missing required fields: title and page_type
      const incompleteData = {
        name: "Test Page",
        slug: "test-page-" + Date.now(),
        sections: [
          {
            __component: "sections.hero",
            title: "Hero Title",
            subtitle: "Hero Subtitle",
            description: "Hero Description"
          }
        ]
      };

      try {
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::landing-page.landing-page',
            pluralApiId: 'landing-pages',
            data: incompleteData,
            locale: 'ru',
            publish: true
          }
        });
        
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('Error #1 test - error message:', error.message);
        
        // Verify the error message includes:
        // 1. Clear indication of missing fields
        expect(error.message).toContain('Missing required fields');
        
        // 2. Lists ALL missing fields (not just the first one)
        expect(error.message).toContain('title (type: string)');
        expect(error.message).toContain('page_type (type: enumeration)');
        
        // 3. Shows what fields were provided
        expect(error.message).toContain('Current data only includes: name, slug, sections');
        
        // 4. Clarifies fields should be at root level
        expect(error.message).toContain('root level of your data object');
      }
    });

    it('should succeed when creating the same entry WITH title and page_type', async () => {
      // This is what the AI should have sent - with ALL required fields
      const completeData = {
        name: "О компании",
        title: "О компании",  // This was missing!
        slug: "about-fixed-" + Date.now(),
        page_type: "about",   // This was missing!
        sections: [
          {
            __component: "sections.hero",
            title: "Более 300 реализованных проектов за 12 лет",
            subtitle: "RocketWare — надежный партнер по разработке и внедрению цифровых и коммуникационных продуктов для бизнеса",
            description: "Мы предлагаем комплексный подход к решению IT-задач, создавая технологические решения под задачи вашего бизнеса.",
            cta_buttons: [
              {
                text: "Начать проект",
                url: "#",
                style: "primary",
                action: "open-project-modal"
              },
              {
                text: "Наши кейсы",
                url: "/portfolio",
                style: "outline"
              }
            ],
            layout: "centered",
            overlay_opacity: 0.7
          }
        ]
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::landing-page.landing-page',
          pluralApiId: 'landing-pages',
          data: completeData,
          locale: 'ru',
          publish: true
        }
      });

      const response = JSON.parse(result.content[0].text);
      console.log('Successfully created About page with all required fields:', response.documentId);
      
      expect(response.documentId).toBeDefined();
      expect(response.title).toBe("О компании");
      expect(response.page_type).toBe("about");
      expect(response.sections).toHaveLength(1);
      expect(response.sections[0].__component).toBe("sections.hero");

      // Clean up
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'landing-pages',
          documentId: response.documentId,
          locale: 'ru'
        }
      });
    }, 30000);

    it('should successfully create entry when all required fields are provided', async () => {
      const completeData = {
        name: "Test Page Complete",
        title: "Test Page Title", // Required root-level field
        slug: "test-page-complete-" + Date.now(),
        page_type: "other", // Required enum field
        sections: [
          {
            __component: "sections.hero",
            title: "Hero Section Title",
            subtitle: "Hero Subtitle",
            description: "Hero Description",
            layout: "centered",
            overlay_opacity: 0.7
          }
        ]
      };

      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::landing-page.landing-page',
          pluralApiId: 'landing-pages',
          data: completeData,
          locale: 'ru',
          publish: true
        }
      });

      const response = JSON.parse(result.content[0].text);
      console.log('Successfully created entry:', response.documentId);
      
      expect(response.documentId).toBeDefined();
      expect(response.title).toBe("Test Page Title");
      expect(response.page_type).toBe("other");

      // Clean up
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          pluralApiId: 'landing-pages',
          documentId: response.documentId,
          locale: 'ru'
        }
      });
    }, 30000);
  });

  describe('Error #2: Incomplete Section Data Saving', () => {
    it('should identify when trying to use unregistered dynamic zone components', async () => {
      // First, get the content type schema to see allowed components
      const schemaResult = await client.callTool({
        name: 'get_content_type_schema',
        arguments: {
          contentType: 'api::landing-page.landing-page'
        }
      });

      const schema = JSON.parse(schemaResult.content[0].text);
      const sectionsField = schema.attributes.find((attr: any) => attr.name === 'sections');
      
      console.log('Allowed dynamic zone components:', sectionsField.components);
      
      // Verify that the problematic components are NOT in the list
      expect(sectionsField.components).not.toContain('sections.stats');
      expect(sectionsField.components).not.toContain('sections.cta');
      expect(sectionsField.components).not.toContain('sections.features');
    });

    it('should now PREVENT creation with unregistered components (fixed!)', async () => {
      const dataWithMixedComponents = {
        name: "Test Mixed Components",
        title: "Test Mixed Components Title",
        slug: "test-mixed-" + Date.now(),
        page_type: "other",
        sections: [
          {
            __component: "sections.hero", // Registered ✓
            title: "Hero Title",
            subtitle: "Hero Subtitle",
            description: "Hero Description",
            layout: "centered"
          },
          {
            __component: "sections.stats", // NOT registered ✗
            title: "Stats Title",
            stats: [
              { value: "100", label: "Projects", icon: "rocket" }
            ]
          },
          {
            __component: "sections.cta", // NOT registered ✗
            title: "CTA Title",
            description: "CTA Description",
            buttons: []
          }
        ]
      };

      try {
        // This should now fail with our new validation
        await client.callTool({
          name: 'create_entry',
          arguments: {
            contentType: 'api::landing-page.landing-page',
            pluralApiId: 'landing-pages',
            data: dataWithMixedComponents,
            locale: 'ru',
            publish: true
          }
        });

        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        console.log('Fixed! Now properly validates dynamic zone components');
        console.log('Error message:', error.message);
        
        // Verify we get a clear error about invalid components
        expect(error.message).toContain('Dynamic zone validation failed');
        expect(error.message).toContain('Invalid components for dynamic zone \'sections\'');
        expect(error.message).toContain('sections.stats');
        expect(error.message).toContain('sections.cta');
        expect(error.message).toContain('Allowed:');
        expect(error.message).toContain('sections.hero');
        
        // The error should guide users to check schema or create components
        expect(error.message).toContain('Check the content type schema for allowed components');
      }
    }, 30000);
  });

  describe('Error #3: Partial Data in API Responses', () => {
    let testEntryId: string;

    beforeAll(async () => {
      // Create a test entry with nested data
      const testData = {
        name: "Test Population",
        title: "Test Population Title",
        slug: "test-population-" + Date.now(),
        page_type: "other",
        sections: [
          {
            __component: "sections.hero",
            title: "Hero with Buttons",
            subtitle: "Testing nested population",
            description: "This hero has CTA buttons that need proper population",
            layout: "centered",
            overlay_opacity: 0.8,
            cta_buttons: [
              {
                text: "Primary Button",
                url: "/primary",
                style: "primary",
                action: "navigate"
              },
              {
                text: "Secondary Button",
                url: "/secondary",
                style: "outline",
                action: "modal"
              }
            ]
          }
        ]
      };

      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::landing-page.landing-page',
          pluralApiId: 'landing-pages',
          data: testData,
          locale: 'ru',
          publish: true
        }
      });

      const created = JSON.parse(createResult.content[0].text);
      testEntryId = created.documentId;
    }, 30000);

    afterAll(async () => {
      // Clean up test entry
      if (testEntryId) {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'landing-pages',
            documentId: testEntryId,
            locale: 'ru'
          }
        });
      }
    });

    it('should return incomplete data with simple populate "*"', async () => {
      const result = await client.callTool({
        name: 'get_entry',
        arguments: {
          pluralApiId: 'landing-pages',
          documentId: testEntryId,
          locale: 'ru',
          options: JSON.stringify({ populate: '*' })
        }
      });

      const response = JSON.parse(result.content[0].text);
      const entry = response.data || response;
      
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
      if (!heroSection.cta_buttons || heroSection.cta_buttons.length === 0) {
        console.log('Simple populate returned incomplete nested data (cta_buttons missing)');
      }
    });

    it('should return complete data with nested population', async () => {
      const result = await client.callTool({
        name: 'get_entry',
        arguments: {
          pluralApiId: 'landing-pages',
          documentId: testEntryId,
          locale: 'ru',
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
      const entry = response.data || response;
      
      if (!entry.sections || entry.sections.length === 0) {
        throw new Error('Sections should be populated with nested populate');
      }

      // With nested populate, all data should be complete
      const heroSection = entry.sections[0];
      expect(heroSection.__component).toBe('sections.hero');
      expect(heroSection.title).toBe('Hero with Buttons');
      expect(heroSection.subtitle).toBe('Testing nested population');
      expect(heroSection.cta_buttons).toBeDefined();
      expect(heroSection.cta_buttons).toHaveLength(2);
      expect(heroSection.cta_buttons[0].text).toBe('Primary Button');
      expect(heroSection.cta_buttons[1].text).toBe('Secondary Button');
    });

    it('should work correctly with strapi_rest tool and nested population', async () => {
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'api/landing-pages/' + testEntryId,
          method: 'GET',
          params: {
            locale: 'ru',
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
      expect(entry.sections[0].cta_buttons).toBeDefined();
      expect(entry.sections[0].cta_buttons).toHaveLength(2);
    });
  });
});