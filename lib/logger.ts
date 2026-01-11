/**
 * Structured Logger
 * 
 * Sanitizes sensitive data and provides structured logging interface.
 * Prevents logging of environment variables, passwords, tokens, secrets, and keys.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Sensitive patterns to detect and redact from logs
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /session[_-]?id/i,
  /credential/i,
  /bearer\s+/i,
  /authorization/i,
];

/**
 * Sanitizes a value to prevent logging sensitive information
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Check if value is an environment variable reference
  if (typeof value === 'string' && value.includes('process.env.')) {
    return '[REDACTED: environment variable]';
  }

  // If it's an object, sanitize recursively
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Check if key matches sensitive patterns
      const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'string' && SENSITIVE_PATTERNS.some(pattern => pattern.test(val))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  // If it's a string, check for sensitive content
  if (typeof value === 'string') {
    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(value))) {
      return '[REDACTED]';
    }
  }

  return value;
}

/**
 * Sanitizes error objects to prevent leaking stack traces with sensitive data
 */
function sanitizeError(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) {
    // Only include stack trace in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      name: error.name,
      message: error.message,
      ...(isDevelopment && { stack: error.stack }),
    };
  }
  
  return {
    message: String(error),
  };
}

/**
 * Formats a log entry with timestamp and structured data
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const sanitizedContext = context ? sanitizeValue(context) : undefined;
  
  const logEntry: Record<string, unknown> = {
    timestamp,
    level,
    message,
  };
  
  if (sanitizedContext) {
    logEntry.context = sanitizedContext;
  }

  // Use appropriate console method based on level
  switch (level) {
    case 'error':
      console.error(JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0));
      break;
    case 'warn':
      console.warn(JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0));
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify(logEntry, null, 2));
      }
      break;
    default:
      console.log(JSON.stringify(logEntry, null, process.env.NODE_ENV === 'development' ? 2 : 0));
  }
}

/**
 * Structured Logger API
 */
const logger = {
  /**
   * Log informational messages
   */
  info: (context: LogContext | string, message?: string): void => {
    if (typeof context === 'string') {
      formatLog('info', context);
    } else {
      formatLog('info', message || 'Info', context);
    }
  },

  /**
   * Log warning messages
   */
  warn: (context: LogContext | string, message?: string): void => {
    if (typeof context === 'string') {
      formatLog('warn', context);
    } else {
      formatLog('warn', message || 'Warning', context);
    }
  },

  /**
   * Log error messages
   */
  error: (error: unknown, message?: string): void => {
    const sanitizedError = sanitizeError(error);
    formatLog('error', message || 'Error', {
      error: sanitizedError,
    });
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (context: LogContext | string, message?: string): void => {
    if (process.env.NODE_ENV === 'development') {
      if (typeof context === 'string') {
        formatLog('debug', context);
      } else {
        formatLog('debug', message || 'Debug', context);
      }
    }
  },
};

export default logger;
