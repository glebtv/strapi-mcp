import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function mediaTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'upload_media',
      description: 'Uploads a media file using base64 encoding. Limited to ~750KB files to prevent context window overflow',
      inputSchema: z.object({
        fileData: z.string().describe('Base64 encoded file data'),
        fileName: z.string().describe('Name for the file'),
        fileType: z.string().describe('MIME type (e.g., "image/jpeg")')
      }),
      execute: async (args) => {
        return await client.uploadMedia(args.fileData, args.fileName, args.fileType);
      }
    },
    {
      name: 'upload_media_from_path',
      description: 'Uploads a media file from a local file path. Supports files up to 10MB',
      inputSchema: z.object({
        filePath: z.string().describe('Local file system path'),
        fileName: z.string().optional().describe('Override the file name'),
        fileType: z.string().optional().describe('Override the MIME type')
      }),
      execute: async (args) => {
        return await client.uploadMediaFromPath(args.filePath, args.fileName, args.fileType);
      }
    },
    {
      name: 'list_media',
      description: 'List media files with optional filters and pagination',
      inputSchema: z.object({
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Number of items per page (default: 10)'),
        sort: z.string().optional().describe('Sort order (e.g., "createdAt:DESC")'),
        filters: z.record(z.any()).optional().describe('Filter parameters')
      }),
      execute: async (args) => {
        return await client.listMedia(args);
      }
    },
    {
      name: 'list_media_folders',
      description: 'List media folders',
      inputSchema: z.object({
        page: z.number().optional().describe('Page number (default: 1)'),
        pageSize: z.number().optional().describe('Number of items per page (default: 10)'),
        sort: z.string().optional().describe('Sort order (e.g., "createdAt:DESC")'),
        filters: z.record(z.any()).optional().describe('Filter parameters')
      }),
      execute: async (args) => {
        return await client.listMediaFolders(args);
      }
    }
  ];
}