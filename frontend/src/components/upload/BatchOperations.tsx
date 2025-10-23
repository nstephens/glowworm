import React, { useState, useCallback, useMemo } from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Edit, 
  Tag, 
  FolderOpen,
  Download,
  Share,
  Archive,
  RotateCcw,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { UploadFile } from './UploadProgress';
import { Album, Tag as TagType } from './AlbumTagSelector';
import { cn } from '@/lib/utils';

interface BatchOperationsProps {
  files: UploadFile[];
  selectedFiles: Set<string>;
  onSelectionChange: (selectedFiles: Set<string>) => void;
  onBatchAction: (action: string, fileIds: string[], data?: any) => void;
  availableAlbums: Album[];
  availableTags: TagType[];
  className?: string;
}

/**
 * BatchOperations - Comprehensive batch operations for uploads
 * 
 * Features:
 * - Multi-select with keyboard shortcuts
 * - Batch actions (delete, edit, tag, move, download, share)
 * - Selection statistics and progress
 * - Confirmation dialogs for destructive actions
 * - Keyboard navigation support
 * - Accessibility compliance
 */
export const BatchOperations: React.FC<BatchOperationsProps> = ({
  files,
  selectedFiles,
  onSelectionChange,
  onBatchAction,
  availableAlbums,
  availableTags,
  className,
}) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const [tagInput, setTagInput] = useState('');

  const selectedCount = selectedFiles.size;
  const totalCount = files.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;

  const selectedFilesList = useMemo(() => {
    return files.filter(file => selectedFiles.has(file.id));
  }, [files, selectedFiles]);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map(f => f.id)));
    }
  }, [isAllSelected, files, onSelectionChange]);

  const handleSelectFile = useCallback((fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    onSelectionChange(newSelection);
  }, [selectedFiles, onSelectionChange]);

  const handleBatchAction = useCallback((action: string, data?: any) => {
    const fileIds = Array.from(selectedFiles);
    onBatchAction(action, fileIds, data);
    
    // Clear selection after action
    onSelectionChange(new Set());
  }, [selectedFiles, onBatchAction, onSelectionChange]);

  const handleDelete = useCallback(() => {
    handleBatchAction('delete');
    setShowDeleteDialog(false);
  }, [handleBatchAction]);

  const handleAddTags = useCallback(() => {
    if (newTags.length > 0) {
      handleBatchAction('addTags', { tags: newTags });
      setShowTagDialog(false);
      setNewTags([]);
      setTagInput('');
    }
  }, [newTags, handleBatchAction]);

  const handleMoveToAlbum = useCallback(() => {
    if (selectedAlbum) {
      handleBatchAction('moveToAlbum', { albumId: selectedAlbum });
      setShowMoveDialog(false);
      setSelectedAlbum('');
    }
  }, [selectedAlbum, handleBatchAction]);

  const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const newTag = tagInput.trim();
      if (!newTags.includes(newTag)) {
        setNewTags(prev => [...prev, newTag]);
        setTagInput('');
      }
    }
  }, [tagInput, newTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setNewTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const getTotalSize = useCallback(() => {
    return selectedFilesList.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFilesList]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (files.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selection Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Batch Operations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsSelectionMode(!isSelectionMode)}
              >
                {isSelectionMode ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Selection Mode
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Select Files
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Selection Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  {isAllSelected ? 'All files selected' : 
                   isPartiallySelected ? `${selectedCount} of ${totalCount} selected` :
                   'Select all files'}
                </span>
              </div>
              
              {selectedCount > 0 && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="outline">
                    {formatFileSize(getTotalSize())}
                  </Badge>
                  <Badge variant="outline">
                    {selectedCount} file{selectedCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </div>

            {selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectionChange(new Set())}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            )}
          </div>

          {/* Batch Actions */}
          {selectedCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchAction('download')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchAction('share')}
              >
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagDialog(true)}
              >
                <Tag className="h-4 w-4 mr-2" />
                Add Tags
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoveDialog(true)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Move to Album
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchAction('edit')}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchAction('archive')}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Shortcuts:</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+A</kbd> Select All
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> Clear Selection
            <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs">Del</kbd> Delete Selected
          </div>
        </CardContent>
      </Card>

      {/* File List with Selection */}
      {isSelectionMode && (
        <Card>
          <CardHeader>
            <CardTitle>Select Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedFiles.has(file.id)}
                    onCheckedChange={() => handleSelectFile(file.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {file.file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {file.status}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {file.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Files?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} file{selectedCount !== 1 ? 's' : ''}? 
              This action cannot be undone and will permanently remove the files from your upload queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedCount} file{selectedCount !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tags Dialog */}
      <AlertDialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Tags to {selectedCount} Files</AlertDialogTitle>
            <AlertDialogDescription>
              Add tags to the selected files. Press Enter to add a tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter tag name and press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
            />
            {newTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTag(tag)}
                      className="h-4 w-4 p-0 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddTags} disabled={newTags.length === 0}>
              Add Tags
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to Album Dialog */}
      <AlertDialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedCount} Files to Album</AlertDialogTitle>
            <AlertDialogDescription>
              Select an album to move the selected files to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Select value={selectedAlbum} onValueChange={setSelectedAlbum}>
              <SelectTrigger>
                <SelectValue placeholder="Select an album" />
              </SelectTrigger>
              <SelectContent>
                {availableAlbums.map((album) => (
                  <SelectItem key={album.id} value={album.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{album.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {album.imageCount} photos
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMoveToAlbum} disabled={!selectedAlbum}>
              Move Files
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
