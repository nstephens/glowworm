import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  InfoModal, 
  ActionModal, 
  ConfirmationModal, 
  FullScreenModal 
} from './index';

/**
 * ModalExamples - Demonstrates all modal variants
 * 
 * This component showcases the different modal types and their usage patterns.
 * Use this for development and testing purposes.
 */
export const ModalExamples: React.FC = () => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActionSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setActionOpen(false);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    // Simulate destructive action
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setConfirmOpen(false);
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Modal Examples</h1>
      <p className="text-muted-foreground">
        Click the buttons below to see different modal variants in action.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info Modal */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Info Modal</h3>
          <p className="text-sm text-muted-foreground">
            For displaying information to users
          </p>
          <Button onClick={() => setInfoOpen(true)}>
            Show Info Modal
          </Button>
        </div>

        {/* Action Modal */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Action Modal</h3>
          <p className="text-sm text-muted-foreground">
            For forms and user actions
          </p>
          <Button onClick={() => setActionOpen(true)}>
            Show Action Modal
          </Button>
        </div>

        {/* Confirmation Modal */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Confirmation Modal</h3>
          <p className="text-sm text-muted-foreground">
            For confirming user actions
          </p>
          <Button 
            variant="destructive" 
            onClick={() => setConfirmOpen(true)}
          >
            Show Confirmation Modal
          </Button>
        </div>

        {/* Full Screen Modal */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Full Screen Modal</h3>
          <p className="text-sm text-muted-foreground">
            For immersive experiences
          </p>
          <Button onClick={() => setFullScreenOpen(true)}>
            Show Full Screen Modal
          </Button>
        </div>
      </div>

      {/* Info Modal */}
      <InfoModal
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="Welcome to GlowWorm!"
        description="Your digital photo display system is ready to use."
      >
        <div className="space-y-4">
          <p>
            GlowWorm helps you organize and display your photos in beautiful, 
            organized galleries. You can create albums, upload images, and 
            customize your display settings.
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Getting Started:</h4>
            <ul className="text-sm space-y-1">
              <li>• Create your first album</li>
              <li>• Upload some photos</li>
              <li>• Customize display settings</li>
            </ul>
          </div>
        </div>
      </InfoModal>

      {/* Action Modal */}
      <ActionModal
        open={actionOpen}
        onOpenChange={setActionOpen}
        title="Create New Album"
        description="Enter the details for your new photo album."
        submitText="Create Album"
        onSubmit={handleActionSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="album-name">Album Name</Label>
            <Input 
              id="album-name" 
              placeholder="My Vacation Photos" 
            />
          </div>
          <div>
            <Label htmlFor="album-description">Description (Optional)</Label>
            <Textarea 
              id="album-description" 
              placeholder="Describe your album..." 
              rows={3}
            />
          </div>
        </div>
      </ActionModal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Album?"
        description="This will permanently delete the album and all its photos."
        confirmText="Delete Album"
        variant="destructive"
        onConfirm={handleConfirm}
        isConfirming={isSubmitting}
      >
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">
            <strong>Warning:</strong> This action cannot be undone. All photos 
            in this album will be permanently removed from your account.
          </p>
        </div>
      </ConfirmationModal>

      {/* Full Screen Modal */}
      <FullScreenModal
        open={fullScreenOpen}
        onOpenChange={setFullScreenOpen}
        title="Photo Gallery"
        description="Browse and manage your photos"
        showCloseButton
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 24 }, (_, i) => (
            <div 
              key={i}
              className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground"
            >
              Photo {i + 1}
            </div>
          ))}
        </div>
      </FullScreenModal>
    </div>
  );
};
