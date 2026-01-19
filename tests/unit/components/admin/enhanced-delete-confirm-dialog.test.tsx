/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedDeleteConfirmDialog } from '@/app/(dashboard)/admin/database/components/enhanced-delete-confirm-dialog';

const mockWarnings = {
  summary: {
    totalInRange: 100,
    oneTimeCount: 50,
    installmentCount: 30,
    installmentGroupsCount: 10,
    subscriptionCount: 20,
    subscriptionsAffected: 5,
  },
  partialInstallments: [],
  affectedSubscriptions: [],
};

describe('EnhancedDeleteConfirmDialog', () => {
  describe('Rendering', () => {
    test('renders with correct initial state', () => {
      const onConfirm = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="delete_all_matching_groups"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByRole('heading', { name: /Delete \d+ Transaction/i })).toBeInTheDocument();
    });

    test('displays summary information correctly', () => {
      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // Check for transaction type counts
      expect(screen.getByText(/50 one-time/i)).toBeInTheDocument();
    });
  });

  describe('Checkbox Interactions', () => {
    test('unchecking one-time checkbox calls handler', () => {
      const onIncludeOneTimeChange = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={onIncludeOneTimeChange}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[0]; // First checkbox
      fireEvent.click(checkbox);

      expect(onIncludeOneTimeChange).toHaveBeenCalled();
    });

    test('unchecking installments checkbox calls handler', () => {
      const onIncludeInstallmentsChange = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={onIncludeInstallmentsChange}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1]; // Second checkbox
      fireEvent.click(checkbox);

      expect(onIncludeInstallmentsChange).toHaveBeenCalled();
    });

    test('disables delete button when all checkboxes unchecked', () => {
      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={false}
          includeInstallments={false}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /Delete 0/i });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Strategy Selection', () => {
    test('changes installment strategy when radio selected', () => {
      const onStrategyChange = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="delete_all_matching_groups"
          onInstallmentStrategyChange={onStrategyChange}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // Find all radio buttons and click the one for "delete_matching_only"
      const radios = screen.getAllByRole('radio');
      const matchingOnlyRadio = radios.find(
        (radio) => (radio as HTMLInputElement).value === 'delete_matching_only'
      );

      if (matchingOnlyRadio) {
        fireEvent.click(matchingOnlyRadio);
        expect(onStrategyChange).toHaveBeenCalled();
      }
    });

    test('changes subscription strategy when radio selected', () => {
      const onStrategyChange = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={onStrategyChange}
          onConfirm={vi.fn()}
        />
      );

      const radios = screen.getAllByRole('radio');
      const deleteAndCancelRadio = radios.find(
        (radio) => (radio as HTMLInputElement).value === 'delete_in_range_and_cancel'
      );

      if (deleteAndCancelRadio) {
        fireEvent.click(deleteAndCancelRadio);
        expect(onStrategyChange).toHaveBeenCalled();
      }
    });
  });

  describe('Count Calculation', () => {
    test('calculates count based on delete_all_matching_groups strategy', () => {
      const warningsWithPartials = {
        ...mockWarnings,
        partialInstallments: [
          {
            groupId: '1',
            businessName: 'Test Business 1',
            total: 10,
            inBatch: 3,
            allPayments: [],
          },
          {
            groupId: '2',
            businessName: 'Test Business 2',
            total: 8,
            inBatch: 2,
            allPayments: [],
          },
        ],
      };

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={warningsWithPartials}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="delete_all_matching_groups"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // Should count: 50 (one-time) + 10 + 8 (all payments in partial groups) = 68
      expect(screen.getByRole('button', { name: /Delete 68 Transaction/i })).toBeInTheDocument();
    });

    test('calculates count based on delete_matching_only strategy', () => {
      const warningsWithPartials = {
        ...mockWarnings,
        partialInstallments: [
          {
            groupId: '1',
            businessName: 'Test Business',
            total: 10,
            inBatch: 3,
            allPayments: [],
          },
        ],
      };

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={warningsWithPartials}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="delete_matching_only"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // Should count: 50 (one-time) + 30 (installmentCount from summary) = 80
      expect(screen.getByRole('button', { name: /Delete 80 Transaction/i })).toBeInTheDocument();
    });

    test('excludes installments when skip_all strategy selected', () => {
      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      // Should count: 50 (one-time only)
      expect(screen.getByRole('button', { name: /Delete 50 Transaction/i })).toBeInTheDocument();
    });
  });

  describe('Warning Display', () => {
    test('displays partial installment warnings', () => {
      const warnings = {
        ...mockWarnings,
        partialInstallments: [
          {
            groupId: '1',
            businessName: 'Amazon',
            inBatch: 3,
            total: 12,
            allPayments: [
              {
                index: 1,
                dealDate: '2024-01-01',
                amount: 100,
                status: 'completed' as const,
                inThisBatch: true,
              },
              {
                index: 2,
                dealDate: '2024-02-01',
                amount: 100,
                status: 'completed' as const,
                inThisBatch: true,
              },
            ],
          },
        ],
      };

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={warnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="delete_all_matching_groups"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(screen.getByText(/Partial Installment/i)).toBeInTheDocument();
      expect(screen.getByText('Amazon')).toBeInTheDocument();
      expect(screen.getByText(/3 of 12/i)).toBeInTheDocument();
    });

    test('displays affected subscription warnings', () => {
      const warnings = {
        ...mockWarnings,
        affectedSubscriptions: [
          {
            id: 1,
            name: 'Netflix',
            businessName: 'Netflix Inc',
            transactionsInRange: 5,
            earliestDate: '2024-01-01',
            latestDate: '2024-05-01',
            continuesAfterRange: true,
            frequency: 'monthly',
            status: 'active',
          },
        ],
      };

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={warnings}
          includeOneTime={true}
          includeInstallments={true}
          includeSubscriptions={true}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      expect(screen.getByText(/Affected Subscription/i)).toBeInTheDocument();
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  describe('Confirmation', () => {
    test('calls onConfirm when delete button clicked', () => {
      const onConfirm = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={false}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /Delete 50/i });
      fireEvent.click(deleteButton);

      expect(onConfirm).toHaveBeenCalled();
    });

    test('does not call onConfirm when cancel button clicked', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <EnhancedDeleteConfirmDialog
          open={true}
          onOpenChange={onOpenChange}
          warnings={mockWarnings}
          includeOneTime={true}
          includeInstallments={false}
          includeSubscriptions={false}
          onIncludeOneTimeChange={vi.fn()}
          onIncludeInstallmentsChange={vi.fn()}
          onIncludeSubscriptionsChange={vi.fn()}
          installmentStrategy="skip_all"
          onInstallmentStrategyChange={vi.fn()}
          subscriptionStrategy="skip"
          onSubscriptionStrategyChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
