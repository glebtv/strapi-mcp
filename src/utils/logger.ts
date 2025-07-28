// Simple logger utility to control verbosity
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Default to ERROR level for tests
const currentLogLevel = process.env.LOG_LEVEL
  ? parseInt(process.env.LOG_LEVEL)
  : process.env.NODE_ENV === "test"
    ? LogLevel.ERROR
    : LogLevel.INFO;

// Check if we're in a test environment
const isTest = process.env.NODE_ENV === "test";

// Helper to format errors concisely in tests
function formatError(error: any): string {
  if (!isTest || !(error instanceof Error)) {
    return error;
  }

  // For tests, only show the error message, not the full stack
  return error.message;
}

export const logger = {
  error: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      // In tests, format errors more concisely
      if (isTest && args.length > 0) {
        const formattedArgs = args.map((arg) => (arg instanceof Error ? formatError(arg) : arg));
        console.error(...formattedArgs);
      } else {
        console.error(...args);
      }
    }
  },

  warn: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.error(...args);
    }
  },

  info: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.error(...args);
    }
  },

  debug: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.error(...args);
    }
  },

  // Always log these regardless of level
  always: (...args: any[]) => {
    console.error(...args);
  },
};
