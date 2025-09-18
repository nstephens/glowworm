import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SetupProvider, useSetup } from './contexts/SetupContext';
import './App.css';

// Import pages
import HomePage from './pages/HomePage';
import SetupWizard from './pages/SetupWizard';
import AdminDashboard from './pages/AdminDashboard';
import DisplayView from './pages/DisplayView';
import DisplayRegistration from './pages/DisplayRegistration';
import Login from './pages/Login';
import { Images, ImagesHeader } from './pages/Images';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Displays from './pages/Displays';
import Settings from './pages/Settings';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';

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
    <ImagesHeader 
      images={images} 
      albums={albums} 
      onUploadClick={() => setShowUploadModal(true)} 
    />
  );

  return (
    <AdminLayout headerContent={headerContent}>
      <Images 
        headerContent={headerContent} 
        onDataChange={handleDataChange}
        showUploadModal={showUploadModal}
        setShowUploadModal={setShowUploadModal}
      />
    </AdminLayout>
  );
};

function AppContent() {
  const { isConfigured, isLoading } = useSetup();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-glowworm-500 mx-auto mb-4"></div>
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
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/images" element={<ProtectedRoute><ImagesWithHeader /></ProtectedRoute>} />
            <Route path="/admin/playlists" element={<ProtectedRoute><AdminLayout><Playlists /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/playlists/:id" element={<ProtectedRoute><AdminLayout><PlaylistDetail /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/displays" element={<ProtectedRoute><AdminLayout><Displays /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/settings" element={<AdminProtectedRoute><AdminLayout><Settings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/display" element={<DisplayRegistration />} />
            <Route path="/display/:slug" element={<DisplayView />} />
            {/* Redirect /setup to home if already configured */}
            <Route path="/setup" element={<HomePage />} />
          </>
        ) : (
          <Route path="/setup" element={<SetupWizard />} />
        )}
        {/* Fallback for unconfigured state if user tries other routes */}
        {!isConfigured && <Route path="*" element={<SetupWizard />} />}
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <SetupProvider>
        <AppContent />
      </SetupProvider>
    </Router>
  );
}

export default App;
