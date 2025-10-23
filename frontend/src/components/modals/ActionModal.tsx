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

interface ActionModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title: string;
  /** Optional description */
  description?: string;
  /** Modal content (typically a form) */
  children: React.ReactNode;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Submit handler */
  onSubmit?: () => void | Promise<void>;
  /** Whether submit is in progress */
  isSubmitting?: boolean;
  /** Disable submit button */
  submitDisabled?: boolean;
  /** Submit button variant */
  submitVariant?: 'default' | 'success' | 'destructive';
}

/**
 * ActionModal - For forms and user actions
 * 
 * Features:
 * - Submit and cancel buttons
 * - Loading state support
 * - Form submission handling
 * - ESC to close
 * - Click outside to close
 * 
 * @example
 * ```tsx
 * <ActionModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Create New Album"
 *   description="Enter album details"
 *   submitText="Create"
 *   onSubmit={handleSubmit}
 *   isSubmitting={isLoading}
 * >
 *   <form onSubmit={handleSubmit}>
 *     <Input placeholder="Album name" />
 *   </form>
 * </ActionModal>
 * ```
 */
export const ActionModal: React.FC<ActionModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitText = 'Submit',
  cancelText = 'Cancel',
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  submitVariant = 'default',
}) => {
  const handleSubmit = async () => {
    if (onSubmit) {
      await onSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="py-4">{children}</div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={submitVariant}
            onClick={handleSubmit}
            disabled={submitDisabled || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

