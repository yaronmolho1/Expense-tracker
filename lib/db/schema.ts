import { pgTable, serial, varchar, integer, boolean, timestamp, decimal, date, text, bigserial, pgEnum, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// ENUMS
// ============================================

export const categorizationSourceEnum = pgEnum('categorization_source', ['user', 'llm', 'imported', 'suggested']);
export const transactionTypeEnum = pgEnum('transaction_type', ['one_time', 'installment', 'subscription']);
export const paymentTypeEnum = pgEnum('payment_type', ['one_time', 'installments']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'projected', 'cancelled']);
export const subscriptionFrequencyEnum = pgEnum('subscription_frequency', ['monthly', 'annual']);
export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'annual']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'ended']);
export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'processing', 'completed', 'failed']);
export const suggestionStatusEnum = pgEnum('suggestion_status', ['pending', 'approved', 'rejected', 'ignored']);
export const logLevelEnum = pgEnum('log_level', ['info', 'warning', 'error']);

// ============================================
// TABLE 1: CATEGORIES
// ============================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  parentId: integer('parent_id').references((): any => categories.id),
  level: integer('level').notNull(),
  displayOrder: integer('display_order').notNull(),
  budgetAmount: decimal('budget_amount', { precision: 12, scale: 2 }), // Current budget (denormalized)
  budgetPeriod: budgetPeriodEnum('budget_period'), // monthly or annual
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// TABLE 2: CARDS
// ============================================

