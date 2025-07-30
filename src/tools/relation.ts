import { z } from 'zod';
import { StrapiClient } from '../strapi-client.js';
import { Tool } from './types.js';

export function relationTools(client: StrapiClient): Tool[] {
  return [
    {
      name: 'connect_relation',
      description: 'Connects entries to a relation field',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.union([z.string(), z.number()])).describe('Array of document IDs to connect')
      }),
      execute: async (args) => {
        if (!args.relatedIds || args.relatedIds.length === 0) {
          throw new Error('At least one related ID is required');
        }
        
        // Validate IDs
        const validIds = args.relatedIds.map((id: any) => {
          const numId = Number(id);
          if (isNaN(numId) || numId <= 0) {
            throw new Error(`Invalid related ID: ${id}. IDs must be positive numbers.`);
          }
          return numId;
        });
        
        return await client.connectRelation(
          args.pluralApiId,
          args.documentId,
          args.relationField,
          validIds
        );
      }
    },
    {
      name: 'disconnect_relation',
      description: 'Disconnects entries from a relation field',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.union([z.string(), z.number()])).describe('Array of document IDs to disconnect')
      }),
      execute: async (args) => {
        if (!args.relatedIds || args.relatedIds.length === 0) {
          throw new Error('At least one related ID is required');
        }
        
        // Validate IDs
        const validIds = args.relatedIds.map((id: any) => {
          const numId = Number(id);
          if (isNaN(numId) || numId <= 0) {
            throw new Error(`Invalid related ID: ${id}. IDs must be positive numbers.`);
          }
          return numId;
        });
        
        return await client.disconnectRelation(
          args.pluralApiId,
          args.documentId,
          args.relationField,
          validIds
        );
      }
    },
    {
      name: 'set_relation',
      description: 'Sets the complete list of related entries, replacing any existing relations',
      inputSchema: z.object({
        pluralApiId: z.string().describe('The plural API ID'),
        documentId: z.string().describe('Main entry document ID'),
        relationField: z.string().describe('Name of the relation field'),
        relatedIds: z.array(z.union([z.string(), z.number()])).describe('Array of document IDs to set')
      }),
      execute: async (args) => {
        // Validate IDs
        const validIds = args.relatedIds.map((id: any) => {
          const numId = Number(id);
          if (isNaN(numId) || numId <= 0) {
            throw new Error(`Invalid related ID: ${id}. IDs must be positive numbers.`);
          }
          return numId;
        });
        
        return await client.setRelation(
          args.pluralApiId,
          args.documentId,
          args.relationField,
          validIds
        );
      }
    }
  ];
}