// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { createTestClient, closeTestClient, parseToolResponse } from './helpers/admin-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('i18n Content Type Configuration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const result = await createTestClient();
    client = result.client;
    transport = result.transport;
  }, 30000);

  afterAll(async () => {
    await closeTestClient(transport);
  });

  it('should enable i18n on a content type', async () => {
    // First, get the current schema
    const schemaResult = await client.callTool({
      name: 'get_content_type_schema',
      arguments: {
        contentType: 'api::project.project'
      }
    });
    const currentSchema = parseToolResponse(schemaResult);
    console.log('Current i18n status:', currentSchema.pluginOptions?.i18n);

    // Update content type to enable i18n
    const updateResult = await client.callTool({
      name: 'update_content_type',
      arguments: {
        contentType: 'api::project.project',
        attributes: {
          name: {
            type: 'string',
            required: true,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          description: {
            type: 'text',
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          }
        },
        pluginOptions: {
          i18n: {
            localized: true
          }
        }
      }
    });

    const updateResponse = parseToolResponse(updateResult);
    console.log('Update response:', updateResponse);

    // Wait a bit for the update to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify the update
    const verifyResult = await client.callTool({
      name: 'get_content_type_schema',
      arguments: {
        contentType: 'api::project.project'
      }
    });
    const updatedSchema = parseToolResponse(verifyResult);
    console.log('Updated schema pluginOptions:', updatedSchema.pluginOptions);
    console.log('Updated schema attributes:', JSON.stringify(updatedSchema.attributes, null, 2));
    
    // Check that i18n is enabled on the content type
    expect(updatedSchema.pluginOptions?.i18n?.localized).toBe(true);
    
    // Check that attributes have i18n enabled
    // Handle both array and object formats
    if (Array.isArray(updatedSchema.attributes)) {
      const nameAttr = updatedSchema.attributes.find((attr: any) => attr.name === 'name');
      const descAttr = updatedSchema.attributes.find((attr: any) => attr.name === 'description');
      expect(nameAttr?.pluginOptions?.i18n?.localized).toBe(true);
      expect(descAttr?.pluginOptions?.i18n?.localized).toBe(true);
    } else {
      expect(updatedSchema.attributes?.name?.pluginOptions?.i18n?.localized).toBe(true);
      expect(updatedSchema.attributes?.description?.pluginOptions?.i18n?.localized).toBe(true);
    }
  }, 60000);

  it('should create content type with i18n enabled', async () => {
    const testName = `i18ntest${Date.now()}`;
    
    const createResult = await client.callTool({
      name: 'create_content_type',
      arguments: {
        displayName: 'I18n Test',
        singularName: testName,
        pluralName: `${testName}s`,
        description: 'Test content type with i18n',
        attributes: {
          title: {
            type: 'string',
            required: true,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          content: {
            type: 'richtext',
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          }
        },
        pluginOptions: {
          i18n: {
            localized: true
          }
        }
      }
    });

    const createResponse = parseToolResponse(createResult);
    const contentTypeUid = createResponse.uid || `api::${testName}.${testName}`;
    console.log('Created content type:', contentTypeUid);

    // Clean up
    if (contentTypeUid) {
      await client.callTool({
        name: 'delete_content_type',
        arguments: {
          contentType: contentTypeUid
        }
      });
    }
  }, 60000);
});