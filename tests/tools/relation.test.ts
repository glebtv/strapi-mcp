import { StrapiClient } from '../../src/strapi-client';
import { relationTools } from '../../src/tools/relation';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Relation Tools', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof relationTools>;

  beforeEach(() => {
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    tools = relationTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect_relation', () => {
    it('should connect relations with valid IDs', async () => {
      const mockResponse = {
        id: '123',
        attributes: {
          title: 'Article',
          authors: [{ id: 2 }, { id: 3 }]
        }
      };

      mockClient.connectRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'connect_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['doc-id-2', 'doc-id-3']
      });

      expect(mockClient.connectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['doc-id-2', 'doc-id-3']
      );
      expect(result).toEqual(mockResponse);
    });

    it('should accept string document IDs', async () => {
      const mockResponse = { id: '123', attributes: {} };
      mockClient.connectRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'connect_relation')!;
      await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['doc-id-2', 'doc-id-3']
      });

      expect(mockClient.connectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['doc-id-2', 'doc-id-3']
      );
    });

    it('should reject empty relatedIds array', async () => {
      const tool = tools.find(t => t.name === 'connect_relation')!;
      
      await expect(
        tool.execute({
          pluralApiId: 'articles',
          documentId: '123',
          relationField: 'authors',
          relatedIds: []
        })
      ).rejects.toThrow('At least one related ID is required');
    });

    it('should accept any string IDs', async () => {
      const mockResponse = { id: '123', attributes: {} };
      mockClient.connectRelation.mockResolvedValue(mockResponse);
      
      const tool = tools.find(t => t.name === 'connect_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['any-valid-doc-id', 'another-doc-id']
      });
      
      expect(mockClient.connectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['any-valid-doc-id', 'another-doc-id']
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('disconnect_relation', () => {
    it('should disconnect relations with valid IDs', async () => {
      const mockResponse = {
        id: '123',
        attributes: {
          title: 'Article',
          authors: [{ id: 2 }]
        }
      };

      mockClient.disconnectRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'disconnect_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['doc-id-3']
      });

      expect(mockClient.disconnectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['doc-id-3']
      );
      expect(result).toEqual(mockResponse);
    });

    it('should accept any string IDs for disconnect', async () => {
      const mockResponse = { id: '123', attributes: {} };
      mockClient.disconnectRelation.mockResolvedValue(mockResponse);
      
      const tool = tools.find(t => t.name === 'disconnect_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['any-doc-id']
      });
      
      expect(mockClient.disconnectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['any-doc-id']
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('set_relation', () => {
    it('should set relations replacing existing ones', async () => {
      const mockResponse = {
        id: '123',
        attributes: {
          title: 'Article',
          authors: [{ id: 4 }, { id: 5 }]
        }
      };

      mockClient.setRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'set_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['doc-id-4', 'doc-id-5']
      });

      expect(mockClient.setRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        ['doc-id-4', 'doc-id-5']
      );
      expect(result).toEqual(mockResponse);
    });

    it('should allow empty array to clear relations', async () => {
      const mockResponse = {
        id: '123',
        attributes: {
          title: 'Article',
          authors: []
        }
      };

      mockClient.setRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'set_relation')!;
      const result = await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: []
      });

      expect(mockClient.setRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        []
      );
      expect(result).toEqual(mockResponse);
    });
  });
});