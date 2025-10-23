import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Image } from './MasonryGallery';

export interface FilterState {
  searchTerm: string;
  selectedAlbums: string[];
  selectedTags: string[];
  selectedOrientations: string[];
  dateRange: {
    start: string;
    end: string;
  } | null;
  sortBy: 'date' | 'title' | 'album' | 'size';
  sortOrder: 'asc' | 'desc';
}

export interface FilterContextType {
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  filteredImages: Image[];
  availableAlbums: string[];
  availableTags: string[];
  availableOrientations: string[];
}

const defaultFilters: FilterState = {
  searchTerm: '',
  selectedAlbums: [],
  selectedTags: [],
  selectedOrientations: [],
  dateRange: null,
  sortBy: 'date',
  sortOrder: 'desc',
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

interface FilterProviderProps {
  children: React.ReactNode;
  images: Image[];
}

/**
 * FilterProvider - Provides filtering context for the gallery
 * 
 * Features:
 * - Search by title, album, tags
 * - Filter by album, tags, orientation
 * - Date range filtering
 * - Sorting by multiple criteria
 * - Clear all filters
 * - Active filter indicators
 */
export const FilterProvider: React.FC<FilterProviderProps> = ({ children, images }) => {
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  // Extract unique values for filter options
  const availableAlbums = useMemo(() => {
    const albums = images
      .map(img => img.album)
      .filter((album, index, arr) => album && arr.indexOf(album) === index)
      .sort();
    return albums;
  }, [images]);

  const availableTags = useMemo(() => {
    const tags = images
      .flatMap(img => img.tags || [])
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
      .sort();
    return tags;
  }, [images]);

  const availableOrientations = useMemo(() => {
    const orientations = images
      .map(img => img.orientation)
      .filter((orientation, index, arr) => orientation && arr.indexOf(orientation) === index)
      .sort();
    return orientations;
  }, [images]);

  // Filter and sort images
  const filteredImages = useMemo(() => {
    let filtered = [...images];

    // Search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(img => 
        img.title.toLowerCase().includes(searchLower) ||
        img.album?.toLowerCase().includes(searchLower) ||
        img.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Album filter
    if (filters.selectedAlbums.length > 0) {
      filtered = filtered.filter(img => 
        img.album && filters.selectedAlbums.includes(img.album)
      );
    }

    // Tag filter
    if (filters.selectedTags.length > 0) {
      filtered = filtered.filter(img => 
        img.tags && img.tags.some(tag => filters.selectedTags.includes(tag))
      );
    }

    // Orientation filter
    if (filters.selectedOrientations.length > 0) {
      filtered = filtered.filter(img => 
        img.orientation && filters.selectedOrientations.includes(img.orientation)
      );
    }

    // Date range filter
    if (filters.dateRange) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      filtered = filtered.filter(img => {
        if (!img.createdAt) return true;
        const imgDate = new Date(img.createdAt);
        return imgDate >= startDate && imgDate <= endDate;
      });
    }

    // Sort images
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (filters.sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'album':
          aValue = (a.album || '').toLowerCase();
          bValue = (b.album || '').toLowerCase();
          break;
        case 'size':
          aValue = a.width * a.height;
          bValue = b.width * b.height;
          break;
        case 'date':
        default:
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [images, filters]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchTerm !== '' ||
      filters.selectedAlbums.length > 0 ||
      filters.selectedTags.length > 0 ||
      filters.selectedOrientations.length > 0 ||
      filters.dateRange !== null ||
      filters.sortBy !== 'date' ||
      filters.sortOrder !== 'desc'
    );
  }, [filters]);

  const value: FilterContextType = {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    filteredImages,
    availableAlbums,
    availableTags,
    availableOrientations,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
