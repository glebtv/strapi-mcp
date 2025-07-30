// Jest test - describe, it, expect are globals
import { getSharedClient } from './helpers/shared-client.js';

describe('Configuration Validation', () => {
  describe('Authentication Configuration', () => {
    it('should accept valid admin credentials', async () => {
      // This test just verifies that our shared client works
      // which means the authentication is properly configured
      const client = await getSharedClient();
      
      const result = await client.callTool({
        name: 'list_content_types',
        arguments: {}
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    // Note: Testing missing authentication would require spawning a separate
    // process since the server calls process.exit(1) when auth is missing.
    // This is already validated in the server startup code.
  });
});