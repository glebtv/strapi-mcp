import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface QueryParams {
  filters?: Record<string, any>;
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  sort?: string[];
  populate?: string | string[] | Record<string, any>;
  fields?: string[];
}

export interface ContentType {
  uid: string;
  apiID: string;
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
  InvalidRequest = 'InvalidRequest',
  MethodNotFound = 'MethodNotFound',
  InvalidParams = 'InvalidParams',
  InternalError = 'InternalError',
  ResourceNotFound = 'ResourceNotFound',
  AccessDenied = 'AccessDenied'
}