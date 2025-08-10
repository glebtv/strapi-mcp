import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import qs from 'qs';
import { AuthManager } from './auth-manager.js';
import { TokenManager } from './token-manager.js';
import { ContentOperations } from './client/content-operations.js';
import { MediaOperations } from './client/media-operations.js';
import { RelationOperations } from './client/relation-operations.js';
import { StrapiConfig, HealthCheckResult } from './types.js';

export class StrapiClient {
  private axios: AxiosInstance;
  private authManager: AuthManager;
  private tokenManager: TokenManager;
  public config: StrapiConfig;
  private healthCheckInProgress = false;

  // Operation modules
  public contentOps: ContentOperations;
  public mediaOps: MediaOperations;
  public relationOps: RelationOperations;

  constructor(config: StrapiConfig) {
    this.config = config;
    this.authManager = new AuthManager(config);
    this.tokenManager = new TokenManager(this);

    // Initialize operation modules
    this.contentOps = new ContentOperations(this);
    this.mediaOps = new MediaOperations(this);
    this.relationOps = new RelationOperations(this);

    this.axios = axios.create({
      baseURL: config.url,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: (status) => status < 500,
      // Use qs for parameter serialization to properly handle nested filters
      paramsSerializer: {
        serialize: (params) => qs.stringify(params, {
          arrayFormat: 'brackets',
          encode: true,  // Properly encode special characters
          encodeValuesOnly: true  // Only encode values, not keys
        })
      }
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
   * Make a request with auth retry logic
   */
  async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
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
            // Remove surrounding quotes if present (from JSON-encoded strings)
            const cleanedData = error.response.data.replace(/^"(.*)"$/, '$1');
            errorMessage = `${errorMessage}: ${cleanedData}`;
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
   * Get content manager initialization data (content types and components)
   */
  async contentManagerInit(): Promise<any> {
    // Use content-manager/init endpoint for listing content types and components
    const response = await this.adminRequest<any>('/content-manager/init');
    // Return the raw data from the API response
    return response?.data || { contentTypes: [], components: [] };
  }


  // Delegate methods to operation modules
  async getEntries(contentTypeUid: string, options?: any): Promise<any> {
    return this.contentOps.getEntries(contentTypeUid, options);
  }


  async createEntry(contentTypeUid: string, data: any, locale?: string): Promise<any> {
    return this.contentOps.createEntry(contentTypeUid, data, locale);
  }

  async updateEntryDraft(contentTypeUid: string, documentId: string, data: any, locale?: string): Promise<any> {
    return this.contentOps.updateEntryDraft(contentTypeUid, documentId, data, locale);
  }

  async updateEntryAndPublish(contentTypeUid: string, documentId: string, data: any, locale?: string): Promise<any> {
    return this.contentOps.updateEntryAndPublish(contentTypeUid, documentId, data, locale);
  }

  async deleteEntry(contentTypeUid: string, documentId: string, locale?: string): Promise<void> {
    return this.contentOps.deleteEntry(contentTypeUid, documentId, locale);
  }

  async publishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
    return this.contentOps.publishEntries(contentTypeUid, documentIds);
  }

  async unpublishEntries(contentTypeUid: string, documentIds: string[]): Promise<any> {
    return this.contentOps.unpublishEntries(contentTypeUid, documentIds);
  }

  async createPublishedEntry(contentTypeUid: string, data: any, locale?: string): Promise<any> {
    return this.contentOps.createPublishedEntry(contentTypeUid, data, locale);
  }

  async createLocalizedDraft(contentTypeUid: string, documentId: string, data: any, locale: string): Promise<any> {
    return this.contentOps.createLocalizedDraft(contentTypeUid, documentId, data, locale);
  }

  async createAndPublishLocalizedEntry(contentTypeUid: string, documentId: string, data: any, locale: string): Promise<any> {
    return this.contentOps.createAndPublishLocalizedEntry(contentTypeUid, documentId, data, locale);
  }

  async publishLocalizedEntry(contentTypeUid: string, documentId: string, locale: string): Promise<any> {
    return this.contentOps.publishLocalizedEntry(contentTypeUid, documentId, locale);
  }

  async uploadMedia(fileData: string, fileName: string, fileType: string): Promise<any> {
    return this.mediaOps.uploadMedia(fileData, fileName, fileType);
  }

  async uploadMediaFromPath(filePath: string, fileName?: string, fileType?: string): Promise<any> {
    return this.mediaOps.uploadMediaFromPath(filePath, fileName, fileType);
  }

  async listMedia(params?: any): Promise<any> {
    return this.mediaOps.listMedia(params);
  }

  async listMediaFolders(params?: any): Promise<any> {
    return this.mediaOps.listMediaFolders(params);
  }

  async connectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    return this.relationOps.connectRelation(contentTypeUid, documentId, relationField, relatedIds);
  }

  async disconnectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    return this.relationOps.disconnectRelation(contentTypeUid, documentId, relationField, relatedIds);
  }

  async setRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    return this.relationOps.setRelation(contentTypeUid, documentId, relationField, relatedIds);
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
}
