// describe, it, expect, beforeEach are global in Jest
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('Component discovery tools', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  const mockComponents = [
    {
      uid: 'shared.testimonial',
      category: 'shared',
      info: {
        displayName: 'Testimonial',
        description: 'Customer testimonial component'
      },
      attributes: {
        quote: { type: 'text', required: true },
        author_name: { type: 'string', required: true },
        author_title: { type: 'string' },
        author_company: { type: 'string' },
        rating: { type: 'integer', min: 1, max: 5 }
      }
    },
    {
      uid: 'shared.social-link',
      category: 'shared',
      info: {
        displayName: 'Social Link',
        description: 'Social media link'
      },
      attributes: {
        platform: { 
          type: 'enumeration',
          enum: ['facebook', 'twitter', 'linkedin', 'instagram'],
          required: true
        },
        url: { type: 'string', required: true }
      }
    },
    {
      uid: 'sections.hero',
      category: 'sections',
      info: {
        displayName: 'Hero Section',
        description: 'Main hero section for landing pages'
      },
      attributes: {
        title: { type: 'string', required: true },
        subtitle: { type: 'text' },
        backgroundImage: { type: 'media' },
        cta: { type: 'component', component: 'shared.button' }
      }
    },
    {
      uid: 'sections.features',
      category: 'sections',
      info: {
        displayName: 'Features Section',
        description: 'Features grid section'
      },
      attributes: {
        title: { type: 'string' },
        features: {
          type: 'component',
          repeatable: true,
          component: 'shared.feature'
        }
      }
    },
    {
      uid: 'blocks.pricing-card',
      category: 'blocks',
      info: {
        displayName: 'Pricing Card'
      },
      attributes: {
        title: { type: 'string', required: true },
        price: { type: 'decimal', required: true },
        currency: { type: 'string', default: 'USD' },
        features: { type: 'json' }
      }
    }
  ];

  beforeEach(() => {
    mockClient = {
      contentManagerInit: jest.fn().mockResolvedValue({
        contentTypes: [],
        components: mockComponents
      })
    } as any;

    tools = contentManagementTools(mockClient);
  });

  describe('list_components tool', () => {
    it('should list all components with minimal info', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({});

      expect(result).toHaveLength(5);
      expect(result).toEqual([
        { uid: 'shared.testimonial', category: 'shared', info: { displayName: 'Testimonial', description: 'Customer testimonial component' } },
        { uid: 'shared.social-link', category: 'shared', info: { displayName: 'Social Link', description: 'Social media link' } },
        { uid: 'sections.hero', category: 'sections', info: { displayName: 'Hero Section', description: 'Main hero section for landing pages' } },
        { uid: 'sections.features', category: 'sections', info: { displayName: 'Features Section', description: 'Features grid section' } },
        { uid: 'blocks.pricing-card', category: 'blocks', info: { displayName: 'Pricing Card' } }
      ]);
    });

    it('should filter components by category', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      
      // Filter for 'shared' category
      const sharedResult = await tool.execute({ filter: 'shared' });
      expect(sharedResult).toHaveLength(2);
      expect(sharedResult.every((c: any) => c.category === 'shared')).toBe(true);
      
      // Filter for 'sections' category
      const sectionsResult = await tool.execute({ filter: 'sections' });
      expect(sectionsResult).toHaveLength(2);
      expect(sectionsResult.every((c: any) => c.category === 'sections')).toBe(true);
      
      // Filter for 'blocks' category
      const blocksResult = await tool.execute({ filter: 'blocks' });
      expect(blocksResult).toHaveLength(1);
      expect(blocksResult[0].uid).toBe('blocks.pricing-card');
    });

    it('should return empty array for non-existent filter', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'nonexistent' });
      
      expect(result).toEqual([]);
    });

    it('should handle components without displayName', async () => {
      mockClient.contentManagerInit = jest.fn().mockResolvedValue({
        contentTypes: [],
        components: [{
          uid: 'test.component',
          category: 'test',
          attributes: { field: { type: 'string' } }
        }]
      });

      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({});
      
      expect(result).toEqual([{
        uid: 'test.component',
        category: 'test'
      }]);
    });
  });

  describe('list_components with filter', () => {
    it('should find component by exact uid', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'shared.testimonial', attributes: true });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('shared.testimonial');
      expect(result[0].attributes).toBeDefined();
      expect(result[0].attributes.quote.required).toBe(true);
    });

    it('should find component by partial uid', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'testimonial' });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('shared.testimonial');
    });

    it('should find component by displayName', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'Hero Section' });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('sections.hero');
    });

    it('should find multiple components matching filter', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'section' });

      // Should match both 'sections.hero' and 'sections.features' (uid contains 'section')
      // and 'Hero Section' and 'Features Section' (displayName contains 'Section')
      expect(result).toHaveLength(2);
      
      const uids = result.map((c: any) => c.uid);
      expect(uids).toContain('sections.hero');
      expect(uids).toContain('sections.features');
    });

    it('should be case-insensitive', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      
      const results = await Promise.all([
        tool.execute({ filter: 'HERO' }),
        tool.execute({ filter: 'Hero' }),
        tool.execute({ filter: 'hero' })
      ]);

      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].uid).toBe('sections.hero');
      });
    });

    it('should return empty array when no matches', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'nonexistent' });

      expect(result).toEqual([]);
    });

    it('should return full schema when attributes=true', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({ filter: 'testimonial', attributes: true });

      const testimonial = result[0];
      
      // Should have all schema details
      expect(testimonial).toHaveProperty('uid');
      expect(testimonial).toHaveProperty('category');
      expect(testimonial).toHaveProperty('info');
      expect(testimonial).toHaveProperty('attributes');
      
      // Check attributes are complete
      expect(testimonial.attributes).toHaveProperty('quote');
      expect(testimonial.attributes).toHaveProperty('author_name');
      expect(testimonial.attributes.quote.type).toBe('text');
      expect(testimonial.attributes.quote.required).toBe(true);
      expect(testimonial.attributes.author_name.required).toBe(true);
    });

    it('should find components used in dynamic zones', async () => {
      const tool = tools.find(t => t.name === 'list_components')!;
      
      // Search for section components that would be used in dynamic zones
      const result = await tool.execute({ filter: 'sections.' });
      
      expect(result).toHaveLength(2);
      const uids = result.map((c: any) => c.uid);
      expect(uids).toContain('sections.hero');
      expect(uids).toContain('sections.features');
    });
  });

  describe('Token usage optimization', () => {
    it('should significantly reduce tokens compared to full component data', async () => {
      const listTool = tools.find(t => t.name === 'list_components')!;
      const listResult = await listTool.execute({});
      
      const fullResponse = await mockClient.contentManagerInit();
      const fullComponentsJson = JSON.stringify(fullResponse.components);
      const minimalJson = JSON.stringify(listResult);
      
      const fullTokens = Math.ceil(fullComponentsJson.length / 4);
      const minimalTokens = Math.ceil(minimalJson.length / 4);
      
      console.log('Component listing token usage:');
      console.log(`- Full data: ~${fullTokens} tokens`);
      console.log(`- Minimal data: ~${minimalTokens} tokens`);
      console.log(`- Reduction: ${((1 - minimalTokens / fullTokens) * 100).toFixed(2)}%`);
      
      expect(minimalTokens).toBeLessThan(fullTokens * 0.45);  // 58% reduction is good
    });

    it('should provide targeted schema retrieval', async () => {
      const listTool = tools.find(t => t.name === 'list_components')!;
      const result = await listTool.execute({ filter: 'testimonial', attributes: true });
      
      const fullResponse = await mockClient.contentManagerInit();
      const allComponentsTokens = Math.ceil(JSON.stringify(fullResponse.components).length / 4);
      const targetedTokens = Math.ceil(JSON.stringify(result).length / 4);
      
      console.log('Targeted component retrieval:');
      console.log(`- All components: ~${allComponentsTokens} tokens`);
      console.log(`- Single component: ~${targetedTokens} tokens`);
      console.log(`- Reduction: ${((1 - targetedTokens / allComponentsTokens) * 100).toFixed(2)}%`);
      
      expect(targetedTokens).toBeLessThan(allComponentsTokens * 0.30);
    });
  });

  describe('AI workflow integration', () => {
    it('should support discovering components for dynamic zones', async () => {
      console.log('\n=== Component Discovery for Dynamic Zones ===');
      
      // Step 1: List all section components
      const listTool = tools.find(t => t.name === 'list_components')!;
      const sections = await listTool.execute({ filter: 'sections' });
      
      console.log('Available section components:', sections);
      expect(sections).toHaveLength(2);
      
      // Step 2: Get schema for hero section
      const listToolWithAttrs = tools.find(t => t.name === 'list_components')!;
      const heroSchema = await listToolWithAttrs.execute({ filter: 'sections.hero', attributes: true });
      
      console.log('Hero section requires:', 
        Object.entries(heroSchema[0].attributes)
          .filter(([_, attr]: [string, any]) => attr.required)
          .map(([name]) => name)
      );
      
      expect(heroSchema[0].attributes.title.required).toBe(true);
    });

    it('should help AI understand component field requirements', async () => {
      const listTool = tools.find(t => t.name === 'list_components')!;
      const result = await listTool.execute({ filter: 'testimonial', attributes: true });
      
      const component = result[0];
      const requiredFields = Object.entries(component.attributes)
        .filter(([_, attr]: [string, any]) => attr.required)
        .map(([name]) => name);
      
      console.log('\nTestimonial component requirements:');
      console.log('- Required fields:', requiredFields);
      console.log('- Field with underscore:', 'author_name (not authorName)');
      
      expect(requiredFields).toContain('quote');
      expect(requiredFields).toContain('author_name');
      expect(component.attributes.author_name).toBeDefined();
    });
  });
});