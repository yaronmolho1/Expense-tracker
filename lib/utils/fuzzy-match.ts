/**
 * Fuzzy Matching Utilities
 *
 * Implements Levenshtein distance algorithm for string similarity comparison.
 * Used for detecting duplicate businesses with slight name variations.
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Levenshtein distance (lower = more similar)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // Characters match, no operation needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of three operations
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // Deletion
          dp[i][j - 1] + 1,     // Insertion
          dp[i - 1][j - 1] + 1  // Substitution
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Calculate similarity score between two strings (0.0 to 1.0)
 * 1.0 = identical, 0.0 = completely different
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (0.0 to 1.0)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // Handle edge cases
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - (distance / maxLength);
}

/**
 * Check if two strings are similar enough to be considered duplicates
 *
 * @param str1 First string
 * @param str2 Second string
 * @param threshold Minimum similarity score (default 0.85)
 * @returns True if similarity >= threshold
 */
export function areSimilar(str1: string, str2: string, threshold: number = 0.85): boolean {
  return calculateSimilarity(str1, str2) >= threshold;
}

/**
 * Find all similar strings from a list
 *
 * @param target Target string to compare against
 * @param candidates List of candidate strings
 * @param threshold Minimum similarity score (default 0.85)
 * @returns Array of objects with candidate and similarity score, sorted by score (descending)
 */
export function findSimilar(
  target: string,
  candidates: string[],
  threshold: number = 0.85
): Array<{ candidate: string; similarity: number }> {
  return candidates
    .map(candidate => ({
      candidate,
      similarity: calculateSimilarity(target, candidate),
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
