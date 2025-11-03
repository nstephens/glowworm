import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, Upload, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'checking' | 'duplicate' | 'uploading' | 'processing' | 'success' | 'error';
  progress?: number;
  error?: string;
  existingImage?: any;
}

interface AnimatedProgressCardProps {
  uploadFile: UploadFile;
  onRemove: (id: string) => void;
  index: number;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    ringColor: 'ring-gray-200',
    label: 'Pending'
  },
  checking: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    ringColor: 'ring-yellow-200',
    label: 'Checking'
  },
  uploading: {
    icon: Upload,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    ringColor: 'ring-blue-200',
    label: 'Uploading'
  },
  processing: {
    icon: Upload,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    ringColor: 'ring-amber-200',
    label: 'Processing'
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    ringColor: 'ring-green-200',
    label: 'Complete'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    ringColor: 'ring-red-200',
    label: 'Failed'
  },
  duplicate: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    ringColor: 'ring-yellow-200',
    label: 'Duplicate'
  }
};

export const AnimatedProgressCard: React.FC<AnimatedProgressCardProps> = ({
  uploadFile,
  onRemove,
  index
}) => {
  const config = statusConfig[uploadFile.status];
  const Icon = config.icon;
  const progress = uploadFile.progress || 0;

  // Create thumbnail preview
  const thumbnailUrl = URL.createObjectURL(uploadFile.file);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      className={cn(
        "relative overflow-hidden rounded-xl border-2 transition-all duration-300",
        config.bgColor,
        config.ringColor,
        "hover:shadow-lg hover:scale-[1.02]"
      )}
    >
      <div className="p-4">
        <div className="flex items-start space-x-4">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={thumbnailUrl}
                alt={uploadFile.file.name}
                className="w-full h-full object-cover"
                onLoad={() => URL.revokeObjectURL(thumbnailUrl)}
              />
            </div>
            
            {/* Status Icon Overlay */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className={cn(
                "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center",
                config.bgColor,
                "ring-2 ring-white"
              )}
            >
              <Icon className={cn("w-3 h-3", config.color)} />
            </motion.div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {uploadFile.file.name}
              </h4>
              <button
                onClick={() => onRemove(uploadFile.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
            </p>

            {/* Status and Progress */}
            <div className="mt-2 flex items-center space-x-2">
              <span className={cn("text-xs font-medium", config.color)}>
                {config.label}
              </span>
              
              {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", 
                      uploadFile.status === 'uploading' ? 'bg-blue-500' : 'bg-amber-500'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>

            {/* Error Message */}
            {uploadFile.error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-xs text-red-500 mt-1"
              >
                {uploadFile.error}
              </motion.p>
            )}

            {/* Duplicate Message */}
            {uploadFile.status === 'duplicate' && uploadFile.existingImage && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-xs text-yellow-600 mt-1"
              >
                Already exists: {uploadFile.existingImage.original_filename}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Success Animation Overlay */}
      {uploadFile.status === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="absolute inset-0 bg-green-500 bg-opacity-10 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 500 }}
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
          >
            <CheckCircle className="w-5 h-5 text-white" />
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnimatedProgressCard;
