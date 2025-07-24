export interface QueryParams {
  filters?: Record<string, any>;
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: string[];
  populate?: string | string[] | Record<string, any>;
  fields?: string[];
  status?: "published" | "draft" | "all";
}

export interface ContentType {
  uid: string;
  apiID: string;
  pluralApiId?: string; // Plural form for API endpoints (e.g., 'articles' for 'article')
  info: {
    displayName: string;
    description: string;
  };
  attributes: Record<string, any>;
}

export interface StrapiResponse<T = any> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export enum ExtendedErrorCode {
  InvalidRequest = "InvalidRequest",
  MethodNotFound = "MethodNotFound",
  InvalidParams = "InvalidParams",
  InternalError = "InternalError",
  ResourceNotFound = "ResourceNotFound",
  AccessDenied = "AccessDenied",
}
