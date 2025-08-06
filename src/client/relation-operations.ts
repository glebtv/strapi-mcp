export class RelationOperations {
  constructor(private client: any) {}

  /**
   * Connect relations
   */
  async connectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    const connectItems = relatedIds.map(id => ({ documentId: id }));
    
    const data = {
      [relationField]: {
        connect: connectItems
      }
    };

    return this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
  }

  /**
   * Disconnect relations
   */
  async disconnectRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    const disconnectItems = relatedIds.map(id => ({ documentId: id }));
    
    const data = {
      [relationField]: {
        disconnect: disconnectItems
      }
    };

    return this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
  }

  /**
   * Set relations (replace all)
   */
  async setRelation(contentTypeUid: string, documentId: string, relationField: string, relatedIds: string[]): Promise<any> {
    // Strapi v5 uses document IDs for relations
    // For set operation, we just pass an array of document IDs
    const data = {
      [relationField]: relatedIds
    };

    return this.client.contentOps.updateEntryDraft(contentTypeUid, documentId, data);
  }
}