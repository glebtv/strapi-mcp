import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { AuthManager } from './auth-manager.js';
import { TokenManager } from './token-manager.js';
import { StrapiConfig, ContentType, QueryOptions, HealthCheckResult, ComponentData } from './types.js';

export class StrapiClient {
  private axios: AxiosInstance;
  private authManager: AuthManager;
  private tokenManager: TokenManager;
  private config: StrapiConfig;
  private healthCheckInProgress = false;

  constructor(config: StrapiConfig) {
    this.config = config;
    this.authManager = new AuthManager(config);
    this.tokenManager = new TokenManager(this);
    
    this.axios = axios.create({
      baseURL: config.url,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: (status) => status < 500
    });

    // Add auth headers to all requests
    this.axios.interceptors.request.use((config) => {
      const authHeaders = this.authManager.getAuthHeaders();
      Object.assign(config.headers, authHeaders);
      return config;
    });
  }

  /**
   * Get the auth manager instance
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * Check Strapi health status
   */
  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const response = await axios.get(`${this.config.url}/_health`, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 200 || response.status === 204) {
        return { status: 'healthy' };
      } else if (response.status === 503) {
        return { status: 'reloading', message: 'Strapi is restarting' };
      } else {
        return { status: 'unhealthy', message: `Health check returned ${response.status}` };
      }
    } catch (error) {
      // Check specifically for connection refused
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        return { status: 'unhealthy', message: 'Connection refused, check if Strapi instance is running' };
      }
      // Silently handle other connection errors to avoid polluting test output
      return { status: 'unhealthy', message: 'Failed to connect to Strapi' };
    }
  }

  /**
   * Wait for Strapi to be healthy after structure changes
   */
  async waitForHealthy(maxWaitTime = 30000): Promise<void> {
    if (this.healthCheckInProgress) {
      return;
    }

    this.healthCheckInProgress = true;
    const startTime = Date.now();
    
    try {
      // Initial delay to let Strapi start reloading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if Strapi is still up - if it returns unhealthy, it means restart has begun
      const initialCheck = await this.checkHealth();
      
      // If Strapi is already restarting, wait for it to come back
      if (initialCheck.status === 'unhealthy' || initialCheck.status === 'reloading') {
        // Wait a bit longer for the restart to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Now keep checking until healthy
        while (Date.now() - startTime < maxWaitTime) {
          const health = await this.checkHealth();
          
          if (health.status === 'healthy') {
            // Wait a bit more to ensure everything is initialized
            await new Promise(resolve => setTimeout(resolve, 1000));
            return;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Strapi did not become healthy within timeout period');
      } else {
        // Strapi is healthy, just return
        return;
      }
    } finally {
      this.healthCheckInProgress = false;
    }
  }

  /**
   * Make a request with auth retry logic
   */
  private async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.request<T>(config);
      
      // Check if the response contains a Strapi error structure
      if (response.data && typeof response.data === 'object' && 'error' in response.data && response.data.error) {
        const error = response.data.error as any;
        
        // Log the full error for debugging
        if (config.url?.includes('update-schema')) {
          console.error('[Update Schema Error] Request:', JSON.stringify(config.data, null, 2));
          console.error('[Update Schema Error] Response:', JSON.stringify(response.data, null, 2));
        }
        
        const errorMessage = error.message || 'Strapi API error';
        const strapiError = new Error(errorMessage);
        
        // Add additional error details
        (strapiError as any).status = error.status;
        (strapiError as any).name = error.name;
        (strapiError as any).details = error.details;
        
        throw strapiError;
      }
      
      return response.data;
    } catch (error) {
      // Handle connection refused errors specifically
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused, check if Strapi instance is running');
      }
      
      // Handle HTTP errors (4xx, 5xx)
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        // Special handling for 401 - try to re-login
        if (status === 401) {
          const reLoginSuccess = await this.authManager.handleAuthError(error);
          if (reLoginSuccess) {
            // Retry the request with new auth
            const response = await this.axios.request<T>(config);
            
            // Check for Strapi errors in retry response too
            if (response.data && typeof response.data === 'object' && 'error' in response.data && response.data.error) {
              const error = response.data.error as any;
              const errorMessage = error.message || 'Strapi API error';
              const strapiError = new Error(errorMessage);
              
              (strapiError as any).status = error.status;
              (strapiError as any).name = error.name;
              (strapiError as any).details = error.details;
              
              throw strapiError;
            }
            
            return response.data;
          }
        }
        
        // Extract error message from response
        let errorMessage = `HTTP ${status} ${statusText}`;
        
        // Try to extract more detailed error information
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            // Plain text error response (like "Method Not Allowed")
            errorMessage = `${errorMessage}: ${error.response.data}`;
          } else if (error.response.data.error) {
            // Strapi error format
            const strapiError = error.response.data.error;
            errorMessage = strapiError.message || errorMessage;
            
            // Create proper error with all details
            const detailedError = new Error(errorMessage);
            (detailedError as any).status = status;
            (detailedError as any).statusText = statusText;
            (detailedError as any).details = strapiError.details;
            throw detailedError;
          } else if (error.response.data.message) {
            // Generic message format
            errorMessage = error.response.data.message;
          }
        }
        
        // Throw a proper error for all HTTP errors
        const httpError = new Error(errorMessage);
        (httpError as any).status = status;
        (httpError as any).statusText = statusText;
        throw httpError;
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  /**
   * Make an admin API request
   */
  async adminRequest<T>(endpoint: string, method: string = 'GET', data?: any, params?: any): Promise<T> {
    // Ensure we're logged in if using admin credentials
    if (this.config.adminEmail && this.config.adminPassword && !this.authManager.getJwtToken()) {
      const loginSuccess = await this.authManager.login();
      if (!loginSuccess) {
        throw new Error('Failed to authenticate with provided admin credentials');
      }
    }

    return this.makeRequest<T>({
      url: endpoint,
      method,
      data,
      params
    });
  }

  /**
   * List all content types
   */
  async listContentTypes(): Promise<ContentType[]> {
    // ONLY use content-manager/init endpoint for listing content types
    const response = await this.adminRequest<any>('/content-manager/init');
    if (response?.data?.contentTypes && Array.isArray(response.data.contentTypes)) {
      return this.processContentTypes(response.data.contentTypes);
    }
    return [];
  }

  private processContentTypes(data: any[]): ContentType[] {
    return data
      .filter((ct: any) => ct.uid && !ct.uid.startsWith('admin::') && !ct.uid.startsWith('plugin::'))
      .map((ct: any) => {
        const apiID = ct.apiID || ct.uid.split('.').pop() || '';
        const pluralApiId = ct.pluralApiId || ct.info?.pluralName || `${apiID}s`;
        
        return {
          uid: ct.uid,
          apiID,
          pluralApiId,
          info: {
            displayName: ct.info?.displayName || ct.schema?.displayName || apiID,
            description: ct.info?.description || ct.schema?.description,
            singularName: ct.info?.singularName,
            pluralName: ct.info?.pluralName
          },
          attributes: ct.attributes || ct.schema?.attributes || {},
          pluginOptions: ct.pluginOptions,
          isLocalized: ct.pluginOptions?.i18n?.localized === true
        };
      });
  }

  /**
   * Get entries for a content type
   */
  async getEntries(pluralApiId: string, options?: QueryOptions): Promise<any> {
    // Build query parameters
    const params: any = {};
    if (options?.filters) params.filters = options.filters;
    if (options?.pagination) params.pagination = options.pagination;
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

    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}`,
        'GET',
        undefined,
        params
      );
      
      if (response?.results) {
        return { data: response.results, meta: { pagination: response.pagination || {} } };
      }
      
      return { data: [], meta: {} };
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    const response = await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}`,
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
   * Get a single entry
   */
  async getEntry(pluralApiId: string, documentId: string, options?: QueryOptions): Promise<any> {
    const params: any = {};
    if (options?.populate) params.populate = options.populate;
    if (options?.fields) params.fields = options.fields;
    if (options?.locale) params.locale = options.locale;

    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}`,
        'GET',
        undefined,
        params
      );
      
      return response;
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    const response = await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}`,
      'GET',
      undefined,
      params
    );
    
    return response;
  }

  /**
   * Create an entry
   */
  async createEntry(contentType: string, pluralApiId: string, data: any, publish: boolean = false, locale?: string): Promise<any> {
    const endpoint = publish 
      ? `/content-manager/collection-types/${contentType}/actions/publish`
      : `/content-manager/collection-types/${contentType}`;
    
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }
    
    const response = await this.adminRequest<any>(
      endpoint,
      'POST',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Update an entry
   */
  async updateEntry(pluralApiId: string, documentId: string, data: any, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }
    
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}`,
        'PUT',
        data,
        params
      );
      return response?.data || response;
    }
    
    // Otherwise look it up by plural API ID
    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    const response = await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}`,
      'PUT',
      data,
      params
    );
    return response?.data || response;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(pluralApiId: string, documentId: string, locale?: string): Promise<void> {
    // If locale is specified, delete only that locale. Otherwise delete all locales
    const localeParam = locale ? `locale=${locale}` : 'locale=*';
    
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}?${localeParam}`,
        'DELETE'
      );
      return;
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}?${localeParam}`,
      'DELETE'
    );
  }

  /**
   * Upload media file
   */
  async uploadMedia(fileData: string, fileName: string, fileType: string): Promise<any> {
    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(fileData)) {
      throw new Error('Invalid base64 data');
    }

    // Validate file size
    const base64Size = fileData.length;
    const MAX_BASE64_SIZE = 1024 * 1024; // 1MB of base64
    
    if (base64Size > MAX_BASE64_SIZE) {
      const estimatedSizeMB = ((base64Size * 3) / 4 / (1024 * 1024)).toFixed(2);
      throw new Error(`File too large: ~${estimatedSizeMB}MB. Maximum ~0.75MB for base64 upload.`);
    }

    // Try to decode to verify it's valid base64
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileData, 'base64');
    } catch (error) {
      console.error('[Upload] Failed to decode base64 data:', error);
      throw new Error('Invalid base64 data');
    }
    const formData = new FormData();
    formData.append('files', buffer, { 
      filename: fileName, 
      contentType: fileType 
    });
    formData.append('fileInfo', JSON.stringify({ name: fileName, folder: null }));

    try {
      // Ensure we're logged in if using admin credentials
      if (this.config.adminEmail && this.config.adminPassword && !this.authManager.getJwtToken()) {
        const loginSuccess = await this.authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      // Media upload uses /upload endpoint with admin auth
      const response = await this.makeRequest<any>({
        url: '/upload',
        method: 'POST',
        data: formData,
        headers: {
          ...formData.getHeaders()
        }
      });

      // Response is an array of uploaded files
      return Array.isArray(response) ? response[0] : response;
    } catch (error) {
      console.error('[API] Failed to upload media:', error);
      throw error;
    }
  }

  /**
   * Upload media from file path
   */
  async uploadMediaFromPath(filePath: string, fileName?: string, fileType?: string): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(stats.size / (1024 * 1024)).toFixed(2)}MB. Maximum 10MB.`);
    }

    const actualFileName = fileName || path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    if (!fileType) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4'
      };
      fileType = mimeTypes[ext] || 'application/octet-stream';
    }

    return this.uploadMedia(base64Data, actualFileName, fileType);
  }

  /**
   * Publish an entry
   */
  async publishEntry(pluralApiId: string, documentId: string, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }
    
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}/actions/publish`,
        'POST',
        {},
        params
      );
      return response?.data || response;
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    const response = await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}/actions/publish`,
      'POST',
      {},
      params
    );
    return response?.data || response;
  }

  /**
   * Unpublish an entry
   */
  async unpublishEntry(pluralApiId: string, documentId: string, locale?: string): Promise<any> {
    const params: any = {};
    if (locale) {
      params.locale = locale;
    }
    
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}/actions/unpublish`,
        'POST',
        { discardDraft: false },
        params
      );
      return response?.data || response;
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    const response = await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}/actions/unpublish`,
      'POST',
      { discardDraft: false },
      params
    );
    return response?.data || response;
  }

  /**
   * Get content type schema
   */
  async getContentTypeSchema(contentType: string): Promise<any> {
    // ONLY use content-type-builder/schema endpoint for getting content type schemas
    const schemaResponse = await this.adminRequest<any>('/content-type-builder/schema');
    
    // The response contains all schemas in different categories
    if (schemaResponse?.data) {
      // Check in contentTypes
      const contentTypes = schemaResponse.data.contentTypes || {};
      for (const ct of Object.values(contentTypes)) {
        if ((ct as any).uid === contentType) {
          return ct;
        }
      }
      
      // Check in singleTypes
      const singleTypes = schemaResponse.data.singleTypes || {};
      for (const st of Object.values(singleTypes)) {
        if ((st as any).uid === contentType) {
          return st;
        }
      }
    }
    
    throw new Error(`Content type ${contentType} not found`);
  }

  /**
   * Connect relations
   */
  async connectRelation(pluralApiId: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    const connectItems = relatedIds.map(id => ({ documentId: id }));
    
    const data = {
      [relationField]: {
        connect: connectItems
      }
    };

    return this.updateEntry(pluralApiId, documentId, data);
  }

  /**
   * Disconnect relations
   */
  async disconnectRelation(pluralApiId: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    const disconnectItems = relatedIds.map(id => ({ documentId: id }));
    
    const data = {
      [relationField]: {
        disconnect: disconnectItems
      }
    };

    return this.updateEntry(pluralApiId, documentId, data);
  }

  /**
   * Set relations (replace all)
   */
  async setRelation(pluralApiId: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    // For set operation, we just pass an array of document IDs
    const data = {
      [relationField]: relatedIds
    };

    return this.updateEntry(pluralApiId, documentId, data);
  }

  /**
   * Create content type
   */
  async createContentType(contentTypeData: any): Promise<any> {
    const singularName = contentTypeData.singularName.toLowerCase().replace(/\s+/g, '-');
    const pluralName = contentTypeData.pluralName.toLowerCase().replace(/\s+/g, '-');
    
    const payload = {
      data: {
        components: [],
        contentTypes: [{
          action: 'create',
          uid: `api::${singularName}.${singularName}`,
          modelName: singularName,
          kind: contentTypeData.kind || 'collectionType',
          globalId: contentTypeData.displayName.replace(/\s+/g, ''),
          pluginOptions: contentTypeData.pluginOptions || {},
          collectionName: pluralName,
          modelType: 'contentType',
          attributes: Object.entries(contentTypeData.attributes || {}).map(([name, config]: [string, any]) => ({
            action: 'create',
            name,
            properties: config
          })),
          status: 'NEW',
          draftAndPublish: contentTypeData.draftAndPublish !== false,
          singularName,
          pluralName,
          displayName: contentTypeData.displayName,
          description: contentTypeData.description || ''
        }]
      }
    };

    const response = await this.adminRequest<any>(
      '/content-type-builder/update-schema',
      'POST',
      payload
    );

    // Wait for Strapi to reload after schema change
    if (this.config.devMode) {
      // Force wait to ensure Strapi has time to start restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.waitForHealthy();
    }

    return response?.data?.uid ? response.data : { uid: `api::${singularName}.${singularName}` };
  }

  /**
   * Update content type
   */
  async updateContentType(contentType: string, attributes: Record<string, any>, options?: any): Promise<any> {
    // Fetch current schema
    const currentSchema = await this.getContentTypeSchema(contentType);
    
    // SAFETY CHECK: Compare existing attributes with provided attributes
    // Handle both array and object formats for attributes
    let existingAttributeNames: string[] = [];
    if (Array.isArray(currentSchema.attributes)) {
      // If attributes is an array, extract attribute names from the array
      existingAttributeNames = currentSchema.attributes
        .filter((attr: any) => attr && typeof attr === 'object' && attr.name)
        .map((attr: any) => attr.name);
    } else if (currentSchema.attributes && typeof currentSchema.attributes === 'object') {
      // If attributes is an object, use the keys
      existingAttributeNames = Object.keys(currentSchema.attributes);
    }
    
    const providedAttributeNames = Object.keys(attributes);
    const deletedAttributes = existingAttributeNames.filter(name => !providedAttributeNames.includes(name));
    
    if (deletedAttributes.length > 1) {
      throw new Error(
        `SAFETY BLOCK: This update would delete ${deletedAttributes.length} attributes: ${deletedAttributes.join(', ')}. ` +
        'To prevent data loss, updates that delete more than one field at a time are blocked. ' +
        'If this is intentional, please update attributes one at a time or modify the schema files directly.'
      );
    }
    
    if (deletedAttributes.length === 1) {
      console.warn(`[WARNING] This update will delete attribute: ${deletedAttributes[0]}`);
    }
    
    // Build the update payload in the format expected by update-schema endpoint
    const parts = contentType.split('::');
    const modelName = parts[1]?.split('.')[1] || parts[0];
    
    // Merge plugin options if provided
    const pluginOptions = {
      ...(currentSchema.pluginOptions || {}),
      ...(options?.pluginOptions || {})
    };
    
    const payload = {
      data: {
        components: [],
        contentTypes: [{
          action: 'update',
          uid: contentType,
          modelName: modelName,
          kind: currentSchema.kind || 'collectionType',
          globalId: currentSchema.globalId || modelName.charAt(0).toUpperCase() + modelName.slice(1),
          pluginOptions: pluginOptions,
          collectionName: currentSchema.collectionName || `${modelName}s`,
          modelType: 'contentType',
          attributes: [
            // First, include ALL existing attributes (to preserve them)
            ...Object.entries(currentSchema.attributes || {}).map(([name, existingConfig]: [string, any]) => {
              // Check if this attribute is being updated
              const updatedConfig = attributes[name];
              
              return {
                action: 'update',
                name,
                properties: updatedConfig ? { ...existingConfig, ...updatedConfig } : existingConfig
              };
            }),
            // Then, add any NEW attributes that don't exist yet
            ...Object.entries(attributes)
              .filter(([name]) => !currentSchema.attributes || !currentSchema.attributes[name])
              .map(([name, config]: [string, any]) => ({
                action: 'update',
                name,
                properties: config
              }))
          ],
          status: 'CHANGED',
          draftAndPublish: currentSchema.draftAndPublish !== false,
          singularName: currentSchema.singularName || modelName,
          pluralName: currentSchema.pluralName || `${modelName}s`,
          displayName: currentSchema.displayName || modelName.charAt(0).toUpperCase() + modelName.slice(1),
          description: currentSchema.description || ''
        }]
      }
    };

    const response = await this.adminRequest<any>(
      '/content-type-builder/update-schema',
      'POST',
      payload
    );

    // Wait for Strapi to reload after schema change
    if (this.config.devMode) {
      // Force wait to ensure Strapi has time to start restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.waitForHealthy();
    }

    return response;
  }

  /**
   * Delete content type
   */
  async deleteContentType(contentType: string): Promise<any> {
    const payload = {
      data: {
        components: [],
        contentTypes: [{
          action: 'delete',
          uid: contentType
        }]
      }
    };

    const response = await this.adminRequest<any>(
      '/content-type-builder/update-schema',
      'POST',
      payload
    );

    // Wait for Strapi to reload after schema change
    if (this.config.devMode) {
      // Force wait to ensure Strapi has time to start restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.waitForHealthy();
    }

    return response;
  }

  /**
   * List components
   */
  async listComponents(): Promise<ComponentData[]> {
    // ONLY use content-type-builder/schema endpoint for listing components
    const allSchemas = await this.adminRequest<any>('/content-type-builder/schema');
    
    // The response structure is { data: { contentTypes: {...}, components: {...} } }
    if (allSchemas?.data?.components) {
      const components = allSchemas.data.components;
      
      // Transform the components object into an array
      return Object.entries(components).map(([uid, comp]: [string, any]) => ({
        uid: uid,
        category: comp.category || uid.split('.')[0],
        displayName: comp.info?.displayName || uid.split('.').pop(),
        description: comp.info?.description,
        icon: comp.info?.icon,
        attributes: comp.attributes
      }));
    }
    
    return [];
  }

  /**
   * Get component schema
   */
  async getComponentSchema(componentUid: string): Promise<any> {
    // ONLY use content-type-builder/schema endpoint for getting component schemas
    const allSchemas = await this.adminRequest<any>('/content-type-builder/schema');
    
    // The response structure is { data: { contentTypes: {...}, components: {...} } }
    if (allSchemas?.data) {
      const schemaData = allSchemas.data;
      
      // Look for components in the schema data structure
      if (schemaData.components && schemaData.components[componentUid]) {
        const component = schemaData.components[componentUid];
        
        // Transform attributes from array format to object format if needed
        let attributes = component.attributes || {};
        
        // Strapi v5 returns attributes as an array, transform it to object format
        if (Array.isArray(component.attributes)) {
          attributes = {};
          for (const attr of component.attributes) {
            if (attr.name) {
              const { name, ...attrProps } = attr;
              attributes[name] = attrProps;
            }
          }
        }
        
        // Return in the expected format with uid and schema properties
        return {
          uid: componentUid,
          schema: {
            ...component,
            attributes
          }
        };
      }
    }
    
    throw new Error(`Component ${componentUid} not found`);
  }

  /**
   * Create component
   */
  async createComponent(componentData: any): Promise<any> {
    // Generate component UID from category and display name
    const componentName = componentData.displayName.toLowerCase().replace(/\s+/g, '-');
    const componentUid = `${componentData.category}.${componentName}`;
    
    // Build the update-schema payload for creating a component
    const payload = {
      data: {
        components: [{
          action: 'create',
          uid: componentUid,
          category: componentData.category,
          icon: componentData.icon || 'brush',
          displayName: componentData.displayName,
          description: componentData.description || '',
          collectionName: `components_${componentData.category.replace(/-/g, '_')}_${componentName.replace(/-/g, '_')}`,
          attributes: Object.entries(componentData.attributes || {}).map(([name, config]: [string, any]) => ({
            action: 'create',
            name,
            properties: config
          }))
        }],
        contentTypes: []
      }
    };
    
    const response = await this.adminRequest<any>(
      '/content-type-builder/update-schema',
      'POST',
      payload
    );
    
    console.error('[StrapiClient] Component creation response:', JSON.stringify(response, null, 2));
    
    // Wait for Strapi to reload after schema change
    if (this.config.devMode) {
      // Force wait to ensure Strapi has time to start restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.waitForHealthy();
      // Additional wait for schema to be fully available
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // The update-schema endpoint only returns { uid: "..." } for created components
    // We need to fetch the full component schema after creation
    try {
      const fullSchema = await this.getComponentSchema(componentUid);
      return fullSchema;
    } catch (error) {
      // If we can't get the schema, return what we know
      console.error('[StrapiClient] Failed to fetch created component schema:', error);
      return {
        uid: componentUid,
        schema: {
          uid: componentUid,
          category: componentData.category,
          displayName: componentData.displayName,
          description: componentData.description || '',
          icon: componentData.icon || 'brush',
          attributes: componentData.attributes
        }
      };
    }
  }

  /**
   * Update component
   */
  async updateComponent(componentUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
    // Fetch current schema
    const currentSchema = await this.getComponentSchema(componentUid);
    const componentData = currentSchema.schema || currentSchema;
    
    // Filter out system fields that shouldn't be included in schema updates
    const systemFields = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy'];
    
    // Build attributes array with ALL existing attributes + new/modified ones
    const attributesArray = [];
    const existingAttributes = componentData.attributes || {};
    
    // First, add all existing attributes with action: "update"
    for (const [name, config] of Object.entries(existingAttributes)) {
      if (!systemFields.includes(name)) {
        // Check if this attribute is being modified
        if (attributesToUpdate[name]) {
          attributesArray.push({
            action: 'update',
            name,
            properties: attributesToUpdate[name]
          });
        } else {
          // Keep existing attribute unchanged
          attributesArray.push({
            action: 'update', 
            name,
            properties: config
          });
        }
      }
    }
    
    // Then add any new attributes with action: "create"
    for (const [name, config] of Object.entries(attributesToUpdate)) {
      if (!existingAttributes[name] && !systemFields.includes(name)) {
        attributesArray.push({
          action: 'create',
          name,
          properties: config
        });
      }
    }
    
    // Build the update-schema payload for updating a component
    const payload = {
      data: {
        components: [{
          action: 'update',
          uid: componentUid,
          category: componentData.category || componentUid.split('.')[0],
          icon: componentData.info?.icon || componentData.icon || 'brush',
          displayName: componentData.info?.displayName || componentData.displayName,
          description: componentData.info?.description || componentData.description || '',
          collectionName: componentData.collectionName,
          attributes: attributesArray
        }],
        contentTypes: []
      }
    };

    const response = await this.adminRequest<any>(
      '/content-type-builder/update-schema',
      'POST',
      payload
    );

    // Wait for Strapi to reload after schema change
    if (this.config.devMode) {
      // Force wait to ensure Strapi has time to start restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.waitForHealthy();
    }

    return response?.data || response;
  }

  /**
   * Direct REST API call
   */
  async strapiRest(endpoint: string, method: string = 'GET', params?: any, body?: any, authenticated: boolean = true): Promise<any> {
    let headers: any = {};
    
    // Only add authentication if requested
    if (authenticated) {
      // Check if this is an admin endpoint
      const isAdminEndpoint = endpoint.startsWith('admin/') || endpoint.startsWith('/admin/') || 
                             endpoint.includes('content-manager') || endpoint.includes('content-type-builder');
      
      if (isAdminEndpoint) {
        // Admin endpoints require JWT token from admin login
        if (this.config.adminEmail && this.config.adminPassword) {
          await this.authManager.login();
          const jwtToken = this.authManager.getJwtToken();
          if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`;
          } else {
            console.error('[StrapiClient] Failed to get JWT token for admin API access');
          }
        } else {
          throw new Error('Admin credentials required for admin endpoint access');
        }
      } else {
        // Regular API endpoints can use API token
        const apiToken = await this.tokenManager.getApiToken();
        if (apiToken) {
          headers['Authorization'] = `Bearer ${apiToken}`;
        } else {
          console.error('[StrapiClient] Failed to get API token for REST API access');
        }
      }
    }
    
    const config: AxiosRequestConfig = {
      url: endpoint,
      method,
      params,
      data: body,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    };

    console.error('[StrapiClient] Making REST API request:', {
      url: endpoint,
      method,
      hasAuth: !!headers['Authorization']
    });

    // Use a separate axios instance for REST API calls to avoid auth interceptor
    try {
      const response = await axios.request({
        ...config,
        baseURL: this.config.url,
        validateStatus: (status) => status < 500
      });
      
      // Check if the response indicates an error
      if (response.status >= 400) {
        const error = response.data?.error || response.data;
        const errorMessage = error?.message || `Request failed with status ${response.status}`;
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          method,
          ...(error?.details && { details: error.details })
        };
        console.error('[StrapiClient] REST API error:', errorDetails);
        throw new Error(`Strapi API error: ${errorMessage}`, { cause: errorDetails });
      }
      
      // Check if response is HTML (which indicates wrong endpoint or auth failure)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html') && typeof response.data === 'string') {
        const isLoginPage = response.data.includes('Strapi Admin') || response.data.includes('strapi--root');
        const errorMsg = isLoginPage 
          ? `Authentication failed or wrong endpoint. Got HTML login page for ${method} ${endpoint}. Check if endpoint requires admin auth.`
          : `Invalid API endpoint ${method} ${endpoint}. Got HTML response instead of JSON.`;
        
        console.error('[StrapiClient] HTML response detected:', {
          endpoint,
          method,
          contentType,
          isLoginPage,
          htmlSnippet: response.data.substring(0, 200)
        });
        
        throw new Error(errorMsg);
      }
      
      return response.data;
    } catch (error) {
      // Handle connection refused errors specifically
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused, check if Strapi instance is running');
      }
      throw error;
    }
  }

  /**
   * Helper to get content type by plural API ID
   */
  private async getContentTypeByPluralApiId(pluralApiId: string): Promise<ContentType | undefined> {
    const contentTypes = await this.listContentTypes();
    return contentTypes.find(ct => ct.pluralApiId === pluralApiId);
  }

  /**
   * Delete all entries for a content type
   * WARNING: This is a destructive operation that will delete ALL data
   */
  async deleteAllEntries(pluralApiId: string): Promise<{ deletedCount: number }> {
    let page = 1;
    let hasMore = true;
    let totalDeleted = 0;
    const errors: any[] = [];
    
    while (hasMore) {
      // Get entries for current page - content-manager API doesn't use status parameter
      const response = await this.getEntries(pluralApiId, {
        pagination: { page, pageSize: 100 }
      });
      
      const entries = response.data || [];
      
      if (entries.length === 0) {
        hasMore = false;
        break;
      }
      
      // Delete all entries on this page
      for (const entry of entries) {
        try {
          await this.deleteEntry(pluralApiId, entry.documentId);
          totalDeleted++;
        } catch (error) {
          console.error(`[Delete All] Failed to delete ${entry.documentId}:`, error);
          errors.push({ documentId: entry.documentId, error });
        }
      }
      
      // Check if there are more pages
      const pagination = response.meta?.pagination || {};
      const totalPages = pagination.pageCount || 1;
      
      if (page >= totalPages) {
        hasMore = false;
      } else {
        page++;
      }
    }
    
    if (errors.length > 0) {
      console.error(`[Delete All] Failed to delete ${errors.length} entries`);
    }
    
    return { deletedCount: totalDeleted };
  }

  /**
   * Helper to infer schema from entry
   */
  private inferSchemaFromEntry(contentType: string, entry: any): any {
    const attributes: Record<string, any> = {};
    const data = entry.attributes || entry;

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'id' || key === 'documentId') return;
      
      let type: string = typeof value;
      if (type === 'object') {
        if (value === null) {
          type = 'string';
        } else if (Array.isArray(value)) {
          type = 'relation';
        } else if (value instanceof Date) {
          type = 'datetime';
        } else {
          type = 'json';
        }
      }
      
      attributes[key] = { type };
    });

    return {
      uid: contentType,
      apiID: contentType.split('.').pop() || contentType,
      info: {
        displayName: contentType.split('.').pop() || contentType,
        description: `Inferred schema for ${contentType}`
      },
      attributes
    };
  }

  /**
   * List media files
   */
  async listMedia(params?: any): Promise<any> {
    try {
      // Ensure we're logged in if using admin credentials
      if (this.config.adminEmail && this.config.adminPassword && !this.authManager.getJwtToken()) {
        const loginSuccess = await this.authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      const response = await this.makeRequest<any>({
        url: '/upload/files',
        method: 'GET',
        params
      });

      return this.filterBase64FromResponse(response);
    } catch (error) {
      console.error('[API] Failed to list media:', error);
      throw error;
    }
  }

  /**
   * List media folders
   */
  async listMediaFolders(params?: any): Promise<any> {
    try {
      // Ensure we're logged in if using admin credentials
      if (this.config.adminEmail && this.config.adminPassword && !this.authManager.getJwtToken()) {
        const loginSuccess = await this.authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      const response = await this.makeRequest<any>({
        url: '/upload/folders',
        method: 'GET',
        params
      });

      return response;
    } catch (error) {
      console.error('[API] Failed to list folders:', error);
      throw error;
    }
  }

  /**
   * Filter base64 data from responses
   */
  private filterBase64FromResponse(data: any): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.filterBase64FromResponse(item));
    }
    
    if (typeof data === 'object') {
      const filtered: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) {
          filtered[key] = `[BASE64_DATA_FILTERED - ${value.length} chars]`;
        } else {
          filtered[key] = this.filterBase64FromResponse(value);
        }
      }
      
      return filtered;
    }
    
    return data;
  }
}