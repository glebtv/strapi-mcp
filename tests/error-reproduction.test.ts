// Jest test to reproduce the "Invalid status" error
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Error Reproduction Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await getSharedClient();
  }, 60000);

  describe('Invalid status error reproduction', () => {
    let testDocumentId: string;

    beforeAll(async () => {
      // Create a test page similar to what the user was working with
      const createResult = await client.callTool({
        name: 'create_entry',
        arguments: {
          contentTypeUid: 'api::page.page',
          data: {
            title: 'Error Reproduction Test Page',
            slug: 'error-test-' + Date.now(),
            sections: [
              {
                __component: 'sections.hero',
                title: 'Test Hero',
                subtitle: 'Test Subtitle'
              }
            ]
          },
          publish: true
        }
      });

      const createResponse = parseToolResponse(createResult);
      testDocumentId = createResponse.documentId;
      expect(testDocumentId).toBeDefined();
    });

    it('should reproduce Invalid status error with Russian locale', async () => {
      console.log('\n=== REPRODUCTION TEST: Russian locale like user ===');
      
      try {
        const result = await client.callTool({
          name: 'entry_section_add',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            locale: 'ru', // Using Russian locale like the user
            zoneField: 'sections',
            section: {
              __component: 'sections.stats', // This component doesn't exist
              title: 'Наши результаты говорят сами за себя',
              background_color: 'dark',
              animate_numbers: true,
              stats: [
                {
                  value: '400',
                  label: 'Завершенных проектов',
                  suffix: '+'
                },
                {
                  value: '53',
                  label: 'Штатных разработчиков',
                  suffix: ''
                }
              ]
            },
            publish: false // Also matching user's request
          }
        });

        // If we reach here, the test failed to reproduce the error
        console.log('ERROR: Expected test to fail but it succeeded:', result);
        expect(true).toBe(false);
      } catch (error: any) {
        console.log('\n=== RUSSIAN LOCALE ERROR DETAILS ===');
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        console.log('Error object:', JSON.stringify(error, null, 2));
        
        // Check if we get the "Invalid status" message
        if (error.message.includes('Invalid status')) {
          console.log('🎯 REPRODUCED: Found "Invalid status" error!');
        } else {
          console.log('ℹ️  Got detailed error instead of "Invalid status"');
        }
        
        expect(error.message).toBeDefined();
      }
    });

    it('should reproduce Invalid status error with draft=false', async () => {
      console.log('\n=== REPRODUCTION TEST: Draft mode ===');
      
      try {
        const result = await client.callTool({
          name: 'entry_section_add',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            zoneField: 'sections',
            section: {
              __component: 'sections.stats', // Non-existent component
              title: 'Test Stats Section',
              stats: []
            },
            publish: false // This was used in the user's failing request
          }
        });

        // If we reach here, the test failed to reproduce the error
        console.log('ERROR: Expected test to fail but it succeeded:', result);
        expect(true).toBe(false);
      } catch (error: any) {
        console.log('\n=== DRAFT MODE ERROR DETAILS ===');
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        console.log('Error object:', JSON.stringify(error, null, 2));
        
        expect(error.message).toBeDefined();
      }
    });

    it('should reproduce Invalid status error with partial update', async () => {
      console.log('\n=== REPRODUCTION TEST: Partial update with non-existent component ===');
      
      try {
        const result = await client.callTool({
          name: 'update_entry',
          arguments: {
            contentTypeUid: 'api::page.page',
            documentId: testDocumentId,
            locale: 'en',
            partial: true,
            publish: true,
            data: {
              sections: [
                {
                  __component: 'sections.hero',
                  title: 'Updated Hero',
                  subtitle: 'Updated Subtitle'
                },
                {
                  __component: 'sections.stats', // Non-existent component
                  title: 'Test Stats',
                  stats: []
                }
              ]
            }
          }
        });

        // If we reach here, the test failed to reproduce the error
        console.log('ERROR: Expected test to fail but it succeeded:', result);
        expect(true).toBe(false);
      } catch (error: any) {
        console.log('\n=== PARTIAL UPDATE ERROR DETAILS ===');
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        console.log('Error object:', JSON.stringify(error, null, 2));
        
        expect(error.message).toBeDefined();
      }
    });

    it('should work correctly with valid component', async () => {
      console.log('\n=== CONTROL TEST: Valid component ===');
      
      const result = await client.callTool({
        name: 'entry_section_add',
        arguments: {
          contentTypeUid: 'api::page.page',
          documentId: testDocumentId,
          zoneField: 'sections',
          section: {
            __component: 'sections.columns', // This component exists
            title: 'Test Columns Section',
            description: 'Test description'
          },
          publish: true
        }
      });

      const response = parseToolResponse(result);
      console.log('SUCCESS: Valid component worked:', response);
      expect(response).toBeDefined();
    });
  });
});