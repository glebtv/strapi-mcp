import { StrapiClient } from '../../src/strapi-client';
import { componentTools } from '../../src/tools/component';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Component Tools', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof componentTools>;

  beforeEach(() => {
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    tools = componentTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list_components', () => {
    it('should list all components', async () => {
      const mockComponents = [
        {
          uid: 'shared.seo',
          category: 'shared',
          displayName: 'SEO',
          description: 'SEO component',
          icon: 'search',
          attributes: {
            title: { type: 'string' },
            description: { type: 'text' }
          }
        }
      ];

      mockClient.listComponents.mockResolvedValue(mockComponents);

      const tool = tools.find(t => t.name === 'list_components')!;
      const result = await tool.execute({});

      expect(mockClient.listComponents).toHaveBeenCalled();
      expect(result).toEqual(mockComponents);
    });
  });

  describe('get_component_schema', () => {
    it('should get component schema', async () => {
      const mockSchema = {
        uid: 'shared.seo',
        category: 'shared',
        schema: {
          displayName: 'SEO',
          icon: 'search',
          attributes: {
            metaTitle: { type: 'string', maxLength: 60 },
            metaDescription: { type: 'text', maxLength: 160 }
          }
        }
      };

      mockClient.getComponentSchema.mockResolvedValue(mockSchema);

      const tool = tools.find(t => t.name === 'get_component_schema')!;
      const result = await tool.execute({ componentUid: 'shared.seo' });

      expect(mockClient.getComponentSchema).toHaveBeenCalledWith('shared.seo');
      expect(result).toEqual(mockSchema);
    });
  });

  describe('create_component', () => {
    it('should create a new component', async () => {
      const mockResponse = {
        uid: 'security.settings',
        message: 'Component created successfully'
      };

      const componentData = {
        displayName: 'Security Settings',
        category: 'security',
        icon: 'shield',
        attributes: {
          enableTwoFactor: { type: 'boolean', default: false },
          passwordExpiration: { type: 'integer', min: 0 }
        }
      };

      mockClient.createComponent.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'create_component')!;
      const result = await tool.execute({ componentData });

      expect(mockClient.createComponent).toHaveBeenCalledWith(componentData);
      expect(result).toEqual(mockResponse);
    });

    it('should properly handle HTTP 405 Method Not Allowed error', async () => {
      const componentData = {
        displayName: 'Test Component',
        category: 'test',
        attributes: {}
      };

      // Mock the client to throw an error similar to what happens with 405
      const error = new Error('HTTP 405 Method Not Allowed: Method Not Allowed');
      (error as any).status = 405;
      (error as any).statusText = 'Method Not Allowed';
      mockClient.createComponent.mockRejectedValue(error);

      const tool = tools.find(t => t.name === 'create_component')!;
      
      // The tool should throw an error, not return success
      await expect(tool.execute({ componentData })).rejects.toThrow('HTTP 405 Method Not Allowed: Method Not Allowed');
      expect(mockClient.createComponent).toHaveBeenCalledWith(componentData);
    });

    it('should handle other HTTP errors properly', async () => {
      const componentData = {
        displayName: 'Test Component',
        category: 'test',
        attributes: {}
      };

      // Mock a 400 Bad Request error
      const error = new Error('HTTP 400 Bad Request: Invalid component data');
      (error as any).status = 400;
      (error as any).statusText = 'Bad Request';
      mockClient.createComponent.mockRejectedValue(error);

      const tool = tools.find(t => t.name === 'create_component')!;
      
      await expect(tool.execute({ componentData })).rejects.toThrow('HTTP 400 Bad Request: Invalid component data');
    });
  });

  describe('update_component', () => {
    it('should update an existing component', async () => {
      const mockResponse = {
        uid: 'shared.seo',
        message: 'Component updated successfully'
      };

      const updateData = {
        componentUid: 'shared.seo',
        attributesToUpdate: {
          ogTitle: { type: 'string' },
          ogDescription: { type: 'text' }
        }
      };

      mockClient.updateComponent.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'update_component')!;
      const result = await tool.execute(updateData);

      expect(mockClient.updateComponent).toHaveBeenCalledWith(
        'shared.seo',
        updateData.attributesToUpdate
      );
      expect(result).toEqual(mockResponse);
    });
  });
});