import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Image, 
  AlertCircle, 
  FileImage,
  Plus,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadFile } from './UploadProgress';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxSize?: number; // in bytes
  acceptedFileTypes?: string[];
  maxFiles?: number;
  className?: string;
}

/**
 * UploadZone - Drag and drop file upload component
 * 
 * Features:
 * - Drag and drop functionality
 * - File type validation
 * - Size validation
 * - Preview generation
 * - Multiple file selection
 * - Visual feedback states
 * - Accessibility support
 */
export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  maxSize = 52428800, // 50MB
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'],
  maxFiles = 100,
  className,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const generatePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `File size ${formatFileSize(file.size)} exceeds maximum ${formatFileSize(maxSize)}`;
    }

    return null;
  };

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    // Process accepted files
    for (const file of acceptedFiles) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    // Process rejected files
    for (const rejection of rejectedFiles) {
      const file = rejection.file;
      const errors = rejection.errors.map((e: any) => e.message).join(', ');
      newErrors.push(`${file.name}: ${errors}`);
    }

    // Check max files limit
    if (selectedFiles.length + validFiles.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed`);
    }

    setErrors(newErrors);

    if (validFiles.length > 0) {
      // Generate previews for image files
      const newPreviews: string[] = [];
      for (const file of validFiles) {
        try {
          const preview = await generatePreview(file);
          newPreviews.push(preview);
        } catch (error) {
          newPreviews.push('');
        }
      }

      // Update state
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);

      // Notify parent component
      onFilesSelected(validFiles);
    }
  }, [acceptedFileTypes, maxSize, maxFiles, selectedFiles.length, onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    multiple: true,
    maxFiles: maxFiles - selectedFiles.length,
  });

  const removeFile = (index: number) => {
    // Release object URL to prevent memory leaks
    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }

    // Remove file and preview
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    // Release all object URLs
    previews.forEach(preview => {
      if (preview) URL.revokeObjectURL(preview);
    });

    setSelectedFiles([]);
    setPreviews([]);
    setErrors([]);
  };

  const totalSize = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  const getDropzoneClassName = () => {
    return cn(
      "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
      "hover:border-primary/50 hover:bg-primary/5",
      isDragActive && !isDragReject && "border-primary bg-primary/10",
      isDragReject && "border-destructive bg-destructive/10",
      selectedFiles.length > 0 && "border-success/50 bg-success/5"
    );
  };

  return (
    <div className={cn("upload-container space-y-4", className)}>
      {/* Drop zone */}
      <div {...getRootProps()} className={getDropzoneClassName()}>
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="flex justify-center">
            {isDragActive ? (
              <Upload className="h-12 w-12 text-primary animate-bounce" />
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          
          <div>
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">
                Drop the files here...
              </p>
            ) : (
              <p className="text-lg font-medium">
                Drag & drop files here, or click to select files
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              <span>Images: JPG, PNG, GIF, WebP, AVIF</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span>Max: {formatFileSize(maxSize)} per file</span>
            </div>
          </div>

          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-2" />
            Browse Files
          </Button>
        </div>
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  Selected Files: {selectedFiles.length}
                </span>
                <Badge variant="outline">
                  {formatFileSize(totalSize)}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="relative group border rounded-lg overflow-hidden"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {previews[index] ? (
                      <img
                        src={previews[index]}
                        alt={`Preview of ${file.name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="p-2">
                    <p className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
