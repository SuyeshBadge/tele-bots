/**
 * Logger utility for the UI/UX Lesson Bot
 */

import { createLogger, format, transports, Logger } from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDirectory = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Ensure activity logs directory exists
const activityLogDirectory = path.join(logDirectory, 'activities');
if (!fs.existsSync(activityLogDirectory)) {
  fs.mkdirSync(activityLogDirectory, { recursive: true });
}

// Ensure API response logs directory exists
const apiResponseLogDirectory = path.join(logDirectory, 'api');
if (!fs.existsSync(apiResponseLogDirectory)) {
  fs.mkdirSync(apiResponseLogDirectory, { recursive: true });
}

// Get log level from environment variable
const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';

// Configure log format
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
      msg += ` - ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Create logger
export const logger: Logger = createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'uiux-bot' },
  transports: [
    // Console transport for all environments
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        logFormat
      )
    }),
    // File transport
    new transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Create activity logger
const activityLogger: Logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, message, userId, action, ...metadata }) => {
      let logEntry = `${timestamp} | USER: ${userId || 'system'} | ACTION: ${action} | ${message}`;
      
      // Add additional metadata if present
      if (Object.keys(metadata).length > 0 && metadata.component !== undefined) {
        delete metadata.component; // Remove component as it's redundant
        if (Object.keys(metadata).length > 0) {
          logEntry += ` | DETAILS: ${JSON.stringify(metadata)}`;
        }
      }
      
      return logEntry;
    })
  ),
  transports: [
    // Activity log file - one per day
    new transports.File({
      filename: path.join(activityLogDirectory, `activity-${new Date().toISOString().split('T')[0]}.log`),
      maxsize: 5242880, // 5MB
      maxFiles: 30, // Keep a month of daily logs
    }),
  ],
  exitOnError: false,
});

// Create OpenAI responses logger (always logs at 'info' level regardless of global level)
const openAIResponseLogger: Logger = createLogger({
  level: 'info',  // Always log at info level
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, message, ...metadata }) => {
      let logEntry = `${timestamp} | ${message}`;
      
      // Add metadata if present
      if (Object.keys(metadata).length > 0) {
        if (metadata.component) {
          delete metadata.component; // Remove component as it's in the filename
        }
        if (Object.keys(metadata).length > 0) {
          logEntry += ` | ${JSON.stringify(metadata)}`;
        }
      }
      
      return logEntry;
    })
  ),
  transports: [
    // API responses log file - one per day
    new transports.File({
      filename: path.join(apiResponseLogDirectory, `openai-${new Date().toISOString().split('T')[0]}.log`),
      maxsize: 10485760, // 10MB
      maxFiles: 30, // Keep a month of daily logs
    }),
    // Console transport for development
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(({ timestamp, message }) => `${timestamp} [OpenAI]: ${message}`)
      )
    })
  ],
  exitOnError: false,
});

/**
 * Stream object for integrating with other libraries such as Express
 */
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

/**
 * Get a child logger with a specific component name
 * 
 * @param component - Component name for the child logger
 * @returns A child logger instance
 */
export function getChildLogger(component: string): Logger {
  // Special handling for OpenAI responses logger
  if (component === 'openai_responses') {
    return openAIResponseLogger.child({ component });
  }
  return logger.child({ component });
}

/**
 * Log a user activity
 * 
 * @param action - The action being performed
 * @param userId - The user ID performing the action
 * @param message - Description of the activity
 * @param metadata - Additional metadata about the activity
 */
export function logActivity(action: string, userId?: number, message?: string, metadata: Record<string, any> = {}): void {
  activityLogger.info(message || action, {
    userId,
    action,
    ...metadata,
  });
  
  // Also log to main logger for visibility
  logger.debug(`Activity: ${action} | User: ${userId || 'system'} | ${message || ''}`, metadata);
}

// Exposed for OpenAI response logging specifically
export function logOpenAIResponse(message: string, metadata: Record<string, any> = {}): void {
  openAIResponseLogger.info(message, metadata);
}

export default logger; 