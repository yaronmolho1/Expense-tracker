/**
 * Input Sanitization Utilities
 * 
 * Prevents XSS attacks by sanitizing user input.
 * Removes dangerous HTML/JavaScript from strings.
 */

/**
 * Remove HTML tags from string
 * Prevents basic XSS attacks
 */
export function stripHtmlTags(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove all HTML tags
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML special characters
 * Converts <, >, &, ", ' to HTML entities
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Remove SQL injection characters
 * Basic protection (use parameterized queries as primary defense)
 */
export function sanitizeSqlInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove common SQL injection patterns
  // Note: This is NOT a replacement for parameterized queries!
  return input
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '')    // Remove SQL comments
    .replace(/\/\*/g, '')  // Remove block comment start
    .replace(/\*\//g, '')  // Remove block comment end
    .trim();
}

/**
 * Sanitize business/category display names
 * Allows alphanumeric, spaces, and common punctuation
 * Removes potentially dangerous characters
 */
export function sanitizeDisplayName(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Strip HTML tags first
  let sanitized = stripHtmlTags(input);
  
  // Remove control characters and other dangerous characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized;
}

/**
 * Sanitize search query input
 * Prevents search-based XSS and injection
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Strip HTML
  let sanitized = stripHtmlTags(input);
  
  // Remove special regex characters that could cause issues
  // Keep: letters, numbers, spaces, hyphens, apostrophes
  sanitized = sanitized.replace(/[^\w\s\-'א-ת]/g, '');
  
  // Trim and limit length
  sanitized = sanitized.trim();
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const trimmed = input.trim().toLowerCase();
  
  // Basic email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  
  return trimmed;
}

/**
 * Sanitize URL input
 * Only allows http/https protocols
 */
export function sanitizeUrl(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const trimmed = input.trim();
  
  try {
    const url = new URL(trimmed);
    
    // Only allow http and https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize filename for file uploads
 * Removes path traversal and dangerous characters
 */
export function sanitizeFilename(input: string): string {
  if (!input || typeof input !== 'string') {
    return 'file';
  }
  
  // Remove path traversal
  let sanitized = input.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[^\w\s\-\.]/g, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim dots and spaces from start/end
  sanitized = sanitized.replace(/^[\s\.]+|[\s\.]+$/g, '');
  
  return sanitized || 'file';
}

/**
 * Sanitize numeric input
 * Returns number or null if invalid
 */
export function sanitizeNumber(input: any): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  
  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  return num;
}

/**
 * Sanitize boolean input
 * Handles string "true"/"false" and actual booleans
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  
  if (typeof input === 'string') {
    return input.toLowerCase() === 'true';
  }
  
  return Boolean(input);
}

/**
 * Sanitize date string (YYYY-MM-DD format)
 * Returns sanitized string or null if invalid
 */
export function sanitizeDate(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  // Must match YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(input)) {
    return null;
  }
  
  // Verify it's a valid date
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return input;
}
