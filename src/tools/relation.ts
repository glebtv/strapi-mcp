import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function relationTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'connect_relation',
      description: 'Connects entries to a relation field',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.string()).describe('Array of document IDs to connect')
      }),
      execute: async (args) => {
        if (!args.relatedIds || args.relatedIds.length === 0) {
          throw new Error('At least one related ID is required');
        }
        
        return await client.connectRelation(
          args.contentTypeUid,
          args.documentId,
          args.relationField,
          args.relatedIds
        );
      }
    },
    {
      name: 'disconnect_relation',
      description: 'Disconnects entries from a relation field',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.string()).describe('Array of document IDs to disconnect')
      }),
      execute: async (args) => {
        if (!args.relatedIds || args.relatedIds.length === 0) {
          throw new Error('At least one related ID is required');
        }
        
        return await client.disconnectRelation(
          args.contentTypeUid,
          args.documentId,
          args.relationField,
          args.relatedIds
        );
      }
    },
    {
      name: 'set_relation',
      description: 'Sets the complete list of related entries, replacing any existing relations',
      inputSchema: z.object({
        contentTypeUid: z.string().describe('The content type UID (e.g., "api::article.article")'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.string()).describe('Array of document IDs to set')
      }),
      execute: async (args) => {
        return await client.setRelation(
          args.contentTypeUid,
          args.documentId,
          args.relationField,
          args.relatedIds
        );
      }
    }
  ];
}