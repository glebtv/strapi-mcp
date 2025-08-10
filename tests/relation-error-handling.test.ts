// Test globals (describe, it, expect, beforeEach) are provided by Jest
import { RelationOperations } from '../src/client/relation-operations.js';

describe('Relation error handling improvements', () => {
  let relationOps: RelationOperations;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      contentOps: {
        updateEntryDraft: jest.fn()
      },
      contentManagerInit: jest.fn().mockResolvedValue({
        contentTypes: [
          {
            uid: 'api::article.article',
            attributes: {
              categories: { type: 'relation' },
              author: { type: 'relation' },
              tags: { type: 'relation' }
            }
          },
          {
            uid: 'api::project.project',
            attributes: {
              technologies: { type: 'relation' },
              team_members: { type: 'relation' }
            }
          }
        ]
      })
    };
    relationOps = new RelationOperations(mockClient);
  });

  describe('connectRelation error handling', () => {
    it('should throw clear error when no related IDs provided', async () => {
      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'author', [])
      ).rejects.toThrow('No related IDs provided for connecting relation field "author"');
    });

    it('should throw clear error for invalid relation IDs', async () => {
      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'author', [123 as any])
      ).rejects.toThrow('Invalid relation ID: "123". Relations require document IDs (strings), not numeric IDs.');
    });

    it('should enhance "Invalid relations" error from Strapi', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Invalid relations')
      );

      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'categories', ['cat1', 'cat2'])
      ).rejects.toThrow(
        'Invalid relations for field "categories" in api::article.article.\n' +
        'Attempted to connect: cat1, cat2\n' +
        'Make sure: 1) The field name is correct, 2) The document IDs exist, 3) The relation type allows these connections'
      );
    });

    it('should pass through other errors unchanged', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'author', ['auth1'])
      ).rejects.toThrow('Network error');
    });

    it('should handle valid document IDs correctly', async () => {
      mockClient.contentOps.updateEntryDraft.mockResolvedValue({ success: true });

      const result = await relationOps.connectRelation(
        'api::article.article',
        'doc123',
        'author',
        ['abc123def456']
      );

      expect(mockClient.contentOps.updateEntryDraft).toHaveBeenCalledWith(
        'api::article.article',
        'doc123',
        {
          author: {
            connect: [{ documentId: 'abc123def456' }]
          }
        }
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('disconnectRelation error handling', () => {
    it('should throw clear error when no related IDs provided', async () => {
      await expect(
        relationOps.disconnectRelation('api::article.article', 'doc123', 'tags', [])
      ).rejects.toThrow('No related IDs provided for disconnecting from relation field "tags"');
    });

    it('should throw clear error for invalid relation IDs', async () => {
      await expect(
        relationOps.disconnectRelation('api::article.article', 'doc123', 'tags', [null as any, undefined as any])
      ).rejects.toThrow('Invalid relation ID: "null". Relations require document IDs (strings), not numeric IDs.');
    });

    it('should enhance "Invalid relations" error', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Invalid relations')
      );

      await expect(
        relationOps.disconnectRelation('api::project.project', 'proj1', 'technologies', ['tech1'])
      ).rejects.toThrow(
        'Invalid relations for field "technologies" in api::project.project.\n' +
        'Attempted to disconnect: tech1\n' +
        'Make sure: 1) The field name is correct, 2) The relations exist'
      );
    });
  });

  describe('setRelation error handling', () => {
    it('should throw clear error for invalid relation IDs', async () => {
      await expect(
        relationOps.setRelation('api::article.article', 'doc123', 'categories', ['valid', 456 as any])
      ).rejects.toThrow('Invalid relation ID: "456". Relations require document IDs (strings), not numeric IDs.');
    });

    it('should handle empty array correctly', async () => {
      mockClient.contentOps.updateEntryDraft.mockResolvedValue({ success: true });

      const result = await relationOps.setRelation(
        'api::article.article',
        'doc123',
        'categories',
        []
      );

      expect(mockClient.contentOps.updateEntryDraft).toHaveBeenCalledWith(
        'api::article.article',
        'doc123',
        { categories: [] }
      );
      expect(result).toEqual({ success: true });
    });

    it('should enhance "Invalid relations" error with context', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Invalid relations')
      );

      await expect(
        relationOps.setRelation('api::project.project', 'proj1', 'team_members', [])
      ).rejects.toThrow(
        'Invalid relations for field "team_members" in api::project.project.\n' +
        'Attempted to set: (empty)\n' +
        'Make sure: 1) The field name is correct, 2) All document IDs exist, 3) The relation type supports this operation'
      );
    });

    it('should show all document IDs in error message', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Invalid relations')
      );

      await expect(
        relationOps.setRelation('api::project.project', 'proj1', 'technologies', ['tech1', 'tech2', 'tech3'])
      ).rejects.toThrow(
        'Invalid relations for field "technologies" in api::project.project.\n' +
        'Attempted to set: tech1, tech2, tech3\n' +
        'Make sure: 1) The field name is correct, 2) All document IDs exist, 3) The relation type supports this operation'
      );
    });
  });

  describe('Common relation mistakes', () => {
    it('should catch numeric ID usage (common Strapi v4 to v5 migration issue)', async () => {
      const numericIds = [1, 2, 3];
      
      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'tags', numericIds as any)
      ).rejects.toThrow('Invalid relation ID: "1". Relations require document IDs (strings), not numeric IDs.');
    });

    it('should catch mixed valid and invalid IDs', async () => {
      const mixedIds = ['valid-id', 123, 'another-valid'] as any;
      
      await expect(
        relationOps.setRelation('api::article.article', 'doc123', 'categories', mixedIds)
      ).rejects.toThrow('Invalid relation ID: "123". Relations require document IDs (strings), not numeric IDs.');
    });

    it('should provide helpful context for field name typos', async () => {
      mockClient.contentOps.updateEntryDraft.mockRejectedValue(
        new Error('Invalid relations')
      );

      // Common typo: "category" instead of "categories"
      await expect(
        relationOps.connectRelation('api::article.article', 'doc123', 'category', ['cat1'])
      ).rejects.toThrow(
        'Invalid relations for field "category" in api::article.article.\n' +
        'Attempted to connect: cat1\n' +
        'Make sure: 1) The field name is correct, 2) The document IDs exist, 3) The relation type allows these connections'
      );
    });
  });
});