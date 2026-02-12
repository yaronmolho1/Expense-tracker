/**
 * Card Detection Service (4-Tier System)
 *
 * Determines {cardLast4, issuer} from uploaded credit card statement files
 * before parsing begins. Nothing starts parsing without verified card info.
 *
 * TIER 1: User-provided card + DB verification
 * TIER 2: Filename pattern extraction + header validation
 * TIER 3: Header-only extraction (fallback)
 * TIER 4: Manual confirmation with file preview
 */

import * as XLSX from 'xlsx';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { cards } from '../db/schema';
import { extractCardFromFilename, type Issuer } from '../parsers/filename-patterns';
import { MaxParser } from '../parsers/max-parser';
import { VisaCalParser } from '../parsers/visa-cal-parser';
import { IscracardParser } from '../parsers/isracard-parser';

// ============================================
// TYPES
// ============================================

export type DetectionTier = 'TIER_1_USER' | 'TIER_2_FILENAME' | 'TIER_3_HEADER' | 'TIER_4_MANUAL';

export type DetectionStatus =
  | 'VERIFIED' // Card found in DB, all info matches
  | 'CLASH' // Card found but info conflicts (filename ≠ header or user ≠ DB)
  | 'NEW_CARD' // Card not in DB, needs to be created
  | 'NEEDS_MANUAL'; // Cannot determine automatically, requires user input

export interface CardInfo {
  last4: string;
  issuer: Issuer;
}

export interface CardDetectionResult {
  status: DetectionStatus;
  tier: DetectionTier;
  cardInfo: CardInfo | null;
  dbCardId?: number;
  clashDetails?: {
    userProvided?: CardInfo;
    filename?: CardInfo;
    header?: CardInfo;
    dbCard?: {
      id: number;
      last4: string;
      issuer: Issuer;
      nickname?: string;
    };
  };
  needsUserConfirmation: boolean;
  message: string;
}

// ============================================
// PARSER MAP
// ============================================

const ISSUER_TO_PARSER = {
  MAX: MaxParser,
  'VISA-CAL': VisaCalParser,
  ISRACARD: IscracardParser,
} as const;

const FILE_FORMAT_TO_ISSUER: Record<string, Issuer> = {
  max: 'MAX',
  'visa-cal': 'VISA-CAL',
  isracard: 'ISRACARD',
};

const ISSUER_TO_FILE_FORMAT: Record<Issuer, string> = {
  MAX: 'max',
  'VISA-CAL': 'visa-cal',
  ISRACARD: 'isracard',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract card info from file header using all parsers
 * @param filePath - Path to the Excel file
 * @returns {issuer, last4} or null if extraction fails
 */
async function extractFromHeader(filePath: string): Promise<CardInfo | null> {
  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Get first 10 rows (header area)
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      range: 0,
    }) as any[][];

    const headerRows = rows.slice(0, 10);

    // Try each parser's header extraction
    const parsers: Array<{ issuer: Issuer; extractor: (rows: any[][]) => { last4: string } | null }> = [
      { issuer: 'MAX', extractor: MaxParser.extractCardFromHeader },
      { issuer: 'VISA-CAL', extractor: VisaCalParser.extractCardFromHeader },
      { issuer: 'ISRACARD', extractor: IscracardParser.extractCardFromHeader },
    ];

    for (const { issuer, extractor } of parsers) {
      const result = extractor(headerRows);
      if (result && result.last4) {
        return { issuer, last4: result.last4 };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting from header:', error);
    return null;
  }
}

/**
 * Lookup card in database by last4 and owner
 * @param last4 - Last 4 digits of card
 * @param owner - Card owner (user ID)
 * @returns DB card or null
 */
async function findCardInDb(last4: string, owner: string) {
  const result = await db
    .select()
    .from(cards)
    .where(and(eq(cards.last4Digits, last4), eq(cards.owner, owner), eq(cards.isActive, true)))
    .limit(1);

  return result[0] || null;
}

/**
 * Validate if multiple CardInfo objects match
 */
