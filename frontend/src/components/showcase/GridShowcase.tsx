import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  getResponsiveGridClasses, 
  getContentGrid, 
  getMobileSpacing,
  getMobileLayout,
  contentGrids,
  mobileSpacing,
  mobileLayouts
} from '@/lib/gridUtils';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Image, 
  Music, 
  Settings, 
  Monitor,
  Upload,
  Download,
  Star,
  Users,
  HardDrive
} from 'lucide-react';

/**
 * Showcase component demonstrating responsive grid utilities
 * across different content types and screen sizes
 */
export const GridShowcase: React.FC = () => {
  // Mock data for different content types
  const dashboardStats = [
    { title: 'Total Files', value: '1,234', icon: Upload, color: 'text-blue-600' },
    { title: 'Storage Used', value: '2.4 GB', icon: HardDrive, color: 'text-green-600' },
    { title: 'Active Users', value: '89', icon: Users, color: 'text-purple-600' },
    { title: 'Downloads', value: '5,678', icon: Download, color: 'text-orange-600' },
  ];

  const galleryImages = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    src: `https://picsum.photos/300/200?random=${i + 1}`,
    title: `Image ${i + 1}`,
    tags: ['nature', 'landscape', 'photography'].slice(0, Math.floor(Math.random() * 3) + 1),
  }));

  const playlistItems = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    title: `Playlist ${i + 1}`,
    description: `A curated collection of ${Math.floor(Math.random() * 50) + 10} images`,
    imageCount: Math.floor(Math.random() * 100) + 10,
  }));

  const settingSections = [
    { title: 'General', description: 'Basic application settings' },
    { title: 'Display', description: 'Screen and layout preferences' },
    { title: 'Storage', description: 'File storage and backup options' },
    { title: 'Security', description: 'Privacy and security settings' },
  ];

  const deviceCards = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `Display ${i + 1}`,
    status: ['online', 'offline', 'maintenance'][Math.floor(Math.random() * 3)],
    location: ['Living Room', 'Office', 'Bedroom', 'Kitchen'][Math.floor(Math.random() * 4)],
  }));

  return (
    <div className="space-y-12 p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Responsive Grid System Showcase</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Demonstrating mobile-first responsive grid utilities across different content types
        </p>
      </div>

      {/* Dashboard Stats - Compact Grid */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Dashboard Stats</h2>
          <p className="text-muted-foreground">Compact grid for info cards (3→4→5→6 columns)</p>
          <Badge variant="outline" className="mt-2">
            {getContentGrid('dashboard', 'stats')}
          </Badge>
        </div>
        
        <div className={cn(getContentGrid('dashboard', 'stats'), 'gap-4')}>
          {dashboardStats.map((stat, index) => (
            <Card key={index} className="p-4">
              <CardContent className="flex items-center space-x-3">
                <stat.icon className={cn('h-8 w-8', stat.color)} />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Image Gallery - Dense Grid */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Image Gallery</h2>
          <p className="text-muted-foreground">Dense grid for image thumbnails (3→4→5→6 columns)</p>
          <Badge variant="outline" className="mt-2">
            {getContentGrid('gallery', 'images')}
          </Badge>
        </div>
        
        <div className={cn(getContentGrid('gallery', 'images'), 'gap-3')}>
          {galleryImages.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                <Image className="h-12 w-12 text-gray-400" />
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm">{image.title}</h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {image.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Playlists - Standard Grid */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Playlists</h2>
          <p className="text-muted-foreground">Standard responsive grid (2→3→4→5→6 columns)</p>
          <Badge variant="outline" className="mt-2">
            {getContentGrid('playlists', 'grid')}
          </Badge>
        </div>
        
        <div className={cn(getContentGrid('playlists', 'grid'), 'gap-6')}>
          {playlistItems.map((playlist) => (
            <Card key={playlist.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Music className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{playlist.title}</CardTitle>
                    <CardDescription>{playlist.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {playlist.imageCount} images
                  </span>
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Settings - Form Grid */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Settings Sections</h2>
          <p className="text-muted-foreground">Form layout grid (1→2→3→4→5 columns)</p>
          <Badge variant="outline" className="mt-2">
            {getContentGrid('settings', 'sections')}
          </Badge>
        </div>
        
        <div className={cn(getContentGrid('settings', 'sections'), 'gap-6')}>
          {settingSections.map((section, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Device Cards - Responsive Grid */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Device Management</h2>
          <p className="text-muted-foreground">Device cards grid (1→2→3→4→5 columns)</p>
          <Badge variant="outline" className="mt-2">
            {getContentGrid('devices', 'cards')}
          </Badge>
        </div>
        
        <div className={cn(getContentGrid('devices', 'cards'), 'gap-4')}>
          {deviceCards.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Monitor className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{device.name}</CardTitle>
                  </div>
                  <Badge 
                    variant={device.status === 'online' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {device.status}
                  </Badge>
                </div>
                <CardDescription>{device.location}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button size="sm" variant="outline" className="w-full">
                  Manage
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Utility Classes Reference */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Available Utility Classes</h2>
          <p className="text-muted-foreground">Reference for all available grid utilities</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Grid Variants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grid Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">responsive-grid</code>
                <p className="text-muted-foreground text-xs mt-1">Standard (2→3→4→5→6)</p>
              </div>
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">responsive-grid-compact</code>
                <p className="text-muted-foreground text-xs mt-1">Dense (3→4→5→6)</p>
              </div>
              <div className="text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">responsive-grid-auto</code>
                <p className="text-muted-foreground text-xs mt-1">Auto-fit (160px→200px→240px)</p>
              </div>
            </CardContent>
          </Card>

          {/* Content Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(contentGrids).map(([type, layouts]) => (
                <div key={type} className="text-sm">
                  <code className="bg-gray-100 px-2 py-1 rounded">{type}</code>
                  <p className="text-muted-foreground text-xs mt-1">
                    {Object.keys(layouts).join(', ')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Mobile Layouts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mobile Layouts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(mobileLayouts).map(([name, classes]) => (
                <div key={name} className="text-sm">
                  <code className="bg-gray-100 px-2 py-1 rounded">{name}</code>
                  <p className="text-muted-foreground text-xs mt-1 truncate">
                    {classes}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};




