export interface StrapiConfig {
  url: string;
  adminEmail?: string;
  adminPassword?: string;
  apiToken?: string;
  devMode?: boolean;
}

export interface AuthTokens {
  jwt?: string;
  apiToken?: string;
}

export interface ContentType {
  uid: string;
  apiID: string;
  pluralApiId: string;
  info: {
    displayName: string;
    description?: string;
    singularName?: string;
    pluralName?: string;
  };
  attributes?: Record<string, any>;
  pluginOptions?: Record<string, any>;
  isLocalized?: boolean;
}

export interface QueryOptions {
  filters?: Record<string, any>;
  pagination?: {
    page?: number;
    pageSize?: number;
    limit?: number;
    start?: number;
  };
  sort?: string | string[];
  populate?: string | string[] | Record<string, any>;
  fields?: string[];
  status?: 'published' | 'draft' | 'all';
  locale?: string;
}

export interface StrapiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'reloading';
  message?: string;
}

export interface ComponentData {
  uid: string;
  category: string;
  displayName: string;
  description?: string;
  icon?: string;
  attributes?: Record<string, any>;
}