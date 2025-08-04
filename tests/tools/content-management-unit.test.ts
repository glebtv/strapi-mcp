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
    
    // Mock getContentTypeSchema for validation
    mockClient.getContentTypeSchema = jest.fn().mockResolvedValue({
      uid: 'api::article.article',
      attributes: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'richtext', required: false }
      ]
    });
    
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
        pluralApiId: 'articles',
        options: JSON.stringify({ filters: { title: 'test' } })
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('articles', {
        filters: { title: 'test' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle invalid JSON gracefully', async () => {
      await expect(getTool().execute({
        pluralApiId: 'articles',
        options: 'invalid json'
      })).rejects.toThrow('Invalid options JSON');
    });

    it('should handle empty options', async () => {
      const mockResponse = { data: [], meta: { pagination: { total: 0 } } };
      mockClient.getEntries.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        pluralApiId: 'articles'
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('articles', {});
      expect(result).toEqual(mockResponse);
    });
  });

  describe('create_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'create_entry')!;

    it('should create entry with publish parameter', async () => {
      const mockResponse = { id: 1, title: 'Test' };
      mockClient.createEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentType: 'api::article.article',
        pluralApiId: 'articles',
        data: { title: 'Test' },
        publish: true
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith('api::article.article', 'articles', { title: 'Test' }, true, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should create entry without publish parameter', async () => {
      const mockResponse = { id: 1, title: 'Test' };
      mockClient.createEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentType: 'api::article.article',
        pluralApiId: 'articles',
        data: { title: 'Test' }
      });

      expect(mockClient.createEntry).toHaveBeenCalledWith('api::article.article', 'articles', { title: 'Test' }, undefined, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'update_entry')!;

    it('should update entry', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        pluralApiId: 'articles',
        documentId: 'abc123',
        data: { title: 'Updated' }
      });

      expect(mockClient.updateEntry).toHaveBeenCalledWith('articles', 'abc123', { title: 'Updated' }, undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'delete_entry')!;

    it('should delete entry', async () => {
      const mockResponse = { success: true, message: 'Entry abc123 deleted successfully' };
      mockClient.deleteEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        pluralApiId: 'articles',
        documentId: 'abc123'
      });

      expect(mockClient.deleteEntry).toHaveBeenCalledWith('articles', 'abc123', undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('publish_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'publish_entry')!;

    it('should publish entry', async () => {
      const mockResponse = { publishedAt: '2024-01-01' };
      mockClient.publishEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        pluralApiId: 'articles',
        documentId: 'abc123'
      });

      expect(mockClient.publishEntry).toHaveBeenCalledWith('articles', 'abc123', undefined);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('unpublish_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'unpublish_entry')!;

    it('should unpublish entry', async () => {
      const mockResponse = { publishedAt: null };
      mockClient.unpublishEntry.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        pluralApiId: 'articles',
        documentId: 'abc123'
      });

      expect(mockClient.unpublishEntry).toHaveBeenCalledWith('articles', 'abc123', undefined);
      expect(result).toEqual(mockResponse);
    });
  });
});