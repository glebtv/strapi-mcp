// Jest globals (describe, it, expect, beforeEach) are available without import
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('list_content_types optimization', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  beforeEach(() => {
    // Create a mock client
    mockClient = {
      contentManagerInit: jest.fn()
    } as any;

    tools = contentManagementTools(mockClient);
  });

  describe('list_content_types tool', () => {
    it('should return minimal JSON with only uid, apiID, and pluralApiId', async () => {
      // Mock response with full content type data
      const mockFullResponse = {
        contentTypes: [
          {
            uid: 'api::article.article',
            apiID: 'article',
            pluralApiId: 'articles',
            info: {
              displayName: 'Article',
              description: 'Blog articles',
              singularName: 'article',
              pluralName: 'articles'
            },
            attributes: {
              title: { type: 'string', required: true },
              content: { type: 'richtext' },
              slug: { type: 'uid', targetField: 'title' },
              // ... many more attributes
              createdAt: { type: 'datetime' },
              updatedAt: { type: 'datetime' }
            },
            pluginOptions: {
              i18n: { localized: true }
            }
          },
          {
            uid: 'api::project.project',
            apiID: 'project',
            pluralApiId: 'projects',
            info: {
              displayName: 'Project',
              description: 'Portfolio projects'
            },
            attributes: {
              name: { type: 'string' },
              description: { type: 'text' }
            }
          }
        ],
        components: [] // Components would also be in the full response
      };

      (mockClient.contentManagerInit as any).mockResolvedValue(mockFullResponse);

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'all' }); // Use 'all' to test with all content types

      // Result should be an array directly, not a JSON string
      expect(result).toEqual([
        {
          uid: 'api::article.article',
          apiID: 'article',
          pluralApiId: 'articles'
        },
        {
          uid: 'api::project.project',
          apiID: 'project',
          pluralApiId: 'projects'
        }
      ]);

      // Verify it's an array with correct structure
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should handle empty content types', async () => {
      (mockClient.contentManagerInit as any).mockResolvedValue({
        contentTypes: [],
        components: []
      });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'all' }); // Use 'all' to test with all content types

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should significantly reduce response size', async () => {
      // Create a large mock response simulating real Strapi data
      const largeContentType = {
        uid: 'api::complex.complex',
        apiID: 'complex',
        pluralApiId: 'complexes',
        info: {
          displayName: 'Complex Type',
          description: 'A very complex content type with many fields',
          singularName: 'complex',
          pluralName: 'complexes'
        },
        attributes: {}
      };

      // Add 50 attributes to simulate a complex type
      for (let i = 0; i < 50; i++) {
        largeContentType.attributes[`field${i}`] = {
          type: 'string',
          required: false,
          maxLength: 255,
          minLength: 0,
          unique: false,
          configurable: true,
          writable: true,
          visible: true,
          private: false,
          pluginOptions: {
            i18n: { localized: true }
          }
        };
      }

      const mockResponse = {
        contentTypes: Array(10).fill(largeContentType),
        components: []
      };

      (mockClient.contentManagerInit as any).mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'all' }); // Use 'all' to test with all content types

      const fullResponseSize = JSON.stringify(mockResponse).length;
      const optimizedSize = JSON.stringify(result).length;

      // Should reduce size by at least 90%
      const reduction = ((fullResponseSize - optimizedSize) / fullResponseSize) * 100;
      expect(reduction).toBeGreaterThan(90);
      
      // Log the actual reduction for verification
      console.log(`Size reduction: ${reduction.toFixed(2)}% (${fullResponseSize} bytes -> ${optimizedSize} bytes)`);
    });

    it('should handle missing or undefined fields gracefully', async () => {
      const mockResponse = {
        contentTypes: [
          {
            uid: 'api::test.test',
            // apiID missing
            pluralApiId: 'tests'
          },
          {
            uid: 'api::another.another',
            apiID: 'another'
            // pluralApiId missing
          }
        ],
        components: []
      };

      (mockClient.contentManagerInit as any).mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'all' }); // Use 'all' to test with all content types

      expect(result).toEqual([
        {
          uid: 'api::test.test',
          apiID: undefined,
          pluralApiId: 'tests'
        },
        {
          uid: 'api::another.another',
          apiID: 'another',
          pluralApiId: undefined
        }
      ]);
    });
  });
});