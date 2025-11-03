import React, { forwardRef } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { useTouchTarget } from '../../hooks/useTouchTarget';

interface TouchLinkProps extends Omit<LinkProps, 'onClick'> {
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onTouchStart?: (event: React.TouchEvent<HTMLAnchorElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<HTMLAnchorElement>) => void;
  enableHaptic?: boolean;
  enableVisualFeedback?: boolean;
  touchTargetSize?: number;
  autoAudit?: boolean;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}

const TouchLink = forwardRef<HTMLAnchorElement, TouchLinkProps>(
  ({
    onClick,
    onTouchStart,
    onTouchEnd,
    enableHaptic = true,
    enableVisualFeedback = true,
    touchTargetSize = 44,
    autoAudit = true,
    className,
    children,
    external = false,
    ...props
  }, ref) => {
    const { elementRef, isCompliant } = useTouchTarget({
      minimumSize: touchTargetSize,
      enableHapticFeedback: enableHaptic,
      hapticType: 'light',
      autoFix: true,
      auditOnMount: autoAudit
    });

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Trigger haptic feedback
      if (enableHaptic) {
        hapticPatterns.navigation();
      }

      // Call original onClick
      onClick?.(event);
    };

    const handleTouchStart = (event: React.TouchEvent<HTMLAnchorElement>) => {
      // Add visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = 'scale(0.95)';
        event.currentTarget.style.opacity = '0.9';
      }

      onTouchStart?.(event);
    };

    const handleTouchEnd = (event: React.TouchEvent<HTMLAnchorElement>) => {
      // Remove visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }

      onTouchEnd?.(event);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Add visual feedback for mouse users
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = 'scale(0.95)';
        event.currentTarget.style.opacity = '0.9';
      }
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Remove visual feedback
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }
    };

    const handleMouseLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Remove visual feedback on mouse leave
      if (enableVisualFeedback) {
        event.currentTarget.style.transform = '';
        event.currentTarget.style.opacity = '';
      }
    };

    // Combine refs
    const combinedRef = (node: HTMLAnchorElement | null) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      if (elementRef.current !== node) {
        (elementRef as React.MutableRefObject<HTMLAnchorElement | null>).current = node;
      }
    };

    const linkProps = external
      ? { ...props, target: '_blank', rel: 'noopener noreferrer' }
      : props;

    return (
      <Link
        ref={combinedRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'touch-target transition-all duration-100 ease-out inline-flex items-center justify-center',
          !isCompliant && 'ring-2 ring-orange-400 ring-opacity-50',
          className
        )}
        style={{
          minWidth: `${touchTargetSize}px`,
          minHeight: `${touchTargetSize}px`,
          ...props.style
        }}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }
);

TouchLink.displayName = 'TouchLink';

export { TouchLink };
