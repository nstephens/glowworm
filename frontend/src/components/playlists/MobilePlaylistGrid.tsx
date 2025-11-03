import React from 'react';
import { Play, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { SwipeablePlaylistCard } from './SwipeablePlaylistCard';
import { Skeleton } from '../ui/Skeleton';
import type { Playlist } from '../../types';

interface MobilePlaylistGridProps {
  playlists: Playlist[];
  playlistThumbnails: Record<number, string>;
  loading?: boolean;
  error?: string | null;
  onPlaylistClick?: (playlist: Playlist) => void;
  onPlaylistPlay?: (playlist: Playlist) => void;
  onPlaylistEdit?: (playlist: Playlist) => void;
  onPlaylistDelete?: (playlist: Playlist) => void;
  onPlaylistSettings?: (playlist: Playlist) => void;
  onPlaylistPreview?: (playlist: Playlist) => void;
  onGenerateVariants?: (playlistId: number) => void;
  onCreatePlaylist?: () => void;
  isGeneratingVariants?: boolean;
  hapticFeedback?: boolean;
  className?: string;
}

export const MobilePlaylistGrid: React.FC<MobilePlaylistGridProps> = ({
  playlists,
  playlistThumbnails,
  loading = false,
  error = null,
  onPlaylistClick,
  onPlaylistPlay,
  onPlaylistEdit,
  onPlaylistDelete,
  onPlaylistSettings,
  onPlaylistPreview,
  onGenerateVariants,
  onCreatePlaylist,
  isGeneratingVariants = false,
  hapticFeedback = true,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Skeleton variant="image" className="w-16 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-3/4 h-5" />
                <Skeleton variant="text" className="w-1/2 h-4" />
                <div className="flex space-x-2">
                  <Skeleton variant="button" className="w-16 h-6" />
                  <Skeleton variant="button" className="w-20 h-6" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-red-800 mb-2">Error Loading Playlists</CardTitle>
          <CardDescription className="text-red-600 mb-4">
            {error}
          </CardDescription>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (playlists.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2">No Playlists Yet</CardTitle>
          <CardDescription className="mb-6">
            Create your first playlist to get started organizing your images
          </CardDescription>
          {onCreatePlaylist && (
            <Button
              onClick={onCreatePlaylist}
              className="shadow-lg"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Playlist
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {playlists.map((playlist) => (
        <SwipeablePlaylistCard
          key={playlist.id}
          playlist={playlist}
          thumbnailUrl={playlistThumbnails[playlist.id]}
          onPlay={onPlaylistPlay}
          onEdit={onPlaylistEdit}
          onDelete={onPlaylistDelete}
          onSettings={onPlaylistSettings}
          onPreview={onPlaylistPreview}
          onGenerateVariants={onGenerateVariants}
          isGeneratingVariants={isGeneratingVariants}
          hapticFeedback={hapticFeedback}
          className="hover:scale-[1.02] transition-transform duration-200"
        />
      ))}
    </div>
  );
};

export default MobilePlaylistGrid;
