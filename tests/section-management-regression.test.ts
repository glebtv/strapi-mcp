/**
 * Regression test for "Invalid status" bug
 * 
 * This test ensures that section management tools work correctly with:
 * 1. Pages that have been previously modified (have status: "modified")
 * 2. Content types with many fields
 * 3. Entries that have gone through multiple edit cycles
 * 
 * Bug context: The tools were sending metadata fields like 'status' back to Strapi,
 * causing "Invalid status" validation errors.
 */

import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Section Management - Status Field Regression', () => {
  let client: Client;
  let testDocumentId: string;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  beforeAll(async () => {
    // Create a test page with many fields to simulate real-world content
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentTypeUid: 'api::page.page',
        data: {
          title: 'Status Regression Test Page',
          slug: 'status-test-' + Date.now(),
          sections: [
            {
              __component: 'sections.hero',
              title: 'Initial Hero',
              subtitle: 'Initial subtitle'
            }
          ],
          // Add SEO component to make it more complex
          seo: {
            metaTitle: 'Test Page Meta',
            metaDescription: 'Test page description'
          }
        },
        publish: false // Create as draft to get status field
      }
    });

    const createResponse = parseToolResponse(createResult);
    testDocumentId = createResponse.documentId;
    
    // Now update it once to ensure it has status: "modified"
    await client.callTool({
      name: 'update_entry',
      arguments: {
        contentTypeUid: 'api::page.page',
        documentId: testDocumentId,
        data: {
          title: 'Updated Title - Now Modified'
        },
        partial: true,
        publish: false
      }
    });
  }, 60000);

  afterAll(async () => {
    // Clean up
    if (testDocumentId) {
      await client.callTool({
        name: 'delete_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId
        }
      });
    }
  });

  describe('Bug: Adding sections to modified pages', () => {
    it('should successfully add section to a page with status:modified', async () => {
      // Fetch current state to verify it has status field
      const fetchBefore = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });
      
      const beforeData = parseToolResponse(fetchBefore);
      const entryBefore = beforeData.data[0];
      
      // Verify the entry has metadata fields that caused the bug
      expect(entryBefore).toHaveProperty('status');
      expect(entryBefore).toHaveProperty('createdAt');
      expect(entryBefore).toHaveProperty('updatedAt');
      expect(entryBefore.sections).toHaveLength(1);
      
      // This is the operation that was failing with "Invalid status"
      const addResult = await client.callTool({
        name: 'entry_section_add',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          zoneField: 'sections',
          section: {
            __component: 'sections.columns',
            title: 'Added to Modified Page',
            description: 'This should work even with status:modified'
          },
          publish: false
        }
      });

      const addResponse = parseToolResponse(addResult);
      expect(addResponse).toBeDefined();
      
      // Verify it was added
      const fetchAfter = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });
      
      const afterData = parseToolResponse(fetchAfter);
      const entryAfter = afterData.data[0];
      
      expect(entryAfter.sections).toHaveLength(2);
      expect(entryAfter.sections[1].__component).toBe('sections.columns');
      expect(entryAfter.sections[1].title).toBe('Added to Modified Page');
    });

    it('should handle update_entry with partial=true on modified pages', async () => {
      // This was also failing with "Invalid status"
      const updateResult = await client.callTool({
        name: 'update_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          partial: true,
          publish: false,
          data: {
            sections: [
              {
                __component: 'sections.hero',
                title: 'Initial Hero',
                subtitle: 'Initial subtitle'
              },
              {
                __component: 'sections.columns',
                title: 'Added to Modified Page',
                description: 'This should work even with status:modified'
              },
              {
                __component: 'sections.prices',
                title: 'Third Section via Partial Update',
                description: 'Added through partial update'
              }
            ]
          }
        }
      });

      const updateResponse = parseToolResponse(updateResult);
      expect(updateResponse).toBeDefined();
      
      // Verify all sections are present
      const fetchResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });
      
      const fetchData = parseToolResponse(fetchResult);
      const entry = fetchData.data[0];
      
      expect(entry.sections).toHaveLength(3);
      expect(entry.sections[2].__component).toBe('sections.prices');
      expect(entry.sections[2].title).toBe('Third Section via Partial Update');
      
      // Other fields should be preserved
      expect(entry.title).toBe('Updated Title - Now Modified');
    });

    it('should not send metadata fields in update requests', async () => {
      // This test verifies our fix: metadata fields are stripped
      
      // First, let's manually fetch the entry
      const fetchResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });
      
      const fetchData = parseToolResponse(fetchResult);
      const entry = fetchData.data[0];
      
      // The entry SHOULD have metadata fields when fetched
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('documentId');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');
      
      // But when we update, these should be stripped (our fix)
      // If the fix is removed, this operation would fail with "Invalid status"
      const updateResult = await client.callTool({
        name: 'entry_section_update',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          zoneField: 'sections',
          sectionIndex: 0,
          section: {
            __component: 'sections.hero',
            title: 'Updated Hero After Multiple Edits',
            subtitle: 'This proves metadata is stripped'
          },
          publish: false
        }
      });
      
      expect(updateResult).toBeDefined();
      const updateResponse = parseToolResponse(updateResult);
      expect(updateResponse).toBeDefined();
      
      // Verify the update worked
      const verifyResult = await client.callTool({
        name: 'get_entries',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          options: JSON.stringify({ populate: '*' })
        }
      });
      
      const verifyData = parseToolResponse(verifyResult);
      const updatedEntry = verifyData.data[0];
      
      expect(updatedEntry.sections[0].title).toBe('Updated Hero After Multiple Edits');
    });
  });
});