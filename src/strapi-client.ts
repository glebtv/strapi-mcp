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
    } catch {
      // Silently handle connection errors to avoid polluting test output
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
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Try to re-login if using admin auth
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
    // Use content-manager/init endpoint which provides more complete information including pluginOptions
    const response = await this.adminRequest<any>('/content-manager/init');
    if (response?.data?.contentTypes && Array.isArray(response.data.contentTypes)) {
      return this.processContentTypes(response.data.contentTypes);
    }
    // Fallback to content-type-builder endpoint
    const builderResponse = await this.adminRequest<any>('/admin/content-type-builder/content-types');
    if (builderResponse?.data && Array.isArray(builderResponse.data)) {
      return this.processContentTypes(builderResponse.data);
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
  async createEntry(contentType: string, pluralApiId: string, data: any, publish: boolean = false): Promise<any> {
    const endpoint = publish 
      ? `/content-manager/collection-types/${contentType}/actions/publish`
      : `/content-manager/collection-types/${contentType}`;
    
    const response = await this.adminRequest<any>(
      endpoint,
      'POST',
      data
    );
    return response?.data || response;
  }

  /**
   * Update an entry
   */
  async updateEntry(pluralApiId: string, documentId: string, data: any): Promise<any> {
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}`,
        'PUT',
        data
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
      data
    );
    return response?.data || response;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(pluralApiId: string, documentId: string): Promise<void> {
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}?locale=*`,
        'DELETE'
      );
      return;
    }

    const contentType = await this.getContentTypeByPluralApiId(pluralApiId);
    
    if (!contentType) {
      throw new Error(`Content type not found: ${pluralApiId}`);
    }
    
    await this.adminRequest<any>(
      `/content-manager/collection-types/${contentType.uid}/${documentId}?locale=*`,
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
  async publishEntry(pluralApiId: string, documentId: string): Promise<any> {
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}/actions/publish`,
        'POST',
        {}
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
      {}
    );
    return response?.data || response;
  }

  /**
   * Unpublish an entry
   */
  async unpublishEntry(pluralApiId: string, documentId: string): Promise<any> {
    // First try to use it as a content type UID directly
    if (pluralApiId.includes('::')) {
      const response = await this.adminRequest<any>(
        `/content-manager/collection-types/${pluralApiId}/${documentId}/actions/unpublish`,
        'POST',
        { discardDraft: false }
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
      { discardDraft: false }
    );
    return response?.data || response;
  }

  /**
   * Get content type schema
   */
  async getContentTypeSchema(contentType: string): Promise<any> {
    // Try the comprehensive content-type-builder/schema endpoint first
    try {
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
    } catch (error) {
      console.error('[Schema] content-type-builder/schema endpoint failed, trying fallbacks:', error);
      // Continue to fallbacks if this endpoint fails
    }
    
    // Try content-manager/init to get full schema with pluginOptions
    const initResponse = await this.adminRequest<any>('/content-manager/init');
    if (initResponse?.data?.contentTypes) {
      const contentTypes = Array.isArray(initResponse.data.contentTypes) 
        ? initResponse.data.contentTypes 
        : [];
      const found = contentTypes.find((ct: any) => ct.uid === contentType);
      if (found) {
        return found;
      }
    }
    
    // Fallback to content-type-builder endpoint
    const response = await this.adminRequest<any>(
      `/admin/content-type-builder/content-types/${contentType}`
    );
    return response?.data || response;
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
          attributes: Object.entries(attributes).map(([name, config]: [string, any]) => {
            // Find existing attribute - handle both array and object formats
            let existingAttr = null;
            if (Array.isArray(currentSchema.attributes)) {
              existingAttr = currentSchema.attributes.find((attr: any) => attr.name === name);
            } else if (currentSchema.attributes && typeof currentSchema.attributes === 'object') {
              existingAttr = currentSchema.attributes[name];
            }
            
            // For update, we need the full config including pluginOptions
            const properties = existingAttr ? { ...existingAttr, ...config } : config;
            
            return {
              action: 'update',
              name,
              properties
            };
          }),
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
    const response = await this.adminRequest<any>(
      '/admin/content-type-builder/components'
    );

    const components = response?.data || [];
    return components.map((comp: any) => ({
      uid: comp.uid,
      category: comp.category,
      displayName: comp.info?.displayName || comp.uid.split('.').pop(),
      description: comp.info?.description,
      icon: comp.info?.icon,
      attributes: comp.attributes
    }));
  }

  /**
   * Get component schema
   */
  async getComponentSchema(componentUid: string): Promise<any> {
    // Always fetch all schemas from /content-type-builder/schema
    const allSchemas = await this.adminRequest<any>(
      '/content-type-builder/schema'
    );
    
    if (allSchemas?.data?.components?.[componentUid]) {
      return allSchemas.data.components[componentUid];
    }
    
    throw new Error(`Component ${componentUid} not found`);
  }

  /**
   * Create component
   */
  async createComponent(componentData: any): Promise<any> {
    const payload = {
      component: {
        category: componentData.category,
        icon: componentData.icon || 'brush',
        displayName: componentData.displayName,
        attributes: componentData.attributes || {}
      }
    };

    const response = await this.adminRequest<any>(
      '/admin/content-type-builder/components',
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
   * Update component
   */
  async updateComponent(componentUid: string, attributesToUpdate: Record<string, any>): Promise<any> {
    // Fetch current schema
    const currentSchema = await this.getComponentSchema(componentUid);
    
    const payload = {
      component: {
        ...currentSchema,
        attributes: {
          ...currentSchema.attributes,
          ...attributesToUpdate
        }
      }
    };

    // Remove uid from payload
    delete payload.component.uid;

    const response = await this.adminRequest<any>(
      `/admin/content-type-builder/components/${componentUid}`,
      'PUT',
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
      // First, ensure we're logged in as admin (if admin credentials are available)
      if (this.config.adminEmail && this.config.adminPassword) {
        await this.authManager.login();
      }
      
      // Try to get or create an API token for REST API access
      const apiToken = await this.tokenManager.getApiToken();
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      } else {
        console.error('[StrapiClient] Failed to get API token for REST API access');
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
    const response = await axios.request({
      ...config,
      baseURL: this.config.url,
      validateStatus: (status) => status < 500
    });
    
    return response.data;
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