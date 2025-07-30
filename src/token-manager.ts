import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StrapiClient } from './strapi-client.js';

interface TokenCache {
  adminJwt?: string;
  apiKey?: string;
  createdAt?: string;
}

export class TokenManager {
  private tokensPath: string;
  private client: StrapiClient;

  constructor(client: StrapiClient) {
    this.client = client;
    // Create ~/.mcp directory if it doesn't exist
    const mcpDir = path.join(os.homedir(), '.mcp');
    if (!fs.existsSync(mcpDir)) {
      fs.mkdirSync(mcpDir, { recursive: true });
    }
    this.tokensPath = path.join(mcpDir, 'strapi-mcp.tokens.json');
  }

  /**
   * Get or create an API token for REST API access
   */
  async getApiToken(): Promise<string | null> {
    // Try to load existing token
    const cache = this.loadTokenCache();
    if (cache.apiKey) {
      return cache.apiKey;
    }

    // Create a new API token
    try {
      console.error('[TokenManager] Creating new API token for REST API access');
      const response = await this.client.adminRequest<any>(
        '/admin/api-tokens',
        'POST',
        {
          name: 'MCP REST API Access',
          description: 'Auto-generated token for MCP server REST API access',
          type: 'full-access',
          lifespan: null,
          permissions: null
        }
      );

      if (response?.data?.accessKey) {
        // Save the token
        cache.apiKey = response.data.accessKey;
        cache.adminJwt = this.client.getAuthManager().getJwtToken();
        cache.createdAt = new Date().toISOString();
        this.saveTokenCache(cache);
        
        console.error('[TokenManager] API token created and saved');
        return response.data.accessKey;
      }
    } catch (error) {
      console.error('[TokenManager] Failed to create API token:', error);
    }

    return null;
  }

  /**
   * Load token cache from disk
   */
  private loadTokenCache(): TokenCache {
    try {
      if (fs.existsSync(this.tokensPath)) {
        const content = fs.readFileSync(this.tokensPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[TokenManager] Failed to load token cache:', error);
    }
    return {};
  }

  /**
   * Save token cache to disk
   */
  private saveTokenCache(cache: TokenCache): void {
    try {
      fs.writeFileSync(this.tokensPath, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('[TokenManager] Failed to save token cache:', error);
    }
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    try {
      if (fs.existsSync(this.tokensPath)) {
        fs.unlinkSync(this.tokensPath);
      }
    } catch (error) {
      console.error('[TokenManager] Failed to clear token cache:', error);
    }
  }
}