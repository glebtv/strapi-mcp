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

    // Create a new API token with retry logic for name conflicts
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Generate token name with random suffix after first attempt
        const tokenName = retryCount === 0 
          ? 'strapi-mcp' 
          : `strapi-mcp-${Math.random().toString(36).substr(2, 6)}`;
        
        console.error(`[TokenManager] Creating new API token: ${tokenName}`);
        
        const response = await this.client.adminRequest<any>(
          '/admin/api-tokens',
          'POST',
          {
            name: tokenName,
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
        // Check if it's a "name already taken" error
        if (error instanceof Error && error.message.includes('Name already taken')) {
          retryCount++;
          console.error(`[TokenManager] Token name already taken, retrying with different name (attempt ${retryCount}/${maxRetries})`);
          continue;
        }
        
        // For other errors, log and exit
        console.error('[TokenManager] Failed to create API token:', error);
        break;
      }
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