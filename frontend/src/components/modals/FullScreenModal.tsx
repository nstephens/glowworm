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
import { X } from 'lucide-react';

interface FullScreenModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Optional description */
  description?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Custom footer */
  footer?: React.ReactNode;
  /** Show close button in header */
  showCloseButton?: boolean;
  /** Close button text */
  closeText?: string;
}

/**
 * FullScreenModal - For image viewing, bulk operations, and immersive experiences
 * 
 * Features:
 * - Full screen overlay
 * - Optional header with title
 * - Close button in header
 * - ESC to close
 * - Click outside to close
 * - Mobile-optimized
 * 
 * @example
 * ```tsx
 * <FullScreenModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Image Gallery"
 *   showCloseButton
 * >
 *   <ImageGallery images={images} />
 * </FullScreenModal>
 * ```
 */
export const FullScreenModal: React.FC<FullScreenModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  closeText = 'Close',
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-h-screen w-screen max-w-screen rounded-none border-0 p-0">
        {(title || showCloseButton) && (
          <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
            <div className="flex-1">
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>
        )}
        <div className="flex-1 overflow-auto p-6">{children}</div>
        {footer && (
          <DialogFooter className="border-t px-6 py-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
