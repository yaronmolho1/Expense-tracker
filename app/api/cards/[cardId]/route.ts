import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cards } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

// Validation schema for update
const updateCardSchema = z.object({
  owner: z.string().min(1),
  nickname: z.string().nullable().optional().transform(val => val === '' ? null : val),
  bankOrCompany: z.string().nullable().optional().transform(val => val === '' ? null : val),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/cards/[cardId]
 * Get a specific card by ID
 */
export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId: cardIdParam } = await params;
    const cardId = parseInt(cardIdParam, 10);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    const card = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const ISSUER_TO_FILE_FORMAT: Record<string, string> = {
      MAX: 'max',
      'VISA-CAL': 'visa-cal',
      ISRACARD: 'isracard',
    };

    const issuer =
      Object.keys(ISSUER_TO_FILE_FORMAT).find((key) => ISSUER_TO_FILE_FORMAT[key] === card.fileFormatHandler) ||
      card.fileFormatHandler;

    return NextResponse.json({
      card: {
        id: card.id,
        last4: card.last4Digits,
        nickname: card.nickname,
        bankOrCompany: card.bankOrCompany,
        issuer,
        fileFormatHandler: card.fileFormatHandler,
        owner: card.owner,
        isActive: card.isActive,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    });
  } catch (error) {
    logger.error(error, 'Failed to fetch card');
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
  }
}

/**
 * PATCH /api/cards/[cardId]
 * Update a card (nickname, bankOrCompany, isActive)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId: cardIdParam } = await params;
    const cardId = parseInt(cardIdParam, 10);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = updateCardSchema.parse(body);

    const { owner, nickname, bankOrCompany, isActive } = validatedData;

    // Verify ownership
    const existingCard = await db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.owner, owner)),
    });

    if (!existingCard) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    // Update card
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (nickname !== undefined) updateData.nickname = nickname;
    if (bankOrCompany !== undefined) updateData.bankOrCompany = bankOrCompany;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await db.update(cards).set(updateData).where(eq(cards.id, cardId)).returning();

    const updatedCard = result[0];

    const ISSUER_TO_FILE_FORMAT: Record<string, string> = {
      MAX: 'max',
      'VISA-CAL': 'visa-cal',
      ISRACARD: 'isracard',
    };

    const issuer =
      Object.keys(ISSUER_TO_FILE_FORMAT).find(
        (key) => ISSUER_TO_FILE_FORMAT[key] === updatedCard.fileFormatHandler
      ) || updatedCard.fileFormatHandler;

    return NextResponse.json({
      message: 'Card updated successfully',
      card: {
        id: updatedCard.id,
        last4: updatedCard.last4Digits,
        nickname: updatedCard.nickname,
        bankOrCompany: updatedCard.bankOrCompany,
        issuer,
        fileFormatHandler: updatedCard.fileFormatHandler,
        isActive: updatedCard.isActive,
        updatedAt: updatedCard.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }
    logger.error(error, 'Failed to update card');
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}

/**
 * DELETE /api/cards/[cardId]
 * Delete a card (only if no transactions exist)
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId: cardIdParam } = await params;
    const cardId = parseInt(cardIdParam, 10);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');

    if (!owner) {
      return NextResponse.json({ error: 'Owner parameter required' }, { status: 400 });
    }

    // Verify ownership
    const existingCard = await db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.owner, owner)),
    });

    if (!existingCard) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    // Check for existing transactions
    const txCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM transactions WHERE card_id = ${cardId}
    `);

    const count = Number(txCount[0]?.count || 0);

    // Get cascade delete confirmation from query param
    const cascadeDelete = searchParams.get('cascade') === 'true';

    if (count > 0 && !cascadeDelete) {
      // Return transaction count - frontend will ask for confirmation
      return NextResponse.json(
        {
          error: `This card has ${count} transaction(s). Delete will remove all transactions.`,
          transactionCount: count,
          requiresConfirmation: true
        },
        { status: 409 }
      );
    }

    // Delete transactions and related data if cascade requested
    if (count > 0 && cascadeDelete) {
      logger.info({ cardId, transactionCount: count }, 'Starting cascade delete for card');

      // Delete transactions
      await db.execute(sql`
        DELETE FROM transactions WHERE card_id = ${cardId}
      `);
    }

    // Always delete related data with FK constraints before deleting card
    // 1. Delete subscriptions (always, not just when transactions exist)
    await db.execute(sql`
      DELETE FROM subscriptions WHERE card_id = ${cardId}
    `);

    // 2. Delete subscription suggestions
    await db.execute(sql`
      DELETE FROM subscription_suggestions WHERE card_id = ${cardId}
    `);

    // 3. Delete uploaded_files
    await db.execute(sql`
      DELETE FROM uploaded_files WHERE card_id = ${cardId}
    `);

    // Delete card permanently
    await db.delete(cards).where(eq(cards.id, cardId));

    return NextResponse.json({
      message: `Card deleted successfully${count > 0 ? ` (${count} transactions removed)` : ''}`,
      cardId,
      transactionsDeleted: count,
    });
  } catch (error) {
    logger.error(error, 'Failed to delete card');
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
