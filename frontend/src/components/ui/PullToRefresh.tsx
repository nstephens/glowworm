import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useTouchGestures } from '@/hooks/useTouchGestures';

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
  className?: string;
  refreshText?: string;
  releaseText?: string;
  refreshingText?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
  className,
  refreshText = 'Pull to refresh',
  releaseText = 'Release to refresh',
  refreshingText = 'Refreshing...',
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || disabled) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setIsPulling(false);
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [onRefresh, isRefreshing, disabled]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    if (disabled || isRefreshing) return;

    const scrollTop = containerRef.current?.scrollTop || 0;
    
    // Only trigger pull-to-refresh when at the top of the container
    if (scrollTop > 0) return;

    const distance = Math.max(0, deltaY);
    const progress = Math.min(distance / threshold, 1);
    
    setPullDistance(distance);
    setIsPulling(distance > 0);
    setCanRefresh(distance >= threshold);
  }, [threshold, disabled, isRefreshing]);

  const handlePanEnd = useCallback(() => {
    if (disabled || isRefreshing) return;

    if (canRefresh) {
      handleRefresh();
    } else {
      setIsPulling(false);
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [canRefresh, handleRefresh, disabled, isRefreshing]);

  useTouchGestures(containerRef, {
    onPan: handlePan,
    onPanEnd: handlePanEnd,
    enablePan: true,
    enableSwipe: false,
    enableTap: false,
  });

  const refreshIndicatorStyle = {
    transform: `translateY(${Math.min(pullDistance * 0.5, threshold * 0.5)}px)`,
    opacity: isPulling ? Math.min(pullDistance / threshold, 1) : 0,
  };

  const refreshIconStyle = {
    transform: `rotate(${pullDistance * 2}deg)`,
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-auto',
        className
      )}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pull to refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-b border-border"
        style={refreshIndicatorStyle}
      >
        <div className="flex items-center gap-2 py-2">
          <div
            className={cn(
              'transition-transform duration-200',
              isRefreshing && 'animate-spin'
            )}
            style={refreshIconStyle}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 text-primary" />
            ) : (
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform duration-200',
                canRefresh && 'rotate-180'
              )} />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {isRefreshing ? refreshingText : canRefresh ? releaseText : refreshText}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200 ease-out"
            style={{
              width: `${Math.min((pullDistance / threshold) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        'transition-transform duration-200 ease-out',
        isPulling && 'transform-gpu'
      )}
      style={{
        transform: isPulling ? `translateY(${Math.min(pullDistance * 0.3, threshold * 0.3)}px)` : 'translateY(0)',
      }}>
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;







