import React from 'react';
import { Button } from '@/components/ui/button';
import { useHighContrast } from '@/hooks/useHighContrast';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HighContrastToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Toggle component for testing high contrast mode
 * Note: This is for development/testing purposes only
 * In production, high contrast mode should be controlled by system preferences
 */
export const HighContrastToggle: React.FC<HighContrastToggleProps> = ({
  className,
  showLabel = true,
  size = 'md',
}) => {
  const { isHighContrast } = useHighContrast();

  const toggleHighContrast = () => {
    // This is a development utility - in production, high contrast should be system-controlled
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (isHighContrast) {
        root.classList.remove('force-high-contrast');
      } else {
        root.classList.add('force-high-contrast');
      }
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 px-2 text-xs';
      case 'lg':
        return 'h-12 px-4 text-base';
      default:
        return 'h-10 px-3 text-sm';
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleHighContrast}
      className={cn(
        'gap-2 transition-all duration-200',
        getSizeClasses(),
        isHighContrast && 'bg-primary text-primary-foreground',
        className
      )}
      aria-label={isHighContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'}
      title={isHighContrast ? 'High contrast mode is active' : 'Click to enable high contrast mode'}
    >
      {isHighContrast ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="hidden sm:inline">
          {isHighContrast ? 'High Contrast' : 'Normal Contrast'}
        </span>
      )}
    </Button>
  );
};

/**
 * High contrast indicator component
 * Shows current contrast mode status
 */
export const HighContrastIndicator: React.FC<{
  className?: string;
  showIcon?: boolean;
}> = ({ className, showIcon = true }) => {
  const { isHighContrast } = useHighContrast();

  if (!isHighContrast) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 text-xs font-medium',
        'bg-primary text-primary-foreground rounded-md',
        'border-2 border-current',
        className
      )}
      role="status"
      aria-label="High contrast mode is active"
    >
      {showIcon && <Eye className="h-3 w-3" />}
      <span>High Contrast</span>
    </div>
  );
};
