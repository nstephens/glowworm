import React from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadProgressHeaderProps {
  totalFiles: number;
  pendingCount: number;
  uploadingCount: number;
  processingCount: number;
  checkingCount?: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  onClearAll: () => void;
  isUploading: boolean;
  concurrentUploads?: number;
}

export const UploadProgressHeader: React.FC<UploadProgressHeaderProps> = ({
  totalFiles,
  pendingCount,
  uploadingCount,
  processingCount,
  checkingCount = 0,
  successCount,
  errorCount,
  duplicateCount,
  onClearAll,
  isUploading,
  concurrentUploads
}) => {
  const completedCount = successCount + errorCount + duplicateCount;
  const overallProgress = totalFiles > 0 ? (completedCount / totalFiles) * 100 : 0;
  const isProcessing = checkingCount > 0 || processingCount > 0 || uploadingCount > 0;

  const getStatusColor = () => {
    if (errorCount > 0) return 'text-red-500';
    if (successCount > 0 && errorCount === 0) return 'text-green-500';
    if (uploadingCount > 0 || processingCount > 0) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getStatusText = () => {
    if (errorCount > 0) return 'Some uploads failed';
    // Only show "Upload complete" if all files are done (pendingCount must be 0)
    if (successCount > 0 && errorCount === 0 && pendingCount === 0 && uploadingCount === 0 && processingCount === 0 && checkingCount === 0) {
      return 'Upload complete!';
    }
    if (checkingCount > 0) return `Checking ${checkingCount} file${checkingCount > 1 ? 's' : ''}...`;
    if (uploadingCount > 0) return 'Uploading...';
    if (processingCount > 0) return 'Processing...';
    return 'Ready to upload';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 mb-4",
        checkingCount > 0 
          ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300 shadow-lg"
          : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
      )}
    >
      {/* Processing Banner - Show when files are being checked */}
      {checkingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 bg-amber-100 border border-amber-300 rounded-lg p-3 flex items-center space-x-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full flex-shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              Processing {checkingCount} selected file{checkingCount > 1 ? 's' : ''}...
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Checking for duplicates and preparing files. Photo picker should have closed.
            </p>
          </div>
        </motion.div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ rotate: isUploading ? 360 : 0 }}
            transition={{ duration: 2, repeat: isUploading ? Infinity : 0, ease: "linear" }}
            className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center"
          >
            <Upload className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <h4 className="font-semibold text-gray-900">Upload Progress</h4>
            <p className={cn("text-sm font-medium", getStatusColor())}>
              {getStatusText()}
            </p>
            {concurrentUploads && isUploading && (
              <p className="text-xs text-gray-500 mt-1">
                Uploading {concurrentUploads} files simultaneously
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={onClearAll}
          disabled={isUploading}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Overall Progress</span>
          <span className="text-sm font-medium text-gray-900">
            {completedCount} / {totalFiles}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Status Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {checkingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-amber-600"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full"
            />
            <span className="text-sm">{checkingCount} checking</span>
          </motion.div>
        )}
        
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-gray-600"
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm">{pendingCount} pending</span>
          </motion.div>
        )}
        
        {(uploadingCount > 0 || processingCount > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-blue-600"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">
              {uploadingCount + processingCount} {uploadingCount > 0 ? 'uploading' : 'processing'}
            </span>
          </motion.div>
        )}
        
        {successCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-green-600"
          >
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{successCount} complete</span>
          </motion.div>
        )}
        
        {errorCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-red-600"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{errorCount} failed</span>
          </motion.div>
        )}
        
        {duplicateCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center space-x-2 text-yellow-600"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{duplicateCount} duplicates</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default UploadProgressHeader;
