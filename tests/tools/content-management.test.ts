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
    mockClient.listContentTypes = jest.fn().mockResolvedValue([
      {
        uid: 'api::article.article',
        pluralApiId: 'articles',
        isLocalized: false
      },
      {
        uid: 'api::i18n-doc.i18n-doc',
        pluralApiId: 'i18n-docs',
        isLocalized: true
      }
    ]);
    
    // Mock adminRequest for default locale fetching
    mockClient.adminRequest = jest.fn().mockResolvedValue([
      { code: 'en', name: 'English', isDefault: true },
      { code: 'fr', name: 'French', isDefault: false }
    ]);
    
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
          pluralApiId: 'articles',
          info: { displayName: 'Article', description: 'Article content type' }
        }
      ];

      mockClient.listContentTypes.mockResolvedValue(mockContentTypes);

      const tool = tools.find(t => t.name === 'list_content_types')!;
      const result = await tool.execute({});

      expect(mockClient.listContentTypes).toHaveBeenCalled();
      expect(result).toEqual({ data: mockContentTypes });
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
      const result = await tool.execute({ pluralApiId: 'articles' });

      expect(mockClient.getEntries).toHaveBeenCalledWith('articles', {});
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
        pluralApiId: 'articles',
        options: JSON.stringify(options)
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('articles', options);
      expect(result).toEqual(mockEntries);
    });

    it('should handle invalid JSON options', async () => {
      const tool = tools.find(t => t.name === 'get_entries')!;
      
      await expect(
        tool.execute({ pluralApiId: 'articles', options: 'invalid json' })
      ).rejects.toThrow('Invalid options JSON');
    });
  });

  describe('get_entry', () => {
    it('should get a specific entry', async () => {
      const mockEntry = {
        id: '123',
        attributes: { title: 'Test Article' }
      };

      mockClient.getEntry.mockResolvedValue(mockEntry);

      const tool = tools.find(t => t.name === 'get_entry')!;
      const result = await tool.execute({ 
        pluralApiId: 'articles',
        documentId: '123'
      });

      expect(mockClient.getEntry).toHaveBeenCalledWith('articles', '123', {});
      expect(result).toEqual(mockEntry);
    });

    it('should get entry with specific locale', async () => {
      const mockEntry = {
        id: '456',
        attributes: { title: 'Article Français' },
        locale: 'fr'
      };

      mockClient.getEntry.mockResolvedValue(mockEntry);

      const tool = tools.find(t => t.name === 'get_entry')!;
      const result = await tool.execute({ 
        pluralApiId: 'i18n-docs',
        documentId: '456',
        locale: 'fr'
      });

      expect(mockClient.getEntry).toHaveBeenCalledWith('i18n-docs', '456', { locale: 'fr' });
      expect(result).toEqual(mockEntry);
    });
  });

  describe('create_entry', () => {
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

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentType: 'api::article.article',
        pluralApiId: 'articles',
        data: entryData
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::article.article',
        'articles',
        entryData,
        undefined,
        undefined
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should create and publish a new entry when publish is true', async () => {
      const mockCreatedEntry = {
        id: '789',
        attributes: { title: 'Published Article', content: 'Content', publishedAt: '2024-01-01T00:00:00Z' }
      };

      const entryData = {
        title: 'Published Article',
        content: 'Content'
      };

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentType: 'api::article.article',
        pluralApiId: 'articles',
        data: entryData,
        publish: true
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::article.article',
        'articles',
        entryData,
        true,
        undefined
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

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentType: 'api::i18n-doc.i18n-doc',
        pluralApiId: 'i18n-docs',
        data: entryData,
        locale: 'fr'
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        'i18n-docs',
        entryData,
        undefined,
        'fr'
      );
      expect(result).toEqual(mockCreatedEntry);
    });

    it('should use default locale for i18n content type when locale not specified', async () => {
      const entryData = { title: 'Default Locale Doc', content: 'Content' };
      const mockCreatedEntry = {
        id: '789',
        attributes: { ...entryData },
        locale: 'en'
      };

      mockClient.createEntry.mockResolvedValue(mockCreatedEntry);

      const tool = tools.find(t => t.name === 'create_entry')!;
      const result = await tool.execute({
        contentType: 'api::i18n-doc.i18n-doc',
        pluralApiId: 'i18n-docs',
        data: entryData
      });

      // Should fetch default locale
      expect(mockClient.adminRequest).toHaveBeenCalledWith('/i18n/locales');
      
      expect(mockClient.createEntry).toHaveBeenCalledWith(
        'api::i18n-doc.i18n-doc',
        'i18n-docs',
        entryData,
        undefined,
        'en' // default locale
      );
      expect(result).toEqual(mockCreatedEntry);
    });
  });

  describe('update_entry', () => {
    it('should update an existing entry', async () => {
      const mockUpdatedEntry = {
        id: '123',
        attributes: { title: 'Updated Title' }
      };

      const updateData = { title: 'Updated Title' };

      mockClient.updateEntry.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        data: updateData
      });

      expect(mockClient.updateEntry).toHaveBeenCalledWith('articles', '123', updateData, undefined);
      expect(result).toEqual(mockUpdatedEntry);
    });

    it('should update entry with specific locale for i18n content type', async () => {
      const mockUpdatedEntry = {
        id: '456',
        attributes: { title: 'Titre Mis à Jour' },
        locale: 'fr'
      };

      const updateData = { title: 'Titre Mis à Jour' };

      mockClient.updateEntry.mockResolvedValue(mockUpdatedEntry);

      const tool = tools.find(t => t.name === 'update_entry')!;
      const result = await tool.execute({
        pluralApiId: 'i18n-docs',
        documentId: '456',
        data: updateData,
        locale: 'fr'
      });

      expect(mockClient.updateEntry).toHaveBeenCalledWith('i18n-docs', '456', updateData, 'fr');
      expect(result).toEqual(mockUpdatedEntry);
    });
  });

  describe('delete_entry', () => {
    it('should delete an entry', async () => {
      mockClient.deleteEntry.mockResolvedValue(undefined);

      const tool = tools.find(t => t.name === 'delete_entry')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('articles', '123', undefined);
      expect(result).toEqual({
        success: true,
        message: 'Entry 123 deleted successfully'
      });
    });

    it('should delete specific locale of i18n entry', async () => {
      mockClient.deleteEntry.mockResolvedValue(undefined);

      const tool = tools.find(t => t.name === 'delete_entry')!;
      const result = await tool.execute({
        pluralApiId: 'i18n-docs',
        documentId: '456',
        locale: 'fr'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('i18n-docs', '456', 'fr');
      expect(result).toEqual({
        success: true,
        message: 'Entry 456 deleted successfully'
      });
    });
  });

  describe('publish_entry', () => {
    it('should publish an entry', async () => {
      const mockPublishedEntry = {
        id: '123',
        attributes: { title: 'Article', publishedAt: '2024-01-01T00:00:00Z' }
      };

      mockClient.publishEntry.mockResolvedValue(mockPublishedEntry);

      const tool = tools.find(t => t.name === 'publish_entry')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123'
      });

      expect(mockClient.publishEntry).toHaveBeenCalledWith('articles', '123', undefined);
      expect(result).toEqual(mockPublishedEntry);
    });

    it('should publish specific locale of i18n entry', async () => {
      const mockPublishedEntry = {
        id: '456',
        attributes: { title: 'Article Français', publishedAt: '2024-01-01T00:00:00Z' },
        locale: 'fr'
      };

      mockClient.publishEntry.mockResolvedValue(mockPublishedEntry);

      const tool = tools.find(t => t.name === 'publish_entry')!;
      const result = await tool.execute({
        pluralApiId: 'i18n-docs',
        documentId: '456',
        locale: 'fr'
      });

      expect(mockClient.publishEntry).toHaveBeenCalledWith('i18n-docs', '456', 'fr');
      expect(result).toEqual(mockPublishedEntry);
    });
  });

  describe('unpublish_entry', () => {
    it('should unpublish an entry', async () => {
      const mockUnpublishedEntry = {
        id: '123',
        attributes: { title: 'Article', publishedAt: null }
      };

      mockClient.unpublishEntry.mockResolvedValue(mockUnpublishedEntry);

      const tool = tools.find(t => t.name === 'unpublish_entry')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123'
      });

      expect(mockClient.unpublishEntry).toHaveBeenCalledWith('articles', '123', undefined);
      expect(result).toEqual(mockUnpublishedEntry);
    });

    it('should unpublish specific locale of i18n entry', async () => {
      const mockUnpublishedEntry = {
        id: '456',
        attributes: { title: 'Article Français', publishedAt: null },
        locale: 'fr'
      };

      mockClient.unpublishEntry.mockResolvedValue(mockUnpublishedEntry);

      const tool = tools.find(t => t.name === 'unpublish_entry')!;
      const result = await tool.execute({
        pluralApiId: 'i18n-docs',
        documentId: '456',
        locale: 'fr'
      });

      expect(mockClient.unpublishEntry).toHaveBeenCalledWith('i18n-docs', '456', 'fr');
      expect(result).toEqual(mockUnpublishedEntry);
    });
  });
});