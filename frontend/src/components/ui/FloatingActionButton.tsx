import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Download, 
  Share, 
  Trash2, 
  Star, 
  MoreHorizontal,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  /** Main action button icon */
  mainIcon?: React.ReactNode;
  /** Main action callback */
  onMainAction?: () => void;
  /** Quick action items */
  actions?: Array<{
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'secondary';
    disabled?: boolean;
  }>;
  /** Whether the FAB is expanded */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Position of the FAB */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Size of the FAB */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show labels */
  showLabels?: boolean;
  /** Custom className */
  className?: string;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  mainIcon = <Plus className="h-5 w-5" />,
  onMainAction,
  actions = [],
  expanded: controlledExpanded,
  onExpandedChange,
  position = 'bottom-right',
  size = 'md',
  showLabels = true,
  className,
  hapticFeedback = true
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

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

  // Handle expansion toggle
  const handleToggle = () => {
    const newExpanded = !expanded;
    
    if (isControlled) {
      onExpandedChange?.(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }
    
    triggerHapticFeedback('light');
  };

  // Handle action click
  const handleActionClick = (action: typeof actions[0]) => {
    if (action.disabled) return;
    
    action.onClick();
    triggerHapticFeedback('medium');
    
    // Auto-collapse after action
    if (isControlled) {
      onExpandedChange?.(false);
    } else {
      setInternalExpanded(false);
    }
  };

  // Handle main action click
  const handleMainActionClick = () => {
    if (actions.length > 0) {
      handleToggle();
    } else {
      onMainAction?.();
      triggerHapticFeedback('medium');
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        if (expanded) {
          if (isControlled) {
            onExpandedChange?.(false);
          } else {
            setInternalExpanded(false);
          }
        }
      }
    };

    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expanded, isControlled, onExpandedChange]);

  // Size classes
  const sizeClasses = {
    sm: {
      main: 'w-12 h-12',
      action: 'w-10 h-10',
      icon: 'h-4 w-4',
      text: 'text-xs'
    },
    md: {
      main: 'w-14 h-14',
      action: 'w-12 h-12',
      icon: 'h-5 w-5',
      text: 'text-sm'
    },
    lg: {
      main: 'w-16 h-16',
      action: 'w-14 h-14',
      icon: 'h-6 w-6',
      text: 'text-base'
    }
  };

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const currentSize = sizeClasses[size];

  return (
    <div
      ref={fabRef}
      className={cn(
        'fixed z-50 flex flex-col-reverse items-end gap-3',
        positionClasses[position],
        className
      )}
    >
      {/* Action Items */}
      {expanded && actions.length > 0 && (
        <div className="flex flex-col-reverse gap-2 animate-in slide-in-from-bottom-2 duration-200">
          {actions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Action Label */}
              {showLabels && (
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap animate-in fade-in duration-200">
                  {action.label}
                </div>
              )}
              
              {/* Action Button */}
              <button
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={cn(
                  'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
                  'hover:scale-110 active:scale-95 touch-manipulation',
                  currentSize.action,
                  {
                    'bg-primary-600 hover:bg-primary-700 text-white': action.variant === 'default' || !action.variant,
                    'bg-red-600 hover:bg-red-700 text-white': action.variant === 'destructive',
                    'bg-gray-600 hover:bg-gray-700 text-white': action.variant === 'secondary',
                    'opacity-50 cursor-not-allowed': action.disabled,
                    'hover:shadow-xl': !action.disabled
                  }
                )}
                title={action.label}
              >
                {React.cloneElement(action.icon as React.ReactElement, {
                  className: cn(currentSize.icon, 'transition-transform duration-200')
                })}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={handleMainActionClick}
        className={cn(
          'rounded-full shadow-lg transition-all duration-200 flex items-center justify-center',
          'hover:scale-110 active:scale-95 touch-manipulation group',
          currentSize.main,
          {
            'bg-primary-600 hover:bg-primary-700 text-white': actions.length === 0,
            'bg-gray-600 hover:bg-gray-700 text-white': actions.length > 0,
            'rotate-45': expanded && actions.length > 0
          }
        )}
        title={actions.length > 0 ? (expanded ? 'Close actions' : 'Show actions') : 'Add'}
      >
        {actions.length > 0 ? (
          expanded ? (
            <X className={cn(currentSize.icon, 'transition-transform duration-200')} />
          ) : (
            <ChevronUp className={cn(currentSize.icon, 'transition-transform duration-200')} />
          )
        ) : (
          React.cloneElement(mainIcon as React.ReactElement, {
            className: cn(currentSize.icon, 'transition-transform duration-200')
          })
        )}
      </button>
    </div>
  );
};

export default FloatingActionButton;





