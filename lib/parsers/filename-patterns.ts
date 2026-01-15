/**
 * Filename Pattern Configuration for Card Detection
 *
 * This file defines regex patterns for extracting card information from filenames.
 * Each issuer has specific filename formats that encode the card's last 4 digits.
 *
 * Used in TIER 2 of the card detection system.
 */

export type Issuer = 'MAX' | 'VISA-CAL' | 'ISRACARD';

export interface FilenamePattern {
  pattern: RegExp;
  last4Extractor: (match: RegExpMatchArray) => string;
  description: string;
  examples: string[];
}

export interface IssuerConfig {
  issuer: Issuer;
  displayName: string;
  parserName: string;
  patterns: FilenamePattern[];
}

/**
 * Filename patterns for all supported issuers
 * Order matters: patterns are tried in sequence until a match is found
 */
export const ISSUER_CONFIGS: IssuerConfig[] = [
  {
    issuer: 'MAX',
    displayName: 'MAX (Discount Bank)',
    parserName: 'max',
    patterns: [
      {
        pattern: /^(\d{2})\.(\d{2})\s*-\s*(\d{4})\.xlsx$/,
        last4Extractor: (match) => match[3],
        description: 'Format: MM.YY - XXXX.xlsx',
        examples: ['08.25 - 7229.xlsx', '07.25 - 7229.xlsx', '12.24 - 1234.xlsx'],
      },
      {
        pattern: /^MAX[_\s-](\d{4})[_\s-]\d{2}[_\s-]\d{2,4}\.xlsx$/i,
        last4Extractor: (match) => match[1],
        description: 'Format: MAX_XXXX_MM_YYYY.xlsx',
        examples: ['MAX_7229_08_2025.xlsx', 'max-1234-12-24.xlsx'],
      },
    ],
  },
  {
    issuer: 'VISA-CAL',
    displayName: 'VISA CAL (Discount Bank)',
    parserName: 'visa-cal',
    patterns: [
      {
        pattern: /פירוט חיובים לכרטיס ויזה (\d{4})/,
        last4Extractor: (match) => match[1],
        description: 'Hebrew format embedded in filename',
        examples: ['פירוט חיובים לכרטיס ויזה 2446.xlsx'],
      },
      {
        pattern: /^VISA[_\s-]?CAL[_\s-](\d{4})[_\s-]?\d{2}[_\s-]?\d{2,4}\.xlsx$/i,
        last4Extractor: (match) => match[1],
        description: 'Format: VISA-CAL-XXXX-MM-YYYY.xlsx',
        examples: ['VISA-CAL-2446-08-2025.xlsx', 'visa_cal_1234_12_24.xlsx'],
      },
      {
        pattern: /^(\d{4})_VISA_CAL_\d{2}_\d{2,4}\.xlsx$/,
        last4Extractor: (match) => match[1],
        description: 'Format: XXXX_VISA_CAL_MM_YYYY.xlsx',
        examples: ['2446_VISA_CAL_08_2025.xlsx'],
      },
    ],
  },
  {
    issuer: 'ISRACARD',
    displayName: 'Isracard / AMEX',
    parserName: 'isracard',
    patterns: [
      {
        pattern: /^(\d{4})_(\d{2})_(\d{4})(\.xlsx)?$/,
        last4Extractor: (match) => match[1],
        description: 'Format: XXXX_MM_YYYY or XXXX_MM_YYYY.xlsx',
        examples: ['8041_01_2025', '8041_01_2025.xlsx', '7547_10_2025', '8582_08_2025.xlsx'],
      },
      {
        pattern: /^ISRACARD[_\s-](\d{4})[_\s-]\d{2}[_\s-]\d{2,4}\.xlsx$/i,
        last4Extractor: (match) => match[1],
        description: 'Format: ISRACARD_XXXX_MM_YYYY.xlsx',
        examples: ['ISRACARD_8041_01_2025.xlsx', 'isracard-7547-10-25.xlsx'],
      },
      {
        pattern: /^AMEX[_\s-](\d{4})[_\s-]\d{2}[_\s-]\d{2,4}\.xlsx$/i,
        last4Extractor: (match) => match[1],
        description: 'Format: AMEX_XXXX_MM_YYYY.xlsx',
        examples: ['AMEX_8041_01_2025.xlsx', 'amex-8582-08-25.xlsx'],
      },
    ],
  },
];

/**
 * Extract card last 4 digits from filename
 * @param filename - The filename to parse
 * @returns {issuer, last4} or null if no pattern matches
 */
export function extractCardFromFilename(filename: string): { issuer: Issuer; last4: string } | null {
  for (const config of ISSUER_CONFIGS) {
    for (const pattern of config.patterns) {
      const match = filename.match(pattern.pattern);
      if (match) {
        const last4 = pattern.last4Extractor(match);
        if (last4 && /^\d{4}$/.test(last4)) {
          return {
            issuer: config.issuer,
            last4,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Get all possible filename patterns for a given issuer
 * @param issuer - The card issuer
 * @returns Array of pattern descriptions and examples
 */
export function getIssuerPatterns(issuer: Issuer): FilenamePattern[] {
  const config = ISSUER_CONFIGS.find((c) => c.issuer === issuer);
  return config?.patterns || [];
}

/**
 * Validate if a filename matches expected format for given issuer
 * @param filename - The filename to validate
 * @param issuer - The expected issuer
 * @returns true if filename matches one of the issuer's patterns
 */
export function validateFilenameFormat(filename: string, issuer: Issuer): boolean {
  const patterns = getIssuerPatterns(issuer);
  return patterns.some((p) => p.pattern.test(filename));
}
