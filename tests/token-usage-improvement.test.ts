// Jest globals (describe, it, expect, beforeEach) are already available
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('Token usage improvements', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  // Simulate a real Strapi response with many content types
  const createLargeContentType = (index: number) => ({
    uid: `api::content${index}.content${index}`,
    apiID: `content${index}`,
    pluralApiId: `content${index}s`,
    info: {
      displayName: `Content Type ${index}`,
      description: `This is a detailed description for content type ${index} with lots of text to simulate real world usage`,
      singularName: `content${index}`,
      pluralName: `content${index}s`
    },
    attributes: {
      // Simulate 30 fields per content type
      ...Array.from({ length: 30 }, (_, i) => ({
        [`field${i}`]: {
          type: i % 3 === 0 ? 'string' : i % 3 === 1 ? 'text' : 'relation',
          required: i % 2 === 0,
          maxLength: 255,
          minLength: 0,
          unique: false,
          configurable: true,
          writable: true,
          visible: true,
          private: false,
          pluginOptions: {
            i18n: { localized: true },
            'content-manager': {
              visible: true,
              edit: {
                label: `Field ${i} Label`,
                description: `Description for field ${i}`,
                placeholder: `Enter value for field ${i}`,
                visible: true,
                editable: true
              },
              list: {
                label: `Field ${i}`,
                searchable: true,
                sortable: true
              }
            }
          }
        }
      })).reduce((acc, cur) => ({ ...acc, ...cur }), {}),
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' },
      publishedAt: { type: 'datetime' },
      createdBy: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'admin::user',
        configurable: false,
        writable: false,
        visible: false,
        useJoinTable: false,
        private: true
      },
      updatedBy: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'admin::user',
        configurable: false,
        writable: false,
        visible: false,
        useJoinTable: false,
        private: true
      }
    },
    pluginOptions: {
      i18n: {
        localized: true
      },
      'content-manager': {
        visible: true,
        configurable: true
      },
      'content-type-builder': {
        visible: true
      }
    },
    kind: 'collectionType',
    collectionName: `content${index}s`,
    isDisplayed: true,
    apiID: `content${index}`,
    category: 'content'
  });

  beforeEach(() => {
    // Create 50 content types to simulate a large Strapi instance
    const largeContentTypes = Array.from({ length: 50 }, (_, i) => createLargeContentType(i));

    mockClient = {
      contentManagerInit: jest.fn().mockResolvedValue({
        contentTypes: largeContentTypes,
        components: []
      })
    } as any;

    tools = contentManagementTools(mockClient);
  });

  describe('Token usage comparison', () => {
    it('should demonstrate significant token reduction in list_content_types', async () => {
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      const result = await listTool.execute({});

      // Calculate token counts (rough estimation: 1 token ≈ 4 characters)
      const fullResponse = await mockClient.contentManagerInit();
      const fullResponseJson = JSON.stringify(fullResponse.contentTypes);
      const fullTokens = Math.ceil(fullResponseJson.length / 4);

      const optimizedJson = JSON.stringify(result);
      const optimizedTokens = Math.ceil(optimizedJson.length / 4);

      console.log('Token usage comparison for list_content_types:');
      console.log(`- Full response: ~${fullTokens} tokens (${fullResponseJson.length} chars)`);
      console.log(`- Optimized response: ~${optimizedTokens} tokens (${optimizedJson.length} chars)`);
      console.log(`- Reduction: ${((1 - optimizedTokens / fullTokens) * 100).toFixed(2)}%`);

      // Should reduce tokens by at least 95%
      expect(optimizedTokens).toBeLessThan(fullTokens * 0.05);

      // Verify the response is a valid array
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(50);
    });

    it('should demonstrate targeted schema retrieval with list_content_types filter', async () => {
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      
      // Scenario: AI needs schema for 'content25'
      const result = await listTool.execute({ filter: 'content25', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('content25');
      expect(result[0].attributes).toBeDefined();

      // Calculate token usage for this targeted approach
      const resultJson = JSON.stringify(result);
      const targetedTokens = Math.ceil(resultJson.length / 4);

      // Compare with getting ALL content types
      const fullResponse = await mockClient.contentManagerInit();
      const fullResponseJson = JSON.stringify(fullResponse.contentTypes);
      const fullTokens = Math.ceil(fullResponseJson.length / 4);

      console.log('\nToken usage for getting single content type schema:');
      console.log(`- Getting all content types: ~${fullTokens} tokens`);
      console.log(`- Using list_content_types with filter: ~${targetedTokens} tokens`);
      console.log(`- Reduction: ${((1 - targetedTokens / fullTokens) * 100).toFixed(2)}%`);

      // Should use less than 5% of tokens compared to full response
      expect(targetedTokens).toBeLessThan(fullTokens * 0.05);
    });

    it('should handle the 25000 token limit scenario', async () => {
      const MAX_TOKENS = 25000;
      const CHARS_PER_TOKEN = 4;
      const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN; // 100,000 characters

      // Test list_content_types stays under limit
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      const listResult = await listTool.execute({});
      const listResultJson = JSON.stringify(listResult);
      
      expect(listResultJson.length).toBeLessThan(MAX_CHARS);
      console.log(`\nlist_content_types response: ${listResultJson.length} chars (${Math.ceil(listResultJson.length / 4)} tokens)`);

      // Test list_content_types with filter for single match stays under limit
      const filteredResult = await listTool.execute({ filter: 'content10', attributes: true });
      const filteredResultJson = JSON.stringify(filteredResult);
      
      expect(filteredResultJson.length).toBeLessThan(MAX_CHARS);
      console.log(`list_content_types with filter response: ${filteredResultJson.length} chars (${Math.ceil(filteredResultJson.length / 4)} tokens)`);
    });
  });

  describe('Workflow demonstration', () => {
    it('should demonstrate the improved workflow for AI agents', async () => {
      // Step 1: AI wants to see available content types
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      const contentTypesList = await listTool.execute({});

      console.log('\n=== Improved AI Workflow ===');
      console.log('Step 1: List all content types (minimal)');
      console.log(`Response size: ${JSON.stringify(contentTypesList).length} chars`);
      expect(contentTypesList).toHaveLength(50);

      // Step 2: AI identifies the content type it needs (e.g., searching for "product")
      const targetApiId = 'content25'; // Simulating AI finding this from the list
      console.log(`\nStep 2: AI identifies target: ${targetApiId}`);

      // Step 3: AI uses list_content_types with filter to get full schema
      const schemaResult = await listTool.execute({ filter: targetApiId, attributes: true });
      
      console.log(`Step 3: Get full schema for ${targetApiId}`);
      console.log(`Response size: ${JSON.stringify(schemaResult).length} chars`);
      
      expect(schemaResult).toHaveLength(1);
      expect(schemaResult[0].attributes).toBeDefined();
      
      // Verify we have all the fields needed for content creation
      const schema = schemaResult[0];
      expect(Object.keys(schema.attributes).length).toBeGreaterThan(30);

      console.log('\nResult: AI can now create content with full schema knowledge');
      console.log('Total tokens used: Much less than the 25000 limit!');
    });

    it('should handle fuzzy search scenarios efficiently', async () => {
      const listTool = tools.find(t => t.name === 'list_content_types')!;

      // Scenario: AI remembers partial name
      const scenarios = [
        { filter: 'cont', expected: 50 }, // Matches all 'content*'
        { filter: '25', expected: 1 },    // Matches content25
        { filter: 'content1', expected: 11 }, // Matches content1, content10-19
      ];

      for (const scenario of scenarios) {
        const result = await listTool.execute({ filter: scenario.filter });
        console.log(`\nSearch for "${scenario.filter}": found ${result.length} matches`);
        expect(result).toHaveLength(scenario.expected);
      }
    });
  });
});