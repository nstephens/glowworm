import React, { useState, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Edit, Trash2, Star, Settings, RefreshCw, Loader2, Eye, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { MobilePlaylistCard } from './MobilePlaylistCard';
import { ConfirmationModal } from '../ConfirmationModal';
import type { Playlist } from '../../types';

interface SwipeablePlaylistCardProps {
  playlist: Playlist;
  thumbnailUrl?: string;
  onPlay?: (playlist: Playlist) => void;
  onEdit?: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
  onSettings?: (playlist: Playlist) => void;
  onPreview?: (playlist: Playlist) => void;
  onGenerateVariants?: (playlistId: number) => void;
  onSetDefault?: (playlist: Playlist) => void;
  isGeneratingVariants?: boolean;
  hapticFeedback?: boolean;
  className?: string;
}

export const SwipeablePlaylistCard: React.FC<SwipeablePlaylistCardProps> = ({
  playlist,
  thumbnailUrl,
  onPlay,
  onEdit,
  onDelete,
  onSettings,
  onPreview,
  onGenerateVariants,
  onSetDefault,
  isGeneratingVariants = false,
  hapticFeedback = true,
  className,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Haptic feedback utility
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (hapticFeedback && 'vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [50],
        heavy: [100]
      };
      navigator.vibrate(patterns[type]);
    }
  };

  const handleSwipeStart = () => {
    setIsSwipeActive(true);
    triggerHapticFeedback('light');
  };

  const handleSwipeMove = (deltaX: number) => {
    setSwipeOffset(deltaX);
    
    // Determine swipe direction with threshold
    if (Math.abs(deltaX) > 30) {
      const newDirection = deltaX > 0 ? 'right' : 'left';
      if (newDirection !== swipeDirection) {
        setSwipeDirection(newDirection);
        triggerHapticFeedback('light');
      }
    } else {
      setSwipeDirection(null);
    }
  };

  const handleSwipeEnd = () => {
    setIsSwipeActive(false);
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  const handleSwipeLeft = () => {
    // Left swipe for delete action with confirmation
    if (onDelete) {
      triggerHapticFeedback('medium');
      setPendingAction(() => () => onDelete(playlist));
      setShowDeleteConfirm(true);
    }
  };

  const handleSwipeRight = () => {
    // Right swipe for edit action
    if (onEdit) {
      triggerHapticFeedback('medium');
      onEdit(playlist);
    }
  };

  const handleConfirmDelete = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setPendingAction(null);
    setShowDeleteConfirm(false);
  };

  const swipeHandlers = useSwipeable({
    onSwipeStart: handleSwipeStart,
    onSwiping: (eventData) => handleSwipeMove(eventData.deltaX),
    onSwipeEnd: handleSwipeEnd,
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    trackMouse: true,
    preventScrollOnSwipe: true,
    delta: 50, // Minimum distance for swipe
  });

  const getSwipeActionColor = () => {
    if (swipeDirection === 'left') {
      return 'bg-red-500'; // Delete action
    } else if (swipeDirection === 'right') {
      return 'bg-blue-500'; // Edit action
    }
    return 'bg-gray-400';
  };

  const getSwipeActionIcon = () => {
    if (swipeDirection === 'left') {
      return <Trash2 className="w-5 h-5" />;
    } else if (swipeDirection === 'right') {
      return <Edit className="w-5 h-5" />;
    }
    return null;
  };

  const getSwipeActionText = () => {
    if (swipeDirection === 'left') {
      return 'Delete';
    } else if (swipeDirection === 'right') {
      return 'Edit';
    }
    return '';
  };

  const getSwipeActionDescription = () => {
    if (swipeDirection === 'left') {
      return 'Swipe to delete playlist';
    } else if (swipeDirection === 'right') {
      return 'Swipe to edit playlist';
    }
    return '';
  };

  return (
    <div
      ref={cardRef}
      className={cn('relative overflow-hidden', className)}
      {...swipeHandlers}
    >
      {/* Swipe Action Background */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-200',
          swipeDirection === 'left' ? 'bg-red-50' : swipeDirection === 'right' ? 'bg-blue-50' : 'bg-transparent'
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          opacity: isSwipeActive ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center shadow-lg',
            getSwipeActionColor()
          )}>
            {getSwipeActionIcon()}
          </div>
          <div className="text-white">
            <div className="font-semibold text-sm">
              {getSwipeActionText()}
            </div>
            <div className="text-xs opacity-90">
              {getSwipeActionDescription()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Card Content */}
      <div
        className={cn(
          'relative transition-transform duration-200',
          isSwipeActive && 'transform',
          swipeDirection === 'left' && 'translate-x-[-20px]',
          swipeDirection === 'right' && 'translate-x-[20px]'
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
      >
        <MobilePlaylistCard
          playlist={playlist}
          thumbnailUrl={thumbnailUrl}
          onPlay={onPlay}
          onEdit={onEdit}
          onDelete={onDelete}
          onSettings={onSettings}
          onPreview={onPreview}
          onGenerateVariants={onGenerateVariants}
          isGeneratingVariants={isGeneratingVariants}
        />
      </div>

      {/* Swipe Indicators */}
      {!isSwipeActive && (
        <div className="absolute inset-y-0 left-0 w-1 bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Playlist"
        message={`Are you sure you want to delete "${playlist.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default SwipeablePlaylistCard;
