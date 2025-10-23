import React from 'react';
import { cn } from '@/lib/utils';

export type CodeVariant = 'inline' | 'block';
export type CodeSize = 'xs' | 'sm' | 'base';

interface CodeProps {
  /** Code variant */
  variant?: CodeVariant;
  /** Font size */
  size?: CodeSize;
  /** Language for syntax highlighting hint */
  language?: string;
  /** Additional CSS classes */
  className?: string;
  /** Code content */
  children: React.ReactNode;
}

/**
 * Code component for displaying code with monospace font
 * 
 * @example
 * ```tsx
 * <Code>inline code</Code>
 * <Code variant="block" language="typescript">
 *   const greeting = "Hello, World!";
 * </Code>
 * ```
 */
export const Code: React.FC<CodeProps> = ({
  variant = 'inline',
  size = 'sm',
  language,
  className,
  children,
}) => {
  const sizeClasses: Record<CodeSize, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
  };

  if (variant === 'block') {
    return (
      <pre
        className={cn(
          'font-mono rounded-lg bg-muted p-4 overflow-x-auto',
          sizeClasses[size],
          className
        )}
        data-language={language}
      >
        <code className="font-mono">{children}</code>
      </pre>
    );
  }

  return (
    <code
      className={cn(
        'font-mono rounded bg-muted px-1.5 py-0.5',
        sizeClasses[size],
        className
      )}
    >
      {children}
    </code>
  );
};

