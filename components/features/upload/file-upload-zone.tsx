'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardSelector } from './card-selector';

interface FileWithCard {
  file: File;
  cardId: number | null;
}

interface FileUploadZoneProps {
  onUploadComplete: (batchId: number) => void;
}

interface DuplicateFile {
  filename: string;
  reason: string;
  firstIndex: number;
  duplicateIndex: number;
}

export function FileUploadZone({ onUploadComplete }: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileWithCard[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateFiles, setDuplicateFiles] = useState<DuplicateFile[]>([]);
  const [validationConflicts, setValidationConflicts] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      cardId: null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    setError(null);
  }, []);

  // Real-time duplicate detection
  useEffect(() => {
    const findDuplicatesInFileList = (fileList: FileWithCard[]): DuplicateFile[] => {
      const seen = new Map<string, number>(); // filename -> first index
      const duplicates: DuplicateFile[] = [];

      fileList.forEach((fileWithCard, index) => {
        const filename = fileWithCard.file.name;
        if (seen.has(filename)) {
          duplicates.push({
            filename,
            reason: 'Selected multiple times',
            firstIndex: seen.get(filename)!,
            duplicateIndex: index
          });
        } else {
          seen.set(filename, index);
        }
      });

      return duplicates;
    };

    const duplicates = findDuplicatesInFileList(files);
    setDuplicateFiles(duplicates);
  }, [files]);

  const removeDuplicateFiles = (fileList: FileWithCard[]): FileWithCard[] => {
    const seen = new Set<string>();
    return fileList.filter(fileWithCard => {
      if (seen.has(fileWithCard.file.name)) {
        return false; // Skip duplicate
      }
      seen.set(fileWithCard.file.name);
      return true; // Keep first occurrence
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateCardId = (index: number, cardId: number | null) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, cardId } : f));
  };

  const handleUpload = async (overrideValidation = false, forceCardMappings?: Array<{filename: string; card_id: number | null}>) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      files.forEach(({ file }) => {
        formData.append('files', file);
      });

      const cardMappings = forceCardMappings || files.map(({ file, cardId }) => ({
        filename: file.name,
        card_id: cardId,
      }));

      formData.append('card_mappings', JSON.stringify(cardMappings));
      formData.append('override_validation', String(overrideValidation));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // Check for validation conflicts (HTTP 400 with requiresUserApproval)
      if (response.status === 400 && data.requiresUserApproval) {
        setValidationConflicts(data);
        setUploading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Upload failed');
      }

      onUploadComplete(data.batch_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Duplicate files alert */}
      {duplicateFiles.length > 0 && (
        <div className="p-4 bg-blue-50 border-2 border-blue-400 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">
                {duplicateFiles.length} Duplicate File{duplicateFiles.length > 1 ? 's' : ''} Detected
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                The following files appear multiple times and will be uploaded only once:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-blue-900">
                {Array.from(new Set(duplicateFiles.map(d => d.filename))).map(filename => (
                  <li key={filename} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    {filename}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Validation conflicts alert */}
      {validationConflicts && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-amber-900">Card Validation Required</h3>
                <p className="text-sm text-amber-800 mt-1">
                  {validationConflicts.filesNeedingApproval?.length} file(s) have validation conflicts:
                </p>
              </div>

              {validationConflicts.filesNeedingApproval?.map((conflict: any, idx: number) => (
                <div key={idx} className="p-3 bg-white border border-amber-200 rounded space-y-3">
                  <div>
                    <p className="font-medium text-sm">{conflict.filename}</p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                      {conflict.conflicts.map((msg: string, i: number) => (
                        <li key={i}>• {msg}</li>
                      ))}
                    </ul>
                    {conflict.detectedLast4 && !conflict.isNewCard && (
                      <p className="mt-2 text-xs font-semibold text-blue-700">
                        {conflict.detectionSource === 'header' ? 'File Header (Most Reliable)' :
                         conflict.detectionSource === 'filename' ? 'Filename Pattern' : 'Detected'}: {conflict.detectedIssuer?.toUpperCase()} •••• {conflict.detectedLast4}
                      </p>
                    )}
                  </div>

                  {conflict.isNewCard ? (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={async () => {
                          if (!conflict.detectedLast4 || !conflict.detectedIssuer) return;

                          try {
                            // Create new card
                            const createResponse = await fetch('/api/cards', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                owner: 'default-user',
                                last4: conflict.detectedLast4,
                                issuer: conflict.detectedIssuer.toUpperCase(),
                              }),
                            });
                            const createData = await createResponse.json();

                            // Update file's card selection and retry upload with override
                            const fileIndex = files.findIndex(f => f.file.name === conflict.filename);
                            if (fileIndex !== -1 && createData.card) {
                              updateCardId(fileIndex, createData.card.id);

                              // Create card mappings with the new card
                              const cardMappings = files.map((f, i) => ({
                                filename: f.file.name,
                                card_id: i === fileIndex ? createData.card.id : f.cardId,
                              }));

                              setValidationConflicts(null);
                              handleUpload(true, cardMappings);
                            }
                          } catch (err) {
                            console.error('Failed to create new card:', err);
                            setError('Failed to create new card');
                          }
                        }}
                      >
                        Yes, Add Card & Proceed
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setValidationConflicts(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        if (!conflict.detectedLast4 || !conflict.detectedIssuer) return;

                        try {
                          // Try to find existing card
                          const cardsResponse = await fetch('/api/cards?owner=default-user');
                          const cardsData = await cardsResponse.json();

                          let cardToUse = cardsData.cards?.find((c: any) =>
                            c.last4 === conflict.detectedLast4 &&
                            c.issuer?.toLowerCase() === conflict.detectedIssuer.toLowerCase()
                          );

                          // If card doesn't exist, create it
                          if (!cardToUse) {
                            const createResponse = await fetch('/api/cards', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                owner: 'default-user',
                                last4: conflict.detectedLast4,
                                issuer: conflict.detectedIssuer.toUpperCase(),
                              }),
                            });
                            const createData = await createResponse.json();
                            cardToUse = createData.card;
                          }

                          // Update file's card selection and retry upload
                          const fileIndex = files.findIndex(f => f.file.name === conflict.filename);
                          if (fileIndex !== -1 && cardToUse) {
                            updateCardId(fileIndex, cardToUse.id);

                            // Create card mappings with the selected card
                            const cardMappings = files.map((f, i) => ({
                              filename: f.file.name,
                              card_id: i === fileIndex ? cardToUse.id : f.cardId,
                            }));

                            // Show confirmation dialog
                            setConfirmDialog({
                              message: `Proceed with card ${cardToUse.issuer?.toUpperCase()} •••• ${cardToUse.last4 || cardToUse.last4Digits}?`,
                              onConfirm: () => {
                                setValidationConflicts(null);
                                setConfirmDialog(null);
                                handleUpload(true, cardMappings);
                              },
                            });
                          }
                        } catch (err) {
                          console.error('Failed to use detected card:', err);
                          setError('Failed to use detected card');
                        }
                      }}
                    >
                      Use Detected Card ({conflict.detectedLast4})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Show confirmation dialog before proceeding
                        setConfirmDialog({
                          message: 'Proceed with your card selection despite the conflicts?',
                          onConfirm: () => {
                            setValidationConflicts(null);
                            setConfirmDialog(null);
                            setTimeout(() => handleUpload(true), 100);
                          },
                        });
                      }}
                    >
                      Keep My Selection
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Clear selection and let user pick manually
                        const fileIndex = files.findIndex(f => f.file.name === conflict.filename);
                        if (fileIndex !== -1) {
                          updateCardId(fileIndex, null);
                        }
                        setValidationConflicts(null);
                      }}
                    >
                      Choose Different Card
                    </Button>
                  </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValidationConflicts(null);
                    setFiles([]);  // Clear files to start fresh
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg">Drop files here...</p>
        ) : (
          <div>
            <p className="text-lg mb-2">Drag & drop Excel files here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
            <p className="text-xs text-gray-400 mt-2">Supports .xlsx, .xls, .csv</p>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Selected Files ({files.length})</h3>
          {files.map((fileWithCard, index) => {
            const duplicateInfo = duplicateFiles.find(d =>
              d.duplicateIndex === index || d.firstIndex === index
            );
            const isFirstOccurrence = duplicateInfo && duplicateInfo.firstIndex === index;
            const isDuplicate = duplicateInfo && duplicateInfo.duplicateIndex === index;

            return (
              <div
                key={index}
                className={`flex items-center gap-4 p-4 border rounded-lg transition-all ${
                  isDuplicate
                    ? 'border-blue-400 bg-blue-50 opacity-60'
                    : isFirstOccurrence
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200'
                }`}
              >
                {(isDuplicate || isFirstOccurrence) && (
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{fileWithCard.file.name}</p>
                    {isDuplicate && (
                      <span className="text-xs px-2 py-1 bg-blue-200 text-blue-800 rounded-full font-medium">
                        Duplicate (will be removed)
                      </span>
                    )}
                    {isFirstOccurrence && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                        Will be kept
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {(fileWithCard.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <CardSelector
                  value={fileWithCard.cardId}
                  onChange={(cardId) => updateCardId(index, cardId)}
                  owner="default-user"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <Button
          onClick={() => {
            // Auto-remove duplicates before upload
            if (duplicateFiles.length > 0) {
              const uniqueFiles = removeDuplicateFiles(files);
              setFiles(uniqueFiles);
              // Small delay to show UI update, then upload
              setTimeout(() => handleUpload(), 100);
            } else {
              handleUpload();
            }
          }}
          disabled={uploading || (files.length - duplicateFiles.length === 0)}
          className="w-full"
          size="lg"
        >
          {uploading
            ? 'Uploading...'
            : duplicateFiles.length > 0
              ? `Continue (${files.length - duplicateFiles.length} unique file${files.length - duplicateFiles.length !== 1 ? 's' : ''})`
              : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
          }
        </Button>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Confirm Action</h3>
            <p className="text-gray-700 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={confirmDialog.onConfirm}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
