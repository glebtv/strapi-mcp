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
    mockClient.listContentTypes = jest.fn().mockResolvedValue({
      contentTypes: [
        {
          uid: 'api::article.article',
          apiID: 'article',
          info: { displayName: 'Article', description: 'Article content type' },
          pluginOptions: {}
        },
        {
          uid: 'api::i18n-doc.i18n-doc',
          apiID: 'i18n-doc',
          pluginOptions: {
            i18n: {
              localized: true
            }
          }
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
    mockClient.updateEntryDraft = jest.fn();
    mockClient.updateEntryAndPublish = jest.fn();
    mockClient.deleteEntry = jest.fn();
    
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
          info: { displayName: 'Article', description: 'Article content type' }
        }
      ];

      mockClient.listContentTypes.mockResolvedValue({ contentTypes: mockContentTypes, components: [] });

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({});

      expect(mockClient.listContentTypes).toHaveBeenCalled();
      expect(result).toEqual({ contentTypes: mockContentTypes, components: [] });
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

  describe('create_draft_entry', () => {
    it('should create a new entry', async () => {
      const mockCreatedEntry = {
        id: '456',
        attributes: { title: 'New Article', content: 'Content' }
      };

      const entryData = {
        title: 'New Article',
        content: 'Content'
      };

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_draft_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        data: entryData
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

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_draft_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        data: entryData,
      });

      expect(mockClient.adminRequest).toHaveBeenCalledWith('/i18n/locales');
      expect(mockClient.createEntry).toHaveBeenCalledWith(
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

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_draft_entry')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        data: entryData,
        locale: 'fr'
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        entryData,
        'fr'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    // Removed duplicate test - this is already covered in the previous test
  });

  describe('update_entry_draft', () => {
    it('should update an existing entry as draft', async () => {
      const mockUpdatedEntry = {
        id: '123',
        attributes: { title: 'Updated Title' }
      };

      const updateData = { title: 'Updated Title' };

      mockClient.updateEntryDraft.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry_draft')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        documentId: '123',
        data: updateData
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

      mockClient.updateEntryDraft.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry_draft')!;
      const result = await tool.execute({
        contentTypeUid: 'api::i18n-doc.i18n-doc',
        documentId: '456',
        data: updateData,
        locale: 'fr'
      });

      expect(mockClient.updateEntryDraft).toHaveBeenCalledWith('api::i18n-doc.i18n-doc', '456', updateData, 'fr');
      expect(result).toEqual(mockUpdatedEntry);
    });
  });

  describe('update_entry_and_publish', () => {
    it('should update and publish an entry', async () => {
      const mockUpdatedEntry = {
        id: '123',
        attributes: { title: 'Published Title', publishedAt: '2024-01-01T00:00:00Z' }
      };

      const updateData = { title: 'Published Title' };

      mockClient.updateEntryAndPublish.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry_and_publish')!;
      const result = await tool.execute({
        contentTypeUid: 'api::article.article',
        documentId: '123',
        data: updateData
      });

      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::article.article', '123', updateData, undefined);
      expect(result).toEqual(mockUpdatedEntry);
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