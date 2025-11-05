import React from 'react';
import { Button } from './ui/button';
import { Play, Plus } from 'lucide-react';

interface PlaylistsHeaderProps {
  playlistCount?: number;
  onCreateClick?: () => void;
}

export const PlaylistsHeader: React.FC<PlaylistsHeaderProps> = ({ 
  playlistCount = 0,
  onCreateClick 
}) => {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Play className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Playlists</h1>
            <p className="text-muted-foreground">{playlistCount} playlists in your collection</p>
          </div>
        </div>
        {onCreateClick && (
          <Button className="shadow-lg" onClick={onCreateClick}>
            <Plus className="w-4 h-4 mr-2" />
            Create Playlist
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlaylistsHeader;
