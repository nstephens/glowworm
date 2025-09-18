import React, { useState, useCallback } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Settings, 
  GripVertical, 
  CheckSquare, 
  Square,
  MoreVertical,
  Move,
  Copy,
  Download,
  Star,
  StarOff,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Playlist } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface PlaylistManagerEnhancedProps {
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => Promise<void>;
  onUpdatePlaylist: (id: number, data: Partial<Playlist>) => Promise<void>;
  onDeletePlaylist: (id: number) => Promise<void>;
  onReorderPlaylists: (playlists: Playlist[]) => Promise<void>;
  onSetDefault: (id: number) => Promise<void>;
  loading?: boolean;
}

interface SortablePlaylistItemProps {
  playlist: Playlist;
  isEditing: boolean;
  editName: string;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleSelect: () => void;
  onSetDefault: () => void;
  isSelectedForBulk: boolean;
}

const SortablePlaylistItem: React.FC<SortablePlaylistItemProps> = ({
  playlist,
  isEditing,
  editName,
  onEdit,
  onDelete,
  onUpdateName,
  onSaveEdit,
  onCancelEdit,
  onToggleSelect,
  onSetDefault,
  isSelectedForBulk
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlist.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all
        ${isDragging ? 'shadow-xl z-10' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Selection Checkbox */}
          <button
            onClick={onToggleSelect}
            className="p-1 text-gray-400 hover:text-primary-600"
          >
            {isSelectedForBulk ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>

          {/* Playlist Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); onSaveEdit(); }} className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => onUpdateName(e.target.value)}
                  className="input-field text-sm"
                  autoFocus
                  required
                />
                <div className="flex space-x-2">
                  <button 
                    type="submit" 
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {playlist.name}
                  </h3>
                  {playlist.is_default && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Star className="w-3 h-3 mr-1" />
                      Default
                    </span>
                  )}
                  {playlist.display_mode && playlist.display_mode !== 'default' && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      playlist.display_mode === 'auto_sort' ? 'bg-blue-100 text-blue-800' :
                      playlist.display_mode === 'movement' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <Settings className="w-3 h-3 mr-1" />
                      {playlist.display_mode === 'auto_sort' ? 'Auto Sort' :
                       playlist.display_mode === 'movement' ? 'Movement' :
                       playlist.display_mode}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {playlist.image_count} images
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Slug: {playlist.slug}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isEditing && (
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={onSetDefault}
              disabled={playlist.is_default}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-colors ${
                playlist.is_default
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {playlist.is_default ? (
                <Star className="w-3 h-3" />
              ) : (
                <StarOff className="w-3 h-3" />
              )}
              <span>{playlist.is_default ? 'Default' : 'Set Default'}</span>
            </button>
          </div>
          
          <div className="flex space-x-1">
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Edit playlist"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const PlaylistManagerEnhanced: React.FC<PlaylistManagerEnhancedProps> = ({
  playlists,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onReorderPlaylists,
  onSetDefault,
  loading = false
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      setIsCreating(true);
      await onCreatePlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateModal(false);
    } catch (err: any) {
      alert('Failed to create playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdatePlaylist = async () => {
    if (!editingPlaylist || !editPlaylistName.trim()) return;

    try {
      await onUpdatePlaylist(editingPlaylist.id, { name: editPlaylistName.trim() });
      setEditingPlaylist(null);
      setEditPlaylistName('');
    } catch (error) {
      console.error('Failed to update playlist:', error);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    
    try {
      await onDeletePlaylist(playlistToDelete.id);
    } catch (err: any) {
      alert('Failed to delete playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setShowDeleteModal(false);
      setPlaylistToDelete(null);
    }
  };

  const startEdit = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name);
  };

  const cancelEdit = () => {
    setEditingPlaylist(null);
    setEditPlaylistName('');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = playlists.findIndex(playlist => playlist.id === active.id);
      const newIndex = playlists.findIndex(playlist => playlist.id === over.id);

      const reorderedPlaylists = arrayMove(playlists, oldIndex, newIndex);
      try {
        await onReorderPlaylists(reorderedPlaylists);
      } catch (error) {
        console.error('Failed to reorder playlists:', error);
      }
    }
  };

  const handleToggleSelect = (playlistId: number) => {
    const newSelected = new Set(selectedPlaylists);
    if (newSelected.has(playlistId)) {
      newSelected.delete(playlistId);
    } else {
      newSelected.add(playlistId);
    }
    setSelectedPlaylists(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedPlaylists.size === playlists.length) {
      setSelectedPlaylists(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedPlaylists(new Set(playlists.map(playlist => playlist.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkDelete = async () => {
    const playlistsToDelete = playlists.filter(playlist => selectedPlaylists.has(playlist.id));
    if (playlistsToDelete.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${playlistsToDelete.length} playlist(s)? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        for (const playlist of playlistsToDelete) {
          await onDeletePlaylist(playlist.id);
        }
        setSelectedPlaylists(new Set());
        setShowBulkActions(false);
      } catch (error) {
        console.error('Failed to delete playlists:', error);
      }
    }
  };

  const handleBulkSetDefault = async () => {
    const selectedPlaylistsList = playlists.filter(playlist => selectedPlaylists.has(playlist.id));
    if (selectedPlaylistsList.length === 0) return;

    // Set the first selected playlist as default
    const firstPlaylist = selectedPlaylistsList[0];
    try {
      await onSetDefault(firstPlaylist.id);
      setSelectedPlaylists(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error('Failed to set default playlist:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Playlist Management</h1>
          {playlists.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              {selectedPlaylists.size === playlists.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showBulkActions && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-gray-600">
                {selectedPlaylists.size} selected
              </span>
              <button
                onClick={handleBulkSetDefault}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                <Star className="w-4 h-4" />
                <span>Set Default</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Playlists Yet</h3>
          <p className="text-gray-500 mb-4">Create your first playlist to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Playlist
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={playlists.map(playlist => playlist.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {playlists.map((playlist) => (
                <SortablePlaylistItem
                  key={playlist.id}
                  playlist={playlist}
                  isEditing={editingPlaylist?.id === playlist.id}
                  editName={editPlaylistName}
                  onEdit={() => startEdit(playlist)}
                  onDelete={() => {
                    setPlaylistToDelete(playlist);
                    setShowDeleteModal(true);
                  }}
                  onUpdateName={setEditPlaylistName}
                  onSaveEdit={handleUpdatePlaylist}
                  onCancelEdit={cancelEdit}
                  onToggleSelect={() => handleToggleSelect(playlist.id)}
                  onSetDefault={() => onSetDefault(playlist.id)}
                  isSelectedForBulk={selectedPlaylists.has(playlist.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Playlist</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPlaylistToDelete(null);
        }}
        onConfirm={handleDeletePlaylist}
        title="Delete Playlist"
        message={playlistToDelete ? `Are you sure you want to delete "${playlistToDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete Playlist"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default PlaylistManagerEnhanced;


