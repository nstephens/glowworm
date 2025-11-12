import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Share, 
  Trash2, 
  Copy, 
  Move, 
  X, 
  CheckSquare, 
  Square,
  MoreHorizontal,
  Heart,
  Star
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface MobileActionBarProps {
  selectedCount: number;
  totalCount: number;
  visible: boolean;
  primaryActions?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    disabled?: boolean;
  }>;
  secondaryActions?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    disabled?: boolean;
  }>;
  onClearSelection: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  hapticFeedback?: boolean;
  className?: string;
}

const MobileActionBar: React.FC<MobileActionBarProps> = ({
  selectedCount,
  totalCount,
  visible,
  primaryActions = [],
  secondaryActions = [],
  onClearSelection,
  onSelectAll,
  allSelected,
  hapticFeedback = true,
  className,
}) => {
  const triggerHapticFeedback = () => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleAction = (action: () => void) => {
    triggerHapticFeedback();
    action();
  };

  const defaultPrimaryActions = [
    {
      id: 'download',
      label: 'Download',
      icon: <Download className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Download selected')),
      variant: 'default' as const,
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Share selected')),
      variant: 'outline' as const,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Delete selected')),
      variant: 'destructive' as const,
    },
  ];

  const defaultSecondaryActions = [
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Copy selected')),
      variant: 'ghost' as const,
    },
    {
      id: 'move',
      label: 'Move',
      icon: <Move className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Move selected')),
      variant: 'ghost' as const,
    },
    {
      id: 'favorite',
      label: 'Favorite',
      icon: <Heart className="w-4 h-4" />,
      onClick: () => handleAction(() => console.log('Favorite selected')),
      variant: 'ghost' as const,
    },
  ];

  const actions = primaryActions.length > 0 ? primaryActions : defaultPrimaryActions;
  const moreActions = secondaryActions.length > 0 ? secondaryActions : defaultSecondaryActions;

  if (!visible || selectedCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          "fixed bottom-20 left-0 right-0 z-50",
          "bg-white border-t border-gray-200 shadow-lg",
          "px-4 py-3",
          className
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(onSelectAll)}
              className="flex items-center space-x-2"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </Button>
            
            <div className="text-sm text-gray-600">
              {selectedCount} of {totalCount} selected
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction(onClearSelection)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Primary Actions */}
          {actions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="flex-1 min-w-0"
            >
              {action.icon}
              <span className="ml-2 hidden sm:inline">{action.label}</span>
            </Button>
          ))}

          {/* More Actions Dropdown */}
          {moreActions.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="px-3"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${(selectedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export { MobileActionBar };








