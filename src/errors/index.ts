import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ExtendedErrorCode } from "../types/index.js";

export { ExtendedErrorCode };

export class ExtendedMcpError extends McpError {
  public extendedCode: ExtendedErrorCode;

  constructor(code: ExtendedErrorCode, message: string) {
    let mcpCode: ErrorCode;

    switch (code) {
      case ExtendedErrorCode.ResourceNotFound:
      case ExtendedErrorCode.AccessDenied:
        mcpCode = ErrorCode.InternalError;
        break;
      case ExtendedErrorCode.InvalidRequest:
        mcpCode = ErrorCode.InvalidRequest;
        break;
      case ExtendedErrorCode.MethodNotFound:
        mcpCode = ErrorCode.MethodNotFound;
        break;
      case ExtendedErrorCode.InvalidParams:
        mcpCode = ErrorCode.InvalidParams;
        break;
      case ExtendedErrorCode.InternalError:
      default:
        mcpCode = ErrorCode.InternalError;
        break;
    }

    super(mcpCode, message);
    this.extendedCode = code;
  }
}
