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
    
    // Mock contentManagerInit for content type checks
    mockClient.contentManagerInit = jest.fn().mockResolvedValue({
      contentTypes: [
        {
          uid: 'api::article.article',
          pluginOptions: {},
          options: {
            draftAndPublish: true  // Ensure draftAndPublish is enabled
          }
        },
        {
          uid: 'api::i18n-doc.i18n-doc',
          pluginOptions: {
            i18n: {
              localized: true
            }
          },
          options: {
            draftAndPublish: true  // Ensure draftAndPublish is enabled
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
        filters: { title: 'test' }
      });

      expect(mockClient.getEntries).toHaveBeenCalledWith('api::article.article', {
        filters: { title: 'test' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should reject invalid filter types', async () => {
      // The schema should reject non-object filters
      const tool = getTool();
      await expect(tool.inputSchema.parseAsync({
        contentTypeUid: 'api::article.article',
        filters: 'invalid string instead of object'
      })).rejects.toThrow();
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

  describe('create_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'create_entry')!;

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

  describe('update_entry tool', () => {
    const getTool = () => tools.find(t => t.name === 'update_entry')!;

    it('should update entry as draft when publish=false', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntryDraft.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123',
        data: { title: 'Updated' },
        publish: false
      });

      expect(mockClient.updateEntryDraft).toHaveBeenCalledWith('api::article.article', 'abc123', { title: 'Updated' }, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should update and publish entry when publish=true', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntryAndPublish.mockResolvedValue(mockResponse);

      const result = await getTool().execute({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123',
        data: { title: 'Updated' },
        publish: true
      });

      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::article.article', 'abc123', { title: 'Updated' }, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should default to publish=true', async () => {
      const mockResponse = { id: 1, title: 'Updated' };
      mockClient.updateEntryAndPublish.mockResolvedValue(mockResponse);

      // Test the actual input schema default behavior
      const tool = getTool();
      const parsedArgs = tool.inputSchema.parse({
        contentTypeUid: 'api::article.article',
        documentId: 'abc123',
        data: { title: 'Updated' }
        // publish not specified
      });
      
      // Verify the default was applied
      expect(parsedArgs.publish).toBe(true);
      
      // Now execute with parsed args
      const result = await tool.execute(parsedArgs);

      expect(result).toEqual(mockResponse);
      expect(mockClient.updateEntryAndPublish).toHaveBeenCalledWith('api::article.article', 'abc123', { title: 'Updated' }, undefined);
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

  describe('error handling', () => {
    it('should handle contentManagerInit failure gracefully', async () => {
      // Mock contentManagerInit to return undefined (server down scenario)
      mockClient.contentManagerInit.mockResolvedValue(undefined as any);

      const getTool = () => tools.find(t => t.name === 'list_content_types')!;
      
      await expect(getTool().execute({}))
        .rejects.toThrow('Failed to retrieve content types from Strapi. The server may be down or unreachable.');
    });

    it('should handle contentManagerInit error with custom message', async () => {
      // Mock contentManagerInit to throw an error
      mockClient.contentManagerInit.mockRejectedValue(new Error('Connection refused'));

      const getTool = () => tools.find(t => t.name === 'list_content_types')!;
      
      await expect(getTool().execute({}))
        .rejects.toThrow('Connection refused');
    });
  });

});