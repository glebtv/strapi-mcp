import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { StrapiClient } from '../src/strapi-client';
import { StrapiConfig } from '../src/types';

describe('Schema Safety Tests', () => {
  let client: StrapiClient;
  let mockAdminRequest: jest.SpyInstance;
  
  beforeEach(() => {
    const config: StrapiConfig = {
      url: 'http://localhost:1337',
      adminEmail: 'admin@test.com',
      adminPassword: 'admin123',
      devMode: false
    };
    
    client = new StrapiClient(config);
    mockAdminRequest = jest.spyOn(client as any, 'adminRequest');
  });
  
  describe('updateContentType safety checks', () => {
    const mockExistingSchema = {
      uid: 'api::article.article',
      attributes: {
        title: { type: 'string', required: true },
        content: { type: 'richtext' },
        author: { type: 'string' },
        publishedAt: { type: 'datetime' },
        tags: { type: 'json' }
      },
      kind: 'collectionType',
      displayName: 'Article',
      singularName: 'article',
      pluralName: 'articles'
    };
    
    beforeEach(() => {
      // Mock getContentTypeSchema to return existing schema
      jest.spyOn(client, 'getContentTypeSchema').mockResolvedValue(mockExistingSchema);
    });
    
    it('should block updates that would delete more than one field', async () => {
      // Try to update with only one field (would delete 4 fields)
      await expect(
        client.updateContentType('api::article.article', {
          title: { type: 'string', required: true }
        })
      ).rejects.toThrow('SAFETY BLOCK: This update would delete 4 attributes: content, author, publishedAt, tags');
    });
    
    it('should allow updates that delete at most one field with warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockAdminRequest.mockResolvedValue({ data: { uid: 'api::article.article' } });
      
      // Update with all fields except one
      await client.updateContentType('api::article.article', {
        title: { type: 'string', required: true },
        content: { type: 'richtext' },
        author: { type: 'string' },
        publishedAt: { type: 'datetime' }
        // tags is missing - will be deleted
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARNING] This update will delete attribute: tags');
      consoleWarnSpy.mockRestore();
    });
    
    it('should preserve all existing fields when adding a new field', async () => {
      mockAdminRequest.mockResolvedValue({ data: { uid: 'api::article.article' } });
      
      // Add a new field
      await client.updateContentType('api::article.article', {
        title: { type: 'string', required: true },
        content: { type: 'richtext' },
        author: { type: 'string' },
        publishedAt: { type: 'datetime' },
        tags: { type: 'json' },
        newField: { type: 'string' } // New field
      });
      
      // Check the payload sent to Strapi
      expect(mockAdminRequest).toHaveBeenCalledWith(
        '/content-type-builder/update-schema',
        'POST',
        expect.objectContaining({
          data: expect.objectContaining({
            contentTypes: expect.arrayContaining([
              expect.objectContaining({
                attributes: expect.arrayContaining([
                  // All existing fields should be preserved
                  expect.objectContaining({ name: 'title', action: 'update' }),
                  expect.objectContaining({ name: 'content', action: 'update' }),
                  expect.objectContaining({ name: 'author', action: 'update' }),
                  expect.objectContaining({ name: 'publishedAt', action: 'update' }),
                  expect.objectContaining({ name: 'tags', action: 'update' }),
                  // New field should be added
                  expect.objectContaining({ name: 'newField', action: 'update' })
                ])
              })
            ])
          })
        })
      );
    });
    
    it('should correctly merge updates to existing fields', async () => {
      mockAdminRequest.mockResolvedValue({ data: { uid: 'api::article.article' } });
      
      // Update existing field with new properties
      await client.updateContentType('api::article.article', {
        title: { type: 'string', required: true, maxLength: 255 }, // Adding maxLength
        content: { type: 'richtext' },
        author: { type: 'string' },
        publishedAt: { type: 'datetime' },
        tags: { type: 'json' }
      });
      
      const callArgs = mockAdminRequest.mock.calls[0];
      const payload = callArgs[2];
      const titleAttr = payload.data.contentTypes[0].attributes.find((attr: any) => attr.name === 'title');
      
      // Should merge the new maxLength property
      expect(titleAttr.properties).toEqual({
        type: 'string',
        required: true,
        maxLength: 255
      });
    });
  });
});