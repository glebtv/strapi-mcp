// Jest test - Testing the exact "Invalid relations" error from production
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Exact Invalid Relations Error Reproduction', () => {
  let client: Client;

  beforeAll(async () => {
    // Get shared client with admin auth
    client = await getSharedClient();
  }, 60000);

  afterAll(async () => {
    // Clean up
  });

  it('should reproduce the exact "Invalid relations" error message', async () => {
    // First, let's create a page entry that we can update
    const initialData = {
      contentTypeUid: 'api::page.page',
      data: {
        title: 'Test Page for Invalid Relations',
        slug: 'test-invalid-relations-exact',
        sections: []
      },
      locale: 'en',
      publish: false
    };

    let documentId: string;
    try {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'create_entry',
          arguments: initialData
        }
      });
      console.log('Create response:', JSON.stringify(response, null, 2));
      const created = response?.content?.[0]?.text ? JSON.parse(response.content[0].text) : response;
      documentId = created.documentId || created.data?.documentId || created.data?.[0]?.documentId;
      console.log('Created initial entry with documentId:', documentId);
    } catch (error: any) {
      console.log('Failed to create initial entry:', error.message);
      return;
    }

    // Now update with data that might trigger "Invalid relations"
    // Based on the production error, it seems to happen when:
    // 1. Passing relation IDs that don't exist
    // 2. Passing wrong format for relations
    // 3. Passing relations in wrong structure
    
    const updateDataVariations = [
      {
        name: 'Test 1: Invalid media relation ID in component',
        data: {
          title: 'Updated Title 1',
          slug: 'updated-slug-1',
          sections: [
            {
              __component: 'sections.hero',
              title: 'Hero Title',
              // Try passing invalid media relation
              image: 'invalid-string-instead-of-id'
            }
          ]
        }
      },
      {
        name: 'Test 2: Invalid relation format',
        data: {
          title: 'Updated Title 2',
          slug: 'updated-slug-2',
          sections: [
            {
              __component: 'sections.hero',
              title: 'Hero Title',
              // Try passing relation as object when it expects ID
              image: {
                connect: [{ id: 999999 }]
              }
            }
          ]
        }
      },
      {
        name: 'Test 3: Invalid nested relations',
        data: {
          title: 'Updated Title 3',
          slug: 'updated-slug-3',
          // Try invalid relation at root level if page has any
          author: 999999, // If page has author relation
          sections: []
        }
      },
      {
        name: 'Test 4: Empty/null relation that should have value',
        data: {
          title: 'Updated Title 4',
          slug: 'updated-slug-4',
          sections: [
            {
              __component: 'sections.hero',
              title: 'Hero Title',
              image: null // Null when relation is required
            }
          ]
        }
      }
    ];

    for (const testCase of updateDataVariations) {
      console.log(`\n=== Testing: ${testCase.name} ===`);
      
      const updateData = {
        contentTypeUid: 'api::page.page',
        documentId: documentId,
        locale: 'en',
        data: testCase.data,
        publish: true
      };

      try {
        const result = await client.request({
          method: 'tools/call',
          params: {
            name: 'update_entry',
            arguments: updateData
          }
        });
        console.log(`${testCase.name}: Unexpectedly succeeded`);
      } catch (error: any) {
        console.log(`Error message: "${error.message}"`);
        
        // Check if this is the exact "Invalid relations" error
        if (error.message.includes('Invalid relations') && !error.message.includes('relation(s) of type')) {
          console.log('✅ FOUND IT! This triggers the generic "Invalid relations" error');
          console.log('Full error:', JSON.stringify(error, null, 2));
          
          // This is the error we want to improve
          expect(error.message).toContain('Invalid relations');
          
          // The error should NOT have helpful details (that's the problem)
          expect(error.message).not.toContain('relation(s) of type');
        }
      }
    }

    // Clean up
    if (documentId) {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'delete_entry',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: documentId
            }
          }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it('should test update_entry with complex sections like production', async () => {
    // This test tries to replicate the exact production scenario
    // with complex sections data structure
    
    const initialData = {
      contentTypeUid: 'api::page.page',
      data: {
        title: 'Production-like Page',
        slug: 'production-like',
        sections: []
      },
      locale: 'en',
      publish: false
    };

    let documentId: string;
    try {
      const response = await client.request({
        method: 'tools/call',
        params: {
          name: 'create_entry',
          arguments: initialData
        }
      });
      console.log('Create response:', JSON.stringify(response, null, 2));
      const created = response?.content?.[0]?.text ? JSON.parse(response.content[0].text) : response;
      documentId = created.documentId || created.data?.documentId || created.data?.[0]?.documentId;
    } catch (error: any) {
      console.log('Failed to create:', error.message);
      return;
    }

    // Try to update with complex data similar to production
    const complexUpdateData = {
      contentTypeUid: 'api::page.page',
      documentId: documentId,
      locale: 'en',
      data: {
        title: 'Complex Page Title',
        slug: 'complex-page',
        sections: [
          {
            __component: 'sections.hero',
            title: 'Hero Section',
            subtitle: 'Subtitle here',
            // This might trigger "Invalid relations"
            cta: {
              label: 'Button',
              url: '#',
              style: 'invalid-enum-value' // Invalid enum
            }
          },
          {
            __component: 'sections.columns',
            title: 'Columns Section',
            // Missing required fields or wrong structure
          },
          {
            __component: 'sections.prices',
            // Completely invalid structure
            prices: 'not-an-array'
          }
        ]
      },
      publish: true
    };

    console.log('\n=== Testing complex update like production ===');
    try {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'update_entry',
          arguments: complexUpdateData
        }
      });
      console.log('Unexpectedly succeeded');
    } catch (error: any) {
      console.log('Error message:', error.message);
      
      if (error.message.includes('Invalid relations')) {
        console.log('✅ Got "Invalid relations" error!');
        console.log('Full error details:', error);
        
        // Check what details we're getting
        if (error.message.includes('Validation errors:')) {
          console.log('Has validation errors section');
        }
        if (error.message.includes('Tip:')) {
          console.log('Has unhelpful tip message');
        }
      }
    }

    // Clean up
    if (documentId) {
      try {
        await client.request({
          method: 'tools/call',
          params: {
            name: 'delete_entry',
            arguments: {
              contentTypeUid: 'api::page.page',
              documentId: documentId
            }
          }
        });
      } catch (e) {
        // Ignore
      }
    }
  });
});