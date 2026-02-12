/**
 * 3-Layer Card Detection Service
 * Orchestrates: User Input → Filename Pattern → Header Validation
 */

import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { extractCardFromFilename, Issuer, ISSUER_CONFIGS } from '@/lib/parsers/filename-patterns';
import { validateFileHeader } from '@/lib/parsers/header-validator';

// Map Issuer to CardIssuer type
export type CardIssuer = 'isracard' | 'visa-cal' | 'max';

function mapIssuer(issuer: Issuer): CardIssuer {
  const map: Record<Issuer, CardIssuer> = {
    'ISRACARD': 'isracard',
    'VISA-CAL': 'visa-cal',
    'MAX': 'max',
  };
  return map[issuer];
}

function reverseMapIssuer(issuer: CardIssuer): Issuer {
  const reverseMap: Record<CardIssuer, Issuer> = {
    'isracard': 'ISRACARD',
    'visa-cal': 'VISA-CAL',
    'max': 'MAX',
  };
  return reverseMap[issuer];
}

function getFormatHandler(issuer: Issuer | CardIssuer): string {
  // If already uppercase Issuer type
  if (issuer === 'ISRACARD' || issuer === 'VISA-CAL' || issuer === 'MAX') {
    const config = ISSUER_CONFIGS.find(c => c.issuer === issuer);
    return config?.parserName || 'generic_parser';
  }

  // If lowercase CardIssuer, map back
  const reverseMap: Record<CardIssuer, Issuer> = {
    'isracard': 'ISRACARD',
    'visa-cal': 'VISA-CAL',
    'max': 'MAX',
  };
  const mapped = reverseMap[issuer as CardIssuer];
  const config = ISSUER_CONFIGS.find(c => c.issuer === mapped);
  return config?.parserName || 'generic_parser';
}

export interface CardDetectionInput {
  filename: string;
  filePath: string;
  userSelectedCardId?: number; // Layer 1: User input
}

export interface CardDetectionResult {
  success: boolean;
  cardId?: number;
  last4?: string;
  issuer?: CardIssuer;
  formatHandler?: string;

  // Validation details
  layer1?: 'user_selected' | 'skipped';
  layer2?: 'filename_matched' | 'filename_failed';
  layer3?: 'header_matched' | 'header_failed';

  // Conflict info
  requiresUserApproval?: boolean;
  conflicts?: string[];

  // What was actually detected from file (L2/L3) - for display purposes
  fileDetectedLast4?: string;
  fileDetectedIssuer?: CardIssuer;

  error?: string;
}

/**
 * 3-Layer Card Detection
 * Returns card info or indicates user approval needed
 */
