import React, { forwardRef } from 'react';
import { Button, ButtonProps } from './button';
import { cn } from '../../lib/utils';
import { hapticPatterns, HapticFeedbackType } from '../../utils/hapticFeedback';
import { useTouchTarget } from '../../hooks/useTouchTarget';

interface TouchButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTouchStart?: (event: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLButtonElement>) => void;
  hapticType?: HapticFeedbackType;
  enableHaptic?: boolean;
  enableVisualFeedback?: boolean;
  touchTargetSize?: number;
  autoAudit?: boolean;
  className?: string;
  children: React.ReactNode;
}

const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  ({
    onClick,
    onTouchStart,
    onTouchEnd,
    hapticType = 'light',
    enableHaptic = true,
    enableVisualFeedback = true,
    touchTargetSize = 44,
    autoAudit = true,
    className,
    children,
    disabled,
    ...props
  }, ref) => {
    const { elementRef, isCompliant, addTouchTarget } = useTouchTarget({
      minimumSize: touchTargetSize,
      enableHapticFeedback: enableHaptic,
      hapticType,
      autoFix: true,
      auditOnMount: autoAudit
    });

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Trigger haptic feedback
      if (enableHaptic) {
        hapticPatterns.buttonPress();
      }

      // Call original onClick
      onClick?.(event);
    };

    const handleTouchStart = (event: React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Add visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = 'scale(0.95)';
        event.currentTarget.style.opacity = '0.9';
      }

      onTouchStart?.(event);
    };

    const handleTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Remove visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }

      onTouchEnd?.(event);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Add visual feedback for mouse users
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = 'scale(0.95)';
        event.currentTarget.style.opacity = '0.9';
      }
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Remove visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      // Remove visual feedback on mouse leave
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }
    };

    // Combine refs
    const combinedRef = (node: HTMLButtonElement | null) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      if (elementRef.current !== node) {
        (elementRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    };

    return (
      <Button
        ref={combinedRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        className={cn(
          'touch-target transition-all duration-100 ease-out',
          !isCompliant && 'ring-2 ring-orange-400 ring-opacity-50',
          className
        )}
        style={{
          minWidth: `${touchTargetSize}px`,
          minHeight: `${touchTargetSize}px`,
          ...props.style
        }}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TouchButton.displayName = 'TouchButton';

export { TouchButton };
