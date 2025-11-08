import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SetupProvider, useSetup } from './contexts/SetupContext';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { registerServiceWorker } from './utils/serviceWorker';
import './App.css';

// Import pages
import HomePage from './pages/HomePage';
import SetupWizard from './pages/SetupWizard';
import AdminSetup from './pages/AdminSetup';
import AdminDashboard from './pages/AdminDashboard';
import DisplayView from './pages/DisplayView';
import DisplayRegistration from './pages/DisplayRegistration';
import Login from './pages/Login';
import { Images } from './pages/Images';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Displays from './pages/Displays';
import AdminLogs from './pages/AdminLogs';
import Settings from './pages/Settings';
import SchedulerPage from './pages/Scheduler';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminDashboardHeader from './components/AdminDashboardHeader';
import PlaylistDetailHeader from './components/PlaylistDetailHeader';
import ImagesPageHeader from './components/ImagesHeader';
import DisplaysHeader from './components/DisplaysHeader';
import PlaylistsHeader from './components/PlaylistsHeader';
import AdminLogsHeader from './components/AdminLogsHeader';
import SettingsHeader from './components/SettingsHeader';
import ProcessingQueueHeader from './components/ProcessingQueueHeader';
import SchedulerHeader from './components/SchedulerHeader';
import ProcessingQueueDashboard from './components/admin/ProcessingQueueDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a React Query client for image processing updates
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Wrapper component for Images with custom header
const ImagesWithHeader: React.FC = () => {
  const [images, setImages] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleDataChange = (newImages: any[], newAlbums: any[]) => {
    setImages(newImages);
    setAlbums(newAlbums);
  };

  const headerContent = (
    <ImagesPageHeader 
      images={images} 
      albums={albums} 
      onUploadClick={() => setShowUploadModal(true)} 
    />
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminLayout headerContent={headerContent}>
        <Images 
          headerContent={headerContent} 
          onDataChange={handleDataChange}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
        />
      </AdminLayout>
    </QueryClientProvider>
  );
};

// Wrapper component for Playlists with custom header
const PlaylistsWithHeader: React.FC = () => {
  const [playlistCount, setPlaylistCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handlePlaylistsLoad = (count: number) => {
    setPlaylistCount(count);
  };

  const headerContent = (
    <PlaylistsHeader 
      playlistCount={playlistCount}
      onCreateClick={() => setShowCreateModal(true)}
    />
  );

  return (
    <AdminLayout headerContent={headerContent}>
      <Playlists 
        onPlaylistsLoad={handlePlaylistsLoad}
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
      />
    </AdminLayout>
  );
};

// Wrapper component for Displays with custom header
const DisplaysWithHeader: React.FC = () => {
  const [activeCount, setActiveCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const handleDisplaysLoad = (active: number, pending: number) => {
    setActiveCount(active);
    setPendingCount(pending);
  };

  const headerContent = (
    <DisplaysHeader 
      activeCount={activeCount}
      pendingCount={pendingCount}
    />
  );

  return (
    <AdminLayout headerContent={headerContent}>
      <Displays 
        onDisplaysLoad={handleDisplaysLoad}
      />
    </AdminLayout>
  );
};

function AppContent() {
  const { isConfigured, needsBootstrap, needsAdmin, isLoading } = useSetup();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading GlowWorm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        {isConfigured ? (
          <>
            {/* Fully configured - normal app routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout headerContent={<AdminDashboardHeader />}><AdminDashboard /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/images" element={<ProtectedRoute><ImagesWithHeader /></ProtectedRoute>} />
            <Route path="/admin/playlists" element={<ProtectedRoute><PlaylistsWithHeader /></ProtectedRoute>} />
            <Route path="/admin/playlists/:slug" element={<ProtectedRoute><AdminLayout headerContent={<PlaylistDetailHeader />}><PlaylistDetail /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/displays" element={<ProtectedRoute><DisplaysWithHeader /></ProtectedRoute>} />
            <Route path="/admin/scheduler" element={<ProtectedRoute><AdminLayout headerContent={<SchedulerHeader />}><SchedulerPage /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/logs" element={<AdminProtectedRoute><AdminLayout headerContent={<AdminLogsHeader />}><AdminLogs /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/processing-queue" element={<AdminProtectedRoute><QueryClientProvider client={queryClient}><AdminLayout headerContent={<ProcessingQueueHeader />}><ProcessingQueueDashboard /></AdminLayout></QueryClientProvider></AdminProtectedRoute>} />
            <Route path="/admin/system/general" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/users" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/database" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/admin" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/oauth" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/displays" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/system/utilities" element={<AdminProtectedRoute><AdminLayout headerContent={<SettingsHeader />}><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/settings" element={<AdminProtectedRoute><Navigate to="/admin/system/general" replace /></AdminProtectedRoute>} />
            <Route path="/display" element={<DisplayRegistration />} />
            <Route path="/display/:slug" element={<DisplayView />} />
            {/* Redirect setup routes to home if already configured */}
            <Route path="/setup" element={<HomePage />} />
            <Route path="/setup/admin" element={<HomePage />} />
          </>
        ) : needsAdmin ? (
          <>
            {/* Stage 2: Bootstrap configured (Docker), needs admin creation */}
            <Route path="/setup/admin" element={<AdminSetup />} />
            <Route path="*" element={<AdminSetup />} />
          </>
        ) : (
          <>
            {/* Stage 1: Needs full bootstrap setup (Native installation) */}
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="*" element={<SetupWizard />} />
          </>
        )}
      </Routes>
    </div>
  );
}

function App() {
  useEffect(() => {
    // Register service worker
    registerServiceWorker({
      onUpdate: (registration) => {
        console.log('New content available, please refresh');
        // You could show a notification to the user here
        if (confirm('New version available! Refresh to update?')) {
          window.location.reload();
        }
      },
      onSuccess: (registration) => {
        console.log('Service Worker is ready');
      },
      onOffline: () => {
        console.log('App is offline');
      },
      onOnline: () => {
        console.log('App is online');
      },
    });
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="glowworm-theme">
      <Router>
        {/* Skip to main content link for keyboard navigation */}
        <a 
          href="#main-content" 
          className="sr-only"
          aria-label="Skip to main content"
        >
          Skip to main content
        </a>
        <SetupProvider>
          <AppContent />
        </SetupProvider>
        <Toaster />
        <OfflineIndicator showWhenOnline={true} autoHide={true} />
      </Router>
    </ThemeProvider>
  );
}

export default App;
