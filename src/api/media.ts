import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { strapiClient } from "./client.js";
import { filterBase64FromResponse } from "../utils/index.js";
import axios from "axios";

export async function uploadMedia(fileData: string, fileName: string, fileType: string): Promise<any> {
  try {
    console.error(`[API] Uploading media file: ${fileName} (type: ${fileType})`);
    
    const base64Size = fileData.length;
    const estimatedFileSize = Math.round((base64Size * 3) / 4);
    const estimatedFileSizeMB = (estimatedFileSize / (1024 * 1024)).toFixed(2);
    
    console.error(`[API] File size: ~${estimatedFileSizeMB}MB (base64 length: ${base64Size})`);
    
    const MAX_BASE64_SIZE = 1024 * 1024; // 1MB of base64 text (~750KB file)
    if (base64Size > MAX_BASE64_SIZE) {
      const maxFileSizeMB = ((MAX_BASE64_SIZE * 3) / 4 / (1024 * 1024)).toFixed(2);
      throw new Error(`File too large. Base64 data is ${base64Size} characters (~${estimatedFileSizeMB}MB file). Maximum allowed is ${MAX_BASE64_SIZE} characters (~${maxFileSizeMB}MB file). Large files cause context window overflow. Consider using smaller files or implementing chunked upload.`);
    }
    
    if (base64Size > 100000) { // 100KB of base64 text
      console.error(`[API] Warning: Large file detected (~${estimatedFileSizeMB}MB). This may cause context window issues.`);
    }
    
    const buffer = Buffer.from(fileData, 'base64');
    
    const formData = new FormData();
    const blob = new Blob([buffer], { type: fileType });
    formData.append('files', blob, fileName);

    const response = await strapiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    const cleanResponse = filterBase64FromResponse(response.data);
    
    return cleanResponse;
  } catch (error) {
    console.error(`[Error] Failed to upload media file ${fileName}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to upload media file ${fileName}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file ${fileName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function uploadMediaFromPath(filePath: string, fileName?: string, fileType?: string): Promise<any> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.error(`[API] Uploading media file from path: ${filePath} (${fileSizeMB}MB)`);
    
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${fileSizeMB}MB. Maximum allowed is 10MB.`);
    }
    
    const actualFileName = fileName || path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    let actualFileType = fileType;
    if (!actualFileType) {
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.json': 'application/json',
        '.mp4': 'video/mp4',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime'
      };
      actualFileType = mimeTypes[extension] || 'application/octet-stream';
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    return await uploadMedia(base64Data, actualFileName, actualFileType);
    
  } catch (error) {
    console.error(`[Error] Failed to upload media file from path ${filePath}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file from path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}