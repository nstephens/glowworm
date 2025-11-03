import React, { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';
import { useSwipeGestures } from '../../hooks/useSwipeGestures';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  MoreHorizontal,
  X
} from 'lucide-react';

export interface SwipeableCardProps {
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
  upAction?: {
    icon: ReactNode;
    label: string;
    action: () => void;
    color?: string;
  };
  downAction?: {
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
  showSwipeHints?: boolean;
  maxSwipeDistance?: number;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  leftAction,
  rightAction,
  upAction,
  downAction,
  className,
  disabled = false,
  enableHaptic = true,
  threshold = 50,
  velocity = 0.3,
  showSwipeHints = true,
  maxSwipeDistance = 80
}) => {
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const { gestureProps, swipeState } = useSwipeGestures({
    onSwipeLeft: leftAction?.action || onSwipeLeft,
    onSwipeRight: rightAction?.action || onSwipeRight,
    onSwipeUp: upAction?.action || onSwipeUp,
    onSwipeDown: downAction?.action || onSwipeDown,
    onSwipeStart: () => {
      setIsSwipeActive(true);
      if (enableHaptic) {
        hapticPatterns.light();
      }
    },
    onSwipeEnd: () => {
      setIsSwipeActive(false);
      setSwipeOffset({ x: 0, y: 0 });
    },
    enableHaptic,
    threshold,
    velocity,
    preventDefault: true,
    stopPropagation: true
  });

  const handlePan = (deltaX: number, deltaY: number) => {
    if (disabled) return;

    const maxSwipe = maxSwipeDistance;
    const swipeX = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    const swipeY = Math.max(-maxSwipe, Math.min(maxSwipe, deltaY));
    
    setSwipeOffset({ x: swipeX, y: swipeY });
    setIsSwipeActive(Math.abs(swipeX) > 20 || Math.abs(swipeY) > 20);
  };

  const getSwipeDirection = () => {
    if (Math.abs(swipeOffset.x) > Math.abs(swipeOffset.y)) {
      return swipeOffset.x > 0 ? 'right' : 'left';
    } else {
      return swipeOffset.y > 0 ? 'down' : 'up';
    }
  };

  const showLeftAction = isSwipeActive && getSwipeDirection() === 'right' && leftAction;
  const showRightAction = isSwipeActive && getSwipeDirection() === 'left' && rightAction;
  const showUpAction = isSwipeActive && getSwipeDirection() === 'down' && upAction;
  const showDownAction = isSwipeActive && getSwipeDirection() === 'up' && downAction;

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
        transform: isSwipeActive 
          ? `translate(${swipeOffset.x * 0.3}px, ${swipeOffset.y * 0.3}px)`
          : 'translate(0, 0)'
      }}
      onMouseEnter={() => setShowHints(true)}
      onMouseLeave={() => setShowHints(false)}
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

      {/* Up Action */}
      {upAction && (
        <div
          className={cn(
            'absolute top-0 left-0 w-full flex items-center justify-center transition-all duration-200',
            'bg-green-500 text-white',
            showUpAction ? 'h-16 opacity-100' : 'h-0 opacity-0'
          )}
          style={{
            backgroundColor: upAction.color || '#10b981'
          }}
        >
          <div className="flex items-center gap-2">
            {upAction.icon}
            <span className="text-sm font-medium">{upAction.label}</span>
          </div>
        </div>
      )}

      {/* Down Action */}
      {downAction && (
        <div
          className={cn(
            'absolute bottom-0 left-0 w-full flex items-center justify-center transition-all duration-200',
            'bg-purple-500 text-white',
            showDownAction ? 'h-16 opacity-100' : 'h-0 opacity-0'
          )}
          style={{
            backgroundColor: downAction.color || '#8b5cf6'
          }}
        >
          <div className="flex items-center gap-2">
            {downAction.icon}
            <span className="text-sm font-medium">{downAction.label}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 bg-white">
        {children}
      </div>

      {/* Swipe Hints */}
      {showSwipeHints && showHints && !isSwipeActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg">
          <div className="flex items-center gap-4 text-gray-400">
            {(leftAction || onSwipeLeft) && (
              <div className="flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Swipe left</span>
              </div>
            )}
            {(rightAction || onSwipeRight) && (
              <div className="flex items-center gap-1">
                <span className="text-xs">Swipe right</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
            {(upAction || onSwipeUp) && (
              <div className="flex items-center gap-1">
                <ChevronUp className="w-4 h-4" />
                <span className="text-xs">Swipe up</span>
              </div>
            )}
            {(downAction || onSwipeDown) && (
              <div className="flex items-center gap-1">
                <span className="text-xs">Swipe down</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Swipe Indicator */}
      {isSwipeActive && (leftAction || rightAction || upAction || downAction) && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="flex items-center gap-1 text-gray-400 bg-white/90 px-2 py-1 rounded-full shadow-sm">
            <MoreHorizontal className="w-4 h-4" />
            <span className="text-xs">Swipe for actions</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeableCard;
