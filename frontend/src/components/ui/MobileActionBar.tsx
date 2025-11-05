import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, 
  Download, 
  Share, 
  Star, 
  Copy, 
  Move, 
  MoreHorizontal,
  X,
  ChevronUp,
  ChevronDown,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Badge } from './badge';

interface MobileActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount?: number;
  /** Whether to show the action bar */
  visible?: boolean;
  /** Primary actions */
  primaryActions?: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'secondary';
    disabled?: boolean;
  }>;
  /** Secondary actions (shown in overflow menu) */
  secondaryActions?: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'secondary';
    disabled?: boolean;
  }>;
  /** Callback when selection is cleared */
  onClearSelection?: () => void;
  /** Callback when select all is triggered */
  onSelectAll?: () => void;
  /** Whether all items are selected */
  allSelected?: boolean;
  /** Position of the action bar */
  position?: 'bottom' | 'top';
  /** Custom className */
  className?: string;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
}

export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  selectedCount,
  totalCount,
  visible = true,
  primaryActions = [],
  secondaryActions = [],
  onClearSelection,
  onSelectAll,
  allSelected = false,
  position = 'bottom',
  className,
  hapticFeedback = true
}) => {
  const [showOverflow, setShowOverflow] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Haptic feedback function
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  };

  // Handle action click
  const handleActionClick = (action: typeof primaryActions[0] | typeof secondaryActions[0]) => {
    if (action.disabled) return;
    
    action.onClick();
    triggerHapticFeedback('medium');
    setShowOverflow(false);
  };

  // Handle overflow toggle
  const handleOverflowToggle = () => {
    setShowOverflow(!showOverflow);
    triggerHapticFeedback('light');
  };

  // Handle select all
  const handleSelectAll = () => {
    onSelectAll?.();
    triggerHapticFeedback('heavy');
  };

  // Handle clear selection
  const handleClearSelection = () => {
    onClearSelection?.();
    triggerHapticFeedback('light');
  };

  // Close overflow on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        overflowRef.current && 
        !overflowRef.current.contains(event.target as Node) &&
        actionBarRef.current &&
        !actionBarRef.current.contains(event.target as Node)
      ) {
        setShowOverflow(false);
      }
    };

    if (showOverflow) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflow]);

  if (!visible || selectedCount === 0) {
    return null;
  }

  const allActions = [...primaryActions, ...secondaryActions];
  const hasOverflow = allActions.length > 3;

  return (
    <div
      ref={actionBarRef}
      className={cn(
        'fixed left-4 right-4 z-50 transition-all duration-300 ease-out',
        position === 'bottom' ? 'bottom-4' : 'top-4',
        className
      )}
    >
      {/* Main Action Bar */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl p-4">
        <div className="flex items-center justify-between">
          {/* Selection Info */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {selectedCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">
                {selectedCount} selected
              </span>
              {totalCount && (
                <span className="text-xs text-gray-500">
                  {Math.round((selectedCount / totalCount) * 100)}% of total
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Select All / Deselect All */}
            {onSelectAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}

            {/* Primary Actions */}
            {primaryActions.slice(0, 3).map((action) => (
              <Button
                key={action.id}
                variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className="touch-manipulation"
                title={action.label}
              >
                {action.icon}
                <span className="ml-1 text-xs hidden sm:inline">{action.label}</span>
              </Button>
            ))}

            {/* Overflow Menu */}
            {hasOverflow && (
              <div className="relative" ref={overflowRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOverflowToggle}
                  className="touch-manipulation"
                  title="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {/* Overflow Menu Dropdown */}
                {showOverflow && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 animate-in slide-in-from-bottom-2 duration-200">
                    {secondaryActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleActionClick(action)}
                        disabled={action.disabled}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center space-x-3',
                          {
                            'text-red-600 hover:bg-red-50': action.variant === 'destructive',
                            'text-gray-500 cursor-not-allowed': action.disabled
                          }
                        )}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Clear Selection */}
            {onClearSelection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-gray-500 hover:text-gray-700 touch-manipulation"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Selection Progress Bar */}
      {totalCount && totalCount > 1 && (
        <div className="mt-2 bg-gray-200 rounded-full h-1 overflow-hidden">
          <div
            className="bg-primary-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${(selectedCount / totalCount) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default MobileActionBar;





