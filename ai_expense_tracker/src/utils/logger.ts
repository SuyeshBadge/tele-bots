import { Logger as NestLogger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Ensure logs directory exists
const logDirectory = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

export class Logger extends NestLogger {
  constructor(context: string) {
    super(context);
  }

  log(message: any, ...optionalParams: any[]) {
    super.log(message, ...optionalParams);
    this.writeToFile('info', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    super.error(message, ...optionalParams);
    this.writeToFile('error', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    super.warn(message, ...optionalParams);
    this.writeToFile('warn', message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    super.debug(message, ...optionalParams);
    this.writeToFile('debug', message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    super.verbose(message, ...optionalParams);
    this.writeToFile('verbose', message, ...optionalParams);
  }

  private writeToFile(level: string, message: any, ...optionalParams: any[]) {
    try {
      const date = new Date();
      const logDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const logFileName = `${logDate}.log`;
      const logFilePath = path.join(logDirectory, logFileName);
      
      const timestamp = date.toISOString();
      const formattedMessage = `${timestamp} [${level}] [${this.context}] ${message}`;
      
      // Include optional params if provided
      const logMessage = optionalParams.length 
        ? `${formattedMessage} ${JSON.stringify(optionalParams)}\n` 
        : `${formattedMessage}\n`;
      
      fs.appendFileSync(logFilePath, logMessage);
    } catch (error) {
      console.error('Failed to write to log file', error);
    }
  }
}

export function getLogger(context: string): Logger {
  return new Logger(context);
} 