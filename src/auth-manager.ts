import axios, { AxiosError } from 'axios';
import { StrapiConfig, AuthTokens } from './types.js';

export class AuthManager {
  private config: StrapiConfig;
  private tokens: AuthTokens = {};
  private loginPromise: Promise<boolean> | null = null;

  constructor(config: StrapiConfig) {
    this.config = config;
    
    // Set initial API token if provided
    if (config.apiToken) {
      this.tokens.apiToken = config.apiToken;
    }
  }

  /**
   * Get current authentication headers
   */
  getAuthHeaders(): Record<string, string> {
    if (this.tokens.jwt) {
      return { 'Authorization': `Bearer ${this.tokens.jwt}` };
    } else if (this.tokens.apiToken) {
      return { 'Authorization': `Bearer ${this.tokens.apiToken}` };
    }
    return {};
  }

  /**
   * Check if we have valid authentication
   */
  hasAuth(): boolean {
    return !!(this.tokens.jwt || this.tokens.apiToken);
  }

  /**
   * Get current JWT token
   */
  getJwtToken(): string | undefined {
    return this.tokens.jwt;
  }

  /**
   * Login to Strapi admin
   */
  async login(): Promise<boolean> {
    // If already logging in, wait for that to complete
    if (this.loginPromise) {
      return this.loginPromise;
    }

    // If no admin credentials, can't login
    if (!this.config.adminEmail || !this.config.adminPassword) {
      console.error('[Auth] No admin credentials provided');
      return false;
    }

    // If already have a JWT, consider it valid (could add expiry check)
    if (this.tokens.jwt) {
      return true;
    }

    this.loginPromise = this.performLogin();
    
    try {
      const result = await this.loginPromise;
      return result;
    } finally {
      this.loginPromise = null;
    }
  }

  private async performLogin(): Promise<boolean> {
    const maxRetries = 5;
    let retryDelay = 1000; // Start with 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.error(`[Auth] Login attempt ${attempt}/${maxRetries} to ${this.config.url}/admin/login`);
        
        const response = await axios.post(
          `${this.config.url}/admin/login`,
          {
            email: this.config.adminEmail,
            password: this.config.adminPassword
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            validateStatus: (status) => status < 500
          }
        );

        if (response.status === 200 && response.data?.data?.token) {
          this.tokens.jwt = response.data.data.token;
          console.error('[Auth] Successfully logged in to Strapi admin');
          return true;
        }
        
        if (response.status === 429) {
          // Rate limited - wait and retry
          console.error(`[Auth] Login rate limited (429), attempt ${attempt}/${maxRetries}, waiting ${retryDelay}ms before retry`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff
            continue;
          }
        }

        // For any other error (including 400/401), fail immediately without retrying
        const errorData = response.data?.error || response.data;
        console.error(`[Auth] Login failed with status ${response.status}: ${errorData?.message || 'Unknown error'}`);
        return false;
      } catch (error) {
        // Handle connection refused errors specifically
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
          console.error('[Auth] Connection refused, check if Strapi instance is running');
          throw new Error('Connection refused, check if Strapi instance is running');
        }
        
        // Only retry on network errors, not authentication errors
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          console.error(`[Auth] Login rate limited in catch block, attempt ${attempt}/${maxRetries}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2;
            continue;
          }
        }
        
        // For any other error, fail immediately
        console.error('[Auth] Login error:', error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Clear JWT token (for re-login on 401)
   */
  clearJwtToken(): void {
    this.tokens.jwt = undefined;
  }

  /**
   * Handle authentication error and retry if needed
   */
  async handleAuthError(error: AxiosError): Promise<boolean> {
    if (error.response?.status === 401 && this.tokens.jwt) {
      console.error('[Auth] JWT token expired, attempting re-login...');
      this.clearJwtToken();
      return await this.login();
    }
    return false;
  }
}