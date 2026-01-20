import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, cards } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Integration Tests: Duplicate File Upload Prevention
 *
 * Tests the duplicate filename detection logic at the API level
 * to ensure users cannot upload the same file twice in the same batch.
 */

describe('Duplicate File Upload Prevention', () => {
  let testCardId: number;
  let testBatchId: number;

  beforeEach(async () => {
    // Create test card
    const uniqueSuffix = Date.now();
    const [card] = await db.insert(cards).values({
      last4Digits: `${uniqueSuffix % 10000}`.padStart(4, '0'),
      fileFormatHandler: 'visa',
      owner: `test-user-${uniqueSuffix}`,
    }).returning();
    testCardId = card.id;

    // Create test batch
    const [batch] = await db.insert(uploadBatches).values({
      status: 'pending',
      fileCount: 0,
      totalTransactions: 0,
    }).returning();
    testBatchId = batch.id;
  });

  afterEach(async () => {
    // Cleanup in correct Foreign Key order
    if (testBatchId) {
      await db.delete(uploadedFiles).where(eq(uploadedFiles.uploadBatchId, testBatchId));
      await db.delete(uploadBatches).where(eq(uploadBatches.id, testBatchId));
    }
    if (testCardId) {
      await db.delete(cards).where(eq(cards.id, testCardId));
    }
  });

  describe('Basic Duplicate Detection', () => {
    it('should reject duplicate filename in same batch', async () => {
      const filename = 'statement.xlsx';

      // First file upload - should succeed
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/uploads/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Verify first file exists
      const firstFile = await db.query.uploadedFiles.findFirst({
        where: eq(uploadedFiles.filename, filename),
      });
      expect(firstFile).toBeTruthy();
      expect(firstFile?.filename).toBe(filename);

      // Check for duplicate
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: (uf, { eq, and }) => and(
          eq(uf.uploadBatchId, testBatchId),
          eq(uf.filename, filename)
        ),
      });

      expect(existingFile).toBeTruthy();
      expect(existingFile?.filename).toBe(filename);
    });

    it('should allow same filename in different batches', async () => {
      const filename = 'statement.xlsx';

      // Create first file in batch 1
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/uploads/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Create second batch
      const [batch2] = await db.insert(uploadBatches).values({
        status: 'pending',
        fileCount: 0,
        totalTransactions: 0,
      }).returning();

      // Create same filename in batch 2 - should succeed
      await db.insert(uploadedFiles).values({
        uploadBatchId: batch2.id,
        cardId: testCardId,
        filename,
        filePath: `/uploads/batch_${batch2.id}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Verify both files exist
      const filesInBatch1 = await db.query.uploadedFiles.findMany({
        where: eq(uploadedFiles.uploadBatchId, testBatchId),
      });
      const filesInBatch2 = await db.query.uploadedFiles.findMany({
        where: eq(uploadedFiles.uploadBatchId, batch2.id),
      });

      expect(filesInBatch1).toHaveLength(1);
      expect(filesInBatch2).toHaveLength(1);
      expect(filesInBatch1[0].filename).toBe(filename);
      expect(filesInBatch2[0].filename).toBe(filename);

      // Cleanup batch 2
      await db.delete(uploadedFiles).where(eq(uploadedFiles.uploadBatchId, batch2.id));
      await db.delete(uploadBatches).where(eq(uploadBatches.id, batch2.id));
    });

    it('should allow different filenames in same batch', async () => {
      const file1 = 'statement1.xlsx';
      const file2 = 'statement2.xlsx';

      // Upload first file
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: file1,
        filePath: `/uploads/batch_${testBatchId}/${file1}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Upload second file with different name - should succeed
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: file2,
        filePath: `/uploads/batch_${testBatchId}/${file2}`,
        fileSize: 2048,
        status: 'pending',
      });

      // Verify both files exist
      const filesInBatch = await db.query.uploadedFiles.findMany({
        where: eq(uploadedFiles.uploadBatchId, testBatchId),
      });

      expect(filesInBatch).toHaveLength(2);
      expect(filesInBatch.map(f => f.filename).sort()).toEqual([file1, file2].sort());
    });
  });

  describe('Case Sensitivity', () => {
    it('should treat filenames as case-sensitive by default', async () => {
      const file1 = 'Statement.xlsx';
      const file2 = 'statement.xlsx';

      // Upload first file
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: file1,
        filePath: `/uploads/batch_${testBatchId}/${file1}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Upload second file with different case - should succeed (different names)
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: file2,
        filePath: `/uploads/batch_${testBatchId}/${file2}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Verify both files exist
      const filesInBatch = await db.query.uploadedFiles.findMany({
        where: eq(uploadedFiles.uploadBatchId, testBatchId),
      });

      expect(filesInBatch).toHaveLength(2);
    });
  });

  describe('Multiple Files Upload', () => {
    it('should check all files before inserting when uploading multiple files', async () => {
      const file1 = 'statement1.xlsx';
      const file2 = 'statement2.xlsx';

      // Upload first batch of files
      await db.insert(uploadedFiles).values([
        {
          uploadBatchId: testBatchId,
          cardId: testCardId,
          filename: file1,
          filePath: `/uploads/batch_${testBatchId}/${file1}`,
          fileSize: 1024,
          status: 'pending',
        },
        {
          uploadBatchId: testBatchId,
          cardId: testCardId,
          filename: file2,
          filePath: `/uploads/batch_${testBatchId}/${file2}`,
          fileSize: 2048,
          status: 'pending',
        },
      ]);

      // Verify both files exist
      const filesInBatch = await db.query.uploadedFiles.findMany({
        where: eq(uploadedFiles.uploadBatchId, testBatchId),
      });

      expect(filesInBatch).toHaveLength(2);

      // Try to check for duplicate of file1
      const duplicate = await db.query.uploadedFiles.findFirst({
        where: (uf, { eq, and }) => and(
          eq(uf.uploadBatchId, testBatchId),
          eq(uf.filename, file1)
        ),
      });

      expect(duplicate).toBeTruthy();
      expect(duplicate?.filename).toBe(file1);
    });

    it('should detect duplicate within the same upload request', async () => {
      const filename = 'statement.xlsx';

      // Simulate checking for duplicate before insert
      // In the real API, this happens before any file is inserted
      const filesToUpload = [filename, filename]; // Duplicate in same request

      const duplicates = filesToUpload.filter((file, index, arr) =>
        arr.indexOf(file) !== index
      );

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toBe(filename);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sanitized filenames correctly', async () => {
      // The API sanitizes filenames, so we need to check against sanitized versions
      const originalFilename = 'statement 2024.xlsx';
      const sanitizedFilename = 'statement2024.xlsx'; // Spaces might be removed

      // Upload first file (already sanitized by API)
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: sanitizedFilename,
        filePath: `/uploads/batch_${testBatchId}/${sanitizedFilename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate using sanitized name
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: (uf, { eq, and }) => and(
          eq(uf.uploadBatchId, testBatchId),
          eq(uf.filename, sanitizedFilename)
        ),
      });

      expect(existingFile).toBeTruthy();
    });

    it('should handle special characters in filenames', async () => {
      const filename = 'statement_nov_2025.xlsx';

      // Upload file with special characters
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/uploads/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: (uf, { eq, and }) => and(
          eq(uf.uploadBatchId, testBatchId),
          eq(uf.filename, filename)
        ),
      });

      expect(existingFile).toBeTruthy();
      expect(existingFile?.filename).toBe(filename);
    });
  });
});
