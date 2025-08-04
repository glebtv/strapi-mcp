// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getSharedClient } from './helpers/shared-client.js';

describe('Validation Error Reproduction Test', () => {
  let client: Client;

  beforeAll(async () => {
    // Use the shared client instance like other tests
    client = await getSharedClient();
  }, 60000);

  it('should first get schema to understand required fields', async () => {
    // First, let's get the schema to see what fields are required
    const schemaResult = await client.callTool({
      name: 'get_content_type_schema',
      arguments: {
        contentType: 'api::landing-page.landing-page'
      }
    });

    console.log('Landing page schema:', JSON.stringify(JSON.parse(schemaResult.content[0].text), null, 2));
  });

  it('should give clear error about missing required fields', async () => {
    // This is the exact same data structure that caused the original error
    const landingPageData = {
      name: "О компании",
      slug: "about",
      sections: [
        {
          __component: "sections.hero",
          title: "Более 300 реализованных проектов за 12 лет", // Note: title here is inside a component, not at root
          subtitle: "RocketWare — надежный партнер по разработке и внедрению цифровых и коммуникационных продуктов для бизнеса",
          description: "Мы предлагаем комплексный подход к решению IT-задач, создавая технологические решения под задачи вашего бизнеса. Наша команда обладает обширной экспертизой в разработке и управлении технологическими продуктами.",
          cta_buttons: [
            { text: "Начать проект", url: "#", style: "primary", action: "open-project-modal" },
            { text: "Наши кейсы", url: "/portfolio", style: "outline" }
          ],
          layout: "centered",
          overlay_opacity: 0.7
        }
      ]
    };

    // Attempt to create the entry without required root-level fields
    try {
      const result = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentType: 'api::landing-page.landing-page',
          pluralApiId: 'landing-pages',
          data: landingPageData,
          locale: 'ru',
          publish: true
        }
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      console.log('Improved error message:', error.message);
      
      // Verify the error message now clearly states:
      // 1. Which fields are missing
      expect(error.message).toContain('Missing required fields');
      expect(error.message).toContain('title (type: string)');
      expect(error.message).toContain('page_type (type: enumeration)');
      
      // 2. What fields were provided
      expect(error.message).toContain('Current data only includes: name, slug, sections');
      
      // 3. Where to add the fields
      expect(error.message).toContain('root level of your data object');
    }
  });

  it('should succeed when all required fields are provided', async () => {
    // Correct data structure with all required fields at root level
    const correctLandingPageData = {
      name: "О компании",
      title: "О компании", // Required field at root level
      slug: "about-test-" + Date.now(), // Make unique to avoid conflicts
      page_type: "about", // Required enum field
      sections: [
        {
          __component: "sections.hero",
          title: "Более 300 реализованных проектов за 12 лет",
          subtitle: "RocketWare — надежный партнер по разработке и внедрению цифровых и коммуникационных продуктов для бизнеса",
          description: "Мы предлагаем комплексный подход к решению IT-задач, создавая технологические решения под задачи вашего бизнеса.",
          cta_buttons: [
            { text: "Начать проект", url: "#", style: "primary", action: "open-project-modal" }
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
        data: correctLandingPageData,
        locale: 'ru',
        publish: true
      }
    });

    const response = JSON.parse(result.content[0].text);
    console.log('Successfully created entry with ID:', response.documentId);
    expect(response.documentId).toBeDefined();
    expect(response.title).toBe("О компании");
    expect(response.page_type).toBe("about");
    
    // Clean up - delete the created entry
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