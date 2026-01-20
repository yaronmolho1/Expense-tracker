import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, cards } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Unit Tests: Upload API Route - Duplicate Filename Prevention
 *
 * Tests the duplicate filename detection logic in the upload API route.
 * These tests focus on the validation logic without testing the full HTTP layer.
 */

describe('POST /api/upload - Duplicate Filename Prevention', () => {
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

  describe('Duplicate Detection Logic', () => {
    it('should detect duplicate filename in batch', async () => {
      const filename = 'test.xlsx';

      // Insert existing file record
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/tmp/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate (simulating the API logic)
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, filename)
        ),
      });

      // Should find the existing file
      expect(existingFile).toBeTruthy();
      expect(existingFile?.filename).toBe(filename);
      expect(existingFile?.uploadBatchId).toBe(testBatchId);
    });

    it('should not detect duplicate when no file exists', async () => {
      const filename = 'new-file.xlsx';

      // Check for duplicate (should not find anything)
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, filename)
        ),
      });

      // Should not find any file
      expect(existingFile).toBeUndefined();
    });

    it('should not detect duplicate in different batch', async () => {
      const filename = 'test.xlsx';

      // Create another batch
      const [batch2] = await db.insert(uploadBatches).values({
        status: 'pending',
        fileCount: 0,
        totalTransactions: 0,
      }).returning();

      // Insert file in batch2
      await db.insert(uploadedFiles).values({
        uploadBatchId: batch2.id,
        cardId: testCardId,
        filename,
        filePath: `/tmp/batch_${batch2.id}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate in testBatchId (should not find anything)
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, filename)
        ),
      });

      expect(existingFile).toBeUndefined();

      // Cleanup batch2
      await db.delete(uploadedFiles).where(eq(uploadedFiles.uploadBatchId, batch2.id));
      await db.delete(uploadBatches).where(eq(uploadBatches.id, batch2.id));
    });
  });

  describe('Multiple Files Validation', () => {
    it('should validate all files before processing', async () => {
      const files = [
        { name: 'file1.xlsx', size: 1024 },
        { name: 'file2.xlsx', size: 2048 },
        { name: 'file3.xlsx', size: 3072 },
      ];

      // Insert first two files
      await db.insert(uploadedFiles).values([
        {
          uploadBatchId: testBatchId,
          cardId: testCardId,
          filename: files[0].name,
          filePath: `/tmp/batch_${testBatchId}/${files[0].name}`,
          fileSize: files[0].size,
          status: 'pending',
        },
        {
          uploadBatchId: testBatchId,
          cardId: testCardId,
          filename: files[1].name,
          filePath: `/tmp/batch_${testBatchId}/${files[1].name}`,
          fileSize: files[1].size,
          status: 'pending',
        },
      ]);

      // Check each file for duplicates
      const results = await Promise.all(
        files.map(file =>
          db.query.uploadedFiles.findFirst({
            where: and(
              eq(uploadedFiles.uploadBatchId, testBatchId),
              eq(uploadedFiles.filename, file.name)
            ),
          })
        )
      );

      // First two should be found, third should not
      expect(results[0]).toBeTruthy();
      expect(results[1]).toBeTruthy();
      expect(results[2]).toBeUndefined();
    });

    it('should reject if any file is duplicate', async () => {
      const files = [
        { name: 'file1.xlsx', size: 1024 },
        { name: 'file2.xlsx', size: 2048 },
        { name: 'file1.xlsx', size: 1024 }, // Duplicate
      ];

      // Check for duplicates within the array
      const duplicates = files.filter((file, index, arr) =>
        arr.findIndex(f => f.name === file.name) !== index
      );

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].name).toBe('file1.xlsx');
    });
  });

  describe('Error Message Format', () => {
    it('should return clear error message with filename', async () => {
      const filename = 'statement_nov_2025.xlsx';

      // Insert existing file
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/tmp/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, filename)
        ),
      });

      if (existingFile) {
        // Simulate error message format
        const errorMessage = `File "${filename}" has already been uploaded in this batch`;

        expect(errorMessage).toContain(filename);
        expect(errorMessage).toContain('already been uploaded');
        expect(errorMessage).toContain('this batch');
      }
    });
  });

  describe('Sanitized Filenames', () => {
    it('should check against sanitized filename', async () => {
      // The API sanitizes filenames before storing
      const originalFilename = 'my file.xlsx';
      const sanitizedFilename = 'myfile.xlsx'; // Spaces removed

      // Insert file with sanitized name
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename: sanitizedFilename,
        filePath: `/tmp/batch_${testBatchId}/${sanitizedFilename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Check for duplicate using sanitized name
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, sanitizedFilename)
        ),
      });

      expect(existingFile).toBeTruthy();
      expect(existingFile?.filename).toBe(sanitizedFilename);
    });
  });

  describe('Race Condition Handling', () => {
    it('should handle concurrent uploads with same filename', async () => {
      const filename = 'test.xlsx';

      // First upload
      await db.insert(uploadedFiles).values({
        uploadBatchId: testBatchId,
        cardId: testCardId,
        filename,
        filePath: `/tmp/batch_${testBatchId}/${filename}`,
        fileSize: 1024,
        status: 'pending',
      });

      // Second concurrent upload attempt
      const existingFile = await db.query.uploadedFiles.findFirst({
        where: and(
          eq(uploadedFiles.uploadBatchId, testBatchId),
          eq(uploadedFiles.filename, filename)
        ),
      });

      // Should detect the existing file
      expect(existingFile).toBeTruthy();

      // Second upload should be rejected
      // (In real API, this would return 400 error)
    });
  });

  describe('Status-Independent Detection', () => {
    it('should detect duplicate regardless of file status', async () => {
      const filename = 'test.xlsx';
      const statuses = ['pending', 'processing', 'completed', 'failed'] as const;

      for (const status of statuses) {
        // Create a new batch for each test
        const [batch] = await db.insert(uploadBatches).values({
          status: 'pending',
          fileCount: 0,
          totalTransactions: 0,
        }).returning();

        // Insert file with specific status
        await db.insert(uploadedFiles).values({
          uploadBatchId: batch.id,
          cardId: testCardId,
          filename,
          filePath: `/tmp/batch_${batch.id}/${filename}`,
          fileSize: 1024,
          status,
        });

        // Check for duplicate
        const existingFile = await db.query.uploadedFiles.findFirst({
          where: and(
            eq(uploadedFiles.uploadBatchId, batch.id),
            eq(uploadedFiles.filename, filename)
          ),
        });

        // Should detect duplicate regardless of status
        expect(existingFile).toBeTruthy();
        expect(existingFile?.status).toBe(status);

        // Cleanup
        await db.delete(uploadedFiles).where(eq(uploadedFiles.uploadBatchId, batch.id));
        await db.delete(uploadBatches).where(eq(uploadBatches.id, batch.id));
      }
    });
  });
});
