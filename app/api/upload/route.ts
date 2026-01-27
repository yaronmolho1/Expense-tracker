import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { statSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles } from '@/lib/db/schema';
import { enqueueJob } from '@/lib/workers/pg-boss-client';
import { detectCard } from '@/lib/services/card-detection-service';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import logger from '@/lib/logger';

/**
 * Checks if an error message contains SQL syntax or database-related information
 */
function containsSqlOrDatabaseInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const sqlIndicators = [
    'insert into',
    'update set',
    'delete from',
    'select from',
    'constraint',
    'unique constraint',
    'foreign key',
    'primary key',
    'duplicate key',
    'sql',
    'postgres',
    'database',
    'relation',
    'column',
    'violates',
    '23505', // PostgreSQL unique violation code
    '23503', // PostgreSQL foreign key violation code
  ];
  
  return sqlIndicators.some(indicator => lowerMessage.includes(indicator));
}

/**
 * Sanitizes error messages before sending to client
 * Prevents exposing SQL queries and database internals
 */
function sanitizeErrorForClient(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Check if error contains SQL or database information
  if (containsSqlOrDatabaseInfo(errorMessage)) {
    // Log the raw error internally for debugging
    logger.error({
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    }, 'SQL/Database error prevented from client exposure');
    
    // Return sanitized message
    return 'File uploaded with errors. Please check the logs for details.';
  }
  
  // Safe to return as-is
  return errorMessage;
}

// Constants for validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const MAX_FILE_COUNT = 100; // Increased limit for bulk uploads
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// Zod schema for card mappings
const cardMappingSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  card_id: z.number().int().positive('Card ID must be a positive integer').nullable(),
});

// Zod schema for upload request validation
const uploadRequestSchema = z.object({
  card_mappings: z.array(cardMappingSchema),
  override_validation: z.boolean().optional().default(false),
});

/**
 * Sanitizes filename to prevent path traversal attacks
 * Removes directory separators and dangerous characters
 */
function sanitizeFilename(filename: string): string {
  // Remove path traversal sequences
  let sanitized = filename.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '');
  // Get just the basename to remove any remaining path components
  sanitized = basename(sanitized);
  // Remove null bytes and other dangerous characters
  sanitized = sanitized.replace(/\0/g, '');
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s\.]+|[\s\.]+$/g, '');
  
  return sanitized || 'file';
}

/**
 * Validates file extension against allowed list
 */
function isValidFileExtension(filename: string): boolean {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return false; // No extension or trailing dot
  }
  const ext = filename.toLowerCase().substring(lastDotIndex);
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Validates files array for size, count, and extensions
 */
