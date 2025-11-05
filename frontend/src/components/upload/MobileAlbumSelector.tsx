import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FolderPlus, 
  Search, 
  X, 
  Check, 
  Plus,
  Folder,
  Clock,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import type { Album } from '../../types';

interface MobileAlbumSelectorProps {
  /** Available albums */
  albums: Album[];
  /** Selected album */
  selectedAlbum: Album | null;
  /** Callback when album changes */
  onAlbumChange: (album: Album | null) => void;
  /** Callback when new album is created */
  onCreateAlbum: (name: string, description?: string) => void;
  /** Whether the selector is visible */
  visible: boolean;
  /** Callback when visibility changes */
  onVisibilityChange: (visible: boolean) => void;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Custom className */
  className?: string;
}

export const MobileAlbumSelector: React.FC<MobileAlbumSelectorProps> = ({
  albums,
  selectedAlbum,
  onAlbumChange,
  onCreateAlbum,
  visible,
  onVisibilityChange,
  hapticFeedback = true,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  }, [hapticFeedback]);

  // Filter albums based on search query
  const filteredAlbums = React.useMemo(() => {
    if (!searchQuery.trim()) return albums;
    
    const query = searchQuery.toLowerCase();
    return albums.filter(album => 
      album.name.toLowerCase().includes(query) ||
      (album.description && album.description.toLowerCase().includes(query))
    );
  }, [albums, searchQuery]);

  // Recent albums (last 5 used)
  const recentAlbums = React.useMemo(() => {
    // In a real app, this would come from localStorage or a context
    return albums.slice(0, 3);
  }, [albums]);

  // Handle album selection
  const handleAlbumSelect = useCallback((album: Album | null) => {
    onAlbumChange(album);
    onVisibilityChange(false);
    triggerHapticFeedback('medium');
  }, [onAlbumChange, onVisibilityChange, triggerHapticFeedback]);

  // Handle create album
  const handleCreateAlbum = useCallback(async () => {
    if (!newAlbumName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      await onCreateAlbum(newAlbumName.trim(), newAlbumDescription.trim() || undefined);
      setNewAlbumName('');
      setNewAlbumDescription('');
      setShowCreateForm(false);
      triggerHapticFeedback('heavy');
    } catch (error) {
      console.error('Failed to create album:', error);
    } finally {
      setIsCreating(false);
    }
  }, [newAlbumName, newAlbumDescription, isCreating, onCreateAlbum, triggerHapticFeedback]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Handle create form toggle
  const handleCreateToggle = useCallback(() => {
    setShowCreateForm(!showCreateForm);
    if (!showCreateForm) {
      // Focus input after animation
      setTimeout(() => {
        createInputRef.current?.focus();
      }, 100);
    }
    triggerHapticFeedback('light');
  }, [showCreateForm, triggerHapticFeedback]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && showCreateForm) {
      handleCreateAlbum();
    } else if (e.key === 'Escape') {
      if (showCreateForm) {
        setShowCreateForm(false);
        setNewAlbumName('');
        setNewAlbumDescription('');
      } else {
        onVisibilityChange(false);
      }
    }
  }, [showCreateForm, handleCreateAlbum, onVisibilityChange]);

  // Focus search input when visible
  useEffect(() => {
    if (visible && !showCreateForm) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [visible, showCreateForm]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onVisibilityChange(false);
    }
  }, [onVisibilityChange]);

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-2 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Select Album</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onVisibilityChange(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyPress}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* No Album Option */}
          <div className="p-4">
            <button
              onClick={() => handleAlbumSelect(null)}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all duration-200 text-left',
                'hover:bg-gray-50 active:scale-95 touch-manipulation',
                !selectedAlbum 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  !selectedAlbum ? 'bg-primary-100' : 'bg-gray-100'
                )}>
                  <Folder className={cn(
                    'h-5 w-5',
                    !selectedAlbum ? 'text-primary-600' : 'text-gray-600'
                  )} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">No Album</h3>
                  <p className="text-sm text-gray-500">Upload without organizing</p>
                </div>
                {!selectedAlbum && (
                  <Check className="h-5 w-5 text-primary-600" />
                )}
              </div>
            </button>
          </div>

          {/* Recent Albums */}
          {recentAlbums.length > 0 && !searchQuery && (
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Recent</h3>
              </div>
              <div className="space-y-2">
                {recentAlbums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => handleAlbumSelect(album)}
                    className={cn(
                      'w-full p-3 rounded-lg border transition-all duration-200 text-left',
                      'hover:bg-gray-50 active:scale-95 touch-manipulation',
                      selectedAlbum?.id === album.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        selectedAlbum?.id === album.id ? 'bg-primary-100' : 'bg-gray-100'
                      )}>
                        <Folder className={cn(
                          'h-5 w-5',
                          selectedAlbum?.id === album.id ? 'text-primary-600' : 'text-gray-600'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{album.name}</h4>
                        {album.description && (
                          <p className="text-sm text-gray-500 truncate">{album.description}</p>
                        )}
                      </div>
                      {selectedAlbum?.id === album.id && (
                        <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Albums */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">All Albums</h3>
              <Badge variant="secondary" className="text-xs">
                {filteredAlbums.length}
              </Badge>
            </div>
            
            {filteredAlbums.length === 0 ? (
              <div className="text-center py-8">
                <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'No albums found' : 'No albums yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAlbums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => handleAlbumSelect(album)}
                    className={cn(
                      'w-full p-3 rounded-lg border transition-all duration-200 text-left',
                      'hover:bg-gray-50 active:scale-95 touch-manipulation',
                      selectedAlbum?.id === album.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        selectedAlbum?.id === album.id ? 'bg-primary-100' : 'bg-gray-100'
                      )}>
                        <Folder className={cn(
                          'h-5 w-5',
                          selectedAlbum?.id === album.id ? 'text-primary-600' : 'text-gray-600'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{album.name}</h4>
                        {album.description && (
                          <p className="text-sm text-gray-500 truncate">{album.description}</p>
                        )}
                      </div>
                      {selectedAlbum?.id === album.id && (
                        <Check className="h-5 w-5 text-primary-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Album Section */}
        <div className="border-t border-gray-200">
          {showCreateForm ? (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Album Name
                </label>
                <Input
                  ref={createInputRef}
                  type="text"
                  placeholder="Enter album name"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Enter description"
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isCreating}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumName.trim() || isCreating}
                  className="flex-1"
                >
                  {isCreating ? 'Creating...' : 'Create Album'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <Button
                onClick={handleCreateToggle}
                variant="outline"
                className="w-full flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Album</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileAlbumSelector;





