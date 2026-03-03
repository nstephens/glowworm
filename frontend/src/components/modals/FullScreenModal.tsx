import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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
}

/**
 * FullScreenModal - For image viewing, bulk operations, and immersive experiences
 *
 * Features:
 * - Full screen overlay
 * - Optional header with title
 * - Built-in close button (via DialogContent)
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
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-h-screen w-screen max-w-screen rounded-none border-0 p-0">
        {title && (
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
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
