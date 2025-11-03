import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Share, 
  Trash2, 
  Star, 
  Copy, 
  Move, 
  Edit,
  Eye,
  MoreHorizontal,
  X,
  ChevronRight,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Badge } from './badge';

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'secondary' | 'success';
  disabled?: boolean;
  badge?: string | number;
  shortcut?: string;
}

interface QuickActionMenuProps {
  /** Whether the menu is visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Quick actions to display */
  actions?: QuickAction[];
  /** Grouped actions */
  actionGroups?: Array<{
    title: string;
    actions: QuickAction[];
  }>;
  /** Position of the menu */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  /** Size of the menu */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show descriptions */
  showDescriptions?: boolean;
  /** Whether to show shortcuts */
  showShortcuts?: boolean;
  /** Custom className */
  className?: string;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Whether to close on action click */
  closeOnAction?: boolean;
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  visible = false,
  onVisibilityChange,
  actions = [],
  actionGroups = [],
  position = 'bottom-right',
  size = 'md',
  showDescriptions = true,
  showShortcuts = false,
  className,
  hapticFeedback = true,
  closeOnAction = true
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
  const handleActionClick = (action: QuickAction) => {
    if (action.disabled) return;
    
    action.onClick();
    triggerHapticFeedback('medium');
    
    if (closeOnAction) {
      onVisibilityChange?.(false);
    }
  };

  // Handle close
  const handleClose = () => {
    onVisibilityChange?.(false);
    triggerHapticFeedback('light');
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && visible) {
        handleClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: {
      menu: 'w-64',
      action: 'px-3 py-2',
      icon: 'h-4 w-4',
      text: 'text-sm',
      description: 'text-xs'
    },
    md: {
      menu: 'w-72',
      action: 'px-4 py-3',
      icon: 'h-5 w-5',
      text: 'text-base',
      description: 'text-sm'
    },
    lg: {
      menu: 'w-80',
      action: 'px-5 py-4',
      icon: 'h-6 w-6',
      text: 'text-lg',
      description: 'text-base'
    }
  };

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
  };

  const currentSize = sizeClasses[size];

  // Flatten all actions
  const allActions = actionGroups.length > 0 
    ? actionGroups.flatMap(group => group.actions)
    : actions;

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 transition-all duration-300 ease-out',
        positionClasses[position],
        className
      )}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200" />
      
      {/* Menu */}
      <div
        className={cn(
          'bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300',
          currentSize.menu
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Quick Actions</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="max-h-96 overflow-y-auto">
          {actionGroups.length > 0 ? (
            // Grouped actions
            <div className="divide-y divide-gray-100">
              {actionGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="p-2">
                  <h4 className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {group.title}
                  </h4>
                  <div className="space-y-1">
                    {group.actions.map((action, actionIndex) => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        size={currentSize}
                        showDescriptions={showDescriptions}
                        showShortcuts={showShortcuts}
                        onClick={() => handleActionClick(action)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Flat actions
            <div className="space-y-1 p-2">
              {allActions.map((action, index) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  size={currentSize}
                  showDescriptions={showDescriptions}
                  showShortcuts={showShortcuts}
                  onClick={() => handleActionClick(action)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {allActions.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No actions available
          </div>
        )}
      </div>
    </div>
  );
};

// Action item component
const ActionItem: React.FC<{
  action: QuickAction;
  size: any;
  showDescriptions: boolean;
  showShortcuts: boolean;
  onClick: () => void;
}> = ({ action, size, showDescriptions, showShortcuts, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={cn(
        'w-full flex items-center space-x-3 rounded-lg transition-all duration-200 touch-manipulation',
        size.action,
        {
          'hover:bg-gray-50 active:bg-gray-100': !action.disabled,
          'opacity-50 cursor-not-allowed': action.disabled,
          'text-red-600 hover:bg-red-50': action.variant === 'destructive',
          'text-green-600 hover:bg-green-50': action.variant === 'success',
          'text-blue-600 hover:bg-blue-50': action.variant === 'secondary'
        }
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {React.cloneElement(action.icon as React.ReactElement, {
          className: cn(size.icon, 'transition-transform duration-200')
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between">
          <span className={cn('font-medium truncate', size.text)}>
            {action.label}
          </span>
          <div className="flex items-center space-x-2">
            {action.badge && (
              <Badge variant="secondary" className="text-xs">
                {action.badge}
              </Badge>
            )}
            {showShortcuts && action.shortcut && (
              <span className="text-xs text-gray-400 font-mono">
                {action.shortcut}
              </span>
            )}
          </div>
        </div>
        {showDescriptions && action.description && (
          <p className={cn('text-gray-500 truncate mt-1', size.description)}>
            {action.description}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </button>
  );
};

export default QuickActionMenu;




