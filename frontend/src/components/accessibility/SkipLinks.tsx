import React from 'react';
import { SkipLink } from '@/components/ui/VisuallyHidden';
import { cn } from '@/lib/utils';

interface SkipLinksProps {
  className?: string;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ className }) => {
  return (
    <div className={cn("skip-links", className)}>
      <SkipLink href="#main-content">
        Skip to main content
      </SkipLink>
      <SkipLink href="#navigation">
        Skip to navigation
      </SkipLink>
      <SkipLink href="#search">
        Skip to search
      </SkipLink>
      <SkipLink href="#footer">
        Skip to footer
      </SkipLink>
    </div>
  );
};

// Individual skip link component
interface SkipToContentProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipToContent: React.FC<SkipToContentProps> = ({
  targetId,
  children,
  className,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <SkipLink
      href={`#${targetId}`}
      onClick={handleClick}
      className={className}
    >
      {children}
    </SkipLink>
  );
};
