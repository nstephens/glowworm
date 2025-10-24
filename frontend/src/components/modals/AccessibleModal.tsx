import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AccessibleModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  showCloseButton?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  showCloseButton = true,
  className,
  size = 'md',
  closeOnEscape = true,
  closeOnOverlayClick = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { getFocusableElements } = useFocusTrap(modalRef, {
    isActive: isOpen,
    initialFocus: true,
    returnFocusOnDeactivate: true,
    preventScroll: false,
  });
  
  const { prefersReducedMotion } = useReducedMotion();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeOnEscape, onOpenChange]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'sm:max-w-sm';
      case 'md':
        return 'sm:max-w-md';
      case 'lg':
        return 'sm:max-w-lg';
      case 'xl':
        return 'sm:max-w-xl';
      case 'full':
        return 'sm:max-w-full sm:h-full';
      default:
        return 'sm:max-w-md';
    }
  };

  const getAnimationClasses = () => {
    if (prefersReducedMotion) {
      return '';
    }
    
    return 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        className={cn(
          getSizeClasses(),
          getAnimationClasses(),
          className
        )}
        onPointerDownOutside={closeOnOverlayClick ? undefined : (e) => e.preventDefault()}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-description" : undefined}
      >
        <DialogHeader>
          <DialogTitle id="modal-title" className="text-lg font-semibold">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription id="modal-description" className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
          {showCloseButton && (
            <DialogClose
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          )}
        </DialogHeader>
        
        <div className="py-4">
          {children}
        </div>
        
        {(onConfirm || onCancel) && (
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            {onCancel && (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="mt-2 sm:mt-0"
              >
                {cancelText}
              </Button>
            )}
            {onConfirm && (
              <Button
                variant={isDestructive ? 'destructive' : 'default'}
                onClick={handleConfirm}
                className="mt-2 sm:mt-0"
              >
                {confirmText}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