export const cards = pgTable('cards', {
  id: serial('id').primaryKey(),
  last4Digits: varchar('last_4_digits', { length: 4 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  bankOrCompany: varchar('bank_or_company', { length: 100 }),
  fileFormatHandler: varchar('file_format_handler', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  owner: varchar('owner', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// TABLE 3: BUSINESSES
// ============================================

export const businesses: any = pgTable('businesses', {
  id: serial('id').primaryKey(),
  normalizedName: varchar('normalized_name', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  primaryCategoryId: integer('primary_category_id').references(() => categories.id),
  childCategoryId: integer('child_category_id').references(() => categories.id),
  categorizationSource: categorizationSourceEnum('categorization_source'),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  approved: boolean('approved').default(false).notNull(),
  mergedToId: integer('merged_to_id'), // Points to target business if merged (self-reference added after table creation)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});




// ============================================
// TABLE 4: SUBSCRIPTIONS
// ============================================

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  cardId: integer('card_id').references(() => cards.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  frequency: subscriptionFrequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: subscriptionStatusEnum('status').notNull(),
  createdFromSuggestion: boolean('created_from_suggestion').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  name: text('name'),
  notes: text('notes'),
});

// ============================================
// TABLE 5: UPLOAD_BATCHES
// ============================================

export const uploadBatches = pgTable('upload_batches', {
  id: serial('id').primaryKey(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  fileCount: integer('file_count').notNull(),
  totalTransactions: integer('total_transactions'),
  newTransactions: integer('new_transactions'),
  updatedTransactions: integer('updated_transactions'),
  totalAmountIls: decimal('total_amount_ils', { precision: 12, scale: 2 }), // Sum of transactions from actual uploaded files only
  status: uploadStatusEnum('status').notNull(),
  errorMessage: text('error_message'),
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
});

// ============================================
// TABLE 6: UPLOADED_FILES
// ============================================

export const uploadedFiles = pgTable('uploaded_files', {
  id: serial('id').primaryKey(),
  uploadBatchId: integer('upload_batch_id').references(() => uploadBatches.id).notNull(),
  cardId: integer('card_id').references(() => cards.id),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: integer('file_size').notNull(),
  status: uploadStatusEnum('status').notNull(),
  transactionsFound: integer('transactions_found'),
  errorMessage: text('error_message'),
  validationWarning: text('validation_warning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

// ============================================
// TABLE 7: EXCHANGE_RATES
// ============================================

export const exchangeRates = pgTable('exchange_rates', {
  date: date('date').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  rateToIls: decimal('rate_to_ils', { precision: 10, scale: 6 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: 'exchange_rates_pkey',
    columns: [table.date, table.currency],
  },
}));


// ============================================
// TABLE 8: TRANSACTIONS (The Big One)
// ============================================

export const transactions = pgTable('transactions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  transactionHash: varchar('transaction_hash', { length: 64 }).notNull().unique(),
  transactionType: transactionTypeEnum('transaction_type').notNull(),
  
  // References
  businessId: integer('business_id').references(() => businesses.id).notNull(),
  originalBusinessId: integer('original_business_id').references(() => businesses.id), // Track original business before any merges
  cardId: integer('card_id').references(() => cards.id).notNull(),
  
  // Dates
  dealDate: date('deal_date').notNull(),
  bankChargeDate: date('bank_charge_date'),
  
  // Amounts
  originalAmount: decimal('original_amount', { precision: 12, scale: 2 }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  exchangeRateUsed: decimal('exchange_rate_used', { precision: 10, scale: 6 }),
  chargedAmountIls: decimal('charged_amount_ils', { precision: 12, scale: 2 }).notNull(),
  
  // Payment Type
  paymentType: paymentTypeEnum('payment_type').notNull(),
  
  // Installment Fields
  installmentGroupId: varchar('installment_group_id', { length: 64 }), // SHA-256 hash
  installmentIndex: integer('installment_index'),
  installmentTotal: integer('installment_total'),
  installmentAmount: decimal('installment_amount', { precision: 12, scale: 2 }),
  
  // Subscription
  subscriptionId: integer('subscription_id').references(() => subscriptions.id),
  
  // Status
  status: transactionStatusEnum('status').notNull(),
  projectedChargeDate: date('projected_charge_date'),
  actualChargeDate: date('actual_charge_date'),
  
  // Refunds
  isRefund: boolean('is_refund').default(false).notNull(),
  parentTransactionId: integer('parent_transaction_id').references((): any => transactions.id),
  
  // Audit
  sourceFile: varchar('source_file', { length: 255 }).notNull(),
  uploadBatchId: integer('upload_batch_id').references(() => uploadBatches.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// TABLE 9: BUSINESS_MERGE_SUGGESTIONS
// ============================================

export const businessMergeSuggestions = pgTable('business_merge_suggestions', {
  id: serial('id').primaryKey(),
  businessId1: integer('business_id_1').references(() => businesses.id).notNull(),
  businessId2: integer('business_id_2').references(() => businesses.id).notNull(),
  similarityScore: decimal('similarity_score', { precision: 3, scale: 2 }).notNull(),
  suggestionReason: text('suggestion_reason'),
  status: suggestionStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedByUser: boolean('resolved_by_user'),
});

// ============================================
// TABLE 10: SUBSCRIPTION_SUGGESTIONS
// ============================================

export const subscriptionSuggestions = pgTable('subscription_suggestions', {
  id: serial('id').primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  cardId: integer('card_id').references(() => cards.id).notNull(),
  detectedAmount: decimal('detected_amount', { precision: 12, scale: 2 }).notNull(),
  frequency: subscriptionFrequencyEnum('frequency').notNull(),
  firstOccurrence: date('first_occurrence').notNull(),
  lastOccurrence: date('last_occurrence').notNull(),
  occurrenceCount: integer('occurrence_count').notNull(),
  detectionReason: text('detection_reason'),
  status: suggestionStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  rejectedUntil: timestamp('rejected_until'), // When status is 'rejected', prevents re-detection until this date
});

// ============================================
// TABLE 11: PROCESSING_LOGS
// ============================================

export const processingLogs = pgTable('processing_logs', {
  id: serial('id').primaryKey(),
  uploadBatchId: integer('upload_batch_id').references(() => uploadBatches.id),
  uploadedFileId: integer('uploaded_file_id').references(() => uploadedFiles.id),
  logLevel: logLevelEnum('log_level').notNull(),
  message: text('message').notNull(),
  context: text('context'), // Will store JSON as text
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// TABLE 12: CATEGORY_BUDGET_HISTORY
// ============================================

export const categoryBudgetHistory = pgTable('category_budget_history', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  budgetAmount: decimal('budget_amount', { precision: 12, scale: 2 }).notNull(),
  budgetPeriod: budgetPeriodEnum('budget_period').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'), // NULL = current/active budget
  createdAt: timestamp('created_at').defaultNow().notNull(),
  notes: text('notes'),
});


// ============================================
// RELATIONS (For Type-Safe Joins)
// ============================================

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  budgetHistory: many(categoryBudgetHistory),
}));

export const categoryBudgetHistoryRelations = relations(categoryBudgetHistory, ({ one }) => ({
  category: one(categories, {
    fields: [categoryBudgetHistory.categoryId],
    references: [categories.id],
  }),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  primaryCategory: one(categories, {
    fields: [businesses.primaryCategoryId],
    references: [categories.id],
  }),
  childCategory: one(categories, {
    fields: [businesses.childCategoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
  subscriptions: many(subscriptions),
}));

export const cardsRelations = relations(cards, ({ many }) => ({
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  uploadedFiles: many(uploadedFiles),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  business: one(businesses, {
    fields: [transactions.businessId],
    references: [businesses.id],
  }),
  card: one(cards, {
    fields: [transactions.cardId],
    references: [cards.id],
  }),
  subscription: one(subscriptions, {
    fields: [transactions.subscriptionId],
    references: [subscriptions.id],
  }),
  uploadBatch: one(uploadBatches, {
    fields: [transactions.uploadBatchId],
    references: [uploadBatches.id],
  }),
  parentTransaction: one(transactions, {
    fields: [transactions.parentTransactionId],
    references: [transactions.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  business: one(businesses, {
    fields: [subscriptions.businessId],
    references: [businesses.id],
  }),
  card: one(cards, {
    fields: [subscriptions.cardId],
    references: [cards.id],
  }),
  transactions: many(transactions),
}));

export const uploadBatchesRelations = relations(uploadBatches, ({ many }) => ({
  files: many(uploadedFiles),
  transactions: many(transactions),
  logs: many(processingLogs),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  uploadBatch: one(uploadBatches, {
    fields: [uploadedFiles.uploadBatchId],
    references: [uploadBatches.id],
  }),
  card: one(cards, {
    fields: [uploadedFiles.cardId],
    references: [cards.id],
  }),
}));

export const businessMergeSuggestionsRelations = relations(businessMergeSuggestions, ({ one }) => ({
  business1: one(businesses, {
    fields: [businessMergeSuggestions.businessId1],
    references: [businesses.id],
  }),
  business2: one(businesses, {
    fields: [businessMergeSuggestions.businessId2],
    references: [businesses.id],
  }),
}));

export const subscriptionSuggestionsRelations = relations(subscriptionSuggestions, ({ one }) => ({
  card: one(cards, {
    fields: [subscriptionSuggestions.cardId],
    references: [cards.id],
  }),
}));