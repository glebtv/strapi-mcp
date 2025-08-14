import FormData from 'form-data';
import { logger } from '../logger.js';

export class MediaOperations {
  constructor(private client: any) {}

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
      logger.error('Upload', 'Failed to decode base64 data', error);
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
      const authManager = this.client.getAuthManager();
      if (this.client.config.adminEmail && this.client.config.adminPassword && !authManager.getJwtToken()) {
        const loginSuccess = await authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      // Media upload uses /upload endpoint with admin auth
      const response = await this.client.makeRequest({
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
      logger.error('API', 'Failed to upload media', error);
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
   * List media files
   */
  async listMedia(params?: any): Promise<any> {
    try {
      // Ensure we're logged in if using admin credentials
      const authManager = this.client.getAuthManager();
      if (this.client.config.adminEmail && this.client.config.adminPassword && !authManager.getJwtToken()) {
        const loginSuccess = await authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      const response = await this.client.makeRequest({
        url: '/upload/files',
        method: 'GET',
        params
      });

      return this.filterBase64FromResponse(response);
    } catch (error) {
      logger.error('API', 'Failed to list media', error);
      throw error;
    }
  }

  /**
   * List media folders
   */
  async listMediaFolders(params?: any): Promise<any> {
    try {
      // Ensure we're logged in if using admin credentials
      const authManager = this.client.getAuthManager();
      if (this.client.config.adminEmail && this.client.config.adminPassword && !authManager.getJwtToken()) {
        const loginSuccess = await authManager.login();
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with provided admin credentials');
        }
      }

      const response = await this.client.makeRequest({
        url: '/upload/folders',
        method: 'GET',
        params
      });

      return response;
    } catch (error) {
      logger.error('API', 'Failed to list folders', error);
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
