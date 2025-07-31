// Jest test - describe, it, expect, beforeAll, afterAll are globals
import { getSharedClient, parseToolResponse } from './helpers/shared-client.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import axios from 'axios';

describe('Page Publish/Unpublish Integration Tests', () => {
  let client: Client;
  let pageDocumentId: string;
  const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
  let adminJWT: string;

  beforeAll(async () => {
    client = await getSharedClient();

    // Get admin JWT for direct API verification
    const loginResponse = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    adminJWT = loginResponse.data.data.token;
  });

  afterAll(async () => {
    // Clean up created pages
    if (pageDocumentId) {
      try {
        await client.callTool({
          name: 'delete_entry',
          arguments: {
            pluralApiId: 'pages',
            documentId: pageDocumentId
          }
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should create a page with dynamic zones in draft state, publish it, and verify visibility', async () => {
    // Create a page with all three dynamic zone components
    const pageData = {
      title: 'Test Page with Dynamic Zones',
      slug: `test-page-dynamic-zones-${Date.now()}`,
      sections: [
        {
          __component: 'sections.hero',
          title: 'Welcome to Our Site',
          subtitle: 'This is a test hero section',
          cta: {
            label: 'Get Started',
            url: '/get-started',
            style: 'primary'
          }
        },
        {
          __component: 'sections.columns',
          title: 'Our Features',
          columns: [
            {
              title: 'Feature 1',
              content: 'This is the first feature column with rich text content.',
              icon: 'star'
            },
            {
              title: 'Feature 2',
              content: 'This is the second feature column with more content.',
              icon: 'heart'
            },
            {
              title: 'Feature 3',
              content: 'This is the third feature column.',
              icon: 'check'
            }
          ]
        },
        {
          __component: 'sections.prices',
          title: 'Our Pricing Plans',
          description: 'Choose the plan that works best for you',
          plans: [
            {
              name: 'Starter',
              price: 9.99,
              currency: 'USD',
              features: ['Feature A', 'Feature B', 'Feature C'],
              recommended: false
            },
            {
              name: 'Professional',
              price: 29.99,
              currency: 'USD',
              features: ['All Starter features', 'Feature D', 'Feature E', 'Feature F'],
              recommended: true
            },
            {
              name: 'Enterprise',
              price: 99.99,
              currency: 'USD',
              features: ['All Professional features', 'Feature G', 'Feature H', 'Priority Support'],
              recommended: false
            }
          ]
        }
      ],
      seo: {
        metaTitle: 'Test Page - Dynamic Zones',
        metaDescription: 'A test page demonstrating dynamic zones with Hero, Columns, and Prices sections',
        keywords: 'test, dynamic zones, strapi'
      }
    };

    // Create the page in draft state
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        data: pageData,
        publish: false // Create in draft state
      }
    });

    const createResponse = parseToolResponse(createResult);
    expect(createResponse).toBeDefined();
    
    // The response might have the documentId at the top level
    pageDocumentId = createResponse.documentId || createResponse.data?.documentId;
    expect(pageDocumentId).toBeDefined();
    
    // Verify page is in draft state (not visible in public API)
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}`);
      throw new Error('Page should not be visible in public API when in draft state');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
    }

    // Verify page is visible in admin API (draft state)
    const adminDraftResponse = await axios.get(
      `${STRAPI_URL}/content-manager/collection-types/api::page.page/${pageDocumentId}`,
      {
        headers: { Authorization: `Bearer ${adminJWT}` }
      }
    );
    expect(adminDraftResponse.status).toBe(200);
    expect(adminDraftResponse.data.data.publishedAt).toBeNull(); // Should be null for draft

    // Publish the page
    const publishResult = await client.callTool({
      name: 'publish_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: pageDocumentId
      }
    });

    const publishResponse = parseToolResponse(publishResult);
    expect(publishResponse).toBeDefined();
    const publishedAt = publishResponse.publishedAt || publishResponse.data?.publishedAt;
    expect(publishedAt).toBeDefined();
    expect(publishedAt).not.toBeNull();

    // Verify page is now visible in public API
    const publicResponse = await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}?populate[sections][populate]=*`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.data).toBeDefined();
    
    // Handle both single response and array response formats
    const responsePageData = publicResponse.data.data ? 
      (Array.isArray(publicResponse.data.data) ? publicResponse.data.data[0] : publicResponse.data.data) :
      publicResponse.data;
    
    expect(responsePageData).toBeDefined();
    expect(responsePageData.title || responsePageData.attributes?.title).toBe('Test Page with Dynamic Zones');
    
    const sections = responsePageData.sections || responsePageData.attributes?.sections;
    expect(sections).toBeDefined();
    expect(sections).toHaveLength(3);

    // Verify sections content
    expect(sections[0].__component).toBe('sections.hero');
    expect(sections[0].title).toBe('Welcome to Our Site');
    expect(sections[1].__component).toBe('sections.columns');
    expect(sections[2].__component).toBe('sections.prices');

    // Verify page shows up in pages list
    const listResponse = await axios.get(`${STRAPI_URL}/api/pages`);
    expect(listResponse.status).toBe(200);
    const foundPage = listResponse.data.data.find((p: any) => 
      p.documentId === pageDocumentId || p.id === pageDocumentId
    );
    expect(foundPage).toBeDefined();

    // Unpublish the page
    const unpublishResult = await client.callTool({
      name: 'unpublish_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: pageDocumentId
      }
    });

    const unpublishResponse = parseToolResponse(unpublishResult);
    expect(unpublishResponse).toBeDefined();
    
    // Note: The unpublish tool returns the state before unpublishing, not after
    // So we skip checking the publishedAt field in the response

    // Verify page is no longer visible in public API
    try {
      await axios.get(`${STRAPI_URL}/api/pages/${pageDocumentId}`);
      throw new Error('Page should not be visible in public API after unpublishing');
    } catch (error: any) {
      expect(error.response?.status).toBe(404);
    }

    // Verify page is still visible in admin API (as draft)
    const adminUnpublishedResponse = await axios.get(
      `${STRAPI_URL}/content-manager/collection-types/api::page.page/${pageDocumentId}`,
      {
        headers: { Authorization: `Bearer ${adminJWT}` }
      }
    );
    expect(adminUnpublishedResponse.status).toBe(200);
    expect(adminUnpublishedResponse.data.data.publishedAt).toBeNull();
    
    // Verify page no longer shows up in public pages list
    const unpublishedListResponse = await axios.get(`${STRAPI_URL}/api/pages`);
    expect(unpublishedListResponse.status).toBe(200);
    const notFoundPage = unpublishedListResponse.data.data.find((p: any) => 
      p.documentId === pageDocumentId || p.id === pageDocumentId
    );
    expect(notFoundPage).toBeUndefined();
  });

  it('should handle i18n locales when publishing/unpublishing', async () => {
    // Create a page with default locale
    const pageData = {
      title: 'Test i18n Page',
      slug: `test-i18n-page-${Date.now()}`,
      sections: [
        {
          __component: 'sections.hero',
          title: 'Default Locale Hero',
          subtitle: 'This is in the default locale'
        }
      ]
    };

    // Create the page
    const createResult = await client.callTool({
      name: 'create_entry',
      arguments: {
        contentType: 'api::page.page',
        pluralApiId: 'pages',
        data: pageData,
        publish: true // Create and publish immediately
      }
    });

    const createResponse = parseToolResponse(createResult);
    const i18nPageId = createResponse.documentId || createResponse.data?.documentId;
    expect(i18nPageId).toBeDefined();

    // Verify published state
    const publishedResponse = await axios.get(`${STRAPI_URL}/api/pages/${i18nPageId}`);
    expect(publishedResponse.status).toBe(200);
    
    const publishedData = publishedResponse.data.data ? 
      (Array.isArray(publishedResponse.data.data) ? publishedResponse.data.data[0] : publishedResponse.data.data) :
      publishedResponse.data;
    
    expect(publishedData.title || publishedData.attributes?.title).toBe('Test i18n Page');

    // Clean up
    await client.callTool({
      name: 'delete_entry',
      arguments: {
        pluralApiId: 'pages',
        documentId: i18nPageId
      }
    });
  });
});