import React from 'react';
import { cn } from '@/lib/utils';

interface VisuallyHiddenProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  className,
  as: Component = 'span',
}) => {
  return (
    <Component
      className={cn(
        "absolute w-px h-px p-0 -m-px overflow-hidden",
        "whitespace-nowrap border-0",
        "clip-path-[inset(50%)]",
        className
      )}
      style={{
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        height: '1px',
        width: '1px',
        margin: '-1px',
        padding: 0,
        border: 0,
        overflow: 'hidden',
        position: 'absolute',
        whiteSpace: 'nowrap',
        wordWrap: 'normal',
      }}
    >
      {children}
    </Component>
  );
};

// Screen reader only text component
export const ScreenReaderOnly: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <VisuallyHidden className={className}>
      {children}
    </VisuallyHidden>
  );
};

// Skip link component for keyboard navigation
export const SkipLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className }) => {
  return (
    <a
      href={href}
      className={cn(
        "absolute top-0 left-0 z-50",
        "bg-primary text-primary-foreground",
        "px-4 py-2 rounded-md",
        "transform -translate-y-full",
        "focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring",
        "transition-transform duration-200",
        className
      )}
    >
      {children}
    </a>
  );
};
