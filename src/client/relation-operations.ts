export class RelationOperations {
  constructor(private client: any) {}

  /**
   * Validate relation IDs and provide clear error messages
   */
  private validateRelationIds(relatedIds: any[], fieldName: string, operation: string): void {
    // Check for empty array
    if (!relatedIds || relatedIds.length === 0) {
      throw new Error(`No related IDs provided for ${operation} relation field "${fieldName}"`);
    }

    // Check for invalid IDs (must be strings, not numbers)
    for (const id of relatedIds) {
      if (typeof id !== 'string') {
        throw new Error(`Invalid relation ID: "${id}". Relations require document IDs (strings), not numeric IDs.`);
      }
    }
  }

  /**
   * Enhance generic "Invalid relations" errors with context
   */
  private async enhanceRelationError(error: Error, contentTypeUid: string, relationField: string, relatedIds: string[], operation: string): Promise<Error> {
    // Only enhance "Invalid relations" errors
    if (error.message !== 'Invalid relations') {
      return error;
    }

    try {
      // Try to fetch schema to provide better context
      // Note: This is a best-effort enhancement - if it fails, return original error
      await this.client.contentManagerInit();
      
      let enhancedMessage = 'Invalid relations';
      enhancedMessage += ` for field "${relationField}" in ${contentTypeUid}.\n`;
      enhancedMessage += `Attempted to ${operation}: ${relatedIds.length > 0 ? relatedIds.join(', ') : '(empty)'}\n`;
      
      if (operation === 'connect') {
        enhancedMessage += 'Make sure: 1) The field name is correct, 2) The document IDs exist, 3) The relation type allows these connections';
      } else if (operation === 'disconnect') {
        enhancedMessage += 'Make sure: 1) The field name is correct, 2) The relations exist';
      } else {
        enhancedMessage += 'Make sure: 1) The field name is correct, 2) All document IDs exist, 3) The relation type supports this operation';
      }

      return new Error(enhancedMessage);
    } catch {
      // If we can't enhance the error, return the original
      return error;
    }
  }

  /**
   * Connect relations
   */
  async connectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Validate inputs
    this.validateRelationIds(relatedIds, relationField, 'connecting');

    // Strapi v5 uses document IDs for relations
    const connectItems = relatedIds.map(id => ({ documentId: id }));

    const data = {
      [relationField]: {
        connect: connectItems
      }
    };

    try {
      return await this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
    } catch (error: any) {
      const enhancedError = await this.enhanceRelationError(error, contentTypeUid, relationField, relatedIds, 'connect');
      throw enhancedError;
    }
  }

  /**
   * Disconnect relations
   */
  async disconnectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Validate inputs
    this.validateRelationIds(relatedIds, relationField, 'disconnecting from');

    // Strapi v5 uses document IDs for relations
    const disconnectItems = relatedIds.map(id => ({ documentId: id }));

    const data = {
      [relationField]: {
        disconnect: disconnectItems
      }
    };

    try {
      return await this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
    } catch (error: any) {
      const enhancedError = await this.enhanceRelationError(error, contentTypeUid, relationField, relatedIds, 'disconnect');
      throw enhancedError;
    }
  }

  /**
   * Set relations (replace all)
   */
  async setRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Validate inputs (allow empty array for clearing relations)
    if (relatedIds && relatedIds.length > 0) {
      // Only validate if there are IDs
      for (const id of relatedIds) {
        if (typeof id !== 'string') {
          throw new Error(`Invalid relation ID: "${id}". Relations require document IDs (strings), not numeric IDs.`);
        }
      }
    }

    // Strapi v5 uses document IDs for relations
    // For set operation, we just pass an array of document IDs
    const data = {
      [relationField]: relatedIds
    };

    try {
      return await this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
    } catch (error: any) {
      const enhancedError = await this.enhanceRelationError(error, contentTypeUid, relationField, relatedIds, 'set');
      throw enhancedError;
    }
  }
}
