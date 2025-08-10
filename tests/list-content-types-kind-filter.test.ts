// describe, it, expect, beforeEach are global in Jest
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('list_content_types with kind filter', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  const mockContentTypes = [
    // User-created content types (api::)
    {
      uid: 'api::article.article',
      apiID: 'article',
      pluralApiId: 'articles',
      info: { displayName: 'Article' }
    },
    {
      uid: 'api::project.project',
      apiID: 'project',
      pluralApiId: 'projects',
      info: { displayName: 'Project' }
    },
    {
      uid: 'api::landing-page.landing-page',
      apiID: 'landing-page',
      pluralApiId: 'landing-pages',
      info: { displayName: 'Landing Page' }
    },
    // System/plugin content types
    {
      uid: 'plugin::users-permissions.user',
      apiID: 'user',
      pluralApiId: 'users',
      info: { displayName: 'User' }
    },
    {
      uid: 'plugin::upload.file',
      apiID: 'file',
      pluralApiId: 'files',
      info: { displayName: 'File' }
    },
    {
      uid: 'admin::permission',
      apiID: 'permission',
      pluralApiId: 'permissions',
      info: { displayName: 'Permission' }
    },
    {
      uid: 'admin::user',
      apiID: 'user',
      pluralApiId: 'users',
      info: { displayName: 'Admin User' }
    },
    {
      uid: 'strapi::core-store',
      apiID: 'core-store',
      pluralApiId: 'core-stores',
      info: { displayName: 'Core Store' }
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

  describe('kind filter parameter', () => {
    it('should return only user content types by default', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({});

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { uid: 'api::article.article', apiID: 'article', pluralApiId: 'articles' },
        { uid: 'api::project.project', apiID: 'project', pluralApiId: 'projects' },
        { uid: 'api::landing-page.landing-page', apiID: 'landing-page', pluralApiId: 'landing-pages' }
      ]);
    });

    it('should return only user content types when kind="user"', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'user' });

      expect(result).toHaveLength(3);
      result.forEach((ct: any) => {
        expect(ct.uid).toMatch(/^api::/);
      });
    });

    it('should return only system content types when kind="system"', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'system' });

      expect(result).toHaveLength(5);
      result.forEach((ct: any) => {
        expect(ct.uid).toMatch(/^(plugin::|admin::|strapi::)/);
      });

      const uids = result.map((ct: any) => ct.uid);
      expect(uids).toContain('plugin::users-permissions.user');
      expect(uids).toContain('plugin::upload.file');
      expect(uids).toContain('admin::permission');
      expect(uids).toContain('admin::user');
      expect(uids).toContain('strapi::core-store');
    });

    it('should return all content types when kind="all"', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({ kind: 'all' });

      expect(result).toHaveLength(8);
      
      // Should include both user and system types
      const uids = result.map((ct: any) => ct.uid);
      expect(uids).toContain('api::article.article');
      expect(uids).toContain('plugin::users-permissions.user');
      expect(uids).toContain('admin::permission');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content types array', async () => {
      mockClient.contentManagerInit = jest.fn().mockResolvedValue({
        contentTypes: [],
        components: []
      });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      const results = await Promise.all([
        tool.execute({ kind: 'user' }),
        tool.execute({ kind: 'system' }),
        tool.execute({ kind: 'all' })
      ]);

      results.forEach(result => {
        expect(result).toEqual([]);
      });
    });

    it('should handle content types with unusual prefixes', async () => {
      const unusualTypes = [
        {
          uid: 'api::test.test',
          apiID: 'test',
          pluralApiId: 'tests'
        },
        {
          uid: 'custom::something.something',
          apiID: 'something',
          pluralApiId: 'somethings'
        },
        {
          uid: 'weird-prefix::item.item',
          apiID: 'item',
          pluralApiId: 'items'
        }
      ];

      mockClient.contentManagerInit = jest.fn().mockResolvedValue({
        contentTypes: unusualTypes,
        components: []
      });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // User filter should only return api:: prefixed
      const userResult = await tool.execute({ kind: 'user' });
      expect(userResult).toHaveLength(1);
      expect(userResult[0].uid).toBe('api::test.test');

      // System filter should return none (no plugin::, admin::, strapi::)
      const systemResult = await tool.execute({ kind: 'system' });
      expect(systemResult).toHaveLength(0);

      // All should return everything
      const allResult = await tool.execute({ kind: 'all' });
      expect(allResult).toHaveLength(3);
    });
  });

  describe('use cases for AI agents', () => {
    it('should help AI focus on user content for typical operations', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Default behavior - AI gets only user content types
      const result = await tool.execute({});
      
      console.log('User content types for AI to work with:');
      result.forEach((ct: any) => {
        console.log(`- ${ct.apiID} (${ct.uid})`);
      });

      // AI shouldn't see system types by default
      const uids = result.map((ct: any) => ct.uid);
      expect(uids).not.toContain('plugin::users-permissions.user');
      expect(uids).not.toContain('admin::permission');
    });

    it('should allow AI to access system types when needed', async () => {
      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Scenario: AI needs to work with user permissions
      const systemTypes = await tool.execute({ kind: 'system' });
      
      const userPermissionType = systemTypes.find(
        (ct: any) => ct.uid === 'plugin::users-permissions.user'
      );
      
      expect(userPermissionType).toBeDefined();
      console.log('AI can access system types like:', userPermissionType);
    });

    it('should significantly reduce token usage by filtering out system types', async () => {
      // Create a more realistic scenario with many system types
      const manySystemTypes = Array.from({ length: 30 }, (_, i) => ({
        uid: `plugin::system${i}.type${i}`,
        apiID: `type${i}`,
        pluralApiId: `type${i}s`,
        info: { displayName: `System Type ${i}` }
      }));

      const userTypes = Array.from({ length: 10 }, (_, i) => ({
        uid: `api::content${i}.content${i}`,
        apiID: `content${i}`,
        pluralApiId: `content${i}s`,
        info: { displayName: `Content ${i}` }
      }));

      mockClient.contentManagerInit = jest.fn().mockResolvedValue({
        contentTypes: [...manySystemTypes, ...userTypes],
        components: []
      });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      const userResult = await tool.execute({ kind: 'user' });
      const allResult = await tool.execute({ kind: 'all' });
      
      const userTokens = JSON.stringify(userResult).length / 4;
      const allTokens = JSON.stringify(allResult).length / 4;
      
      console.log(`\nToken usage with kind filter:`);
      console.log(`- User types only: ~${Math.ceil(userTokens)} tokens (${userResult.length} types)`);
      console.log(`- All types: ~${Math.ceil(allTokens)} tokens (${allResult.length} types)`);
      console.log(`- Reduction: ${((1 - userTokens / allTokens) * 100).toFixed(2)}%`);
      
      expect(userResult).toHaveLength(10);
      expect(allResult).toHaveLength(40);
    });
  });
});