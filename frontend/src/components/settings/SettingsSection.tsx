import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { createAriaAttributes, generateAriaId, getAriaAttributes } from '../../utils/ariaUtils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
  onToggle?: (expanded: boolean) => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon,
  defaultExpanded = false,
  children,
  className,
  onToggle
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const sectionId = generateAriaId('section');
  const contentId = `${sectionId}-content`;
  const titleId = `${sectionId}-title`;
  const descriptionId = description ? `${sectionId}-description` : undefined;

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // Create ARIA attributes for the collapsible section
  const buttonAriaAttributes = createAriaAttributes.button({
    label: `Toggle ${title} section`,
    expanded,
    controls: contentId,
    describedBy: descriptionId,
  });

  const contentAriaAttributes = getAriaAttributes.collapsibleContent(
    contentId,
    titleId,
    !expanded
  );

  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 overflow-hidden", className)}>
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          "hover:bg-gray-50 active:bg-gray-100",
          "min-h-[44px] touch-target" // Ensure minimum touch target
        )}
        {...buttonAriaAttributes}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && (
            <div className="flex-shrink-0 text-gray-400" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-base font-semibold text-gray-900">
              {title}
            </h3>
            {description && (
              <p 
                id={descriptionId}
                className="text-sm text-gray-500 mt-0.5"
              >
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-2" aria-hidden="true">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            {...contentAriaAttributes}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { SettingsSection };
