import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { useSwipeGestures } from '../../hooks/useSwipeGestures';
import { ChevronRight, Trash2, Edit, Share, MoreHorizontal } from 'lucide-react';

export interface SwipeableListItemProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  leftAction?: {
    icon: ReactNode;
    label: string;
    action: () => void;
    color?: string;
  };
  rightAction?: {
    icon: ReactNode;
    label: string;
    action: () => void;
    color?: string;
  };
  className?: string;
  disabled?: boolean;
  enableHaptic?: boolean;
  threshold?: number;
  velocity?: number;
}

export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  leftAction,
  rightAction,
  className,
  disabled = false,
  enableHaptic = true,
  threshold = 50,
  velocity = 0.3
}) => {
  const { gestureProps, swipeState } = useSwipeGestures({
    onSwipeLeft: leftAction?.action || onSwipeLeft,
    onSwipeRight: rightAction?.action || onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    enableHaptic,
    threshold,
    velocity,
    preventDefault: true,
    stopPropagation: true
  });

  const showLeftAction = swipeState.isSwiping && swipeState.direction === 'right' && leftAction;
  const showRightAction = swipeState.isSwiping && swipeState.direction === 'left' && rightAction;

  return (
    <div
      {...gestureProps}
      className={cn(
        'relative overflow-hidden bg-white rounded-lg border border-gray-200',
        'transition-all duration-200 ease-out',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      style={{
        transform: swipeState.isSwiping 
          ? `translateX(${swipeState.direction === 'left' ? -Math.min(swipeState.distance * 0.3, 80) : swipeState.direction === 'right' ? Math.min(swipeState.distance * 0.3, 80) : 0}px)`
          : 'translateX(0)'
      }}
    >
      {/* Left Action */}
      {leftAction && (
        <div
          className={cn(
            'absolute left-0 top-0 h-full flex items-center justify-center transition-all duration-200',
            'bg-blue-500 text-white',
            showLeftAction ? 'w-20 opacity-100' : 'w-0 opacity-0'
          )}
          style={{
            backgroundColor: leftAction.color || '#3b82f6'
          }}
        >
          <div className="flex flex-col items-center gap-1">
            {leftAction.icon}
            <span className="text-xs font-medium">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right Action */}
      {rightAction && (
        <div
          className={cn(
            'absolute right-0 top-0 h-full flex items-center justify-center transition-all duration-200',
            'bg-red-500 text-white',
            showRightAction ? 'w-20 opacity-100' : 'w-0 opacity-0'
          )}
          style={{
            backgroundColor: rightAction.color || '#ef4444'
          }}
        >
          <div className="flex flex-col items-center gap-1">
            {rightAction.icon}
            <span className="text-xs font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 bg-white">
        {children}
      </div>

      {/* Swipe Indicator */}
      {swipeState.isSwiping && (leftAction || rightAction) && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="flex items-center gap-1 text-gray-400">
            <ChevronRight className="w-4 h-4" />
            <span className="text-xs">Swipe for actions</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
};

export interface SwipeableListProps {
  children: ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

export const SwipeableList: React.FC<SwipeableListProps> = ({
  children,
  className,
  spacing = 'md'
}) => {
  const spacingClasses = {
    sm: 'space-y-1',
    md: 'space-y-2',
    lg: 'space-y-4'
  };

  return (
    <div className={cn('space-y-2', spacingClasses[spacing], className)}>
      {children}
    </div>
  );
};

// Predefined action configurations
export const swipeActions = {
  delete: {
    icon: <Trash2 className="w-5 h-5" />,
    label: 'Delete',
    color: '#ef4444'
  },
  edit: {
    icon: <Edit className="w-5 h-5" />,
    label: 'Edit',
    color: '#3b82f6'
  },
  share: {
    icon: <Share className="w-5 h-5" />,
    label: 'Share',
    color: '#10b981'
  },
  more: {
    icon: <MoreHorizontal className="w-5 h-5" />,
    label: 'More',
    color: '#6b7280'
  }
};

export default SwipeableListItem;
