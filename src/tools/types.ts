import { z } from 'zod';

export interface Tool<T = any> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<T>;
  execute: (args: T) => Promise<any>;
}