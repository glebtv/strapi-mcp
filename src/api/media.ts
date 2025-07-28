import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { validateStrapiConnection, strapiClient } from "./client.js";
import { filterBase64FromResponse, logger } from "../utils/index.js";
import axios from "axios";
import { config } from "../config/index.js";

export async function uploadMedia(
  fileData: string,
  fileName: string,
  fileType: string
): Promise<any> {
  try {
    logger.info(`[API] Uploading media file: ${fileName} (type: ${fileType})`);

    const base64Size = fileData.length;
    const estimatedFileSize = Math.round((base64Size * 3) / 4);
    const estimatedFileSizeMB = (estimatedFileSize / (1024 * 1024)).toFixed(2);

    logger.info(`[API] File size: ~${estimatedFileSizeMB}MB (base64 length: ${base64Size})`);

    const MAX_BASE64_SIZE = 1024 * 1024; // 1MB of base64 text (~750KB file)
    if (base64Size > MAX_BASE64_SIZE) {
      const maxFileSizeMB = ((MAX_BASE64_SIZE * 3) / 4 / (1024 * 1024)).toFixed(2);
      throw new Error(
        `File too large. Base64 data is ${base64Size} characters (~${estimatedFileSizeMB}MB file). Maximum allowed is ${MAX_BASE64_SIZE} characters (~${maxFileSizeMB}MB file). Large files cause context window overflow. Consider using smaller files or implementing chunked upload.`
      );
    }

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(fileData)) {
      throw new Error("Invalid base64 data: contains invalid characters");
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, "base64");

    // Ensure we're connected and authenticated first
    await validateStrapiConnection();
    
    // Get auth token from config
    const authToken = config.strapi.apiToken;
    if (!authToken) {
      throw new Error("No API token available for upload");
    }

    // Use form-data package for Node.js
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    
    // Append buffer directly with metadata
    form.append('files', buffer, {
      filename: fileName,
      contentType: fileType
    });

    const response = await axios.post(`${config.strapi.url}/api/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.data && response.data.length > 0) {
      logger.info(`[API] Successfully uploaded media file: ${fileName}`);
      const cleanResponse = filterBase64FromResponse(response.data);
      return cleanResponse[0];
    } else {
      throw new Error("No data returned from upload");
    }
  } catch (error) {
    logger.error(`[Error] Failed to upload media file ${fileName}:`, error);
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

export async function uploadMediaFromPath(
  filePath: string,
  fileName?: string,
  fileType?: string
): Promise<any> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const FormData = (await import("form-data")).default;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    logger.info(`[API] Uploading media file from path: ${filePath} (${fileSizeMB}MB)`);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${fileSizeMB}MB. Maximum allowed is 10MB.`);
    }

    const actualFileName = fileName || path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    let actualFileType = fileType;
    if (!actualFileType) {
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".json": "application/json",
        ".mp4": "video/mp4",
        ".avi": "video/avi",
        ".mov": "video/quicktime",
      };
      actualFileType = mimeTypes[extension] || "application/octet-stream";
    }

    // Ensure we're connected and authenticated first
    await validateStrapiConnection();
    
    // Get auth token from config
    const authToken = config.strapi.apiToken;
    if (!authToken) {
      throw new Error("No API token available for upload");
    }

    // Create FormData and append the file stream
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('files', fileStream, {
      filename: actualFileName,
      contentType: actualFileType
    });

    const response = await axios.post(`${config.strapi.url}/api/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.data && response.data.length > 0) {
      logger.info(`[API] Successfully uploaded media file: ${actualFileName}`);
      return response.data[0];
    } else {
      throw new Error("No data returned from upload");
    }
  } catch (error) {
    logger.error(`[Error] Failed to upload media file from path ${filePath}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to upload media file: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file from path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function listMedia(): Promise<any[]> {
  try {
    logger.debug(`[API] Listing all media files`);
    
    // Ensure we're connected and authenticated first
    await validateStrapiConnection();
    
    // Get auth token from config
    const authToken = config.strapi.apiToken;
    if (!authToken) {
      throw new Error("No API token available for upload");
    }

    const response = await axios.get(`${config.strapi.url}/api/upload/files`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    return response.data;
  } catch (error) {
    logger.error(`[Error] Failed to list media files:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list media files: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list media files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getMedia(id: string): Promise<any> {
  try {
    logger.debug(`[API] Getting media file: ${id}`);
    
    // Ensure we're connected and authenticated first
    await validateStrapiConnection();
    
    // Get auth token from config
    const authToken = config.strapi.apiToken;
    if (!authToken) {
      throw new Error("No API token available for upload");
    }

    const response = await axios.get(`${config.strapi.url}/api/upload/files/${id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    return response.data;
  } catch (error) {
    logger.error(`[Error] Failed to get media file ${id}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get media file: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get media file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function deleteMedia(id: string): Promise<void> {
  try {
    logger.debug(`[API] Deleting media file: ${id}`);
    
    // Ensure we're connected and authenticated first
    await validateStrapiConnection();
    
    // Get auth token from config
    const authToken = config.strapi.apiToken;
    if (!authToken) {
      throw new Error("No API token available for upload");
    }

    await axios.delete(`${config.strapi.url}/api/upload/files/${id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    logger.info(`[API] Successfully deleted media file: ${id}`);
  } catch (error) {
    logger.error(`[Error] Failed to delete media file ${id}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete media file: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to delete media file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}