import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { tableName } = await request.json();

    // Validate table name (whitelist for security)
    const allowedTables = [
      'transactions',
      'businesses',
      'cards',
      'upload_batches',
      'uploaded_files',
      'subscriptions',
      'business_merge_suggestions',
      'subscription_suggestions',
      'processing_logs',
    ];

    if (!allowedTables.includes(tableName)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    // Clear the table
    await db.execute(sql.raw(`TRUNCATE ${tableName} CASCADE;`));

    return NextResponse.json({
      success: true,
      message: `Table ${tableName} cleared successfully`,
    });
  } catch (error) {
    console.error('Error clearing table:', error);
    return NextResponse.json(
      { error: 'Failed to clear table' },
      { status: 500 }
    );
  }
}
