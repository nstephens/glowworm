import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Star, Trash2, Share, MoreHorizontal } from 'lucide-react';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface CompactInfoCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  details?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  expandable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enableSwipe?: boolean;
  swipeActions?: {
    left?: { icon: React.ReactNode; action: () => void; color?: string };
    right?: { icon: React.ReactNode; action: () => void; color?: string };
  };
}

export const CompactInfoCard: React.FC<CompactInfoCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  details,
  className,
  onClick,
  expandable = false,
  loading = false,
  disabled = false,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  enableSwipe = false,
  swipeActions,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const colorClasses = {
    primary: 'border-primary/20 bg-primary/5',
    secondary: 'border-secondary/20 bg-secondary/5',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    destructive: 'border-red-200 bg-red-50',
  };

  const iconColorClasses = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    destructive: 'bg-red-100 text-red-600',
  };

  const handleClick = () => {
    if (disabled || loading) return;
    
    // Trigger haptic feedback
    hapticPatterns.selection();
    
    if (expandable) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled || loading) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const handleSwipeLeft = useCallback(() => {
    // Trigger haptic feedback for swipe
    hapticPatterns.swipe();
    
    if (swipeActions?.left) {
      swipeActions.left.action();
    } else {
      onSwipeLeft?.();
    }
    setSwipeOffset(0);
    setIsSwipeActive(false);
  }, [swipeActions?.left, onSwipeLeft]);

  const handleSwipeRight = useCallback(() => {
    // Trigger haptic feedback for swipe
    hapticPatterns.swipe();
    
    if (swipeActions?.right) {
      swipeActions.right.action();
    } else {
      onSwipeRight?.();
    }
    setSwipeOffset(0);
    setIsSwipeActive(false);
  }, [swipeActions?.right, onSwipeRight]);

  const handleSwipeUp = useCallback(() => {
    onSwipeUp?.();
    setSwipeOffset(0);
    setIsSwipeActive(false);
  }, [onSwipeUp]);

  const handleSwipeDown = useCallback(() => {
    onSwipeDown?.();
    setSwipeOffset(0);
    setIsSwipeActive(false);
  }, [onSwipeDown]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    if (!enableSwipe || disabled || loading) return;
    
    const maxSwipe = 80;
    const swipeAmount = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    
    setSwipeOffset(swipeAmount);
    setIsSwipeActive(Math.abs(swipeAmount) > 20);
  }, [enableSwipe, disabled, loading]);

  const handlePanEnd = useCallback(() => {
    if (!enableSwipe || disabled || loading) return;
    
    const threshold = 60;
    if (Math.abs(swipeOffset) > threshold) {
      if (swipeOffset > 0) {
        handleSwipeRight();
      } else {
        handleSwipeLeft();
      }
    } else {
      setSwipeOffset(0);
      setIsSwipeActive(false);
    }
  }, [enableSwipe, disabled, loading, swipeOffset, handleSwipeRight, handleSwipeLeft]);

  // Set up touch gestures
  useTouchGestures(cardRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onSwipeUp: handleSwipeUp,
    onSwipeDown: handleSwipeDown,
    onPan: handlePan,
    onPanEnd: handlePanEnd,
    enableSwipe: enableSwipe,
    enablePan: enableSwipe,
    threshold: 10,
    velocity: 0.3,
  });

  return (
    <div className="relative overflow-hidden">
      {/* Swipe action indicators */}
      {enableSwipe && (swipeActions?.left || swipeActions?.right) && (
        <>
          {swipeActions?.left && (
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white transition-transform duration-200 ease-out',
                'w-20 z-0'
              )}
              style={{
                transform: `translateX(${Math.min(0, swipeOffset + 80)}px)`,
                opacity: swipeOffset < -20 ? Math.min(Math.abs(swipeOffset) / 80, 1) : 0,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                {swipeActions.left.icon}
                <span className="text-xs">Delete</span>
              </div>
            </div>
          )}
          {swipeActions?.right && (
            <div
              className={cn(
                'absolute right-0 top-0 bottom-0 flex items-center justify-center bg-green-500 text-white transition-transform duration-200 ease-out',
                'w-20 z-0'
              )}
              style={{
                transform: `translateX(${Math.max(0, swipeOffset - 80)}px)`,
                opacity: swipeOffset > 20 ? Math.min(swipeOffset / 80, 1) : 0,
              }}
            >
              <div className="flex flex-col items-center gap-1">
                {swipeActions.right.icon}
                <span className="text-xs">Favorite</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main card */}
      <div
        ref={cardRef}
        className={cn(
          'info-card relative z-10 transition-transform duration-200 ease-out',
          colorClasses[color],
          (onClick || expandable) && !disabled && !loading && 'cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          loading && 'loading',
          isSwipeActive && 'shadow-lg',
          className
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={(onClick || expandable) && !disabled && !loading ? 0 : undefined}
        role={(onClick || expandable) ? 'button' : undefined}
        aria-expanded={expandable ? isExpanded : undefined}
        aria-label={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`}
        aria-disabled={disabled || loading}
      >
      {/* Card Header */}
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <div className="flex items-center gap-2">
          {icon && (
            <div className={cn('card-icon', iconColorClasses[color])}>
              {icon}
            </div>
          )}
          {expandable && (
            <div className={cn('card-icon card-expand-indicator', isExpanded && 'expanded')}>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="card-content">
        <div className="card-value">{value}</div>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>

      {/* Progressive Disclosure */}
      {expandable && details && (
        <div className={cn('card-details', isExpanded && 'expanded')}>
          <div className="card-details-content">
            {details}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default CompactInfoCard;
