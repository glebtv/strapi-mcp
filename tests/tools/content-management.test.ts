import { StrapiClient } from '../../src/strapi-client';
import { contentManagementTools } from '../../src/tools/content-management';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Content Management Tools', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof contentManagementTools>;

  beforeEach(() => {
    // Create mock client
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    
    // Mock listContentTypes for i18n checks
    mockClient.contentManagerInit = jest.fn().mockResolvedValue({
      contentTypes: [
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { displayName: 'Article', description: 'Article content type' },
          pluginOptions: {},
          options: { draftAndPublish: true }  // Explicitly set draftAndPublish
        },
        {
          uid: 'api::i18n-doc.i18n-doc',
          apiID: 'i18n-doc',
          pluginOptions: {
            i18n: {
              localized: true
            }
          },
          options: { draftAndPublish: true }  // Explicitly set draftAndPublish
        }
      ],
      components: []
    });
    
    // Mock adminRequest for default locale fetching
    mockClient.adminRequest = jest.fn().mockResolvedValue([
      { code: 'en', name: 'English', isDefault: true },
      { code: 'fr', name: 'French', isDefault: false }
    ]);
    
    // Mock all needed methods
    mockClient.getEntries = jest.fn();
    mockClient.createEntry = jest.fn();
    mockClient.createPublishedEntry = jest.fn();
    mockClient.createLocalizedDraft = jest.fn();
    mockClient.createAndPublishLocalizedEntry = jest.fn();
    mockClient.publishLocalizedEntry = jest.fn();
    mockClient.updateEntryDraft = jest.fn();
    mockClient.updateEntryAndPublish = jest.fn();
    mockClient.deleteEntry = jest.fn();
    mockClient.publishEntries = jest.fn();
    mockClient.unpublishEntries = jest.fn();
    
    // Get tools
    tools = contentManagementTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list_content_types', () => {
    it('should list all content types', async () => {
      const mockContentTypes = [
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { 
            displayName: 'Article', 
            description: 'Article content type',
            pluralName: 'articles' 
          },
          attributes: { 
            title: { type: 'string' },
            content: { type: 'text' }
          }
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: mockContentTypes, components: [] });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Test with attributes=false (default)
      const result = await tool.execute({ attributes: false });
      expect(mockClient.contentManagerInit).toHaveBeenCalled();
      
      // Should return minimal data (uid, apiID, pluralName only)
      const expectedMinimal = mockContentTypes.map(ct => ({
        uid: ct.uid,
        apiID: ct.apiID,
        pluralApiId: ct.info.pluralName
      }));
      expect(result).toEqual(expectedMinimal);
      
      // Test with attributes=true
      const resultWithAttrs = await tool.execute({ attributes: true });
      expect(resultWithAttrs).toEqual(mockContentTypes);
    });

    it('should filter content types when filter is provided', async () => {
      const mockContentTypes = [
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { pluralName: 'articles' },
          attributes: {}
        },
        {
          uid: 'api::post.post',
          apiID: 'post',
          info: { pluralName: 'posts' },
          attributes: {}
        },
        {
          uid: 'api::page.page',
          apiID: 'page',
          info: { pluralName: 'pages' },
          attributes: {}
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: mockContentTypes, components: [] });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Test filtering by apiID
      const result = await tool.execute({ filter: 'post' });
      expect(result).toHaveLength(1);
      expect(result[0].apiID).toBe('post');
      
      // Test filtering by uid
      const resultUid = await tool.execute({ filter: 'api::page' });
      expect(resultUid).toHaveLength(1);
      expect(resultUid[0].uid).toBe('api::page.page');
      
      // Test filtering by pluralName
      const resultPlural = await tool.execute({ filter: 'articles' });
      expect(resultPlural).toHaveLength(1);
      expect(resultPlural[0].apiID).toBe('article');
    });

    it('should filter by kind parameter', async () => {
      const mockContentTypes = [
        // User content types
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { pluralName: 'articles' },
          attributes: {}
        },
        {
          uid: 'api::page.page',
          apiID: 'page',
          info: { pluralName: 'pages' },
          attributes: {}
        },
        // System content types
        {
          uid: 'plugin::users-permissions.user',
          apiID: 'user',
          info: { pluralName: 'users' },
          attributes: {}
        },
        {
          uid: 'admin::permission',
          apiID: 'permission',
          info: { pluralName: 'permissions' },
          attributes: {}
        },
        {
          uid: 'strapi::core-store',
          apiID: 'core-store',
          info: { pluralName: 'core-stores' },
          attributes: {}
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: mockContentTypes, components: [] });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Test kind='user' (default)
      const userResult = await tool.execute({ kind: 'user' });
      expect(userResult).toHaveLength(2);
      userResult.forEach((ct: any) => {
        expect(ct.uid).toMatch(/^api::/);
      });
      
      // Test kind='system'
      const systemResult = await tool.execute({ kind: 'system' });
      expect(systemResult).toHaveLength(3);
      systemResult.forEach((ct: any) => {
        expect(ct.uid).toMatch(/^(plugin::|admin::|strapi::)/);
      });
      
      // Test kind='all'
      const allResult = await tool.execute({ kind: 'all' });
      expect(allResult).toHaveLength(5);
    });

    it('should combine kind and filter parameters', async () => {
      const mockContentTypes = [
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { pluralName: 'articles' },
          attributes: {}
        },
        {
          uid: 'api::user.user',
          apiID: 'user',
          info: { pluralName: 'users' },
          attributes: {}
        },
        {
          uid: 'plugin::users-permissions.user',
          apiID: 'user',
          info: { pluralName: 'users' },
          attributes: {}
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: mockContentTypes, components: [] });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      
      // Filter for 'user' within kind='user' content types
      const result = await tool.execute({ kind: 'user', filter: 'user' });
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('api::user.user');
    });
  });

  describe('list_components', () => {
    it('should list all components', async () => {
      const mockComponents = [
        {
          uid: 'shared.seo',
          apiID: 'seo',
          category: 'shared',
          info: { displayName: 'SEO' },
          attributes: { metaTitle: { type: 'string' } }
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: [], components: mockComponents });

      const tool = tools.find(t => t.name === 'list_components')!;
      
      // Test with attributes=false (default)
      const result = await tool.execute({ attributes: false });
      const expectedWithoutAttrs = mockComponents.map(({ attributes, ...rest }) => rest);
      expect(result).toEqual(expectedWithoutAttrs);
      
      // Test with attributes=true
      const resultWithAttrs = await tool.execute({ attributes: true });
      expect(resultWithAttrs).toEqual(mockComponents);
    });

    it('should filter components when filter is provided', async () => {
      const mockComponents = [
        {
          uid: 'shared.seo',
          apiID: 'seo',
          category: 'shared',
          info: { displayName: 'SEO' },
          attributes: {}
        },
        {
          uid: 'shared.button',
          apiID: 'button',
          category: 'shared',
          info: { displayName: 'Button' },
          attributes: {}
        },
        {
          uid: 'sections.hero',
          apiID: 'hero',
          category: 'sections',
          info: { displayName: 'Hero' },
          attributes: {}
        }
      ];

      mockClient.contentManagerInit.mockResolvedValue({ contentTypes: [], components: mockComponents });

      const tool = tools.find(t => t.name === 'list_components')!;
      
      // Test filtering by category
      const result = await tool.execute({ filter: 'sections' });
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('sections');
      
      // Test filtering by apiID
      const resultApi = await tool.execute({ filter: 'button' });
      expect(resultApi).toHaveLength(1);
      expect(resultApi[0].apiID).toBe('button');
      
      // Test filtering by displayName
      const resultDisplay = await tool.execute({ filter: 'seo' });
      expect(resultDisplay).toHaveLength(1);
      expect(resultDisplay[0].info.displayName).toBe('SEO');
    });
  });

  describe('get_entries', () => {
    it('should get entries with default options', async () => {
      const mockEntries = {
        data: [{ id: 1, attributes: { title: 'Test' } }],
        meta: { pagination: { page: 1, pageSize: 25 } }
      };

      mockClient.getEntries.mockResolvedValue(mockEntries);

      const tool = tools.find(t => t.name === 'get_entries')!;
      const result = await tool.execute({ contentTypeUid: 'api::article.article' });

      expect(mockClient.getEntries).toHaveBeenCalledWith('api::article.article', {});
      expect(result).toEqual(mockEntries);
    });

    it('should get entries with parsed options', async () => {
      const mockEntries = {
        data: [{ id: 1, attributes: { title: 'Filtered' } }],
        meta: { pagination: { page: 1, pageSize: 10 } }
      };

      const options = {
        filters: { title: { $contains: 'test' } },
        pagination: { page: 1, pageSize: 10 },
        sort: ['title:asc']
      };

      mockClient.getEntries.mockResolvedValue(mockEntries);

      const tool = tools.find(t => t.name === 'get_entries')!;
      const result = await tool.execute({ 
        contentTypeUid: 'api::article.article',
        options: JSON.stringify(options)
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('api::article.article', options);
      expect(result).toEqual(mockEntries);
    });

    it('should handle invalid JSON options', async () => {
      const tool = tools.find(t => t.name === 'get_entries')!;
      
      await expect(
        tool.execute({ contentTypeUid: 'api::article.article', options: 'invalid json' })
      ).rejects.toThrow('Invalid options JSON');
    });
  });

  describe('create_entry', () => {
    it('should create and publish entry by default', async () => {
      const mockCreatedEntry = {
        id: '456',
        attributes: { title: 'New Article', content: 'Content' }
      };

      const entryData = {
        title: 'New Article',
        content: 'Content'
      };

      mockClient.createPublishedEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        data: entryData,
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.createPublishedEntry).toHaveBeenCalledWith(
        'api::article.article',
        entryData,
        undefined
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should create draft entry when publish is false', async () => {
      const mockCreatedEntry = {
        id: '456',
        attributes: { title: 'Draft Article', content: 'Content' }
      };

      const entryData = {
        title: 'Draft Article',
        content: 'Content'
      };

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        data: entryData,
        publish: false
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::article.article',
        entryData,
        undefined
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should create entry with default locale for i18n content type', async () => {
      const mockCreatedEntry = {
        id: '789',
        attributes: { title: 'i18n Article', content: 'Content' },
        locale: 'en'
      };

      const entryData = {
        title: 'i18n Article',
        content: 'Content'
      };

      mockClient.createPublishedEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        data: entryData,
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.adminRequest).toHaveBeenCalledWith('/i18n/locales');
      expect(mockClient.createPublishedEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        entryData,
        'en'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should create entry with specific locale for i18n content type', async () => {
      const entryData = { title: 'Nouveau Document', content: 'Contenu ici' };
      const mockCreatedEntry = {
        id: '456',
        attributes: { ...entryData },
        locale: 'fr'
      };

      mockClient.createPublishedEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        data: entryData,
        locale: 'fr',
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.createPublishedEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        entryData,
        'fr'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should handle content types with draftAndPublish disabled', async () => {
      const mockCreatedEntry = {
        id: '123',
        attributes: { title: 'No Draft Article' }
      };

      const entryData = { title: 'No Draft Article' };

      // Mock content type with draftAndPublish disabled
      mockClient.contentManagerInit.mockResolvedValue({
        contentTypes: [
          {
            uid: 'api::no-draft.no-draft',
            apiID: 'no-draft',
            options: { draftAndPublish: false }
          }
        ],
        components: []
      });

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::no-draft.no-draft',
        data: entryData,
        publish: true // Should be ignored when draftAndPublish is disabled
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::no-draft.no-draft',
        entryData,
        undefined
      );
      expect(result).toEqual(mockCreatedEntry);
    });
  });

  describe('update_entry', () => {
    it('should update and publish entry by default', async () => {
      const mockUpdatedEntry = {
        id: '123',
        attributes: { title: 'Published Title', publishedAt: '2024-01-01T00:00:00Z' }
      };

      const updateData = { title: 'Published Title' };

      mockClient.updateEntryAndPublish.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        documentId: '123',
        data: updateData,
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::article.article', '123', updateData, undefined);
      expect(result).toEqual(mockUpdatedEntry);
    });

    it('should update as draft when publish is false', async () => {
      const mockUpdatedEntry = {
        id: '123',
        attributes: { title: 'Draft Title' }
      };

      const updateData = { title: 'Draft Title' };

      mockClient.updateEntryDraft.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        documentId: '123',
        data: updateData,
        publish: false
      });

      expect(mockClient.updateEntryDraft).toHaveBeenCalledWith('api::article.article', '123', updateData, undefined);
      expect(result).toEqual(mockUpdatedEntry);
    });

    it('should update entry with specific locale for i18n content type', async () => {
      const mockUpdatedEntry = {
        id: '456',
        attributes: { title: 'Titre Mis à Jour' },
        locale: 'fr'
      };

      const updateData = { title: 'Titre Mis à Jour' };

      mockClient.updateEntryAndPublish.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        documentId: '456',
        data: updateData,
        locale: 'fr',
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::i18n-doc.i18n-doc', '456', updateData, 'fr');
      expect(result).toEqual(mockUpdatedEntry);
    });

    it('should handle content types with draftAndPublish disabled', async () => {
      const mockUpdatedEntry = {
        id: '789',
        attributes: { title: 'No Draft Update' }
      };

      const updateData = { title: 'No Draft Update' };

      // Mock content type with draftAndPublish disabled
      mockClient.contentManagerInit.mockResolvedValue({
        contentTypes: [
          {
            uid: 'api::no-draft.no-draft',
            apiID: 'no-draft',
            options: { draftAndPublish: false }
          }
        ],
        components: []
      });

      mockClient.updateEntryDraft.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::no-draft.no-draft',
        documentId: '789',
        data: updateData,
        publish: true  // Should be ignored when draftAndPublish is disabled
      });

      expect(mockClient.updateEntryDraft).toHaveBeenCalledWith(
        'api::no-draft.no-draft',
        '789',
        updateData,
        undefined
      );
      expect(result).toEqual(mockUpdatedEntry);
    });
  });

  describe('create_localized_entry', () => {
    it('should create and publish localized entry by default', async () => {
      const mockCreatedEntry = {
        id: 'loc123',
        attributes: { title: 'Localized Title' },
        locale: 'fr'
      };

      const entryData = { title: 'Localized Title' };

      mockClient.createAndPublishLocalizedEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_localized_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        documentId: 'doc123',
        data: entryData,
        locale: 'fr',
        publish: true  // Explicitly set to test default behavior
      });

      expect(mockClient.createAndPublishLocalizedEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        'doc123',
        entryData,
        'fr'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should create localized draft when publish is false', async () => {
      const mockCreatedEntry = {
        id: 'loc456',
        attributes: { title: 'Draft Localized' },
        locale: 'es'
      };

      const entryData = { title: 'Draft Localized' };

      mockClient.createLocalizedDraft.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_localized_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        documentId: 'doc456',
        data: entryData,
        locale: 'es',
        publish: false
      });

      expect(mockClient.createLocalizedDraft).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        'doc456',
        entryData,
        'es'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should throw error if content type is not i18n-enabled', async () => {
      const tool = tools.find(t => t.name === 'create_localized_entry')!;
      
      await expect(
        tool.execute({
          contentTypeUid: 'api::article.article',  // Not i18n-enabled in mock
          documentId: 'doc789',
          data: { title: 'Test' },
          locale: 'fr'
        })
      ).rejects.toThrow('Content type api::article.article is not i18n-enabled');
    });

    it('should handle content types with draftAndPublish disabled', async () => {
      const mockCreatedEntry = {
        id: 'loc999',
        attributes: { title: 'No Draft Localized' },
        locale: 'de'
      };

      const entryData = { title: 'No Draft Localized' };

      // Mock content type with i18n enabled but draftAndPublish disabled
      mockClient.contentManagerInit.mockResolvedValue({
        contentTypes: [
          {
            uid: 'api::i18n-no-draft.i18n-no-draft',
            apiID: 'i18n-no-draft',
            pluginOptions: {
              i18n: { localized: true }
            },
            options: { draftAndPublish: false }
          }
        ],
        components: []
      });

      mockClient.createLocalizedDraft.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_localized_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-no-draft.i18n-no-draft',
        documentId: 'doc999',
        data: entryData,
        locale: 'de',
        publish: true  // Should be ignored when draftAndPublish is disabled
      });

      expect(mockClient.createLocalizedDraft).toHaveBeenCalledWith(
        'api::i18n-no-draft.i18n-no-draft',
        'doc999',
        entryData,
        'de'
      );
      expect(result).toEqual(mockCreatedEntry);
    });
  });

  describe('delete_entry', () => {
    it('should delete an entry', async () => {
      mockClient.deleteEntry.mockResolvedValue(undefined);

      const tool = tools.find(t => t.name === 'delete_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        documentId: '123'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('api::article.article', '123', undefined);
      expect(result).toEqual({
        success: true,
        message: 'Entry 123 deleted successfully'
      });
    });

    it('should delete specific locale of i18n entry', async () => {
      mockClient.deleteEntry.mockResolvedValue(undefined);

      const tool = tools.find(t => t.name === 'delete_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        documentId: '456',
        locale: 'fr'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('api::i18n-doc.i18n-doc', '456', 'fr');
      expect(result).toEqual({
        success: true,
        message: 'Entry 456 deleted successfully'
      });
    });
  });

});