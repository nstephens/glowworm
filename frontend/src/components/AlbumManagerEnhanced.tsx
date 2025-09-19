import React, { useState, useCallback } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Folder, 
  FolderOpen, 
  GripVertical, 
  CheckSquare, 
  Square,
  MoreVertical,
  Move,
  Copy,
  Download
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
import type { Album, Image } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface AlbumManagerEnhancedProps {
  albums: Album[];
  images: Image[];
  onCreateAlbum: (name: string) => Promise<void>;
  onUpdateAlbum: (id: number, name: string) => Promise<void>;
  onDeleteAlbum: (id: number) => Promise<void>;
  onReorderAlbums: (albums: Album[]) => Promise<void>;
  onSelectAlbum: (album: Album | null) => void;
  selectedAlbum: Album | null;
  loading?: boolean;
}

interface SortableAlbumItemProps {
  album: Album;
  isSelected: boolean;
  isEditing: boolean;
  editName: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleSelect: () => void;
  isSelectedForBulk: boolean;
  imageCount: number;
}

const SortableAlbumItem: React.FC<SortableAlbumItemProps> = ({
  album,
  isSelected,
  isEditing,
  editName,
  onSelect,
  onEdit,
  onDelete,
  onUpdateName,
  onSaveEdit,
  onCancelEdit,
  onToggleSelect,
  isSelectedForBulk,
  imageCount
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.id });

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
        flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
        ${isSelected 
          ? 'bg-primary-50 border-2 border-primary-200' 
          : 'bg-white border border-gray-200 hover:bg-gray-50'
        }
        ${isDragging ? 'shadow-lg z-10' : ''}
      `}
      onClick={onSelect}
    >
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
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="p-1 text-gray-400 hover:text-primary-600"
        >
          {isSelectedForBulk ? (
            <CheckSquare className="w-4 h-4 text-primary-600" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        {/* Album Icon */}
        <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />

        {/* Album Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form onSubmit={(e) => { e.preventDefault(); onSaveEdit(); }} className="flex items-center space-x-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => onUpdateName(e.target.value)}
                className="input-field text-sm flex-1"
                autoFocus
                required
                onClick={(e) => e.stopPropagation()}
              />
              <button 
                type="submit" 
                className="text-green-600 hover:text-green-800 p-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <>
              <h4 className="font-medium text-gray-900 truncate">{album.name}</h4>
              <p className="text-sm text-gray-500">
                {imageCount} images
              </p>
            </>
          )}
        </div>
      </div>

      {/* Action Menu */}
      {!isEditing && (
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-gray-400 hover:text-primary-600"
            title="Edit album"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete album"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const AlbumManagerEnhanced: React.FC<AlbumManagerEnhancedProps> = ({
  albums,
  images,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onReorderAlbums,
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
  const [selectedAlbums, setSelectedAlbums] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getImageCount = useCallback((albumId: number | null) => {
    return images.filter(img => img.album_id === albumId).length;
  }, [images]);

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

  const confirmDeleteAlbum = async () => {
    if (!albumToDelete) return;
    
    try {
      await onDeleteAlbum(albumToDelete.id);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = albums.findIndex(album => album.id === active.id);
      const newIndex = albums.findIndex(album => album.id === over.id);

      const reorderedAlbums = arrayMove(albums, oldIndex, newIndex);
      try {
        await onReorderAlbums(reorderedAlbums);
      } catch (error) {
        console.error('Failed to reorder albums:', error);
      }
    }
  };

  const handleToggleSelect = (albumId: number) => {
    const newSelected = new Set(selectedAlbums);
    if (newSelected.has(albumId)) {
      newSelected.delete(albumId);
    } else {
      newSelected.add(albumId);
    }
    setSelectedAlbums(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedAlbums.size === albums.length) {
      setSelectedAlbums(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedAlbums(new Set(albums.map(album => album.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkDelete = async () => {
    const albumsToDelete = albums.filter(album => selectedAlbums.has(album.id));
    if (albumsToDelete.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${albumsToDelete.length} album(s)? This will move all images to the default album.`
    );

    if (confirmed) {
      try {
        for (const album of albumsToDelete) {
          await onDeleteAlbum(album.id);
        }
        setSelectedAlbums(new Set());
        setShowBulkActions(false);
      } catch (error) {
        console.error('Failed to delete albums:', error);
      }
    }
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
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Albums</h3>
          {albums.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              {selectedAlbums.size === albums.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {showBulkActions && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-gray-600">
                {selectedAlbums.size} selected
              </span>
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
            onClick={() => setShowCreateForm(true)}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Album
          </button>
        </div>
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

        {/* Sortable Albums */}
        {albums.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={albums.map(album => album.id)}
              strategy={verticalListSortingStrategy}
            >
              {albums.map((album) => (
                <SortableAlbumItem
                  key={album.id}
                  album={album}
                  isSelected={selectedAlbum?.id === album.id}
                  isEditing={editingAlbum?.id === album.id}
                  editName={editAlbumName}
                  onSelect={() => onSelectAlbum(album)}
                  onEdit={() => startEdit(album)}
                  onDelete={() => handleDeleteAlbum(album)}
                  onUpdateName={setEditAlbumName}
                  onSaveEdit={handleUpdateAlbum}
                  onCancelEdit={cancelEdit}
                  onToggleSelect={() => handleToggleSelect(album.id)}
                  isSelectedForBulk={selectedAlbums.has(album.id)}
                  imageCount={getImageCount(album.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

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
      </div>

      {/* Album Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAlbumToDelete(null);
        }}
        onConfirm={confirmDeleteAlbum}
        title="Delete Album"
        message={albumToDelete ? `Are you sure you want to delete "${albumToDelete.name}"? This will move all images to the default album.` : ''}
        confirmText="Delete Album"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default AlbumManagerEnhanced;





