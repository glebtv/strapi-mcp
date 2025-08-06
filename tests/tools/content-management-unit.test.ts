import { contentManagementTools } from '../../src/tools/content-management';
import { StrapiClient } from '../../src/strapi-client';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Content Management Tools - Unit Tests', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof contentManagementTools>;

  beforeEach(() => {
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    
    // Mock listContentTypes for i18n checks - updated to match new response format
    mockClient.listContentTypes = jest.fn().mockResolvedValue({
      contentTypes: [
        {
          uid: 'api::article.article',
          pluginOptions: {}
        },
        {
          uid: 'api::i18n-doc.i18n-doc',
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
    
    // Mock getEntries method
    mockClient.getEntries = jest.fn();
    
    // Mock createEntry method
    mockClient.createEntry = jest.fn();
    
    // Mock updateEntryDraft method
    mockClient.updateEntryDraft = jest.fn();
    
    // Mock updateEntryAndPublish method
    mockClient.updateEntryAndPublish = jest.fn();
    
    // Mock deleteEntry method
    mockClient.deleteEntry = jest.fn();
    
    tools = contentManagementTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get_entries tool', () => {
    const getTool = () => tools.find(t => t.name === 'get_entries')!;

    it('should handle options as JSON string', async () => {
      const mockResponse = { data: [], meta: { pagination: { total: 0 } } };
      mockClient.getEntries.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        options: JSON.stringify({ filters: { title: 'test' } })
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('api::article.article', {
        filters: { title: 'test' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle invalid JSON gracefully', async () => {
      await expect(getTool().execute({
        contentTypeUid: 'api::article.article',
        options: 'invalid json'
      })).rejects.toThrow('Invalid options JSON');
    });

    it('should handle empty options', async () => {
      const mockResponse = { data: [], meta: { pagination: { total: 0 } } };
      mockClient.getEntries.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article'
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('api::article.article', {});
      expect(result).toEqual(mockResponse);
    });
  });

  describe('create_draft_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'create_draft_entry')!;

    it('should create draft entry', async () => {
      const mockResponse = { id: 1, title: 'Test' };
      mockClient.createEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        data: { title: 'Test' }
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith('api::article.article', { title: 'Test' }, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should create entry with locale', async () => {
      const mockResponse = { id: 1, title: 'Test' };
      mockClient.createEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        data: { title: 'Test' },
        locale: 'fr'
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith('api::article.article', { title: 'Test' }, 'fr');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update_entry_draft tool', () => {
    const getTool = () => tools.find(t => t.name === 'update_entry_draft')!;

    it('should update entry as draft', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntryDraft.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123',
        data: { title: 'Updated' }
      });

      expect(mockClient.updateEntryDraft).toHaveBeenCalledWith('api::article.article', 'abc123', { title: 'Updated' }, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update_entry_and_publish tool', () => {
    const getTool = () => tools.find(t => t.name === 'update_entry_and_publish')!;

    it('should update and publish entry', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntryAndPublish.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123',
        data: { title: 'Updated' }
      });

      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::article.article', 'abc123', { title: 'Updated' }, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'delete_entry')!;

    it('should delete entry', async () => {
      mockClient.deleteEntry.mockResolvedValue(undefined);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('api::article.article', 'abc123', undefined);
      expect(result).toEqual({ success: true, message: 'Entry abc123 deleted successfully' });
    });
  });

});