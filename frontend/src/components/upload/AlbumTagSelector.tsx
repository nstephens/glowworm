import React, { useState, useMemo } from 'react';
import { 
  FolderOpen, 
  Tag, 
  Plus, 
  X, 
  Check,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface Album {
  id: string;
  name: string;
  description?: string;
  imageCount: number;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

interface AlbumTagSelectorProps {
  selectedAlbum?: Album;
  selectedTags: Tag[];
  availableAlbums: Album[];
  availableTags: Tag[];
  onAlbumChange: (album: Album | undefined) => void;
  onTagsChange: (tags: Tag[]) => void;
  onCreateAlbum?: (name: string, description?: string) => void;
  onCreateTag?: (name: string, color?: string) => void;
  className?: string;
}

/**
 * AlbumTagSelector - Component for selecting albums and tags for uploads
 * 
 * Features:
 * - Album selection with search
 * - Tag selection with autocomplete
 * - Create new albums and tags
 * - Visual tag colors
 * - Batch operations
 * - Accessibility support
 */
export const AlbumTagSelector: React.FC<AlbumTagSelectorProps> = ({
  selectedAlbum,
  selectedTags,
  availableAlbums,
  availableTags,
  onAlbumChange,
  onTagsChange,
  onCreateAlbum,
  onCreateTag,
  className,
}) => {
  const [albumSearch, setAlbumSearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');

  // Filter albums based on search
  const filteredAlbums = useMemo(() => {
    if (!albumSearch) return availableAlbums;
    return availableAlbums.filter(album =>
      album.name.toLowerCase().includes(albumSearch.toLowerCase())
    );
  }, [availableAlbums, albumSearch]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!tagSearch) return availableTags;
    return availableTags.filter(tag =>
      tag.name.toLowerCase().includes(tagSearch.toLowerCase())
    );
  }, [availableTags, tagSearch]);

  const handleAlbumSelect = (albumId: string) => {
    const album = availableAlbums.find(a => a.id === albumId);
    onAlbumChange(album);
  };

  const handleTagToggle = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleCreateAlbum = () => {
    if (newAlbumName.trim() && onCreateAlbum) {
      onCreateAlbum(newAlbumName.trim(), newAlbumDescription.trim() || undefined);
      setNewAlbumName('');
      setNewAlbumDescription('');
      setShowCreateAlbum(false);
    }
  };

  const handleCreateTag = () => {
    if (newTagName.trim() && onCreateTag) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowCreateTag(false);
    }
  };

  const tagColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Album Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Album
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedAlbum?.id} onValueChange={handleAlbumSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select an album (optional)" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <Input
                  placeholder="Search albums..."
                  value={albumSearch}
                  onChange={(e) => setAlbumSearch(e.target.value)}
                  className="mb-2"
                />
              </div>
              {filteredAlbums.map((album) => (
                <SelectItem key={album.id} value={album.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{album.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {album.imageCount} photos
                    </Badge>
                  </div>
                </SelectItem>
              ))}
              {filteredAlbums.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">
                  No albums found
                </div>
              )}
            </SelectContent>
          </Select>

          {selectedAlbum && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium">{selectedAlbum.name}</div>
                {selectedAlbum.description && (
                  <div className="text-sm text-muted-foreground">
                    {selectedAlbum.description}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAlbumChange(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {onCreateAlbum && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateAlbum(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Album
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tag Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Search tags..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
            />
            
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredTags.map((tag) => {
                const isSelected = selectedTags.some(t => t.id === tag.id);
                return (
                  <Button
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTagToggle(tag)}
                    className={cn(
                      "h-8",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    <span
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    {tag.name}
                    <Badge variant="secondary" className="ml-2">
                      {tag.usageCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {filteredTags.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No tags found
              </div>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Selected Tags:</div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTagToggle(tag)}
                      className="h-4 w-4 p-0 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {onCreateTag && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateTag(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Tag
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Create Album Dialog */}
      {showCreateAlbum && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Album</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Album name"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newAlbumDescription}
              onChange={(e) => setNewAlbumDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateAlbum} disabled={!newAlbumName.trim()}>
                Create Album
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateAlbum(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Tag Dialog */}
      {showCreateTag && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Tag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <div className="space-y-2">
              <div className="text-sm font-medium">Tag Color:</div>
              <div className="flex gap-2">
                {tagColors.map((color) => (
                  <Button
                    key={color}
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      "w-8 h-8 p-0",
                      newTagColor === color && "ring-2 ring-primary"
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Create Tag
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateTag(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
