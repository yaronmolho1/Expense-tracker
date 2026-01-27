import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses, transactions, subscriptions, businessMergeSuggestions } from '@/lib/db/schema';
import { eq, sql, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

const UpdateBusinessSchema = z.object({
  approved: z.boolean().optional(),
  display_name: z.string().min(1).optional(),
  primary_category_id: z.number().int().nullable().optional(),
  child_category_id: z.number().int().nullable().optional(),
});

const DeleteBusinessSchema = z.object({
  delete_merged: z.boolean().optional().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ requires awaiting params
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateBusinessSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const updates: any = {};

    if (validation.data.approved !== undefined) {
      updates.approved = validation.data.approved;
    }

    if (validation.data.display_name) {
      updates.displayName = validation.data.display_name;
    }

    if (validation.data.primary_category_id !== undefined) {
      updates.primaryCategoryId = validation.data.primary_category_id;
    }

    if (validation.data.child_category_id !== undefined) {
      updates.childCategoryId = validation.data.child_category_id;
    }

    // When updating categories, auto-approve the business
    if (validation.data.primary_category_id !== undefined || validation.data.child_category_id !== undefined) {
      updates.approved = true;
    }

    // Update business
    await db
      .update(businesses)
      .set(updates)
      .where(eq(businesses.id, businessId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to update business:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update business' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const businessId = parseInt(id, 10);

    if (isNaN(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    // Parse optional query parameters
    const url = new URL(request.url);
    const deleteMergedParam = url.searchParams.get('delete_merged');
    const deleteMerged = deleteMergedParam === 'true';

    // Check if this business has businesses merged into it
    const mergedBusinesses = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.mergedToId, businessId));

    // Get transaction counts before deletion
    const businessStats = await db
      .select({
        transactionCount: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .where(eq(transactions.businessId, businessId));

    const mergedStats = deleteMerged && mergedBusinesses.length > 0
      ? await db
          .select({
            transactionCount: sql<number>`COUNT(*)::int`,
          })
          .from(transactions)
          .where(sql`${transactions.originalBusinessId} IN (${sql.join(mergedBusinesses.map(b => b.id), sql`, `)})`)
      : [{ transactionCount: 0 }];

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      if (deleteMerged && mergedBusinesses.length > 0) {
        // Delete all (parent + merged): Delete transactions that belong to merged businesses
        const mergedIds = mergedBusinesses.map(b => b.id);
        await tx
          .delete(transactions)
          .where(inArray(transactions.originalBusinessId, mergedIds));

        // Delete the merged businesses
        await tx
          .delete(businesses)
          .where(inArray(businesses.id, mergedIds));
      } else if (mergedBusinesses.length > 0) {
        // Delete parent only: First unmerge all child businesses
        for (const mergedBusiness of mergedBusinesses) {
          // Move transactions back to the original business (unmerge)
          await tx
            .update(transactions)
            .set({ businessId: mergedBusiness.id })
            .where(eq(transactions.originalBusinessId, mergedBusiness.id));

          // Clear the mergedToId to restore the business as active
          await tx
            .update(businesses)
            .set({ mergedToId: null })
            .where(eq(businesses.id, mergedBusiness.id));
        }
      }

      // Delete transactions directly associated with this business (parent)
      await tx
        .delete(transactions)
        .where(eq(transactions.businessId, businessId));

      // Delete subscriptions associated with this business
      await tx
        .delete(subscriptions)
        .where(eq(subscriptions.businessId, businessId));

      // Delete business merge suggestions involving this business
      await tx
        .delete(businessMergeSuggestions)
        .where(
          or(
            eq(businessMergeSuggestions.businessId1, businessId),
            eq(businessMergeSuggestions.businessId2, businessId)
          )
        );

      // Delete the business itself (parent)
      await tx
        .delete(businesses)
        .where(eq(businesses.id, businessId));
    });

    return NextResponse.json({
      success: true,
      deleted_transactions: businessStats[0]?.transactionCount || 0,
      deleted_merged_businesses: deleteMerged ? mergedBusinesses.length : 0,
      deleted_merged_transactions: deleteMerged ? (mergedStats[0]?.transactionCount || 0) : 0,
      unmerged_businesses: !deleteMerged ? mergedBusinesses.length : 0,
    });
  } catch (error) {
    console.error('[API] Failed to delete business:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete business' },
      { status: 500 }
    );
  }
}
