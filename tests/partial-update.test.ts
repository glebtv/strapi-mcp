// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Partial Update Functionality', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('update_entry with partial=true', () => {
    let testDocumentId: string;

    beforeAll(async () => {
      // Create a test entry first
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          data: {
            title: 'Test Partial Update Page',
            slug: 'test-partial-' + Date.now(),
            seo: {
              metaTitle: 'Original Meta Title',
              metaDescription: 'Original Meta Description'
            },
            sections: [
              {
                __component: 'sections.hero',
                title: 'Original Hero Title',
                subtitle: 'Original Hero Subtitle'
              },
              {
                __component: 'sections.columns',
                title: 'Original Columns Title',
                description: 'Original columns description'
              }
            ]
          },
          publish: true
        }
      });

      const createResponse = parseToolResponse(createResult);
      expect(createResponse).toBeDefined();
      testDocumentId = createResponse.documentId;
      expect(testDocumentId).toBeDefined();
    });

    it('should update only specified fields while preserving others', async () => {
      // Update only the title using partial update
      const partialUpdateResult = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          partial: true,
          data: {
            title: 'Updated Page Title Only'
          },
          publish: true
        }
      });

      const updateResponse = parseToolResponse(partialUpdateResult);
      expect(updateResponse).toBeDefined();
      expect(updateResponse.title).toBe('Updated Page Title Only');

      // Verify other fields were preserved
      const fetchResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });

      const fetchResponse = parseToolResponse(fetchResult);
      const entry = fetchResponse.data[0];
      expect(entry.title).toBe('Updated Page Title Only'); // Updated value
      expect(entry.seo.metaDescription).toBe('Original Meta Description'); // Original value preserved
      expect(entry.seo.metaTitle).toBe('Original Meta Title'); // Original value preserved
      expect(entry.sections).toHaveLength(2); // Sections preserved
      expect(entry.sections[0].title).toBe('Original Hero Title'); // Section content preserved
    });

    it('should update multiple fields while preserving sections', async () => {
      // Update title and seo component but preserve sections
      const partialUpdateResult = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          partial: true,
          data: {
            title: 'Updated Page Title',
            seo: {
              metaTitle: 'Updated Meta Title',
              metaDescription: 'Updated Meta Description'
            }
          },
          publish: true
        }
      });

      const updateResponse = parseToolResponse(partialUpdateResult);
      expect(updateResponse).toBeDefined();

      // Verify the updates and preservation
      const fetchResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });

      const fetchResponse = parseToolResponse(fetchResult);
      const entry = fetchResponse.data[0];
      expect(entry.title).toBe('Updated Page Title'); // Updated
      expect(entry.seo.metaDescription).toBe('Updated Meta Description'); // Updated
      expect(entry.seo.metaTitle).toBe('Updated Meta Title'); // Updated
      expect(entry.sections).toHaveLength(2); // Sections still preserved
      expect(entry.sections[0].title).toBe('Original Hero Title'); // Section content still preserved
      expect(entry.sections[1].title).toBe('Original Columns Title'); // Section content still preserved
    });

    it('should work with non-partial updates (existing behavior)', async () => {
      // Test that existing behavior still works
      const fullUpdateResult = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          partial: false, // Explicit false
          data: {
            title: 'Full Update Title',
            slug: 'test-partial-' + Date.now(),
            seo: {
              metaTitle: 'Full Update Meta Title',
              metaDescription: 'Full Update Meta Description'
            },
            sections: [
              {
                __component: 'sections.hero',
                title: 'Full Update Hero Title',
                subtitle: 'Full Update Hero Subtitle'
              }
            ]
          },
          publish: true
        }
      });

      const updateResponse = parseToolResponse(fullUpdateResult);
      expect(updateResponse).toBeDefined();

      // Verify full replacement happened
      const fetchResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });

      const fetchResponse = parseToolResponse(fetchResult);
      const entry = fetchResponse.data[0];
      expect(entry.title).toBe('Full Update Title');
      expect(entry.seo.metaTitle).toBe('Full Update Meta Title');
      expect(entry.seo.metaDescription).toBe('Full Update Meta Description');
      expect(entry.sections).toHaveLength(1); // Only one section now
      expect(entry.sections[0].title).toBe('Full Update Hero Title');
    });

    it('should handle errors when entry does not exist', async () => {
      try {
        await client.callTool({
          name: 'update_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: 'nonexistent-id',
            partial: true,
            data: {
              title: 'Should Fail'
            }
          }
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('Entry with documentId nonexistent-id not found');
      }
    });
  });
});