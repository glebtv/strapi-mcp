import fs from 'fs';
import path from 'path';
import os from 'os';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export class Logger {
  private static instance: Logger;
  private logFile: string;
  private logStream: fs.WriteStream;
  private logLevel: LogLevel;
  private startTime: Date;

  private constructor() {
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
    
    // Create log directory
    const logDir = path.join(os.homedir(), '.mcp', 'strapi');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create log file with timestamp
    this.logFile = path.join(logDir, `mcp-log-${timestamp}.log`);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    // Set log level from environment or default to INFO
    const envLogLevel = process.env.LOG_LEVEL || process.env.STRAPI_LOG_LEVEL || '2';
    this.logLevel = parseInt(envLogLevel, 10) as LogLevel;
    
    // Write initial log entry
    this.writeLog('INFO', 'Logger', `=== MCP Server Started at ${this.startTime.toISOString()} ===`);
    this.writeLog('INFO', 'Logger', `Log file: ${this.logFile}`);
    this.writeLog('INFO', 'Logger', `Log level: ${LogLevel[this.logLevel]}`);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private writeLog(level: string, context: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      data: data || undefined
    };
    
    try {
      this.logStream.write(JSON.stringify(logEntry) + '\n');
    } catch (e) {
      // Fallback to console if write fails
      console.error('Failed to write to log file:', e);
    }
  }

  public error(context: string, message: string, data?: any) {
    if (this.logLevel >= LogLevel.ERROR) {
      this.writeLog('ERROR', context, message, data);
    }
  }

  public warn(context: string, message: string, data?: any) {
    if (this.logLevel >= LogLevel.WARN) {
      this.writeLog('WARN', context, message, data);
    }
  }

  public info(context: string, message: string, data?: any) {
    if (this.logLevel >= LogLevel.INFO) {
      this.writeLog('INFO', context, message, data);
    }
  }

  public debug(context: string, message: string, data?: any) {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.writeLog('DEBUG', context, message, data);
    }
  }

  public trace(context: string, message: string, data?: any) {
    if (this.logLevel >= LogLevel.TRACE) {
      this.writeLog('TRACE', context, message, data);
    }
  }

  public logToolCall(toolName: string, args: any, result: any, error?: any, duration?: number) {
    const logEntry = {
      type: 'TOOL_CALL',
      tool: toolName,
      arguments: args,
      result: error ? undefined : result,
      error: error ? {
        message: error.message || String(error),
        stack: error.stack,
        details: (error as any).details
      } : undefined,
      duration: duration || 0
    };
    
    this.writeLog('INFO', 'ToolCall', `Tool ${toolName} ${error ? 'failed' : 'succeeded'}`, logEntry);
  }

  public logHttpRequest(method: string, url: string, headers?: any, data?: any) {
    this.writeLog('DEBUG', 'HTTP', `${method} ${url}`, { headers, data });
  }

  public logHttpResponse(method: string, url: string, status: number, data?: any, duration?: number) {
    const level = status >= 400 ? 'ERROR' : 'DEBUG';
    this.writeLog(level, 'HTTP', `${method} ${url} -> ${status}`, { status, data, duration });
  }

  public logCurl(curl: string) {
    this.writeLog('TRACE', 'CURL', curl);
  }

  public getLogFile(): string {
    return this.logFile;
  }

  public close() {
    this.writeLog('INFO', 'Logger', `=== MCP Server Stopped at ${new Date().toISOString()} ===`);
    this.logStream.end();
  }
}

// Export singleton instance
export const logger = Logger.getInstance();