import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface InfoModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Optional description */
  description?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Custom footer (defaults to OK button) */
  footer?: React.ReactNode;
  /** Show info icon */
  showIcon?: boolean;
}

/**
 * InfoModal - For displaying information to users
 * 
 * Features:
 * - Simple OK button by default
 * - Optional info icon
 * - Centered content
 * - ESC to close
 * - Click outside to close
 * 
 * @example
 * ```tsx
 * <InfoModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Information"
 *   description="Here's some important information"
 * >
 *   <p>Detailed information goes here...</p>
 * </InfoModal>
 * ```
 */
export const InfoModal: React.FC<InfoModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showIcon = true,
}) => {
  const defaultFooter = (
    <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
      OK
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {showIcon && (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Info className="h-6 w-6 text-primary" />
            </div>
          )}
          <DialogTitle className="text-center sm:text-left">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-center sm:text-left">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">{children}</div>
        <DialogFooter className="sm:justify-end">
          {footer || defaultFooter}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

