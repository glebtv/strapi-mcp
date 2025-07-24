import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";
import axios from "axios";

export async function listComponents(): Promise<any[]> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function getComponentSchema(componentUid: string): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function createComponent(componentData: any): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function updateComponent(
  componentUid: string,
  attributesToUpdate: Record<string, any>
): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}
