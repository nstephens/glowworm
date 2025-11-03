import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Skeleton, 
  SkeletonText, 
  SkeletonAvatar, 
  SkeletonButton, 
  SkeletonCard,
  ImageCardSkeleton,
  MasonryGallerySkeleton,
  DashboardSkeleton,
  FormSkeleton,
  UploadSkeleton,
  GlobalLoading,
  LoadingOverlay,
  LoadingState,
  LazyImage,
  ErrorBoundary
} from '@/components/loading';
import { 
  RefreshCw, 
  Upload, 
  Download, 
  Settings, 
  User, 
  Image as ImageIcon,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const LoadingShowcase: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'skeletons' | 'loading' | 'errors'>('skeletons');
  const [showGlobalLoading, setShowGlobalLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleGlobalLoading = () => {
    setShowGlobalLoading(true);
    setTimeout(() => setShowGlobalLoading(false), 3000);
  };

  const handleError = () => {
    setShowError(true);
    setTimeout(() => setShowError(false), 3000);
  };

  if (showError) {
    throw new Error('This is a test error for the error boundary');
  }

  return (
    <ErrorBoundary>
      <motion.div
        className="p-6 space-y-6"
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Loading States Showcase</h1>
            <p className="text-muted-foreground">
              Explore the comprehensive loading state system with skeletons, animations, and error handling
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'skeletons' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('skeletons')}
            >
              Skeletons
            </Button>
            <Button
              variant={activeTab === 'loading' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('loading')}
            >
              Loading States
            </Button>
            <Button
              variant={activeTab === 'errors' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('errors')}
            >
              Error Handling
            </Button>
          </div>
        </div>

        {activeTab === 'skeletons' && (
          <div className="space-y-6">
            {/* Base Skeleton Components */}
            <Card>
              <CardHeader>
                <CardTitle>Base Skeleton Components</CardTitle>
                <CardDescription>
                  Fundamental skeleton components for different UI elements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Text Skeletons</h3>
                    <div className="space-y-2">
                      <Skeleton height="1.5rem" width="100%" />
                      <Skeleton height="1rem" width="75%" />
                      <Skeleton height="1rem" width="50%" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Avatar Skeletons</h3>
                    <div className="flex items-center space-x-4">
                      <SkeletonAvatar size="sm" />
                      <SkeletonAvatar size="md" />
                      <SkeletonAvatar size="lg" />
                      <SkeletonAvatar size="xl" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Button Skeletons</h3>
                    <div className="flex space-x-2">
                      <SkeletonButton size="sm" />
                      <SkeletonButton size="md" />
                      <SkeletonButton size="lg" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Card Skeleton</h3>
                  <SkeletonCard showAvatar showActions />
                </div>
              </CardContent>
            </Card>

            {/* Gallery Skeletons */}
            <Card>
              <CardHeader>
                <CardTitle>Gallery Skeletons</CardTitle>
                <CardDescription>
                  Skeleton components for gallery and image displays
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Image Card Skeleton</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ImageCardSkeleton aspectRatio="square" />
                    <ImageCardSkeleton aspectRatio="portrait" />
                    <ImageCardSkeleton aspectRatio="landscape" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Masonry Gallery Skeleton</h3>
                  <MasonryGallerySkeleton itemCount={6} />
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Skeletons */}
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Skeletons</CardTitle>
                <CardDescription>
                  Skeleton components for dashboard and data visualization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DashboardSkeleton />
              </CardContent>
            </Card>

            {/* Form Skeletons */}
            <Card>
              <CardHeader>
                <CardTitle>Form Skeletons</CardTitle>
                <CardDescription>
                  Skeleton components for forms and user input
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormSkeleton fieldCount={4} />
                  <UploadSkeleton fileCount={3} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'loading' && (
          <div className="space-y-6">
            {/* Loading States */}
            <Card>
              <CardHeader>
                <CardTitle>Loading States</CardTitle>
                <CardDescription>
                  Various loading indicators and states
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Loading Overlay</h3>
                    <LoadingOverlay isLoading={isLoading}>
                      <div className="h-32 bg-muted rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">Content behind overlay</p>
                      </div>
                    </LoadingOverlay>
                    <Button onClick={handleLoading}>
                      <Loader2 className="h-4 w-4 mr-2" />
                      Toggle Loading
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Loading State</h3>
                    <LoadingState
                      isLoading={isLoading}
                      skeleton={
                        <div className="space-y-2">
                          <Skeleton height="1rem" width="100%" />
                          <Skeleton height="1rem" width="75%" />
                          <Skeleton height="1rem" width="50%" />
                        </div>
                      }
                    >
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Loaded Content</h4>
                        <p className="text-muted-foreground">
                          This content appears when loading is complete.
                        </p>
                      </div>
                    </LoadingState>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Global Loading</h3>
                  <Button onClick={handleGlobalLoading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Show Global Loading
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Lazy Image Loading</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LazyImage
                      src="https://picsum.photos/400/300?random=1"
                      alt="Lazy loaded image"
                      className="w-full h-48 rounded-lg"
                      placeholderSrc="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzIDIiPjwvc3ZnPg=="
                    />
                    <LazyImage
                      src="https://picsum.photos/400/300?random=2"
                      alt="Another lazy loaded image"
                      className="w-full h-48 rounded-lg"
                      blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzIDIiPjwvc3ZnPg=="
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="space-y-6">
            {/* Error Handling */}
            <Card>
              <CardHeader>
                <CardTitle>Error Handling</CardTitle>
                <CardDescription>
                  Error boundaries and error state management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Error Boundary Test</h3>
                  <p className="text-muted-foreground">
                    Click the button below to trigger an error and see the error boundary in action.
                  </p>
                  <Button variant="destructive" onClick={handleError}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Trigger Error
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Error States</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">Network Error</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Failed to load data. Please check your connection and try again.
                      </p>
                    </div>
                    
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">Warning</span>
                      </div>
                      <p className="text-sm text-yellow-700">
                        This action cannot be undone. Please proceed with caution.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Global Loading Overlay */}
        <GlobalLoading
          isLoading={showGlobalLoading}
          variant="spinner"
          size="lg"
          message="Processing your request..."
        />
      </motion.div>
    </ErrorBoundary>
  );
};
