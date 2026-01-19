import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { tableName } = await request.json();

    // Validate table name (whitelist for security)
    const allowedTables: Record<string, string> = {
      'Transactions': 'transactions',
      'Businesses': 'businesses',
      'Cards': 'cards',
      'Upload_batches': 'upload_batches',
      'Uploaded_files': 'uploaded_files',
      'Subscriptions': 'subscriptions',
      'Business_merge_suggestions': 'business_merge_suggestions',
      'Subscription_suggestions': 'subscription_suggestions',
      'Processing_logs': 'processing_logs',
    };

    const dbTableName = allowedTables[tableName];
    if (!dbTableName) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    // Clear the table
    await db.execute(sql.raw(`TRUNCATE ${dbTableName} CASCADE;`));

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
