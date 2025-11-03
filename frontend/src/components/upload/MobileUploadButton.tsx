import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Plus, 
  Camera, 
  Image as ImageIcon, 
  FileText,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Album } from '../../types';

interface MobileUploadButtonProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Callback when upload is triggered */
  onUpload: () => void;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Number of files selected */
  fileCount?: number;
  /** Whether to show album selection */
  showAlbumSelection?: boolean;
  /** Available albums */
  albums?: Album[];
  /** Selected album */
  selectedAlbum?: Album | null;
  /** Callback when album changes */
  onAlbumChange?: (album: Album | null) => void;
  /** Position of the button */
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Custom className */
  className?: string;
}

export const MobileUploadButton: React.FC<MobileUploadButtonProps> = ({
  onFilesSelected,
  onUpload,
  isUploading = false,
  fileCount = 0,
  showAlbumSelection = false,
  albums = [],
  selectedAlbum,
  onAlbumChange,
  position = 'bottom-right',
  size = 'md',
  hapticFeedback = true,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAlbumMenu, setShowAlbumMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  }, [hapticFeedback]);

  // Size classes
  const sizeClasses = {
    sm: {
      main: 'w-12 h-12',
      action: 'w-10 h-10',
      icon: 'h-5 w-5',
      text: 'text-xs'
    },
    md: {
      main: 'w-14 h-14',
      action: 'w-12 h-12',
      icon: 'h-6 w-6',
      text: 'text-sm'
    },
    lg: {
      main: 'w-16 h-16',
      action: 'w-14 h-14',
      icon: 'h-7 w-7',
      text: 'text-base'
    }
  };

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4'
  };

  const currentSize = sizeClasses[size];

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    onFilesSelected(fileArray);
    triggerHapticFeedback('medium');
    setIsExpanded(false);
  }, [onFilesSelected, triggerHapticFeedback]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  // Handle camera input change
  const handleCameraInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Handle main button click
  const handleMainClick = useCallback(() => {
    if (fileCount > 0) {
      onUpload();
      triggerHapticFeedback('heavy');
    } else {
      setIsExpanded(!isExpanded);
      triggerHapticFeedback('light');
    }
  }, [fileCount, onUpload, isExpanded, triggerHapticFeedback]);

  // Handle action click
  const handleActionClick = useCallback((action: string) => {
    switch (action) {
      case 'files':
        fileInputRef.current?.click();
        break;
      case 'camera':
        cameraInputRef.current?.click();
        break;
      case 'album':
        setShowAlbumMenu(!showAlbumMenu);
        break;
    }
    triggerHapticFeedback('medium');
  }, [showAlbumMenu, triggerHapticFeedback]);

  // Handle album selection
  const handleAlbumSelect = useCallback((album: Album | null) => {
    onAlbumChange?.(album);
    setShowAlbumMenu(false);
    triggerHapticFeedback('light');
  }, [onAlbumChange, triggerHapticFeedback]);

  return (
    <div className={cn(
      'fixed z-50 flex flex-col-reverse items-end gap-3',
      positionClasses[position],
      className
    )}>
      {/* Action Items */}
      {isExpanded && (
        <div className="flex flex-col-reverse gap-2 animate-in slide-in-from-bottom-2 duration-200">
          {/* Album Selection */}
          {showAlbumSelection && (
            <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap animate-in fade-in duration-200">
                {selectedAlbum ? selectedAlbum.name : 'Select Album'}
              </div>
              
              <button
                onClick={() => handleActionClick('album')}
                className={cn(
                  'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
                  'hover:scale-110 active:scale-95 touch-manipulation',
                  currentSize.action,
                  'bg-blue-600 hover:bg-blue-700 text-white'
                )}
                title="Select Album"
              >
                <FileText className={cn(currentSize.icon, 'transition-transform duration-200')} />
              </button>
            </div>
          )}

          {/* Camera Action */}
          <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap animate-in fade-in duration-200">
              Take Photo
            </div>
            
            <button
              onClick={() => handleActionClick('camera')}
              className={cn(
                'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
                'hover:scale-110 active:scale-95 touch-manipulation',
                currentSize.action,
                'bg-green-600 hover:bg-green-700 text-white'
              )}
              title="Take Photo"
            >
              <Camera className={cn(currentSize.icon, 'transition-transform duration-200')} />
            </button>
          </div>

          {/* Files Action */}
          <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap animate-in fade-in duration-200">
              Choose Files
            </div>
            
            <button
              onClick={() => handleActionClick('files')}
              className={cn(
                'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
                'hover:scale-110 active:scale-95 touch-manipulation',
                currentSize.action,
                'bg-purple-600 hover:bg-purple-700 text-white'
              )}
              title="Choose Files"
            >
              <ImageIcon className={cn(currentSize.icon, 'transition-transform duration-200')} />
            </button>
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative',
          isDragging && 'scale-110'
        )}
      >
        <button
          onClick={handleMainClick}
          disabled={isUploading}
          className={cn(
            'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
            'hover:scale-110 active:scale-95 touch-manipulation group',
            currentSize.main,
            {
              'bg-primary-600 hover:bg-primary-700 text-white': fileCount === 0,
              'bg-green-600 hover:bg-green-700 text-white': fileCount > 0,
              'opacity-50 cursor-not-allowed': isUploading,
              'animate-pulse': isUploading
            }
          )}
          title={fileCount > 0 ? 'Upload Files' : 'Add Files'}
        >
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : fileCount > 0 ? (
            <div className="flex items-center gap-1">
              <Check className={cn(currentSize.icon, 'transition-transform duration-200')} />
              <span className={cn('font-bold', currentSize.text)}>{fileCount}</span>
            </div>
          ) : (
            <Plus className={cn(currentSize.icon, 'transition-transform duration-200', isExpanded && 'rotate-45')} />
          )}
        </button>

        {/* File Count Badge */}
        {fileCount > 0 && !isUploading && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
            {fileCount}
          </div>
        )}

        {/* Upload Progress Ring */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin" />
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraInputChange}
        className="hidden"
      />

      {/* Album Selection Menu */}
      {showAlbumMenu && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="px-3 py-2 border-b border-gray-100">
            <h4 className="font-medium text-gray-900">Select Album</h4>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => handleAlbumSelect(null)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between',
                !selectedAlbum && 'bg-blue-50 text-blue-600'
              )}
            >
              <span>No Album</span>
              {!selectedAlbum && <Check className="h-4 w-4" />}
            </button>
            
            {albums.map((album) => (
              <button
                key={album.id}
                onClick={() => handleAlbumSelect(album)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center justify-between',
                  selectedAlbum?.id === album.id && 'bg-blue-50 text-blue-600'
                )}
              >
                <span>{album.name}</span>
                {selectedAlbum?.id === album.id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-primary-500/20 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 shadow-2xl text-center">
            <Upload className="h-16 w-16 text-primary-600 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Drop files to upload</h3>
            <p className="text-gray-600">Release to add images to your collection</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileUploadButton;




