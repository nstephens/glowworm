import React from 'react';
import { Button } from '../components/ui/button';
import { Upload, ImageIcon } from 'lucide-react';
import type { Image, Album } from '../types';

interface ImagesHeaderProps {
  images: Image[];
  albums: Album[];
  onUploadClick: () => void;
}

export const ImagesHeader: React.FC<ImagesHeaderProps> = ({ 
  images, 
  albums, 
  onUploadClick 
}) => {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Images</h1>
            <p className="text-muted-foreground">{images.length} images in your collection</p>
          </div>
        </div>
        <Button className="shadow-lg" onClick={onUploadClick}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Images
        </Button>
      </div>
    </div>
  );
};

export default ImagesHeader;
