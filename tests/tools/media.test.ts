import { StrapiClient } from '../../src/strapi-client';
import { mediaTools } from '../../src/tools/media';
import { StrapiConfig } from '../../src/types';

// Mock the StrapiClient
jest.mock('../../src/strapi-client');

describe('Media Tools', () => {
  let mockClient: jest.Mocked<StrapiClient>;
  let tools: ReturnType<typeof mediaTools>;

  beforeEach(() => {
    mockClient = new StrapiClient({} as StrapiConfig) as jest.Mocked<StrapiClient>;
    tools = mediaTools(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload_media', () => {
    it('should upload media from base64 data', async () => {
      const mockResponse = {
        id: 1,
        name: 'test.jpg',
        url: '/uploads/test_123.jpg',
        mime: 'image/jpeg'
      };

      mockClient.uploadMedia.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'upload_media')!;
      const result = await tool.execute({
        fileData: 'base64encodeddata',
        fileName: 'test.jpg',
        fileType: 'image/jpeg'
      });

      expect(mockClient.uploadMedia).toHaveBeenCalledWith(
        'base64encodeddata',
        'test.jpg',
        'image/jpeg'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle upload errors', async () => {
      mockClient.uploadMedia.mockRejectedValue(
        new Error('File too large: ~2MB. Maximum ~0.75MB for base64 upload.')
      );

      const tool = tools.find(t => t.name === 'upload_media')!;
      
      await expect(
        tool.execute({
          fileData: 'verylongbase64string',
          fileName: 'large.jpg',
          fileType: 'image/jpeg'
        })
      ).rejects.toThrow('File too large');
    });
  });

  describe('upload_media_from_path', () => {
    it('should upload media from file path', async () => {
      const mockResponse = {
        id: 2,
        name: 'document.pdf',
        url: '/uploads/document_456.pdf',
        mime: 'application/pdf'
      };

      mockClient.uploadMediaFromPath.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'upload_media_from_path')!;
      const result = await tool.execute({
        filePath: '/path/to/document.pdf'
      });

      expect(mockClient.uploadMediaFromPath).toHaveBeenCalledWith(
        '/path/to/document.pdf',
        undefined,
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should upload with custom file name and type', async () => {
      const mockResponse = {
        id: 3,
        name: 'renamed.png',
        url: '/uploads/renamed_789.png',
        mime: 'image/png'
      };

      mockClient.uploadMediaFromPath.mockResolvedValue(mockResponse);

      const tool = tools.find(t => t.name === 'upload_media_from_path')!;
      const result = await tool.execute({
        filePath: '/path/to/image.png',
        fileName: 'renamed.png',
        fileType: 'image/png'
      });

      expect(mockClient.uploadMediaFromPath).toHaveBeenCalledWith(
        '/path/to/image.png',
        'renamed.png',
        'image/png'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle file not found errors', async () => {
      mockClient.uploadMediaFromPath.mockRejectedValue(
        new Error('File not found: /invalid/path.jpg')
      );

      const tool = tools.find(t => t.name === 'upload_media_from_path')!;
      
      await expect(
        tool.execute({ filePath: '/invalid/path.jpg' })
      ).rejects.toThrow('File not found');
    });
  });
});