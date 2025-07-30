import { StrapiClient } from '../../src/strapi-client';
import { contentTypeBuilderTools } from '../../src/tools/content-type-builder';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Content Type Builder Tools', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof contentTypeBuilderTools>;

  beforeEach(() => {
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    tools = contentTypeBuilderTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create_content_type', () => {
    it('should create a new content type', async () => {
      const mockResponse = {
        uid: 'api::product.product',
        message: 'Content type created successfully'
      };

      const contentTypeData = {
        displayName: 'Product',
        singularName: 'product',
        pluralName: 'products',
        kind: 'collectionType' as const,
        description: 'Product content type',
        draftAndPublish: true,
        attributes: {
          name: { type: 'string', required: true },
          price: { type: 'decimal', required: true },
          description: { type: 'text' }
        }
      };

      mockClient.createContentType.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'create_content_type')!;
      const result = await tool.execute(contentTypeData);

      expect(mockClient.createContentType).toHaveBeenCalledWith(contentTypeData);
      expect(result).toEqual(mockResponse);
    });

    it('should create content type with minimal fields', async () => {
      const mockResponse = { uid: 'api::simple.simple' };

      const contentTypeData = {
        displayName: 'Simple',
        singularName: 'simple',
        pluralName: 'simples',
        attributes: {
          title: { type: 'string' }
        }
      };

      mockClient.createContentType.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'create_content_type')!;
      const result = await tool.execute(contentTypeData);

      expect(mockClient.createContentType).toHaveBeenCalledWith(contentTypeData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('update_content_type', () => {
    it('should update content type attributes', async () => {
      const mockResponse = {
        uid: 'api::article.article',
        message: 'Content type updated successfully'
      };

      const updateData = {
        contentType: 'api::article.article',
        attributes: {
          featured: { type: 'boolean', default: false },
          views: { type: 'integer', default: 0 }
        }
      };

      mockClient.updateContentType.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'update_content_type')!;
      const result = await tool.execute(updateData);

      expect(mockClient.updateContentType).toHaveBeenCalledWith(
        'api::article.article',
        updateData.attributes,
        { pluginOptions: undefined }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete_content_type', () => {
    it('should delete a content type', async () => {
      const mockResponse = {
        message: 'Content type deleted successfully'
      };

      mockClient.deleteContentType.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'delete_content_type')!;
      const result = await tool.execute({
        contentType: 'api::deprecated.deprecated'
      });

      expect(mockClient.deleteContentType).toHaveBeenCalledWith('api::deprecated.deprecated');
      expect(result).toEqual(mockResponse);
    });
  });
});