/**
 * Header Validation - Extract card info from Excel file headers
 * Reads first ~10 rows to identify card last4 and issuer
 */

import * as XLSX from 'xlsx';
import { Issuer } from './filename-patterns';

export interface HeaderValidationResult {
  last4: string;
  issuer: Issuer;
  confidence: 'high' | 'medium' | 'low';
  additionalInfo?: {
    cardType?: string;
    accountNumber?: string;
    statementMonth?: string;
  };
}

// ============================================
// HEADER EXTRACTION FUNCTIONS
// ============================================

/**
 * Validate Isracard file header
 * Expected pattern in row 5: "ישראכרט אמריקן אקספרס - 8582" or "ישראכרט - 7547"
 */
function validateIsracardHeader(rows: any[][]): HeaderValidationResult | null {
  // Check rows 3-6 for Isracard pattern (usually row 5, but can vary)
  for (let i = 3; i < Math.min(7, rows.length); i++) {
    const rowText = rows[i]?.[0]?.toString() || '';

    // MUST contain either "ישראכרט" or "אמריקן אקספרס" to be Isracard (avoid matching MAX files)
    if (!rowText.includes('ישראכרט') && !rowText.includes('אמריקן אקספרס')) {
      continue;
    }

    // Match pattern: "ישראכרט" or "אמריקן אקספרס" + " - " + 4 digits
    const cardMatch = rowText.match(/-\s*(\d{4})/);

    if (cardMatch) {
      const cardType = rowText.includes('אמריקן אקספרס') ? 'AMEX' : 'Isracard';
      return {
        last4: cardMatch[1],
        issuer: 'ISRACARD',
        confidence: 'high',
        additionalInfo: {
          cardType,
        },
      };
    }
  }

  return null;
}

/**
 * Validate VISA/CAL file header
 * Expected pattern in row 0: "המסתיים ב-2446"
 */
function validateVisaCalHeader(rows: any[][]): HeaderValidationResult | null {
  // Check first 3 rows for the pattern (might not always be row 0)
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const rowText = rows[i]?.[0]?.toString() || '';

    // Match pattern: "המסתיים ב-" + 4 digits
    const cardMatch = rowText.match(/המסתיים ב-(\d{4})/);

    if (cardMatch) {
      // Extract account number if available (next row or row 1)
      const row1 = rows[1]?.[0]?.toString() || '';
      const accountMatch = row1.match(/דיסקונט לישראל ([\d-]+)/);

      return {
        last4: cardMatch[1],
        issuer: 'VISA-CAL',
        confidence: 'high',
        additionalInfo: {
          cardType: 'VISA/CAL',
          accountNumber: accountMatch?.[1],
        },
      };
    }
  }

  return null;
}

/**
 * Validate MAX file header
 * Expected: Column header "4 ספרות אחרונות של כרטיס האשראי" with last 4 digits in data row
 */
function validateMaxHeader(rows: any[][]): HeaderValidationResult | null {
  // MAX files have Hebrew headers
  // Look for "4 ספרות אחרונות של כרטיס האשראי" column in first 6 rows
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    // Find column index for "4 ספרות אחרונות של כרטיס האשראי"
    const colIndex = row.findIndex((cell: any) =>
      cell?.toString().includes('4 ספרות אחרונות') ||
      cell?.toString().includes('ספרות אחרונות של כרטיס')
    );

    if (colIndex !== -1) {
      // Found the header, now look for the value in next rows (check up to 10 rows)
      for (let j = i + 1; j < Math.min(i + 10, rows.length); j++) {
        const dataRow = rows[j];
        const cardValue = dataRow?.[colIndex]?.toString().trim();

        // Must be exactly 4 digits (not more, not less)
        if (cardValue && /^\d{4}$/.test(cardValue)) {
          return {
            last4: cardValue,
            issuer: 'MAX',
            confidence: 'high',
            additionalInfo: {
              cardType: 'MAX',
            },
          };
        }
      }
    }
  }

  return null;
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validate file header and extract card info
 * @param filePath - Absolute path to Excel file
 * @param expectedIssuer - (Optional) Issuer to validate against
 * @returns Validation result or null
 */
export async function validateFileHeader(
  filePath: string,
  expectedIssuer?: Issuer
): Promise<HeaderValidationResult | null> {
  try {
    // Read file as buffer first (XLSX.readFile may have issues in Docker)
    const fs = require('fs');
    const buffer = fs.readFileSync(filePath);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read first 15 rows (MAX needs more rows to find card number in data)
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      range: 0,
      blankrows: true,
      defval: null,
    }).slice(0, 15);

    // Try validators based on expected issuer first (if provided), then try all
    let result: HeaderValidationResult | null = null;

    if (expectedIssuer) {
      switch (expectedIssuer) {
        case 'ISRACARD':
          result = validateIsracardHeader(rows);
          break;
        case 'VISA-CAL':
          result = validateVisaCalHeader(rows);
          break;
        case 'MAX':
          result = validateMaxHeader(rows);
          break;
      }

      if (result) {
        return result;
      }
    }

    // Try all validators (MAX first - most specific)
    const validators = [
      validateMaxHeader,
      validateVisaCalHeader,
      validateIsracardHeader,
    ];

    for (const validator of validators) {
      result = validator(rows);
      if (result) return result;
    }

    return null;
  } catch (error) {
    console.error('[Header Validator] Error reading file:', filePath, error);
    return null;
  }
}

/**
 * Check if header matches expected card details
 */
export function headerMatchesCard(
  headerResult: HeaderValidationResult,
  expectedLast4: string,
  expectedIssuer: Issuer
): { matches: boolean; reason?: string } {
  if (headerResult.last4 !== expectedLast4) {
    return {
      matches: false,
      reason: `Card mismatch: header shows ${headerResult.last4}, expected ${expectedLast4}`,
    };
  }

  if (headerResult.issuer !== expectedIssuer) {
    return {
      matches: false,
      reason: `Issuer mismatch: header shows ${headerResult.issuer}, expected ${expectedIssuer}`,
    };
  }

  return { matches: true };
}
