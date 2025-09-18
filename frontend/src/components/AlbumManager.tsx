import React, { useState } from 'react';
import { Plus, Edit, Trash2, Folder, FolderOpen } from 'lucide-react';
import type { Album, Image } from '../types';
import { AlbumDeleteModal } from './AlbumDeleteModal';

interface AlbumManagerProps {
  albums: Album[];
  images: Image[];
  onCreateAlbum: (name: string) => Promise<void>;
  onUpdateAlbum: (id: number, name: string) => Promise<void>;
  onDeleteAlbum: (id: number, action: 'delete-images' | 'move-to-unsorted') => Promise<void>;
  onSelectAlbum: (album: Album | null) => void;
  selectedAlbum: Album | null;
  loading?: boolean;
}

export const AlbumManager: React.FC<AlbumManagerProps> = ({
  albums,
  images,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onSelectAlbum,
  selectedAlbum,
  loading = false
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [editAlbumName, setEditAlbumName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;

    try {
      await onCreateAlbum(newAlbumName.trim());
      setNewAlbumName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create album:', error);
    }
  };

  const handleUpdateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum || !editAlbumName.trim()) return;

    try {
      await onUpdateAlbum(editingAlbum.id, editAlbumName.trim());
      setEditingAlbum(null);
      setEditAlbumName('');
    } catch (error) {
      console.error('Failed to update album:', error);
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    setAlbumToDelete(album);
    setShowDeleteModal(true);
  };

  const confirmDeleteAlbum = async (action: 'delete-images' | 'move-to-unsorted') => {
    if (!albumToDelete) return;
    
    try {
      await onDeleteAlbum(albumToDelete.id, action);
    } catch (error) {
      console.error('Failed to delete album:', error);
    } finally {
      setShowDeleteModal(false);
      setAlbumToDelete(null);
    }
  };

  const startEdit = (album: Album) => {
    setEditingAlbum(album);
    setEditAlbumName(album.name);
  };

  const cancelEdit = () => {
    setEditingAlbum(null);
    setEditAlbumName('');
  };

  const getImageCount = (albumId: number | null) => {
    return images.filter(img => img.album_id === albumId).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Albums</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Album
        </button>
      </div>

      {/* Create Album Form */}
      {showCreateForm && (
        <div className="bg-gray-50 rounded-lg p-4">
          <form onSubmit={handleCreateAlbum} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Album Name
              </label>
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Enter album name..."
                className="input-field"
                autoFocus
                required
              />
            </div>
            <div className="flex space-x-2">
              <button type="submit" className="btn-primary text-sm">
                Create Album
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAlbumName('');
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Albums List */}
      <div className="space-y-2">
        {/* All Images */}
        <div
          className={`
            flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors
            ${selectedAlbum === null 
              ? 'bg-primary-50 border-2 border-primary-200' 
              : 'bg-white border border-gray-200 hover:bg-gray-50'
            }
          `}
          onClick={() => onSelectAlbum(null)}
        >
          <div className="flex items-center space-x-3">
            <FolderOpen className="w-5 h-5 text-primary-600" />
            <div>
              <h4 className="font-medium text-gray-900">All Images</h4>
              <p className="text-sm text-gray-500">{images.length} images</p>
            </div>
          </div>
        </div>

        {/* Album Items */}
        {albums.map((album) => (
          <div
            key={album.id}
            className={`
              flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors
              ${selectedAlbum?.id === album.id 
                ? 'bg-primary-50 border-2 border-primary-200' 
                : 'bg-white border border-gray-200 hover:bg-gray-50'
              }
            `}
            onClick={() => onSelectAlbum(album)}
          >
            <div className="flex items-center space-x-3 flex-1">
              <Folder className="w-5 h-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                {editingAlbum?.id === album.id ? (
                  <form onSubmit={handleUpdateAlbum} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editAlbumName}
                      onChange={(e) => setEditAlbumName(e.target.value)}
                      className="input-field text-sm"
                      autoFocus
                      required
                    />
                    <button type="submit" className="text-green-600 hover:text-green-800">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <h4 className="font-medium text-gray-900 truncate">{album.name}</h4>
                    <p className="text-sm text-gray-500">
                      {getImageCount(album.id)} images
                    </p>
                  </>
                )}
              </div>
            </div>

            {editingAlbum?.id !== album.id && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(album);
                  }}
                  className="p-1 text-gray-400 hover:text-primary-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAlbum(album);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        {albums.length === 0 && (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No albums yet</h4>
            <p className="text-gray-500 mb-4">
              Create your first album to organize your images
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Album
            </button>
          </div>
        )}

        {/* Album Delete Confirmation Modal */}
        <AlbumDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setAlbumToDelete(null);
          }}
          onConfirm={confirmDeleteAlbum}
          album={albumToDelete}
          imageCount={albumToDelete ? getImageCount(albumToDelete.id) : 0}
        />
      </div>
    </div>
  );
};

export default AlbumManager;
