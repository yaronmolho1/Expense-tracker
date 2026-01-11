import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { businesses, categories, cards } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Get all businesses with transaction counts
    const businessList = await db
      .select({
        id: businesses.id,
        name: businesses.displayName,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(businesses)
      .groupBy(businesses.id, businesses.displayName)
      .orderBy(businesses.displayName);

    // Get all categories (parent + child)
    const categoryList = await db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        level: categories.level,
      })
      .from(categories)
      .orderBy(categories.displayOrder);

    // Get all cards
    const cardList = await db
      .select({
        id: cards.id,
        last4: cards.last4Digits,
        nickname: cards.nickname,
        bankOrCompany: cards.bankOrCompany,
        owner: cards.owner,
      })
      .from(cards)
      .where(sql`${cards.isActive} = true`)
      .orderBy(cards.owner, cards.nickname);

    // Build category tree
    const parentCategories = categoryList.filter((c) => c.level === 0);
    const categoryTree = parentCategories.map((parent) => ({
      value: parent.id,
      label: parent.name,
      name: parent.name,
      children: categoryList
        .filter((c) => c.parentId === parent.id)
        .map((child) => ({
          value: child.id,
          label: child.name,
        })),
    }));

    return NextResponse.json({
      businesses: businessList.map((b) => ({
        value: b.id,
        label: b.name,
      })),
      categories: {
        parents: parentCategories.map((c) => ({
          value: c.id,
          label: c.name,
        })),
        tree: categoryTree,
      },
      cards: cardList.map((c) => ({
        value: c.id,
        label: c.nickname || `${c.bankOrCompany} •••• ${c.last4}`,
        owner: c.owner,
      })),
      transactionTypes: [
        { value: 'one_time', label: 'One-time' },
        { value: 'installment', label: 'Installment' },
        { value: 'subscription', label: 'Subscription' },
        { value: 'refund', label: 'Refund' },
      ],
      statuses: [
        { value: 'completed', label: 'Completed' },
        { value: 'projected', label: 'Projected' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
