// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Component Schema Discovery Issue Reproduction', () => {
  let client: Client;

  beforeAll(async () => {
    // Use the shared client instance
    client = await getSharedClient();
  }, 60000);

  describe('List Components Issue', () => {
    it('should list all components including sections.hero', async () => {
      const result = await client.callTool({
        name: 'list_components',
        arguments: {}
      });

      const components = parseToolResponse(result);
      console.log('Found components:', components.map((c: any) => c.uid));
      
      // Test: Should return components array
      expect(components).toBeInstanceOf(Array);
      
      // Test: Should find existing components
      const componentUids = components.map((c: any) => c.uid);
      
      // These components exist in the test Strapi app
      const expectedComponents = [
        'sections.hero',
        'sections.prices',
        'sections.columns',
        'shared.button',
        'shared.seo',
        'shared.pricing-plan',
        'shared.column'
      ];
      
      // Check if any expected components are found
      const foundExpected = expectedComponents.filter(uid => componentUids.includes(uid));
      console.log('Expected components found:', foundExpected);
      console.log('Missing components:', expectedComponents.filter(uid => !componentUids.includes(uid)));
      
      // The issue: list_components returns empty array
      expect(components.length).toBeGreaterThan(0);
      expect(foundExpected.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Get Component Schema Issue', () => {
    it('should get schema for sections.hero component', async () => {
      const result = await client.callTool({
        name: 'get_component_schema',
        arguments: {
          componentUid: 'sections.hero'
        }
      });

      const schema = parseToolResponse(result);
      console.log('Hero component schema:', JSON.stringify(schema, null, 2));
      
      // Test: Should have expected structure
      expect(schema).toHaveProperty('uid', 'sections.hero');
      expect(schema).toHaveProperty('schema');
      expect(schema.schema).toHaveProperty('attributes');
      expect(schema.schema.attributes).toHaveProperty('title');
      expect(schema.schema.attributes).toHaveProperty('subtitle');
      expect(schema.schema.attributes).toHaveProperty('image');
      expect(schema.schema.attributes).toHaveProperty('cta');
    }, 60000);

    it('should handle nested component schema like shared.button', async () => {
      const result = await client.callTool({
        name: 'get_component_schema',
        arguments: {
          componentUid: 'shared.button'
        }
      });

      const schema = parseToolResponse(result);
      console.log('Button component schema:', JSON.stringify(schema, null, 2));
      
      expect(schema).toHaveProperty('uid', 'shared.button');
      expect(schema).toHaveProperty('schema');
      expect(schema.schema).toHaveProperty('attributes');
    }, 60000);
  });

  describe('Debug Component API Endpoints', () => {
    it('should check what the component-builder API returns', async () => {
      // This test helps debug what the actual API returns
      // Use the correct endpoint without /admin prefix
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'content-type-builder/components',
          method: 'GET',
          authenticated: true
        }
      });

      const response = parseToolResponse(result);
      console.log('Direct API response for components:', JSON.stringify(response, null, 2));
      
      // Check what the API actually returns
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
    }, 60000);

    it('should check component schema endpoint', async () => {
      // Use the correct endpoint path (without /admin prefix)
      const result = await client.callTool({
        name: 'strapi_rest',
        arguments: {
          endpoint: 'content-type-builder/schema',
          method: 'GET',
          authenticated: true
        }
      });

      const response = parseToolResponse(result);
      
      // The response structure is { data: { contentTypes: {...}, components: {...} } }
      const components = response?.data?.components || {};
      
      console.log('Schema endpoint components:', Object.keys(components));
      console.log('Full response structure:', JSON.stringify(response, null, 2).substring(0, 500) + '...');
      
      expect(components).toBeDefined();
      expect(Object.keys(components).length).toBeGreaterThan(0);
      
      // Check if our expected components are in the schema
      expect(components['sections.hero']).toBeDefined();
      expect(components['shared.button']).toBeDefined();
    }, 60000);
  });
});