import { QueryOptions } from '../types.js';

export class ContentOperations {
  constructor(private client: any) {}

  /**
   * Get entries for a content type
   */
  async getEntries(contentTypeUid: string, options?: QueryOptions): Promise<any> {
    // Build query parameters
    const params: any = {};
    if (options?.filters) params.filters = options.filters;

    // Handle pagination - Strapi expects page and pageSize as direct params, not nested
    if (options?.pagination) {
      if (options.pagination.page) params.page = options.pagination.page;
      if (options.pagination.pageSize) params.pageSize = options.pagination.pageSize;
    }

    if (options?.sort) params.sort = options.sort;
    if (options?.populate) params.populate = options.populate;
    if (options?.fields) params.fields = options.fields;
    if (options?.status) params.status = options.status;
    if (options?.locale) params.locale = options.locale;

    // Handle any additional parameters passed through options
    if (options && typeof options === 'object') {
      Object.entries(options).forEach(([key, value]) => {
        if (!['filters', 'pagination', 'sort', 'populate', 'fields', 'status', 'locale'].includes(key)) {
          params[key] = value;
        }
      });
    }

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}`,
      'GET',
      undefined,
      params
    );

    if (response?.results) {
      return { data: response.results, meta: { pagination: response.pagination || {} } };
    }

    return { data: [], meta: {} };
  }


  /**
   * Create an entry (always creates as draft)
   */
  async createEntry(contentTypeUid: string, data: any, locale?: string): Promise<any> {
    const endpoint = `/content-manager/collection-types/${contentTypeUid}`;

    const params: any = {};
    if (locale) {
      params.locale = locale;
    }

    const response = await this.client.adminRequest(
      endpoint,
      'POST',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Update an entry as draft (won't publish)
   */
  async updateEntryDraft(contentTypeUid: string, documentId: string, data: any, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}`,
      'PUT',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Update an entry and publish it immediately
   */
  async updateEntryAndPublish(contentTypeUid: string, documentId: string, data: any, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}/actions/publish`,
      'POST',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(contentTypeUid: string, documentId: string, locale?: string): Promise<void> {
    // If locale is specified, delete only that locale. Otherwise delete all locales
    const localeParam = locale ? `locale=${locale}` : 'locale=*';

    await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}?${localeParam}`,
      'DELETE'
    );
  }

  /**
   * Publish entries using bulk endpoint (publishes all locales)
   */
  async publishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
    return await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/actions/bulkPublish`,
      'POST',
      { documentIds }
    );
  }

  /**
   * Unpublish entries using bulk endpoint (unpublishes all locales)
   */
  async unpublishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
    return await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/actions/bulkUnpublish`,
      'POST',
      { documentIds }
    );
  }

  /**
   * Create and publish an entry in one step
   */
  async createPublishedEntry(contentTypeUid: string, data: any, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/actions/publish`,
      'POST',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Create a localized draft for an existing entry
   */
  async createLocalizedDraft(contentTypeUid: string, documentId: string, data: any, locale: string): Promise<any> {
    const params = { locale };

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}`,
      'PUT',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Create and publish a localized entry in one step (specific locale)
   */
  async createAndPublishLocalizedEntry(contentTypeUid: string, documentId: string, data: any, locale: string): Promise<any> {
    const params = { locale };

    // Include documentId in the data
    const requestData = { ...data, documentId };

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}/actions/publish`,
      'POST',
      requestData,
      params
    );
    return response?.data || response;
  }

  /**
   * Publish an existing draft entry for a specific locale
   */
  async publishLocalizedEntry(contentTypeUid: string, documentId: string, locale: string): Promise<any> {
    const params = { locale };

    // First, get the current draft data
    const currentEntry = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}`,
      'GET',
      undefined,
      params
    );

    // Then publish it with the current data
    const requestData = { ...currentEntry.data, documentId };

    const response = await this.client.adminRequest(
      `/content-manager/collection-types/${contentTypeUid}/${documentId}/actions/publish`,
      'POST',
      requestData,
      params
    );
    return response?.data || response;
  }
}
