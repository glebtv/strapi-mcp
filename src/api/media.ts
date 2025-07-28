import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { strapiClient } from "./client.js";
import { filterBase64FromResponse, logger } from "../utils/index.js";
import axios from "axios";
import { config } from "../config/index.js";
import { setTimeout } from "timers/promises";

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

    if (base64Size > 100000) {
      // 100KB of base64 text
      logger.warn(
        `[API] Warning: Large file detected (~${estimatedFileSizeMB}MB). This may cause context window issues.`
      );
    }

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(fileData)) {
      throw new Error("Invalid base64 data: contains invalid characters");
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileData, "base64");
      // Verify the buffer can be re-encoded to base64 to catch subtle issues
      const reencoded = buffer.toString("base64");
      // If the re-encoded length doesn't match (accounting for padding), the input was invalid
      const originalWithoutPadding = fileData.replace(/=+$/, "");
      const reencodedWithoutPadding = reencoded.replace(/=+$/, "");
      if (
        originalWithoutPadding.length !== reencodedWithoutPadding.length &&
        originalWithoutPadding !== ""
      ) {
        throw new Error("Invalid base64 data: failed verification");
      }
    } catch (error) {
      throw new Error(
        `Invalid base64 data: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const formData = new FormData();
    const blob = new Blob([buffer], { type: fileType });
    formData.append("files", blob, fileName);

    // Log current authentication state
    logger.debug(`[Upload Debug] Current auth config:`);
    logger.debug(`[Upload Debug] - Has API Token: ${!!config.strapi.apiToken}`);
    logger.debug(
      `[Upload Debug] - Has Admin Credentials: ${!!(config.strapi.adminEmail && config.strapi.adminPassword)}`
    );
    logger.debug(
      `[Upload Debug] - Current strapiClient auth header: ${strapiClient.defaults.headers.common["Authorization"] ? "Set" : "Not set"}`
    );

    // Helper function to perform upload with retry logic
    const performUpload = async (
      client: any,
      url: string,
      formData: FormData,
      headers?: any,
      retries = 3
    ) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // For axios.post, the third parameter should be the config object, not wrapped
          const config = headers ? { headers } : undefined;
          const response = await client.post(url, formData, config);

          // Check if the response is actually successful
          if (response.status >= 400) {
            logger.error(
              `[Upload Debug] Upload failed with status ${response.status}: ${JSON.stringify(response.data)}`
            );
            throw new Error(`Upload failed: ${response.status} - ${JSON.stringify(response.data)}`);
          }

          return response;
        } catch (error) {
          if (
            axios.isAxiosError(error) &&
            (error.code === "ECONNRESET" || error.code === "ECONNREFUSED") &&
            attempt < retries
          ) {
            logger.debug(
              `[Upload Debug] Connection error on attempt ${attempt}, retrying in ${attempt}s...`
            );
            await setTimeout(attempt * 1000);
            continue;
          }
          throw error;
        }
      }
      throw new Error("Upload failed after all retries");
    };

    // Try upload with current strapiClient configuration first
    try {
      logger.debug(`[Upload Debug] Attempting upload with current strapiClient configuration...`);

      // Note: We need to remove the Content-Type header for FormData uploads
      // axios will set it automatically with the correct boundary
      // Prepare upload config without Content-Type
      const uploadHeaders = {
        ...strapiClient.defaults.headers.common,
        "Content-Type": undefined as any, // Remove Content-Type to let axios set it for FormData
      };

      const response = await performUpload(strapiClient, "/api/upload", formData, uploadHeaders);

      logger.debug(`[Upload Debug] Upload successful with current strapiClient configuration`);
      const cleanResponse = filterBase64FromResponse(response.data);

      // Strapi returns an array of uploaded files
      if (Array.isArray(cleanResponse) && cleanResponse.length > 0) {
        return cleanResponse[0];
      }

      return cleanResponse;
    } catch (firstError) {
      logger.debug(
        `[Upload Debug] First attempt failed:`,
        axios.isAxiosError(firstError)
          ? `${firstError.response?.status} - ${JSON.stringify(firstError.response?.data)}`
          : firstError
      );

      // If we have an API token, try it explicitly
      if (config.strapi.apiToken) {
        try {
          logger.debug(`[Upload Debug] Attempting with explicit API token...`);
          const response = await performUpload(axios, `${config.strapi.url}/api/upload`, formData, {
            Authorization: `Bearer ${config.strapi.apiToken}`,
          });

          logger.debug(`[Upload Debug] Upload successful with API token`);
          const cleanResponse = filterBase64FromResponse(response.data);

          if (Array.isArray(cleanResponse) && cleanResponse.length > 0) {
            return cleanResponse[0];
          }

          return cleanResponse;
        } catch (apiTokenError) {
          logger.debug(
            `[Upload Debug] API token attempt failed:`,
            axios.isAxiosError(apiTokenError)
              ? `${apiTokenError.response?.status} - ${JSON.stringify(apiTokenError.response?.data)}`
              : apiTokenError
          );
        }
      }

      // If we have admin credentials, try to get a user JWT token
      if (config.strapi.adminEmail && config.strapi.adminPassword) {
        try {
          logger.debug(
            `[Upload Debug] Attempting to get user JWT token using admin credentials...`
          );

          // Try to authenticate via Users & Permissions plugin
          const authResponse = await axios.post(`${config.strapi.url}/api/auth/local`, {
            identifier: config.strapi.adminEmail,
            password: config.strapi.adminPassword,
          });

          if (authResponse.data && authResponse.data.jwt) {
            logger.debug(`[Upload Debug] Got user JWT token, attempting upload...`);

            const response = await performUpload(
              axios,
              `${config.strapi.url}/api/upload`,
              formData,
              { Authorization: `Bearer ${authResponse.data.jwt}` }
            );

            logger.debug(`[Upload Debug] Upload successful with user JWT token`);
            const cleanResponse = filterBase64FromResponse(response.data);

            if (Array.isArray(cleanResponse) && cleanResponse.length > 0) {
              return cleanResponse[0];
            }

            return cleanResponse;
          }
        } catch (userAuthError) {
          logger.debug(
            `[Upload Debug] User auth attempt failed:`,
            axios.isAxiosError(userAuthError)
              ? `${userAuthError.response?.status} - ${JSON.stringify(userAuthError.response?.data)}`
              : userAuthError
          );
        }
      }

      // If all attempts fail, throw the original error with a proper message
      if (axios.isAxiosError(firstError) && firstError.message) {
        throw firstError;
      } else {
        throw new Error(`Upload failed: ${firstError}`);
      }
    }
  } catch (error) {
    logger.error(`[Error] Failed to upload media file ${fileName}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to upload media file ${fileName}: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    // Extract a meaningful error message
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error && error.message) {
      errorMessage = error.message;
    } else if (typeof error === "string" && error) {
      errorMessage = error;
    } else if (error && typeof error === "object" && "toString" in error) {
      errorMessage = error.toString();
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file ${fileName}: ${errorMessage}`
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

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    return await uploadMedia(base64Data, actualFileName, actualFileType);
  } catch (error) {
    logger.error(`[Error] Failed to upload media file from path ${filePath}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to upload media file from path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
