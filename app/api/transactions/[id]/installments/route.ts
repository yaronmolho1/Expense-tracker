import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    // Get the transaction to find its installment group ID
    const transaction = await db
      .select({
        installmentGroupId: transactions.installmentGroupId,
      })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1);

    if (!transaction[0] || !transaction[0].installmentGroupId) {
      return NextResponse.json(
        { error: 'Transaction is not part of an installment group' },
        { status: 404 }
      );
    }

    const groupId = transaction[0].installmentGroupId;

    // Fetch all transactions in the same installment group
    const installments = await db
      .select({
        id: transactions.id,
        dealDate: transactions.dealDate,
        bankChargeDate: transactions.bankChargeDate,
        actualChargeDate: transactions.actualChargeDate,
        projectedChargeDate: transactions.projectedChargeDate,
        chargedAmountIls: transactions.chargedAmountIls,
        originalAmount: transactions.originalAmount,
        originalCurrency: transactions.originalCurrency,
        status: transactions.status,
        installmentIndex: transactions.installmentIndex,
        installmentTotal: transactions.installmentTotal,
        installmentGroupId: transactions.installmentGroupId,
      })
      .from(transactions)
      .where(eq(transactions.installmentGroupId, groupId))
      .orderBy(transactions.installmentIndex);

    const transformedInstallments = installments.map((inst) => ({
      id: inst.id,
      deal_date: inst.dealDate,
      charge_date: inst.actualChargeDate || inst.projectedChargeDate || inst.bankChargeDate || inst.dealDate,
      charged_amount_ils: Number(inst.chargedAmountIls),
      original_amount: inst.originalAmount ? Number(inst.originalAmount) : null,
      original_currency: inst.originalCurrency,
      status: inst.status,
      installment_index: inst.installmentIndex!,
      installment_total: inst.installmentTotal!,
      installment_group_id: inst.installmentGroupId,
    }));

    return NextResponse.json({
      installments: transformedInstallments,
    });
  } catch (error) {
    console.error('Error fetching installment group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installment group' },
      { status: 500 }
    );
  }
}
