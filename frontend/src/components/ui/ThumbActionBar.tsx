import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useThumbNavigation } from '../../utils/thumbNavigation';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { 
  Plus, 
  Upload, 
  Download, 
  Share, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Settings,
  Heart,
  Star,
  Eye,
  Copy,
  Move
} from 'lucide-react';

export interface ThumbActionBarProps {
  actions: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    action: () => void;
    type?: 'primary' | 'secondary' | 'destructive' | 'utility';
    disabled?: boolean;
    hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'error';
  }>;
  isLeftHanded?: boolean;
  hasBottomNav?: boolean;
  enableHaptic?: boolean;
  className?: string;
  maxVisibleActions?: number;
  showLabels?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'auto';
}

export const ThumbActionBar: React.FC<ThumbActionBarProps> = ({
  actions,
  isLeftHanded = false,
  hasBottomNav = true,
  enableHaptic = true,
  className,
  maxVisibleActions = 3,
  showLabels = false,
  position = 'auto'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { layoutClasses, getOptimalPlacement } = useThumbNavigation(isLeftHanded, hasBottomNav);

  // Determine position based on action types
  const primaryActions = actions.filter(action => action.type === 'primary');
  const secondaryActions = actions.filter(action => action.type === 'secondary');
  const destructiveActions = actions.filter(action => action.type === 'destructive');
  const utilityActions = actions.filter(action => action.type === 'utility' || !action.type);

  const visibleActions = isExpanded ? actions : actions.slice(0, maxVisibleActions);
  const hiddenActions = actions.slice(maxVisibleActions);

  const handleActionClick = (action: typeof actions[0]) => {
    if (action.disabled) return;

    // Trigger haptic feedback
    if (enableHaptic) {
      const hapticMap = {
        light: () => hapticPatterns.light(),
        medium: () => hapticPatterns.medium(),
        heavy: () => hapticPatterns.heavy(),
        success: () => hapticPatterns.success(),
        error: () => hapticPatterns.error()
      };
      
      const hapticType = action.hapticType || 'light';
      hapticMap[hapticType]();
    }

    // Execute action
    action.action();
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (enableHaptic) {
      hapticPatterns.selection();
    }
  };

  // Get position class
  const getPositionClass = () => {
    if (position !== 'auto') {
      return `thumb-${position.replace('-', '-')}`;
    }

    // Auto-determine position based on action types
    if (primaryActions.length > 0) {
      return isLeftHanded ? 'thumb-primary-left' : 'thumb-primary-right';
    } else if (secondaryActions.length > 0) {
      return 'thumb-secondary-center';
    } else {
      return isLeftHanded ? 'thumb-primary-left' : 'thumb-primary-right';
    }
  };

  return (
    <div className={cn('fixed z-50', getPositionClass(), className)}>
      {/* Main Action Button */}
      {visibleActions.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          {/* Secondary Actions */}
          {isExpanded && (
            <div className="flex flex-col gap-2 mb-2">
              {visibleActions.slice(1).map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled}
                  className={cn(
                    'touch-target flex items-center gap-2 px-3 py-2 rounded-full',
                    'bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200',
                    'hover:bg-white hover:shadow-xl transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    action.type === 'destructive' && 'text-red-600 hover:bg-red-50',
                    action.type === 'primary' && 'text-blue-600 hover:bg-blue-50',
                    action.type === 'secondary' && 'text-gray-600 hover:bg-gray-50',
                    action.type === 'utility' && 'text-gray-600 hover:bg-gray-50'
                  )}
                  title={action.label}
                >
                  {action.icon}
                  {showLabels && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {action.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={() => {
              if (visibleActions.length === 1) {
                handleActionClick(visibleActions[0]);
              } else {
                toggleExpanded();
              }
            }}
            className={cn(
              'touch-target w-14 h-14 rounded-full shadow-lg transition-all duration-200',
              'flex items-center justify-center text-white',
              'hover:scale-110 active:scale-95',
              primaryActions.length > 0 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            )}
            title={visibleActions[0]?.label || 'Actions'}
          >
            {visibleActions.length === 1 ? (
              visibleActions[0].icon
            ) : (
              <MoreHorizontal className="w-6 h-6" />
            )}
          </button>

          {/* Expand/Collapse Indicator */}
          {actions.length > maxVisibleActions && (
            <button
              onClick={toggleExpanded}
              className="touch-target w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition-all duration-200"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <MoreHorizontal className={cn('w-4 h-4 transition-transform duration-200', isExpanded && 'rotate-45')} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ThumbActionBar;
