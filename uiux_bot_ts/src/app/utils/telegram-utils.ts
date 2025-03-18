/**
 * Sanitize HTML for Telegram
 * @param text The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeHtmlForTelegram(text: string): string {
  if (!text) return '';
  
  // First convert the content to plain text if it has problematic HTML
  // This is the safest approach to avoid HTML parsing errors
  let sanitized = text;
  
  // Check if the text contains HTML tags that might cause issues
  const hasHtmlTags = /<[^>]+>/g.test(sanitized);
  
  if (hasHtmlTags) {
    // Count HTML tags to see if they're balanced
    const openingTags = (sanitized.match(/<[^\/][^>]*>/g) || []).length;
    const closingTags = (sanitized.match(/<\/[^>]+>/g) || []).length;
    
    // If tags are unbalanced, strip all HTML to be safe
    if (openingTags !== closingTags) {
      // Strip all HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      
      // Now we can apply markdown style formatting safely
      sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      sanitized = sanitized.replace(/\*(.*?)\*/g, '<i>$1</i>');
    } else {
      // Fix only <b> and <i> tags which are allowed in Telegram
      // Remove all other HTML tags
      sanitized = sanitized.replace(/<(?!\/?(b|i))[^>]+>/g, '');
    }
  }
  
  // Standardize newlines
  sanitized = sanitized.replace(/<br\s*\/?>/g, '\n');
  
  // Ensure paragraph spacing
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Telegram has a character limit for captions (1024 chars)
  // If the content is too long, truncate it
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 990) + '...\n\n<i>Message truncated due to length limits</i>';
  }
  
  return sanitized;
} 