export async function detectCard(input: CardDetectionInput): Promise<CardDetectionResult> {
  const conflicts: string[] = [];
  let detectedLast4: string | undefined;
  let detectedIssuer: CardIssuer | undefined;
  let formatHandler: string | undefined;

  // Track what file layers detected (for display in conflicts)
  let fileDetectedLast4: string | undefined;
  let fileDetectedIssuer: CardIssuer | undefined;

  // ============================================
  // LAYER 1: USER INPUT (Source of Truth)
  // ============================================

  let layer1Result: 'user_selected' | 'skipped' = 'skipped';

  if (input.userSelectedCardId) {
    layer1Result = 'user_selected';

    // Fetch card from database
    const [card] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, input.userSelectedCardId))
      .limit(1);

    if (!card) {
      return {
        success: false,
        error: 'Selected card not found in database',
        layer1: layer1Result,
      };
    }

    detectedLast4 = card.last4Digits ?? undefined;
    formatHandler = card.fileFormatHandler ?? undefined;

    // Infer issuer from format handler
    if (formatHandler?.includes('isracard')) {
      detectedIssuer = 'isracard';
    } else if (formatHandler?.includes('visa') || formatHandler?.includes('cal')) {
      detectedIssuer = 'visa-cal';
    } else if (formatHandler?.includes('max')) {
      detectedIssuer = 'max';
    }
  }

  // ============================================
  // LAYER 2: FILENAME PATTERN VALIDATION
  // ============================================

  const filenameResult = extractCardFromFilename(input.filename);
  let layer2Result: 'filename_matched' | 'filename_failed' = 'filename_failed';

  if (filenameResult) {
    layer2Result = 'filename_matched';
    const filenameIssuer = mapIssuer(filenameResult.issuer);

    // Track file detection (prefer header over filename, but store filename for now)
    if (!fileDetectedLast4) {
      fileDetectedLast4 = filenameResult.last4;
      fileDetectedIssuer = filenameIssuer;
    }

    // If user provided input, validate filename matches
    if (layer1Result === 'user_selected') {
      if (filenameResult.last4 && filenameResult.last4 !== detectedLast4) {
        conflicts.push(
          `Filename shows card ${filenameResult.last4}, but user selected ${detectedLast4}`
        );
      }

      if (filenameIssuer !== detectedIssuer) {
        conflicts.push(
          `Filename indicates ${filenameIssuer}, but user selected ${detectedIssuer}`
        );
      }
    } else {
      // No user input - use filename as source
      detectedLast4 = filenameResult.last4;
      detectedIssuer = filenameIssuer;
      formatHandler = getFormatHandler(filenameResult.issuer);
    }
  }

  // ============================================
  // LAYER 3: FILE HEADER VALIDATION
  // ============================================

  const headerResult = await validateFileHeader(input.filePath, detectedIssuer ? reverseMapIssuer(detectedIssuer) : undefined);
  let layer3Result: 'header_matched' | 'header_failed' = 'header_failed';

  if (headerResult) {
    layer3Result = 'header_matched';

    // Header is most reliable - ALWAYS overwrite file detection display
    fileDetectedLast4 = headerResult.last4;
    fileDetectedIssuer = mapIssuer(headerResult.issuer);

    // Validate against previous layers
    if (detectedLast4 && headerResult.last4 !== detectedLast4) {
      conflicts.push(
        `File header shows card ${headerResult.last4}, but ${layer1Result === 'user_selected' ? 'user selected' : 'filename shows'} ${detectedLast4}`
      );
    }

    if (detectedIssuer && mapIssuer(headerResult.issuer) !== detectedIssuer) {
      conflicts.push(
        `File header indicates ${mapIssuer(headerResult.issuer)}, but ${layer1Result === 'user_selected' ? 'user selected' : 'filename indicates'} ${detectedIssuer}`
      );
    }

    // If no conflicts and no previous detection, use header
    if (conflicts.length === 0 && !detectedLast4) {
      detectedLast4 = headerResult.last4;
      detectedIssuer = mapIssuer(headerResult.issuer);
      formatHandler = getFormatHandler(headerResult.issuer);
    }
  }

  // ============================================
  // CONFLICT RESOLUTION
  // ============================================

  // Count how many layers succeeded
  const successfulLayers = [
    layer1Result === 'user_selected' ? 1 : 0,
    layer2Result === 'filename_matched' ? 1 : 0,
    layer3Result === 'header_matched' ? 1 : 0,
  ].reduce((sum, val) => sum + val, 0);

  // RULE 1: If any conflicts between layers → require approval
  if (conflicts.length > 0) {
    return {
      success: false,
      requiresUserApproval: true,
      conflicts,
      last4: detectedLast4,
      issuer: detectedIssuer,
      fileDetectedLast4,
      fileDetectedIssuer,
      layer1: layer1Result,
      layer2: layer2Result,
      layer3: layer3Result,
    };
  }

  // RULE 2: Need at least 2 successful layers (can't proceed with only 1)
  if (successfulLayers < 2) {
    return {
      success: false,
      requiresUserApproval: true,
      conflicts: ['Insufficient validation - need at least 2 matching sources to confirm card identity'],
      last4: detectedLast4,
      issuer: detectedIssuer,
      fileDetectedLast4,
      fileDetectedIssuer,
      layer1: layer1Result,
      layer2: layer2Result,
      layer3: layer3Result,
    };
  }

  // RULE 3: If we have 2+ layers but still missing card data → require approval
  if (!detectedLast4 || !detectedIssuer || !formatHandler) {
    return {
      success: false,
      requiresUserApproval: true,
      conflicts: ['Could not extract complete card details from validation layers'],
      last4: detectedLast4,
      issuer: detectedIssuer,
      fileDetectedLast4,
      fileDetectedIssuer,
      layer1: layer1Result,
      layer2: layer2Result,
      layer3: layer3Result,
    };
  }

  // ============================================
  // SUCCESS - FIND OR CREATE CARD
  // ============================================

  // Look up card in database - match BOTH last4 AND format handler to avoid duplicates
  const existingCards = await db
    .select()
    .from(cards)
    .where(eq(cards.last4Digits, detectedLast4));

  // Filter by format handler to find exact match
  const existingCard = existingCards.find(
    (c) => c.fileFormatHandler === formatHandler
  );

  return {
    success: true,
    cardId: existingCard?.id,
    last4: detectedLast4,
    issuer: detectedIssuer,
    formatHandler,
    layer1: layer1Result,
    layer2: layer2Result,
    layer3: layer3Result,
  };
}