function cardsMatch(card1: CardInfo | null, card2: CardInfo | null): boolean {
  if (!card1 || !card2) return false;
  return card1.last4 === card2.last4 && card1.issuer === card2.issuer;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect card information from uploaded file using 4-tier system
 *
 * @param params.owner - User ID (owner of the card)
 * @param params.filePath - Path to uploaded file
 * @param params.filename - Name of uploaded file
 * @param params.userProvidedCard - Optional user-selected card {last4, issuer}
 * @returns CardDetectionResult with status and card info
 */
export async function detectCard(params: {
  owner: string;
  filePath: string;
  filename: string;
  userProvidedCard?: CardInfo;
}): Promise<CardDetectionResult> {
  const { owner, filePath, filename, userProvidedCard } = params;

  // ==========================================
  // TIER 1: User-provided card + DB verification
  // ==========================================
  if (userProvidedCard) {
    const dbCard = await findCardInDb(userProvidedCard.last4, owner);

    if (dbCard) {
      // Card exists in DB - check if issuer matches
      const dbIssuer = dbCard.fileFormatHandler ? FILE_FORMAT_TO_ISSUER[dbCard.fileFormatHandler] : undefined;

      if (dbIssuer === userProvidedCard.issuer) {
        // Perfect match - VERIFIED
        return {
          status: 'VERIFIED',
          tier: 'TIER_1_USER',
          cardInfo: userProvidedCard,
          dbCardId: dbCard.id,
          needsUserConfirmation: false,
          message: `Card verified: ${dbCard.nickname || dbCard.last4Digits} (${dbIssuer})`,
        };
      } else {
        // Issuer mismatch - CLASH
        return {
          status: 'CLASH',
          tier: 'TIER_1_USER',
          cardInfo: null,
          clashDetails: {
            userProvided: userProvidedCard,
            dbCard: {
              id: dbCard.id,
              last4: dbCard.last4Digits,
              issuer: dbIssuer,
              nickname: dbCard.nickname || undefined,
            },
          },
          needsUserConfirmation: true,
          message: `User selected ${userProvidedCard.issuer}, but DB shows ${dbIssuer} for card ${userProvidedCard.last4}`,
        };
      }
    } else {
      // Card not in DB - NEW_CARD
      return {
        status: 'NEW_CARD',
        tier: 'TIER_1_USER',
        cardInfo: userProvidedCard,
        needsUserConfirmation: true,
        message: `New card: ${userProvidedCard.last4} (${userProvidedCard.issuer}) - will be added to database`,
      };
    }
  }

  // ==========================================
  // TIER 2: Filename pattern extraction + header validation
  // ==========================================
  const filenameCard = extractCardFromFilename(filename);

  if (filenameCard) {
    // Try to validate against header
    const headerCard = await extractFromHeader(filePath);

    if (headerCard) {
      // Both filename and header available
      if (cardsMatch(filenameCard, headerCard)) {
        // Perfect match - check DB
        const dbCard = await findCardInDb(filenameCard.last4, owner);

        if (dbCard) {
          const dbIssuer = dbCard.fileFormatHandler ? FILE_FORMAT_TO_ISSUER[dbCard.fileFormatHandler] : undefined;

          if (dbIssuer === filenameCard.issuer) {
            // VERIFIED
            return {
              status: 'VERIFIED',
              tier: 'TIER_2_FILENAME',
              cardInfo: filenameCard,
              dbCardId: dbCard.id,
              needsUserConfirmation: false,
              message: `Card auto-detected from filename and verified: ${dbCard.nickname || dbCard.last4Digits}`,
            };
          } else {
            // CLASH: filename/header agree, but DB disagrees
            return {
              status: 'CLASH',
              tier: 'TIER_2_FILENAME',
              cardInfo: null,
              clashDetails: {
                filename: filenameCard,
                header: headerCard,
                dbCard: {
                  id: dbCard.id,
                  last4: dbCard.last4Digits ?? undefined,
                  issuer: dbIssuer,
                  nickname: dbCard.nickname || undefined,
                },
              },
              needsUserConfirmation: true,
              message: `Filename/header show ${filenameCard.issuer}, but DB shows ${dbIssuer} for card ${filenameCard.last4}`,
            };
          }
        } else {
          // NEW_CARD
          return {
            status: 'NEW_CARD',
            tier: 'TIER_2_FILENAME',
            cardInfo: filenameCard,
            needsUserConfirmation: true,
            message: `New card detected from filename: ${filenameCard.last4} (${filenameCard.issuer})`,
          };
        }
      } else {
        // CLASH: filename ≠ header
        return {
          status: 'CLASH',
          tier: 'TIER_2_FILENAME',
          cardInfo: null,
          clashDetails: {
            filename: filenameCard,
            header: headerCard,
          },
          needsUserConfirmation: true,
          message: `Conflict: filename shows ${filenameCard.issuer}-${filenameCard.last4}, header shows ${headerCard.issuer}-${headerCard.last4}`,
        };
      }
    } else {
      // Filename only, no header validation possible
      const dbCard = await findCardInDb(filenameCard.last4, owner);

      if (dbCard) {
        const dbIssuer = dbCard.fileFormatHandler ? FILE_FORMAT_TO_ISSUER[dbCard.fileFormatHandler] : undefined;

        if (dbIssuer === filenameCard.issuer) {
          // VERIFIED (with lower confidence)
          return {
            status: 'VERIFIED',
            tier: 'TIER_2_FILENAME',
            cardInfo: filenameCard,
            dbCardId: dbCard.id,
            needsUserConfirmation: false,
            message: `Card detected from filename: ${dbCard.nickname || dbCard.last4Digits} (header validation unavailable)`,
          };
        }
      }

      // Fallback to TIER 3 if no DB match
    }
  }

  // ==========================================
  // TIER 3: Header-only extraction
  // ==========================================
  const headerCard = await extractFromHeader(filePath);

  if (headerCard) {
    const dbCard = await findCardInDb(headerCard.last4, owner);

    if (dbCard) {
      const dbIssuer = dbCard.fileFormatHandler ? FILE_FORMAT_TO_ISSUER[dbCard.fileFormatHandler] : undefined;

      if (dbIssuer === headerCard.issuer) {
        // VERIFIED
        return {
          status: 'VERIFIED',
          tier: 'TIER_3_HEADER',
          cardInfo: headerCard,
          dbCardId: dbCard.id,
          needsUserConfirmation: false,
          message: `Card detected from file header: ${dbCard.nickname || dbCard.last4Digits}`,
        };
      } else {
        // CLASH
        return {
          status: 'CLASH',
          tier: 'TIER_3_HEADER',
          cardInfo: null,
          clashDetails: {
            header: headerCard,
            dbCard: {
              id: dbCard.id,
              last4: dbCard.last4Digits,
              issuer: dbIssuer,
              nickname: dbCard.nickname || undefined,
            },
          },
          needsUserConfirmation: true,
          message: `Header shows ${headerCard.issuer}, but DB shows ${dbIssuer} for card ${headerCard.last4}`,
        };
      }
    } else {
      // NEW_CARD
      return {
        status: 'NEW_CARD',
        tier: 'TIER_3_HEADER',
        cardInfo: headerCard,
        needsUserConfirmation: true,
        message: `New card detected from header: ${headerCard.last4} (${headerCard.issuer})`,
      };
    }
  }

  // ==========================================
  // TIER 4: Manual confirmation required
  // ==========================================
  return {
    status: 'NEEDS_MANUAL',
    tier: 'TIER_4_MANUAL',
    cardInfo: null,
    needsUserConfirmation: true,
    message: 'Cannot auto-detect card info. Please provide card details manually.',
  };
}

/**
 * Create a new card in the database
 * @param params Card creation parameters
 * @returns Created card ID
 */
export async function createCard(params: {
  owner: string;
  last4: string;
  issuer: Issuer;
  nickname?: string;
  bankOrCompany?: string;
}): Promise<number> {
  const { owner, last4, issuer, nickname, bankOrCompany } = params;

  const fileFormatHandler = ISSUER_TO_FILE_FORMAT[issuer];

  const result = await db
    .insert(cards)
    .values({
      owner,
      last4Digits: last4,
      fileFormatHandler,
      nickname: nickname || null,
      bankOrCompany: bankOrCompany || getDefaultBankName(issuer),
      isActive: true,
    })
    .returning({ id: cards.id });

  return result[0].id;
}

/**
 * Get default bank name for issuer
 */
function getDefaultBankName(issuer: Issuer): string {
  switch (issuer) {
    case 'MAX':
      return 'Discount Bank (MAX)';
    case 'VISA-CAL':
      return 'Discount Bank (VISA-CAL)';
    case 'ISRACARD':
      return 'Isracard / AMEX';
    default:
      return 'Unknown';
  }
}
