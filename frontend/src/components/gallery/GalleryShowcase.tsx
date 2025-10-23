import React, { useState } from 'react';
import { MasonryGallery, Image } from './MasonryGallery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Filter, 
  Grid, 
  List, 
  Search,
  Download,
  Share,
  Trash,
  Edit
} from 'lucide-react';

/**
 * GalleryShowcase - Demonstrates the MasonryGallery component
 * 
 * This component showcases the masonry gallery with filtering, search,
 * and bulk actions. Use this for development and testing purposes.
 */
export const GalleryShowcase: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('all');
  const [selectedOrientation, setSelectedOrientation] = useState<string>('all');
  const [showSelection, setShowSelection] = useState(true);
  const [viewMode, setViewMode] = useState<'masonry' | 'grid'>('masonry');

  // Mock images for demonstration
  const mockImages: Image[] = [
    {
      id: '1',
      src: 'https://picsum.photos/800/600?random=1',
      width: 800,
      height: 600,
      title: 'Beautiful Sunset',
      album: 'Vacation',
      tags: ['sunset', 'beach', 'nature'],
      orientation: 'landscape',
      createdAt: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      src: 'https://picsum.photos/600/800?random=2',
      width: 600,
      height: 800,
      title: 'Mountain Peak',
      album: 'Nature',
      tags: ['mountains', 'landscape', 'adventure'],
      orientation: 'portrait',
      createdAt: '2024-01-14T15:45:00Z',
    },
    {
      id: '3',
      src: 'https://picsum.photos/700/700?random=3',
      width: 700,
      height: 700,
      title: 'City Architecture',
      album: 'Urban',
      tags: ['city', 'architecture', 'modern'],
      orientation: 'square',
      createdAt: '2024-01-13T09:20:00Z',
    },
    {
      id: '4',
      src: 'https://picsum.photos/900/600?random=4',
      width: 900,
      height: 600,
      title: 'Ocean Waves',
      album: 'Vacation',
      tags: ['ocean', 'waves', 'blue'],
      orientation: 'landscape',
      createdAt: '2024-01-12T14:10:00Z',
    },
    {
      id: '5',
      src: 'https://picsum.photos/600/900?random=5',
      width: 600,
      height: 900,
      title: 'Forest Path',
      album: 'Nature',
      tags: ['forest', 'path', 'green'],
      orientation: 'portrait',
      createdAt: '2024-01-11T11:30:00Z',
    },
    {
      id: '6',
      src: 'https://picsum.photos/800/800?random=6',
      width: 800,
      height: 800,
      title: 'Abstract Art',
      album: 'Art',
      tags: ['abstract', 'colorful', 'creative'],
      orientation: 'square',
      createdAt: '2024-01-10T16:45:00Z',
    },
  ];

  const albums = ['all', 'Vacation', 'Nature', 'Urban', 'Art', 'Family'];
  const orientations = ['all', 'landscape', 'portrait', 'square'];

  const handleImageSelect = (image: Image) => {
    console.log('Selected image:', image);
  };

  const handleBulkAction = (action: string, images: Image[]) => {
    console.log(`Bulk action: ${action}`, images);
    
    switch (action) {
      case 'download':
        alert(`Downloading ${images.length} images...`);
        break;
      case 'share':
        alert(`Sharing ${images.length} images...`);
        break;
      case 'edit':
        alert(`Editing ${images.length} images...`);
        break;
      case 'delete':
        if (confirm(`Delete ${images.length} images? This action cannot be undone.`)) {
          alert(`Deleted ${images.length} images`);
        }
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  };

  const fetchImages = async (page: number) => {
    // Simulate API call with random errors for testing
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Simulate occasional errors for testing error handling
    if (Math.random() < 0.1) { // 10% chance of error
      throw new Error('Failed to fetch images. Please try again.');
    }
    
    // Return more mock images for infinite scroll demo
    const moreImages = Array.from({ length: 10 }, (_, i) => {
      const orientations: Array<'landscape' | 'portrait' | 'square'> = ['landscape', 'portrait', 'square'];
      const orientation = orientations[Math.floor(Math.random() * orientations.length)];
      const width = orientation === 'landscape' ? 800 : orientation === 'portrait' ? 600 : 700;
      const height = orientation === 'landscape' ? 600 : orientation === 'portrait' ? 800 : 700;
      
      return {
        id: `page-${page}-${i}`,
        src: `https://picsum.photos/${width}/${height}?random=${page * 10 + i}`,
        width,
        height,
        title: `Image ${page * 10 + i}`,
        album: 'Demo',
        tags: ['demo'],
        orientation,
        createdAt: new Date().toISOString(),
      };
    });

    return {
      images: moreImages,
      hasMore: page < 5, // Simulate 5 pages of data
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Photo Gallery</h1>
          <p className="text-muted-foreground">
            Browse and manage your photos with our enhanced masonry layout
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'masonry' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('masonry')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Album Filter */}
            <div className="space-y-2">
              <Label htmlFor="album">Album</Label>
              <Select value={selectedAlbum} onValueChange={setSelectedAlbum}>
                <SelectTrigger>
                  <SelectValue placeholder="Select album" />
                </SelectTrigger>
                <SelectContent>
                  {albums.map((album) => (
                    <SelectItem key={album} value={album}>
                      {album === 'all' ? 'All Albums' : album}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Orientation Filter */}
            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select value={selectedOrientation} onValueChange={setSelectedOrientation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select orientation" />
                </SelectTrigger>
                <SelectContent>
                  {orientations.map((orientation) => (
                    <SelectItem key={orientation} value={orientation}>
                      {orientation === 'all' ? 'All Orientations' : orientation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="selection"
                  checked={showSelection}
                  onCheckedChange={setShowSelection}
                />
                <Label htmlFor="selection" className="text-sm">
                  Show selection
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Badge variant="secondary">{mockImages.length} images</Badge>
        <Badge variant="outline">6 albums</Badge>
        <Badge variant="outline">3 orientations</Badge>
      </div>

      {/* Masonry Gallery */}
      <MasonryGallery
        initialImages={mockImages}
        fetchImages={fetchImages}
        onImageSelect={handleImageSelect}
        onBulkAction={handleBulkAction}
        showSelection={showSelection}
        className="min-h-[600px]"
      />

      {/* Keyboard Shortcuts Info */}
      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Selection</h4>
              <ul className="space-y-1">
                <li><kbd className="px-2 py-1 bg-muted rounded">Ctrl+A</kbd> Select all images</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Esc</kbd> Clear selection</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Space</kbd> Toggle selection</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Navigation</h4>
              <ul className="space-y-1">
                <li><kbd className="px-2 py-1 bg-muted rounded">↑↓←→</kbd> Navigate between images</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Enter</kbd> View image details</li>
                <li><kbd className="px-2 py-1 bg-muted rounded">Delete</kbd> Delete selected</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
