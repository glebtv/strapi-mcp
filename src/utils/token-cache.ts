import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

const TOKEN_CACHE_FILE = path.join(process.cwd(), ".test-tokens.json");
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface TokenCache {
  adminJwtToken?: {
    token: string;
    timestamp: number;
  };
}

/**
 * Read token cache from disk
 */
function readTokenCache(): TokenCache {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      const data = fs.readFileSync(TOKEN_CACHE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    logger.debug("[TokenCache] Failed to read token cache:", error);
  }
  return {};
}

/**
 * Write token cache to disk
 */
function writeTokenCache(cache: TokenCache): void {
  try {
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2));
    logger.debug("[TokenCache] Token cache updated");
  } catch (error) {
    logger.debug("[TokenCache] Failed to write token cache:", error);
  }
}

/**
 * Get cached admin JWT token if still valid
 */
export function getCachedAdminToken(): string | null {
  if (process.env.NODE_ENV !== "test") {
    return null; // Only use cache in test mode
  }

  const cache = readTokenCache();
  if (cache.adminJwtToken) {
    const age = Date.now() - cache.adminJwtToken.timestamp;
    if (age < TOKEN_EXPIRY_MS) {
      logger.debug(`[TokenCache] Using cached admin token (age: ${Math.round(age / 1000)}s)`);
      return cache.adminJwtToken.token;
    } else {
      logger.debug("[TokenCache] Cached admin token expired");
    }
  }
  return null;
}

/**
 * Save admin JWT token to cache
 */
export function cacheAdminToken(token: string): void {
  if (process.env.NODE_ENV !== "test") {
    return; // Only use cache in test mode
  }

  const cache = readTokenCache();
  cache.adminJwtToken = {
    token,
    timestamp: Date.now(),
  };
  writeTokenCache(cache);
}

/**
 * Clear cached tokens
 */
export function clearTokenCache(): void {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      fs.unlinkSync(TOKEN_CACHE_FILE);
      logger.debug("[TokenCache] Token cache cleared");
    }
  } catch (error) {
    logger.debug("[TokenCache] Failed to clear token cache:", error);
  }
}
