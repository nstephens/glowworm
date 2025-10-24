import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LiveRegionProps {
  children: React.ReactNode;
  className?: string;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  className,
  politeness = 'polite',
  atomic = false,
}) => {
  return (
    <div
      className={cn("sr-only", className)}
      aria-live={politeness}
      aria-atomic={atomic}
      role="status"
    >
      {children}
    </div>
  );
};

// Hook for managing live region announcements
export function useLiveRegion() {
  const [announcement, setAnnouncement] = useState<string>('');
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setAnnouncement(message);
    setIsAnnouncing(true);

    // Clear announcement after a short delay
    timeoutRef.current = setTimeout(() => {
      setAnnouncement('');
      setIsAnnouncing(false);
    }, 1000);
  };

  const announcePolite = (message: string) => announce(message, 'polite');
  const announceAssertive = (message: string) => announce(message, 'assertive');

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    announcement,
    isAnnouncing,
    announce,
    announcePolite,
    announceAssertive,
  };
}

// Component for announcing dynamic content changes
interface AnnouncementProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  className?: string;
}

export const Announcement: React.FC<AnnouncementProps> = ({
  message,
  politeness = 'polite',
  className,
}) => {
  return (
    <LiveRegion politeness={politeness} className={className}>
      {message}
    </LiveRegion>
  );
};

// Hook for managing loading states with announcements
export function useLoadingAnnouncements() {
  const { announcePolite, announceAssertive } = useLiveRegion();

  const announceLoading = (item: string) => {
    announcePolite(`Loading ${item}...`);
  };

  const announceLoaded = (item: string) => {
    announcePolite(`${item} loaded successfully`);
  };

  const announceError = (item: string, error?: string) => {
    announceAssertive(`Error loading ${item}${error ? `: ${error}` : ''}`);
  };

  const announceSuccess = (action: string) => {
    announcePolite(`${action} completed successfully`);
  };

  const announceFailure = (action: string, error?: string) => {
    announceAssertive(`${action} failed${error ? `: ${error}` : ''}`);
  };

  return {
    announceLoading,
    announceLoaded,
    announceError,
    announceSuccess,
    announceFailure,
  };
}
