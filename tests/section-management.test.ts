// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Section Management Tools', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('Section CRUD Operations', () => {
    let testDocumentId: string;

    beforeAll(async () => {
      // Create a test page with initial sections
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          data: {
            title: 'Section Management Test Page',
            slug: 'section-test-' + Date.now(),
            sections: [
              {
                __component: 'sections.hero',
                title: 'Hero Section',
                subtitle: 'Hero Subtitle'
              },
              {
                __component: 'sections.columns',
                title: 'Columns Section',
                description: 'Columns description'
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

    describe('entry_section_add', () => {
      it('should add a section at the end by default', async () => {
        const addResult = await client.callTool({
          name: 'entry_section_add',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            section: {
              __component: 'sections.prices',
              title: 'New Prices Section',
              description: 'Prices section description'
            },
            publish: true
          }
        });

        const addResponse = parseToolResponse(addResult);
        expect(addResponse).toBeDefined();

        // Verify the section was added
        const fetchResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const fetchResponse = parseToolResponse(fetchResult);
        const entry = fetchResponse.data[0];
        expect(entry.sections).toHaveLength(3);
        expect(entry.sections[2].__component).toBe('sections.prices');
        expect(entry.sections[2].title).toBe('New Prices Section');
      });

      it('should add a section at a specific position', async () => {
        const addResult = await client.callTool({
          name: 'entry_section_add',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            section: {
              __component: 'sections.hero',
              title: 'Inserted Hero Section',
              subtitle: 'Inserted Subtitle'
            },
            position: 1,
            publish: true
          }
        });

        const addResponse = parseToolResponse(addResult);
        expect(addResponse).toBeDefined();

        // Verify the section was inserted at position 1
        const fetchResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const fetchResponse = parseToolResponse(fetchResult);
        const entry = fetchResponse.data[0];
        expect(entry.sections).toHaveLength(4);
        expect(entry.sections[1].title).toBe('Inserted Hero Section');
        // Original sections should be shifted
        expect(entry.sections[0].title).toBe('Hero Section'); // Original first
        expect(entry.sections[2].title).toBe('Columns Section'); // Original second, now third
      });

      it('should fail when __component is missing', async () => {
        try {
          await client.callTool({
            name: 'entry_section_add',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: testDocumentId,
              zoneField: 'sections',
              section: {
                title: 'Section without component'
              },
              publish: true
            }
          });
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.message).toContain('Section must include __component field');
        }
      });
    });

    describe('entry_section_update', () => {
      it('should update a specific section by index', async () => {
        const updateResult = await client.callTool({
          name: 'entry_section_update',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            sectionIndex: 0,
            section: {
              __component: 'sections.hero',
              title: 'Updated Hero Section',
              subtitle: 'Updated Hero Subtitle'
            },
            publish: true
          }
        });

        const updateResponse = parseToolResponse(updateResult);
        expect(updateResponse).toBeDefined();

        // Verify only the specific section was updated
        const fetchResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const fetchResponse = parseToolResponse(fetchResult);
        const entry = fetchResponse.data[0];
        expect(entry.sections[0].title).toBe('Updated Hero Section');
        expect(entry.sections[0].subtitle).toBe('Updated Hero Subtitle');
        // Other sections should remain unchanged
        expect(entry.sections[1].title).toBe('Inserted Hero Section');
        expect(entry.sections[2].title).toBe('Columns Section');
      });

      it('should fail with invalid section index', async () => {
        try {
          await client.callTool({
            name: 'entry_section_update',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: testDocumentId,
              zoneField: 'sections',
              sectionIndex: 999,
              section: {
                __component: 'sections.hero',
                title: 'Should Fail'
              },
              publish: true
            }
          });
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.message).toContain('Section index 999 is out of range');
        }
      });
    });

    describe('entry_section_delete', () => {
      it('should delete a specific section by index', async () => {
        // First get current section count
        const beforeFetch = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const beforeResponse = parseToolResponse(beforeFetch);
        const beforeCount = beforeResponse.data[0].sections.length;

        const deleteResult = await client.callTool({
          name: 'entry_section_delete',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            sectionIndex: 1, // Delete the "Inserted Hero Section"
            publish: true
          }
        });

        const deleteResponse = parseToolResponse(deleteResult);
        expect(deleteResponse).toBeDefined();

        // Verify the section was deleted
        const fetchResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const fetchResponse = parseToolResponse(fetchResult);
        const entry = fetchResponse.data[0];
        expect(entry.sections).toHaveLength(beforeCount - 1);
        expect(entry.sections[0].title).toBe('Updated Hero Section');
        expect(entry.sections[1].title).toBe('Columns Section');
        expect(entry.sections[2].title).toBe('New Prices Section');
      });
    });

    describe('entry_section_reorder', () => {
      it('should move a section from one position to another', async () => {
        // Add another section first to have more items to reorder
        await client.callTool({
          name: 'entry_section_add',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            section: {
              __component: 'sections.hero',
              title: 'Moveable Section',
              subtitle: 'Will be moved'
            },
            publish: true
          }
        });

        // First get current section count to determine correct fromIndex
        const beforeReorderFetch = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const beforeReorderResponse = parseToolResponse(beforeReorderFetch);
        const currentSections = beforeReorderResponse.data[0].sections;
        const lastIndex = currentSections.length - 1;

        // Now reorder: move the last section to the first position
        const reorderResult = await client.callTool({
          name: 'entry_section_reorder',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            fromIndex: lastIndex, // Last position
            toIndex: 0, // First position
            publish: true
          }
        });

        const reorderResponse = parseToolResponse(reorderResult);
        expect(reorderResponse).toBeDefined();

        // Verify the reordering
        const fetchResult = await client.callTool({
          name: 'get_entries',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            populate: '*'
          }
        });

        const fetchResponse = parseToolResponse(fetchResult);
        const entry = fetchResponse.data[0];
        expect(entry.sections[0].title).toBe('Moveable Section'); // Moved to first
        
        // The other sections should be shifted down, but we need to check what we actually have
        // After all previous operations: Updated Hero Section, Columns Section, New Prices Section
        // Then Moveable Section was added and moved to position 0
        const otherTitles = entry.sections.slice(1).map((s: any) => s.title);
        expect(otherTitles).toContain('Updated Hero Section');
        expect(otherTitles).toContain('Columns Section');  
        expect(otherTitles).toContain('New Prices Section');
      });
    });

    describe('Error handling', () => {
      it('should fail when zone field does not exist', async () => {
        try {
          await client.callTool({
            name: 'entry_section_add',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: testDocumentId,
              zoneField: 'nonexistent_field',
              section: {
                __component: 'sections.hero',
                title: 'Should Fail'
              },
              publish: true
            }
          });
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.message).toContain("Field 'nonexistent_field' is not a dynamic zone or does not exist");
        }
      });

      it('should fail when entry does not exist', async () => {
        try {
          await client.callTool({
            name: 'entry_section_add',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: 'nonexistent-id',
              zoneField: 'sections',
              section: {
                __component: 'sections.hero',
                title: 'Should Fail'
              },
              publish: true
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
});