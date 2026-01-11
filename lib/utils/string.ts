/**
 * Converts a string to title case (first letter capitalized, rest lowercase)
 * Handles English words, preserving Hebrew characters and special formatting
 *
 * @example
 * toTitleCase('APPLE STORE') => 'Apple Store'
 * toTitleCase('netflix') => 'Netflix'
 * toTitleCase('coca-cola') => 'Coca-Cola'
 */
export function toTitleCase(str: string): string {
  if (!str) return str;

  return str
    .split(' ')
    .map(word => {
      if (!word) return word;

      // Handle hyphenated words (e.g., "coca-cola" => "Coca-Cola")
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }

      // Regular word: capitalize first char, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