function validateFiles(files: File[]): { valid: boolean; error?: string } {
  // Check file count
  if (files.length === 0) {
    return { valid: false, error: 'No files provided' };
  }

  if (files.length > MAX_FILE_COUNT) {
    return {
      valid: false,
      error: `Too many files. Maximum ${MAX_FILE_COUNT} files allowed, received ${files.length}`,
    };
  }

  // Validate each file
  for (const file of files) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      };
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: `File "${file.name}" is empty`,
      };
    }

    // Check file extension
    if (!isValidFileExtension(file.name)) {
      return {
        valid: false,
        error: `File "${file.name}" has invalid extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }

    // Check for path traversal in filename before sanitization
    const originalBasename = basename(file.name);
    if (file.name !== originalBasename || file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return {
        valid: false,
        error: `File "${file.name}" contains invalid characters or path traversal sequences`,
      };
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    console.log('[UPLOAD API] POST request received');
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const cardMappingsRaw = formData.get('card_mappings') as string | null;
    const overrideValidationRaw = formData.get('override_validation') as string | null;
    
    console.log('[UPLOAD API] Files count:', files.length);
    console.log('[UPLOAD API] Card mappings:', cardMappingsRaw);

    // Validate files first (before any database operations)
    const fileValidation = validateFiles(files);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: 'File validation failed', details: fileValidation.error },
        { status: 400 }
      );
    }

    // Validate and parse card_mappings JSON
    if (!cardMappingsRaw) {
      return NextResponse.json(
        { error: 'Missing required field: card_mappings' },
        { status: 400 }
      );
    }

    let parsedCardMappings: unknown;
    try {
      parsedCardMappings = JSON.parse(cardMappingsRaw);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in card_mappings',
          details: parseError instanceof Error ? parseError.message : 'Failed to parse JSON',
        },
        { status: 400 }
      );
    }

    // Validate card_mappings structure with Zod
    const validated = uploadRequestSchema.safeParse({
      card_mappings: parsedCardMappings,
      override_validation: overrideValidationRaw === 'true',
    });

    if (!validated.success) {
      console.error('[UPLOAD API] Validation failed:', JSON.stringify(validated.error.issues, null, 2));
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validated.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    
    console.log('[UPLOAD API] Validation passed');

    const { card_mappings: cardMappings, override_validation: overrideValidation } = validated.data;

    // Sanitize all filenames
    const sanitizedFiles = files.map((file) => {
      const sanitizedName = sanitizeFilename(file.name);
      return {
        file,
        originalName: file.name,
        sanitizedName,
      };
    });

    // Verify that all card_mappings reference valid filenames
    const fileNames = sanitizedFiles.map((f) => f.originalName);
    const invalidMappings = cardMappings.filter(
      (m) => !fileNames.includes(m.filename)
    );
    if (invalidMappings.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid card_mappings',
          details: `The following filenames in card_mappings do not match uploaded files: ${invalidMappings.map((m) => m.filename).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Create upload batch record
    const [batch] = await db.insert(uploadBatches).values({
      fileCount: sanitizedFiles.length,
      status: 'pending',
    }).returning();

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', `batch_${batch.id}`);
    await mkdir(uploadDir, { recursive: true });

    // Track files requiring user approval
    const filesNeedingApproval: Array<{
      filename: string;
      conflicts: string[];
      detectedLast4?: string;
      detectedIssuer?: string;
      isNewCard?: boolean;
    }> = [];

    // Save and validate each file
    for (const { file, originalName, sanitizedName } of sanitizedFiles) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const mapping = cardMappings.find((m) => m.filename === originalName);
      // Use sanitized filename for file path to prevent path traversal
      const filePath = join(uploadDir, sanitizedName);

      // Save file to disk
      await writeFile(filePath, buffer);

      // Verify file exists and is readable before validation
      try {
        const stat = statSync(filePath);
        logger.debug({ filename: originalName, fileSize: stat.size }, 'File written and verified');

        // Try reading the file to verify it's complete
        readFileSync(filePath);
      } catch (err) {
        logger.error(err, 'File verification error');
        throw new Error(`File verification failed for ${originalName}`);
      }

      // Run 3-layer card detection (use original filename for detection, sanitized for storage)
      const detectionResult = await detectCard({
        filename: originalName,
        filePath,
        userSelectedCardId: mapping?.card_id ?? undefined,
      });

      // Check if user approval needed (unless overridden)
      if (detectionResult.requiresUserApproval && !overrideValidation) {
        filesNeedingApproval.push({
          filename: originalName,
          conflicts: detectionResult.conflicts || [],
          detectedLast4: detectionResult.fileDetectedLast4 || detectionResult.last4,
          detectedIssuer: detectionResult.fileDetectedIssuer || detectionResult.issuer,
        });

        // Create uploaded_files record with 'pending' status (blocked)
        // Store sanitized filename in database but show original to user
        await db.insert(uploadedFiles).values({
          uploadBatchId: batch.id,
          cardId: null, // No card assigned yet
          filename: sanitizedName,
          filePath,
          fileSize: file.size,
          status: 'pending',
          errorMessage: `Validation required: ${detectionResult.conflicts?.join('; ')}`,
        });

        continue; // Skip to next file
      }

      // If validation overridden, prioritize user-selected card, then detected card
      const cardIdToUse = overrideValidation && mapping?.card_id
        ? mapping.card_id
        : (detectionResult.cardId || mapping?.card_id);

      logger.info({
        filename: originalName,
        overrideValidation,
        mappingCardId: mapping?.card_id,
        detectedCardId: detectionResult.cardId,
        finalCardId: cardIdToUse,
      }, 'File card assignment');

      // Check if new card detected (validation passed but card doesn't exist and not overridden)
      if (!overrideValidation && !detectionResult.cardId && detectionResult.last4 && detectionResult.issuer) {
        filesNeedingApproval.push({
          filename: originalName,
          conflicts: [`New card detected: ${detectionResult.issuer.toUpperCase()} •••• ${detectionResult.last4}. Would you like to add this card?`],
          detectedLast4: detectionResult.last4,
          detectedIssuer: detectionResult.issuer,
          isNewCard: true,
        });

        // Create uploaded_files record with 'pending' status (waiting for card creation)
        await db.insert(uploadedFiles).values({
          uploadBatchId: batch.id,
          cardId: null,
          filename: sanitizedName,
          filePath,
          fileSize: file.size,
          status: 'pending',
          errorMessage: `New card detected - waiting for user confirmation`,
        });

        continue;
      }

      // Ensure we have a valid card assignment
      if (!cardIdToUse) {
        throw new Error(`No card assigned for file: ${originalName}. Please select a card manually.`);
      }

      // Validation passed (or overridden) - create uploaded_files record
      await db.insert(uploadedFiles).values({
        uploadBatchId: batch.id,
        cardId: cardIdToUse,
        filename: sanitizedName,
        filePath,
        fileSize: file.size,
        status: 'pending',
      });
    }

    // If ANY files need approval, return error and block processing
    if (filesNeedingApproval.length > 0) {
      // Update batch status to 'failed' (blocked for user input)
      await db.update(uploadBatches)
        .set({
          status: 'failed',
          errorMessage: `${filesNeedingApproval.length} file(s) require manual card validation`,
        })
        .where(eq(uploadBatches.id, batch.id));

      return NextResponse.json({
        error: 'Card validation required',
        requiresUserApproval: true,
        batch_id: batch.id,
        filesNeedingApproval,
      }, { status: 400 });
    }

    // All validations passed - enqueue background job
    await enqueueJob('process-batch', { batchId: batch.id });

    return NextResponse.json({
      batch_id: batch.id,
      status: 'pending',
      file_count: sanitizedFiles.length,
    });

  } catch (error) {
    // Log raw error internally for debugging
    logger.error(error, 'Upload error');
    console.error('[UPLOAD API] ERROR:', error);
    
    // Sanitize error message to prevent exposing SQL or database details
    const sanitizedMessage = sanitizeErrorForClient(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        message: sanitizedMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}