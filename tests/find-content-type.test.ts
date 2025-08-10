// describe, it, expect, beforeEach are global in Jest
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('list_content_types tool with filter', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  const mockContentTypes = [
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
        author: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'api::author.author'
        },
        publishedAt: { type: 'datetime' },
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
        name: { type: 'string', required: true },
        description: { type: 'text' },
        client: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'api::client.client'
        },
        technologies: {
          type: 'relation',
          relation: 'manyToMany',
          target: 'api::technology.technology'
        }
      }
    },
    {
      uid: 'api::product.product',
      apiID: 'product',
      pluralApiId: 'products',
      info: {
        displayName: 'Product',
        description: 'E-commerce products'
      },
      attributes: {
        name: { type: 'string', required: true },
        price: { type: 'decimal', required: true },
        category: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'api::category.category'
        }
      }
    },
    {
      uid: 'api::landing-page.landing-page',
      apiID: 'landing-page',
      pluralApiId: 'landing-pages',
      info: {
        displayName: 'Landing Page',
        description: 'Dynamic landing pages'
      },
      attributes: {
        title: { type: 'string', required: true },
        sections: {
          type: 'dynamiczone',
          components: ['sections.hero', 'sections.features']
        }
      }
    }
  ];

  beforeEach(() => {
    mockClient = {
      contentManagerInit: jest.fn().mockResolvedValue({
        contentTypes: mockContentTypes,
        components: []
      })
    } as any;

    tools = contentManagementTools(mockClient);
  });

  describe('filtering by uid', () => {
    it('should find content type by exact uid', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'api::article.article', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('api::article.article');
    });

    it('should find content type by partial uid', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'article', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('api::article.article');
    });

    it('should find multiple content types matching partial uid', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'api::', attributes: true });

      expect(result).toHaveLength(4);
    });
  });

  describe('filtering by apiID', () => {
    it('should find content type by exact apiID', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'project', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('project');
    });

    it('should find content type by partial apiID', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'prod', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('product');
    });
  });

  describe('filtering by pluralApiId', () => {
    it('should find content type by exact pluralApiId', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'landing-pages', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].pluralApiId).toBe('landing-pages');
    });

    it('should find content type by partial pluralApiId', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'pages', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].pluralApiId).toBe('landing-pages');
    });

    it('should find multiple content types with similar pluralApiIds', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'product', attributes: true });

      // Should match both 'product' apiID and 'products' pluralApiId
      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('product');
    });
  });

  describe('case-insensitive search', () => {
    it('should find content type regardless of case', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      const results = await Promise.all([
        tool.execute({ filter: 'ARTICLE', attributes: true }),
        tool.execute({ filter: 'Article', attributes: true }),
        tool.execute({ filter: 'aRtIcLe', attributes: true })
      ]);

      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].uid).toBe('api::article.article');
      });
    });
  });

  describe('returning full schema', () => {
    it('should return complete schema for matched content types', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'article', attributes: true });

      const articleSchema = result[0];
      
      // Should have all the schema details
      expect(articleSchema).toHaveProperty('uid');
      expect(articleSchema).toHaveProperty('apiID');
      expect(articleSchema).toHaveProperty('pluralApiId');
      expect(articleSchema).toHaveProperty('info');
      expect(articleSchema).toHaveProperty('attributes');
      expect(articleSchema).toHaveProperty('pluginOptions');
      
      // Check attributes are complete
      expect(articleSchema.attributes).toHaveProperty('title');
      expect(articleSchema.attributes).toHaveProperty('content');
      expect(articleSchema.attributes).toHaveProperty('author');
      expect(articleSchema.attributes.title.required).toBe(true);
      expect(articleSchema.attributes.author.type).toBe('relation');
    });
  });

  describe('error handling', () => {
    it('should return helpful error when no matches found', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'nonexistent' });

      // With new behavior, it returns an empty array when no matches
      expect(result).toEqual([]);
    });

    it('should handle empty filter gracefully', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: '' });

      // Empty string should match all content types
      expect(result).toHaveLength(4);
    });

    it('should handle special regex characters in filter', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'api::.*' });

      // Should treat it as literal string, not regex - no matches
      expect(result).toEqual([]);
    });
  });

  describe('multiple matches', () => {
    it('should return all matching content types', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'pro', attributes: true });

      // Should match both 'project' and 'product'
      expect(result).toHaveLength(2);
      
      const apiIds = result.map((ct: any) => ct.apiID);
      expect(apiIds).toContain('project');
      expect(apiIds).toContain('product');
    });

    it('should return all content types when filter matches everything', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ filter: 'a', attributes: true }); // 'a' is in all our test content types

      expect(result).toHaveLength(4);
    });
  });

  describe('performance', () => {
    it('should handle large number of content types efficiently', async () => {
      // Create 100 content types
      const manyContentTypes = Array.from({ length: 100 }, (_, i) => ({
        uid: `api::type${i}.type${i}`,
        apiID: `type${i}`,
        pluralApiId: `type${i}s`,
        info: { displayName: `Type ${i}` },
        attributes: { field: { type: 'string' } }
      }));

      mockClient.contentManagerInit = jest.fn().mockResolvedValue({
        contentTypes: manyContentTypes,
        components: []
      });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      const startTime = Date.now();
      const result = await tool.execute({ filter: 'type50', attributes: true });
      const endTime = Date.now();

      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('type50');
      
      // Should complete in reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});