import React, { useState } from 'react';
import { Trash2, Folder, FolderOpen, AlertTriangle } from 'lucide-react';
import type { Album } from '../types';

interface AlbumDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: 'delete-images' | 'move-to-unsorted') => void;
  album: Album | null;
  imageCount: number;
}

export const AlbumDeleteModal: React.FC<AlbumDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  album,
  imageCount
}) => {
  const [selectedAction, setSelectedAction] = useState<'delete-images' | 'move-to-unsorted'>('move-to-unsorted');

  if (!isOpen || !album) return null;

  const handleConfirm = () => {
    onConfirm(selectedAction);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Album</h3>
            <p className="text-sm text-gray-500">What should happen to the images?</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              You're about to delete <strong>"{album.name}"</strong> which contains{' '}
              <strong>{imageCount} image{imageCount !== 1 ? 's' : ''}</strong>.
            </p>
            <p className="text-sm text-gray-600">
              Choose what should happen to the images in this album:
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Move to Unsorted */}
            <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="deleteAction"
                value="move-to-unsorted"
                checked={selectedAction === 'move-to-unsorted'}
                onChange={(e) => setSelectedAction(e.target.value as 'move-to-unsorted')}
                className="mt-1 text-primary-600 focus:ring-primary-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Move to Unsorted</span>
                </div>
                <p className="text-sm text-gray-600">
                  Images will be moved to the unsorted gallery where you can organize them later.
                </p>
              </div>
            </label>

            {/* Delete Images */}
            <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="deleteAction"
                value="delete-images"
                checked={selectedAction === 'delete-images'}
                onChange={(e) => setSelectedAction(e.target.value as 'delete-images')}
                className="mt-1 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-gray-900">Delete Images Too</span>
                </div>
                <p className="text-sm text-gray-600">
                  Images will be permanently deleted along with the album. This cannot be undone.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              selectedAction === 'delete-images'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
            }`}
          >
            {selectedAction === 'delete-images' ? 'Delete Album & Images' : 'Delete Album'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumDeleteModal;

