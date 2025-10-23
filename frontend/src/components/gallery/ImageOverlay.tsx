import React, { useState } from 'react';
import { 
  Edit, 
  Trash, 
  Share, 
  Star, 
  Download, 
  Eye,
  Heart,
  Copy,
  MoreHorizontal,
  Info,
  Tag,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Image } from './MasonryGallery';
import { cn } from '@/lib/utils';

interface ImageOverlayProps {
  image: Image;
  isHovered: boolean;
  isSelected: boolean;
  onAction: (action: string, image: Image) => void;
  onSelect: (image: Image) => void;
  showSelection?: boolean;
  className?: string;
}

/**
 * ImageOverlay - Enhanced hover overlay with animations and actions
 * 
 * Features:
 * - Smooth fade-in/out animations
 * - Multiple action buttons with tooltips
 * - Image metadata display
 * - Dropdown menu for additional actions
 * - Touch-friendly interactions
 * - Accessibility support
 */
export const ImageOverlay: React.FC<ImageOverlayProps> = ({
  image,
  isHovered,
  isSelected,
  onAction,
  onSelect,
  showSelection = true,
  className,
}) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const handleAction = (action: string) => {
    onAction(action, image);
  };

  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    handleAction('favorite');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (width: number, height: number) => {
    const megapixels = (width * height) / 1000000;
    return `${megapixels.toFixed(1)}MP`;
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          "flex flex-col justify-between p-4",
          "transition-all duration-300 ease-in-out",
          "opacity-0 group-hover:opacity-100",
          isHovered && "opacity-100",
          className
        )}
      >
        {/* Top section - Image info and selection */}
        <div className="flex items-start justify-between">
          {/* Image metadata */}
          <div className="text-white space-y-1">
            <h3 className="font-semibold text-sm truncate max-w-[200px]" title={image.title}>
              {image.title}
            </h3>
            {image.album && (
              <p className="text-xs text-white/80 truncate" title={image.album}>
                📁 {image.album}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span>{formatFileSize(image.width, image.height)}</span>
              <span>•</span>
              <span>{image.orientation}</span>
              <span>•</span>
              <span>{formatDate(image.createdAt)}</span>
            </div>
            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {image.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                    {tag}
                  </Badge>
                ))}
                {image.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs px-1 py-0 text-white/70">
                    +{image.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Selection indicator */}
          {showSelection && (
            <div className="flex items-center gap-2">
              {isSelected && (
                <Badge variant="default" className="bg-primary text-primary-foreground">
                  Selected
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Bottom section - Action buttons */}
        <div className="flex items-center justify-between">
          {/* Quick actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => onSelect(image)}
                  aria-label="View details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View details</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => handleAction('download')}
                  aria-label="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white",
                    isFavorited && "text-red-400"
                  )}
                >
                  <Star 
                    className={cn(
                      "h-4 w-4",
                      isFavorited && "fill-current"
                    )}
                    onClick={handleFavorite}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFavorited ? 'Remove from favorites' : 'Add to favorites'}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => handleAction('share')}
                  aria-label="Share"
                >
                  <Share className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleAction('edit')}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('copy')}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('info')}>
                <Info className="h-4 w-4 mr-2" />
                Properties
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('tags')}>
                <Tag className="h-4 w-4 mr-2" />
                Manage Tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleAction('delete')}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center overlay for touch devices */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
