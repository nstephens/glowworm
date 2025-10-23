import React, { useState } from 'react';
import { 
  Download, 
  Share, 
  Edit, 
  Trash, 
  Copy, 
  Archive,
  Tag,
  FolderOpen,
  MoreHorizontal,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBulkSelection } from './BulkSelectionProvider';
import { Image } from './MasonryGallery';
import { cn } from '@/lib/utils';

interface BulkActionsToolbarProps {
  selectedImages: Image[];
  onBulkAction: (action: string, images: Image[]) => void;
  className?: string;
}

/**
 * BulkActionsToolbar - Enhanced bulk actions interface
 * 
 * Features:
 * - Progress indicators for long-running operations
 * - Confirmation dialogs for destructive actions
 * - Grouped action buttons
 * - Selection statistics
 * - Keyboard shortcuts display
 * - Responsive design
 */
export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedImages,
  onBulkAction,
  className,
}) => {
  const { clearSelection, getSelectionCount } = useBulkSelection();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const selectionCount = getSelectionCount();
  const hasSelection = selectionCount > 0;

  const handleAction = async (action: string) => {
    if (!hasSelection) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress for long-running operations
      if (['download', 'archive', 'move'].includes(action)) {
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsProcessing(false);
              setProgress(0);
              return 100;
            }
            return prev + 10;
          });
        }, 200);

        // Simulate operation delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        clearInterval(interval);
      }

      onBulkAction(action, selectedImages);
      setIsProcessing(false);
      setProgress(0);
    } catch (error) {
      console.error(`Bulk action ${action} failed:`, error);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(false);
    handleAction('delete');
  };

  const handleArchive = () => {
    setShowArchiveDialog(false);
    handleAction('archive');
  };

  const getFileSize = (images: Image[]) => {
    const totalPixels = images.reduce((sum, img) => sum + (img.width * img.height), 0);
    const megapixels = totalPixels / 1000000;
    return `${megapixels.toFixed(1)}MP`;
  };

  const getAlbums = (images: Image[]) => {
    const albums = [...new Set(images.map(img => img.album).filter(Boolean))];
    return albums.length;
  };

  if (!hasSelection) return null;

  return (
    <>
      <div className={cn(
        "sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b",
        "transition-all duration-200",
        className
      )}>
        <div className="p-4">
          {/* Selection info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  {selectionCount} image{selectionCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Badge variant="outline">{getFileSize(selectedImages)}</Badge>
                <Badge variant="outline">{getAlbums(selectedImages)} albums</Badge>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('download')}
              disabled={isProcessing}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('share')}
              disabled={isProcessing}
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('edit')}
              disabled={isProcessing}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('copy')}
              disabled={isProcessing}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                >
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleAction('tags')}>
                  <Tag className="h-4 w-4 mr-2" />
                  Manage Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction('move')}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Move to Album
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Shortcuts:</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+A</kbd> Select All
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> Clear
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Del</kbd> Delete
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Images?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectionCount} image{selectionCount !== 1 ? 's' : ''}? 
              This action cannot be undone and will permanently remove the images from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectionCount} image{selectionCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Archive Images?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archive {selectionCount} image{selectionCount !== 1 ? 's' : ''}? 
              Archived images will be moved to your archive folder and hidden from the main gallery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive {selectionCount} image{selectionCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
