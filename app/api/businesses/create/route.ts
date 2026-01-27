import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses } from '@/lib/db/schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(255),
  primary_category_id: z.number().int().positive(),
  child_category_id: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = CreateBusinessSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, primary_category_id, child_category_id } = validation.data;

    // Normalize name (lowercase, trim)
    const normalizedName = name.toLowerCase().trim();

    // Check if a business with this normalized name already exists
    const existingBusiness = await db
      .select()
      .from(businesses)
      .where(eq(businesses.normalizedName, normalizedName))
      .limit(1);

    if (existingBusiness.length > 0) {
      return NextResponse.json(
        { error: 'A business with this name already exists' },
        { status: 409 }
      );
    }

    // Create the business
    const newBusiness = await db
      .insert(businesses)
      .values({
        normalizedName,
        displayName: name.trim(),
        primaryCategoryId: primary_category_id,
        childCategoryId: child_category_id || null,
        approved: true, // Auto-approve user-created businesses
        categorizationSource: 'user',
      })
      .returning();

    return NextResponse.json({
      success: true,
      business: {
        id: newBusiness[0].id,
        normalized_name: newBusiness[0].normalizedName,
        display_name: newBusiness[0].displayName,
        primary_category_id: newBusiness[0].primaryCategoryId,
        child_category_id: newBusiness[0].childCategoryId,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Failed to create business:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create business' },
      { status: 500 }
    );
  }
}
