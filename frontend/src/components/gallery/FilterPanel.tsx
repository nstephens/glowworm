import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  SortAsc,
  SortDesc,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useFilters } from './FilterContext';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  className?: string;
}

/**
 * FilterPanel - Comprehensive filtering interface for the gallery
 * 
 * Features:
 * - Search by title, album, tags
 * - Multi-select filters for albums, tags, orientations
 * - Date range picker
 * - Sorting options
 * - Clear all filters
 * - Active filter indicators
 * - Collapsible sections
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({ className }) => {
  const {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    availableAlbums,
    availableTags,
    availableOrientations,
  } = useFilters();

  const [isExpanded, setIsExpanded] = useState(true);
  const [showDateRange, setShowDateRange] = useState(false);

  const handleSearchChange = (value: string) => {
    setFilters({ searchTerm: value });
  };

  const handleAlbumToggle = (album: string) => {
    const newAlbums = filters.selectedAlbums.includes(album)
      ? filters.selectedAlbums.filter(a => a !== album)
      : [...filters.selectedAlbums, album];
    setFilters({ selectedAlbums: newAlbums });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.selectedTags.includes(tag)
      ? filters.selectedTags.filter(t => t !== tag)
      : [...filters.selectedTags, tag];
    setFilters({ selectedTags: newTags });
  };

  const handleOrientationToggle = (orientation: string) => {
    const newOrientations = filters.selectedOrientations.includes(orientation)
      ? filters.selectedOrientations.filter(o => o !== orientation)
      : [...filters.selectedOrientations, orientation];
    setFilters({ selectedOrientations: newOrientations });
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const newDateRange = {
      ...filters.dateRange,
      [field]: value,
    };
    setFilters({ dateRange: newDateRange });
  };

  const handleSortChange = (sortBy: string) => {
    setFilters({ sortBy: sortBy as any });
  };

  const handleSortOrderToggle = () => {
    setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.selectedAlbums.length > 0) count++;
    if (filters.selectedTags.length > 0) count++;
    if (filters.selectedOrientations.length > 0) count++;
    if (filters.dateRange) count++;
    if (filters.sortBy !== 'date' || filters.sortOrder !== 'desc') count++;
    return count;
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Images</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by title, album, or tags..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
              {filters.searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Albums Filter */}
          {availableAlbums.length > 0 && (
            <div className="space-y-3">
              <Label>Albums</Label>
              <div className="flex flex-wrap gap-2">
                {availableAlbums.map((album) => (
                  <div key={album} className="flex items-center space-x-2">
                    <Checkbox
                      id={`album-${album}`}
                      checked={filters.selectedAlbums.includes(album)}
                      onCheckedChange={() => handleAlbumToggle(album)}
                    />
                    <Label
                      htmlFor={`album-${album}`}
                      className="text-sm cursor-pointer"
                    >
                      {album}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div className="space-y-3">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={filters.selectedTags.includes(tag)}
                      onCheckedChange={() => handleTagToggle(tag)}
                    />
                    <Label
                      htmlFor={`tag-${tag}`}
                      className="text-sm cursor-pointer"
                    >
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orientation Filter */}
          {availableOrientations.length > 0 && (
            <div className="space-y-3">
              <Label>Orientation</Label>
              <div className="flex flex-wrap gap-2">
                {availableOrientations.map((orientation) => (
                  <div key={orientation} className="flex items-center space-x-2">
                    <Checkbox
                      id={`orientation-${orientation}`}
                      checked={filters.selectedOrientations.includes(orientation)}
                      onCheckedChange={() => handleOrientationToggle(orientation)}
                    />
                    <Label
                      htmlFor={`orientation-${orientation}`}
                      className="text-sm cursor-pointer capitalize"
                    >
                      {orientation}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Date Range Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Date Range</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDateRange(!showDateRange)}
                className="h-8"
              >
                <Calendar className="h-4 w-4 mr-1" />
                {showDateRange ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showDateRange && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.dateRange?.start || ''}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.dateRange?.end || ''}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Sorting */}
          <div className="space-y-3">
            <Label>Sort By</Label>
            <div className="flex items-center gap-4">
              <Select value={filters.sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="album">Album</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSortOrderToggle}
                className="h-10"
              >
                {filters.sortOrder === 'asc' ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
