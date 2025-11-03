import React, { useState } from 'react';
import { 
  Play, 
  Clock, 
  Star, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Settings,
  RefreshCw,
  Loader2,
  Eye,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '../ui/dropdown-menu';
import type { Playlist } from '../../types';

interface MobilePlaylistCardProps {
  playlist: Playlist;
  thumbnailUrl?: string;
  onPlay?: (playlist: Playlist) => void;
  onEdit?: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
  onSettings?: (playlist: Playlist) => void;
  onGenerateVariants?: (playlistId: number) => void;
  onPreview?: (playlist: Playlist) => void;
  isGeneratingVariants?: boolean;
  className?: string;
}

export const MobilePlaylistCard: React.FC<MobilePlaylistCardProps> = ({
  playlist,
  thumbnailUrl,
  onPlay,
  onEdit,
  onDelete,
  onSettings,
  onGenerateVariants,
  onPreview,
  isGeneratingVariants = false,
  className,
}) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getDisplayModeLabel = (mode: string) => {
    switch (mode) {
      case 'auto_sort':
        return 'Auto Sort';
      case 'movement':
        return 'Movement';
      case 'random':
        return 'Random';
      default:
        return mode;
    }
  };

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-xl shadow-sm',
        'hover:shadow-md transition-all duration-200',
        'group cursor-pointer',
        className
      )}
    >
      <div className="p-4">
        {/* Header with thumbnail and basic info */}
        <div className="flex items-start space-x-3 mb-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
            {thumbnailUrl && !imageError ? (
              <img
                src={thumbnailUrl}
                alt={`${playlist.name} thumbnail`}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>

          {/* Playlist Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                  {playlist.name}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {playlist.image_count} images • {playlist.slug}
                </p>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {onPreview && (
                    <DropdownMenuItem onClick={() => onPreview(playlist)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  {onPlay && (
                    <DropdownMenuItem onClick={() => onPlay(playlist)}>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(playlist)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onSettings && (
                    <DropdownMenuItem onClick={() => onSettings(playlist)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  {onGenerateVariants && (
                    <DropdownMenuItem 
                      onClick={() => onGenerateVariants(playlist.id)}
                      disabled={isGeneratingVariants}
                    >
                      {isGeneratingVariants ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Generate Variants
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={() => onDelete(playlist)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Metadata and badges */}
        <div className="space-y-2">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {playlist.is_default && (
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                Default
              </Badge>
            )}
            {playlist.display_mode && playlist.display_mode !== 'default' && (
              <Badge variant="outline" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {getDisplayModeLabel(playlist.display_mode)}
              </Badge>
            )}
          </div>

          {/* Duration and stats */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(playlist.display_time_seconds || 30)}</span>
              </span>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center space-x-1">
              {onPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(playlist);
                  }}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              )}
              {onPlay && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(playlist);
                  }}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Play
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobilePlaylistCard;




