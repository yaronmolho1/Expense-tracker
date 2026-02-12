import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';
import { getUserId } from '@/lib/utils/auth';

// Validation schemas
// Support both last4Digits (preferred) and last4 (legacy) for backward compatibility
const createCardSchema = z.object({
  owner: z.string().min(1),
  last4Digits: z.string().length(4).regex(/^\d{4}$/).optional(),
  last4: z.string().length(4).regex(/^\d{4}$/).optional(), // Legacy field name
  // Support both issuer (legacy) and fileFormatHandler (direct)
  issuer: z.enum(['MAX', 'VISA-CAL', 'ISRACARD']).optional(),
  fileFormatHandler: z.enum(['max', 'visa-cal', 'isracard']).optional(),
  bankOrCompany: z.string().min(1).optional(),
  nickname: z.string().optional(),
}).refine((data) => data.last4Digits || data.last4, {
  message: 'Either last4Digits or last4 must be provided',
  path: ['last4Digits', 'last4'],
}).refine((data) => data.issuer || data.fileFormatHandler, {
  message: 'Either issuer or fileFormatHandler must be provided',
  path: ['issuer', 'fileFormatHandler'],
});

const ISSUER_TO_FILE_FORMAT: Record<string, string> = {
  MAX: 'max',
  'VISA-CAL': 'visa-cal',
  ISRACARD: 'isracard',
};

function getDefaultBankName(issuer: string): string {
  switch (issuer) {
    case 'MAX':
      return 'Max';
    case 'VISA-CAL':
      return 'Visa / Cal';
    case 'ISRACARD':
      return 'Isracard / Amex';
    default:
      return 'Unknown';
  }
}

/**
 * GET /api/cards
 * Get all active cards for a user
 * Query params: owner (optional, for backward compatibility - automatically uses authenticated user)
 */
export async function GET(request: Request) {
  try {
    // Get owner from auth (with fallback to query param for backward compatibility)
    const { searchParams } = new URL(request.url);
    const queryOwner = searchParams.get('owner');
    const authOwner = await getUserId(request);
    const owner = authOwner || queryOwner;

    logger.debug({ owner }, 'Cards API GET request received');

    if (!owner) {
      logger.warn('Cards API: No owner determined');
      return NextResponse.json({ error: 'Owner could not be determined' }, { status: 400 });
    }

    logger.debug({ owner }, 'Fetching cards from database');
    const allCards = await db.select().from(cards)
      .where(or(eq(cards.owner, owner), eq(cards.isSystem, true)))
      .orderBy(desc(cards.isSystem), desc(cards.createdAt));

    logger.debug({ cardCount: allCards.length, owner }, 'Cards fetched successfully');

    return NextResponse.json({
      cards: allCards.map((card) => ({
        id: card.id,
        last4: card.last4Digits,
        nickname: card.nickname,
        bankOrCompany: card.bankOrCompany,
        issuer:
          card.fileFormatHandler
            ? Object.keys(ISSUER_TO_FILE_FORMAT).find(
                (key) => ISSUER_TO_FILE_FORMAT[key] === card.fileFormatHandler
              ) || card.fileFormatHandler
            : null,
        fileFormatHandler: card.fileFormatHandler,
        isActive: card.isActive,
        isSystem: card.isSystem,
        type: card.type,
        createdAt: card.createdAt,
      })),
    });
  } catch (error) {
    logger.error(error, 'Failed to fetch cards');
    return NextResponse.json({ 
      error: 'Failed to fetch cards',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/cards
 * Create a new card
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = createCardSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validatedData.error.issues },
        { status: 400 }
      );
    }

    const { owner, last4Digits, last4, issuer, fileFormatHandler, nickname, bankOrCompany } = validatedData.data;

    // Support both last4Digits (preferred) and last4 (legacy)
    // Zod refine ensures at least one is provided, but TypeScript doesn't know that
    const finalLast4Digits = last4Digits || last4 || '';
    if (!finalLast4Digits) {
      // This should never happen due to Zod validation, but TypeScript safety
      return NextResponse.json(
        { error: 'Invalid request data', details: [{ message: 'Either last4Digits or last4 must be provided' }] },
        { status: 400 }
      );
    }

    // Determine fileFormatHandler: prefer direct value, fallback to mapped issuer
    // Zod refine ensures at least one is provided
    const finalFileFormatHandler = fileFormatHandler || (issuer ? ISSUER_TO_FILE_FORMAT[issuer] : null);
    if (!finalFileFormatHandler) {
      // This should never happen due to Zod validation, but TypeScript safety
      return NextResponse.json(
        { error: 'Invalid request data', details: [{ message: 'Either issuer or fileFormatHandler must be provided' }] },
        { status: 400 }
      );
    }

    // Check if card already exists
    const existingCard = await db.query.cards.findFirst({
      where: and(
        eq(cards.owner, owner),
        eq(cards.last4Digits, finalLast4Digits),
        eq(cards.fileFormatHandler, finalFileFormatHandler),
        eq(cards.isActive, true)
      ),
    });

    if (existingCard) {
      // Determine issuer for response (reverse lookup)
      const existingIssuer = Object.keys(ISSUER_TO_FILE_FORMAT).find(
        (key) => ISSUER_TO_FILE_FORMAT[key] === existingCard.fileFormatHandler
      ) || existingCard.fileFormatHandler;

      return NextResponse.json(
        {
          error: 'Card already exists',
          card: {
            id: existingCard.id,
            last4: existingCard.last4Digits,
            nickname: existingCard.nickname,
            issuer: existingIssuer,
          },
        },
        { status: 409 }
      );
    }

    // Create new card
    // Use provided bankOrCompany, or generate default from issuer if available
    const finalBankOrCompany = bankOrCompany || (issuer ? getDefaultBankName(issuer) : null);
    
    const result = await db
      .insert(cards)
      .values({
        owner,
        last4Digits: finalLast4Digits,
        fileFormatHandler: finalFileFormatHandler,
        nickname: nickname || null,
        bankOrCompany: finalBankOrCompany,
        isActive: true,
      })
      .returning();

    const newCard = result[0];

    // Determine issuer for response (reverse lookup)
    const responseIssuer = Object.keys(ISSUER_TO_FILE_FORMAT).find(
      (key) => ISSUER_TO_FILE_FORMAT[key] === newCard.fileFormatHandler
    ) || newCard.fileFormatHandler;

    return NextResponse.json(
      {
        message: 'Card created successfully',
        card: {
          id: newCard.id,
          last4: newCard.last4Digits,
          nickname: newCard.nickname,
          bankOrCompany: newCard.bankOrCompany,
          issuer: responseIssuer,
          fileFormatHandler: newCard.fileFormatHandler,
          createdAt: newCard.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    logger.error(error, 'Failed to create card');
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
  }
}
