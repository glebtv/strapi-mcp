// describe, it, expect, beforeEach are global in Jest
import { StrapiClient } from '../src/strapi-client.js';
import { contentManagementTools } from '../src/tools/content-management.js';

describe('Improved AI workflow with optimized tools', () => {
  let mockClient: StrapiClient;
  let tools: ReturnType<typeof contentManagementTools>;

  const mockContentTypes = [
    // User content types
    {
      uid: 'api::article.article',
      apiID: 'article',
      pluralApiId: 'articles',
      info: { displayName: 'Article' },
      attributes: {
        title: { type: 'string', required: true },
        content: { type: 'richtext', required: true },
        author: { type: 'string' },
        publishedAt: { type: 'datetime' }
      },
      pluginOptions: { i18n: { localized: true } }
    },
    {
      uid: 'api::project.project',
      apiID: 'project',
      pluralApiId: 'projects',
      info: { displayName: 'Project' },
      attributes: {
        name: { type: 'string', required: true },
        description: { type: 'text' },
        client: { type: 'string', required: true }
      }
    },
    {
      uid: 'api::landing-page.landing-page',
      apiID: 'landing-page',
      pluralApiId: 'landing-pages',
      info: { displayName: 'Landing Page' },
      attributes: {
        title: { type: 'string', required: true },
        sections: { type: 'dynamiczone' }
      }
    },
    // System types (should be filtered out by default)
    {
      uid: 'plugin::users-permissions.user',
      apiID: 'user',
      pluralApiId: 'users',
      info: { displayName: 'User' },
      attributes: {
        username: { type: 'string' },
        email: { type: 'email' },
        provider: { type: 'string' }
      }
    },
    {
      uid: 'admin::permission',
      apiID: 'permission',
      pluralApiId: 'permissions',
      info: { displayName: 'Permission' },
      attributes: {
        action: { type: 'string' },
        role: { type: 'relation' }
      }
    }
  ];

  beforeEach(() => {
    mockClient = {
      contentManagerInit: jest.fn().mockResolvedValue({
        contentTypes: mockContentTypes,
        components: []
      })
    } as any;

    tools = contentManagementTools(mockClient);
  });

  describe('Optimized workflow for AI agents', () => {
    it('should demonstrate the complete optimized workflow', async () => {
      console.log('\n=== OPTIMIZED AI WORKFLOW DEMONSTRATION ===\n');

      // Step 1: List user content types (minimal, no system types)
      console.log('STEP 1: List available user content types');
      console.log('----------------------------------------');
      
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      const userTypes = await listTool.execute({}); // Default is 'user'
      
      console.log('Request: list_content_types(kind: "user")');
      console.log(`Response size: ${JSON.stringify(userTypes).length} chars`);
      console.log('Content types:', userTypes);
      
      expect(userTypes).toHaveLength(3); // Only user types
      expect(userTypes.every((ct: any) => ct.uid.startsWith('api::')));
      
      // Step 2: AI identifies the content type it needs
      console.log('\nSTEP 2: AI identifies target content type');
      console.log('----------------------------------------');
      console.log('AI sees: article, project, landing-page');
      console.log('AI needs to create an article');
      
      // Step 3: Get full schema for the specific content type
      console.log('\nSTEP 3: Get full schema for "article"');
      console.log('----------------------------------------');
      
      const articleSchema = await listTool.execute({ filter: 'article', attributes: true });
      
      console.log('Request: list_content_types(filter: "article", attributes: true)');
      console.log(`Response size: ${JSON.stringify(articleSchema).length} chars`);
      console.log('Schema received:', {
        matches: articleSchema.length,
        contentType: articleSchema[0]?.uid,
        attributes: articleSchema[0] ? Object.keys(articleSchema[0].attributes) : []
      });
      
      expect(articleSchema).toHaveLength(1);
      expect(articleSchema[0].attributes.title.required).toBe(true);
      expect(articleSchema[0].attributes.content.required).toBe(true);
      
      // Step 4: AI can now create content with proper validation
      console.log('\nSTEP 4: AI creates content with required fields');
      console.log('----------------------------------------');
      console.log('AI knows required fields: title, content');
      console.log('AI knows optional fields: author, publishedAt');
      console.log('AI knows localization is enabled');
      
      // Token usage comparison
      console.log('\n=== TOKEN USAGE COMPARISON ===');
      console.log('------------------------------');
      
      const allTypesResult = await listTool.execute({ kind: 'all' });
      const fullResponse = await mockClient.contentManagerInit();
      
      const tokensFullResponse = Math.ceil(JSON.stringify(fullResponse.contentTypes).length / 4);
      const tokensOptimizedList = Math.ceil(JSON.stringify(userTypes).length / 4);
      const tokensTargetedSchema = Math.ceil(JSON.stringify(articleSchema).length / 4);
      const tokensTotalOptimized = tokensOptimizedList + tokensTargetedSchema;
      
      console.log(`Old approach (get everything): ~${tokensFullResponse} tokens`);
      console.log(`New approach:`);
      console.log(`  - List user types: ~${tokensOptimizedList} tokens`);
      console.log(`  - Get article schema: ~${tokensTargetedSchema} tokens`);
      console.log(`  - Total: ~${tokensTotalOptimized} tokens`);
      console.log(`Reduction: ${((1 - tokensTotalOptimized / tokensFullResponse) * 100).toFixed(2)}%`);
      
      expect(tokensTotalOptimized).toBeLessThan(tokensFullResponse * 0.5);
    });

    it('should handle system type access when needed', async () => {
      console.log('\n=== ACCESSING SYSTEM TYPES ===\n');
      
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      
      // Scenario: AI needs to work with user permissions
      console.log('Scenario: AI needs to manage user permissions');
      console.log('---------------------------------------------');
      
      const systemTypes = await listTool.execute({ kind: 'system' });
      console.log(`Found ${systemTypes.length} system types`);
      
      const userPermType = systemTypes.find((ct: any) => 
        ct.uid === 'plugin::users-permissions.user'
      );
      
      expect(userPermType).toBeDefined();
      console.log('Found user permissions type:', userPermType);
      
      // Get full schema for system type - need to specify kind: 'system' or 'all' for plugin types
      const userSchema = await listTool.execute({ 
        filter: 'plugin::users-permissions.user', 
        kind: 'all',  // Need 'all' or 'system' to include plugin types
        attributes: true 
      });
      
      expect(userSchema).toHaveLength(1);
      console.log('Retrieved full schema for system type');
    });

    it('should efficiently handle partial searches', async () => {
      console.log('\n=== FUZZY SEARCH CAPABILITIES ===\n');
      
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      
      // Scenario 1: AI remembers partial name
      console.log('Scenario 1: AI remembers "land" from landing-page');
      const result1 = await listTool.execute({ filter: 'land', attributes: true });
      expect(result1).toHaveLength(1);
      expect(result1[0].apiID).toBe('landing-page');
      console.log('✓ Found landing-page');
      
      // Scenario 2: AI searches by plural form
      console.log('\nScenario 2: AI searches for "articles" (plural)');
      const result2 = await listTool.execute({ filter: 'articles', attributes: true });
      expect(result2).toHaveLength(1);
      expect(result2[0].apiID).toBe('article');
      console.log('✓ Found article via pluralApiId');
      
      // Scenario 3: Multiple matches
      console.log('\nScenario 3: AI searches for "pro" (matches project)');
      const result3 = await listTool.execute({ filter: 'pro', attributes: true });
      expect(result3).toHaveLength(1);
      expect(result3[0].apiID).toBe('project');
      console.log('✓ Found project');
      
      // Scenario 4: No matches
      console.log('\nScenario 4: AI searches for non-existent type');
      const result4 = await listTool.execute({ filter: 'product' });
      expect(result4).toHaveLength(0);
      console.log('✓ Returns empty array for non-existent type');
    });

    it('should stay well under MCP token limits', async () => {
      const MAX_MCP_TOKENS = 25000;
      const CHARS_PER_TOKEN = 4;
      
      console.log('\n=== MCP TOKEN LIMIT COMPLIANCE ===\n');
      
      // Test all operations stay under limit
      const listTool = tools.find(t => t.name === 'list_content_types')!;
      
      const operations = [
        { name: 'list_content_types (user)', result: await listTool.execute({}) },
        { name: 'list_content_types (system)', result: await listTool.execute({ kind: 'system' }) },
        { name: 'list_content_types (all)', result: await listTool.execute({ kind: 'all' }) },
        { name: 'list_content_types (filtered)', result: await listTool.execute({ filter: 'article', attributes: true }) },
        { name: 'list_content_types (multiple)', result: await listTool.execute({ filter: 'a' }) }
      ];
      
      operations.forEach(op => {
        const chars = JSON.stringify(op.result).length;
        const tokens = Math.ceil(chars / CHARS_PER_TOKEN);
        const percentage = (tokens / MAX_MCP_TOKENS * 100).toFixed(2);
        
        console.log(`${op.name.padEnd(30)} : ${tokens.toString().padStart(6)} tokens (${percentage}% of limit)`);
        
        expect(tokens).toBeLessThan(MAX_MCP_TOKENS);
      });
      
      console.log(`\n✓ All operations stay well under the ${MAX_MCP_TOKENS} token MCP limit`);
    });
  });
});