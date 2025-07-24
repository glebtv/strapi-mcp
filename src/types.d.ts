declare module "@modelcontextprotocol/sdk/server/index" {
  export class Server {
    constructor(info: any, options: any);
    setRequestHandler(schema: any, handler: any): void;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio" {
  export class StdioServerTransport {
    constructor();
  }
}

declare module "@modelcontextprotocol/sdk/types" {
  export const CallToolRequestSchema: any;
  export const ListResourcesRequestSchema: any;
  export const ListToolsRequestSchema: any;
  export const ReadResourceRequestSchema: any;
  export enum ErrorCode {
    InvalidRequest = "InvalidRequest",
    MethodNotFound = "MethodNotFound",
    InvalidParams = "InvalidParams",
    InternalError = "InternalError",
  }
  export class McpError extends Error {
    constructor(code: ErrorCode, message: string);
  }
  export interface ReadResourceRequest {
    params: {
      uri: string;
    };
  }
  export interface CallToolRequest {
    params: {
      name: string;
      arguments?: any;
    };
  }
}
