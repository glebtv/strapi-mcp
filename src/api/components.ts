import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export async function listComponents(): Promise<any[]> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function getComponentSchema(_componentUid: string): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function createComponent(_componentData: any): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}

export async function updateComponent(
  _componentUid: string,
  _attributesToUpdate: Record<string, any>
): Promise<any> {
  throw new ExtendedMcpError(
    ExtendedErrorCode.AccessDenied,
    "Component operations require admin credentials. This operation is not available with API tokens only."
  );
}
