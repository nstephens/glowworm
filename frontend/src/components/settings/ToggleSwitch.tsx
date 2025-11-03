import React from 'react';
import { cn } from '../../lib/utils';
import { createAriaAttributes, generateAriaId } from '../../utils/ariaUtils';

interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  hapticFeedback?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  description,
  checked,
  onChange,
  id,
  disabled = false,
  className,
  hapticFeedback = true
}) => {
  const handleToggle = () => {
    if (disabled) return;
    
    onChange(!checked);
    
    if (hapticFeedback && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const toggleId = id || generateAriaId('toggle');
  const descriptionId = description ? `${toggleId}-description` : undefined;

  // Create ARIA attributes for the switch
  const ariaAttributes = createAriaAttributes.switch({
    label,
    checked,
    describedBy: descriptionId,
    disabled,
  });

  return (
    <div className={cn("flex items-center justify-between py-4", className)}>
      <div className="flex-1 min-w-0 pr-4">
        <label
          htmlFor={toggleId}
          className="block text-base font-medium text-gray-900 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p 
            id={descriptionId}
            className="mt-1 text-sm text-gray-500"
          >
            {description}
          </p>
        )}
      </div>
      
      <button
        id={toggleId}
        {...ariaAttributes}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          "touch-target min-h-[44px] min-w-[44px] items-center justify-center",
          checked
            ? "bg-blue-600"
            : "bg-gray-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-6" : "translate-x-1"
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};

export { ToggleSwitch };
