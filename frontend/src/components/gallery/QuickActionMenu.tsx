import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MoreHorizontal, 
  Download, 
  Share, 
  Trash2, 
  Copy, 
  Move, 
  Heart, 
  Star,
  Edit,
  Archive,
  Tag
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  group?: string;
}

interface QuickActionMenuProps {
  actions?: QuickAction[];
  onAction?: (actionId: string) => void;
  hapticFeedback?: boolean;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
}

const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  actions = [],
  onAction,
  hapticFeedback = true,
  className,
  position = 'bottom-right',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const triggerHapticFeedback = () => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const defaultActions: QuickAction[] = [
    {
      id: 'download',
      label: 'Download',
      icon: <Download className="w-4 h-4" />,
      onClick: () => console.log('Download'),
      group: 'primary',
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share className="w-4 h-4" />,
      onClick: () => console.log('Share'),
      group: 'primary',
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="w-4 h-4" />,
      onClick: () => console.log('Copy'),
      group: 'secondary',
    },
    {
      id: 'move',
      label: 'Move',
      icon: <Move className="w-4 h-4" />,
      onClick: () => console.log('Move'),
      group: 'secondary',
    },
    {
      id: 'favorite',
      label: 'Favorite',
      icon: <Heart className="w-4 h-4" />,
      onClick: () => console.log('Favorite'),
      group: 'secondary',
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: <Edit className="w-4 h-4" />,
      onClick: () => console.log('Edit'),
      group: 'secondary',
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <Archive className="w-4 h-4" />,
      onClick: () => console.log('Archive'),
      group: 'secondary',
    },
    {
      id: 'tag',
      label: 'Add Tag',
      icon: <Tag className="w-4 h-4" />,
      onClick: () => console.log('Add Tag'),
      group: 'secondary',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => console.log('Delete'),
      variant: 'destructive',
      group: 'danger',
    },
  ];

  const menuActions = actions.length > 0 ? actions : defaultActions;

  // Group actions by category
  const groupedActions = menuActions.reduce((acc, action) => {
    const group = action.group || 'primary';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  const handleAction = (action: QuickAction) => {
    triggerHapticFeedback();
    action.onClick();
    onAction?.(action.id);
    setIsOpen(false);
  };

  const toggleMenu = () => {
    triggerHapticFeedback();
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'bottom-0 right-0';
      case 'bottom-left':
        return 'bottom-0 left-0';
      case 'top-right':
        return 'top-0 right-0';
      case 'top-left':
        return 'top-0 left-0';
      default:
        return 'bottom-0 right-0';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-8 h-8';
      case 'md':
        return 'w-10 h-10';
      case 'lg':
        return 'w-12 h-12';
      default:
        return 'w-10 h-10';
    }
  };

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMenu}
        className={cn(
          "rounded-full shadow-lg",
          getSizeClasses(),
          isOpen && "bg-blue-600 text-white border-blue-600"
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {/* Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              "absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200",
              "min-w-48 max-w-64",
              position.includes('bottom') ? 'mb-2' : 'mt-2',
              position.includes('right') ? 'right-0' : 'left-0',
              getPositionClasses()
            )}
          >
            <div className="p-2">
              {Object.entries(groupedActions).map(([group, groupActions]) => (
                <div key={group} className="mb-2 last:mb-0">
                  {group !== 'primary' && (
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {group}
                    </div>
                  )}
                  <div className="space-y-1">
                    {groupActions.map((action) => (
                      <Button
                        key={action.id}
                        variant={action.variant || 'ghost'}
                        size="sm"
                        onClick={() => handleAction(action)}
                        disabled={action.disabled}
                        className={cn(
                          "w-full justify-start",
                          action.variant === 'destructive' && "text-red-600 hover:text-red-700 hover:bg-red-50"
                        )}
                      >
                        {action.icon}
                        <span className="ml-2">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                  {group !== 'danger' && Object.keys(groupedActions).length > 1 && (
                    <div className="border-t border-gray-100 my-2" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { QuickActionMenu };







