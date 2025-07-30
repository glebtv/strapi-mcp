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
        relatedIds: [2, 3]
      });

      expect(mockClient.connectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        [2, 3]
      );
      expect(result).toEqual(mockResponse);
    });

    it('should convert string IDs to numbers', async () => {
      const mockResponse = { id: '123', attributes: {} };
      mockClient.connectRelation.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'connect_relation')!;
      await tool.execute({
        pluralApiId: 'articles',
        documentId: '123',
        relationField: 'authors',
        relatedIds: ['2', '3']
      });

      expect(mockClient.connectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        [2, 3]
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

    it('should reject invalid IDs', async () => {
      const tool = tools.find(t => t.name === 'connect_relation')!;
      
      await expect(
        tool.execute({
          pluralApiId: 'articles',
          documentId: '123',
          relationField: 'authors',
          relatedIds: ['invalid', '0', '-1']
        })
      ).rejects.toThrow('Invalid related ID');
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
        relatedIds: [3]
      });

      expect(mockClient.disconnectRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        [3]
      );
      expect(result).toEqual(mockResponse);
    });

    it('should validate IDs before disconnecting', async () => {
      const tool = tools.find(t => t.name === 'disconnect_relation')!;
      
      await expect(
        tool.execute({
          pluralApiId: 'articles',
          documentId: '123',
          relationField: 'authors',
          relatedIds: ['not-a-number']
        })
      ).rejects.toThrow('Invalid related ID');
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
        relatedIds: [4, 5]
      });

      expect(mockClient.setRelation).toHaveBeenCalledWith(
        'articles',
        '123',
        'authors',
        [4, 5]
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