import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Clock, Settings, Zap, Star, ChevronLeft, ChevronRight, Check, AlertCircle, Play, Pause, RotateCcw, Save, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '../ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface MobilePlaylistCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePlaylist: (data: PlaylistCreateData) => Promise<void>;
  loading?: boolean;
  enableHaptic?: boolean;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

interface PlaylistCreateData {
  name: string;
  description?: string;
  display_time_seconds: number;
  display_mode: string;
  is_default: boolean;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  display_time_seconds?: string;
}

const DISPLAY_MODES = [
  { 
    value: 'default', 
    label: 'Default', 
    description: 'Standard slideshow',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-blue-500'
  },
  { 
    value: 'ken_burns_plus', 
    label: 'Ken Burns Plus', 
    description: 'Cinematic zoom & pan with breathing fades',
    icon: <Star className="w-4 h-4" />,
    color: 'bg-purple-600'
  },
  { 
    value: 'soft_glow', 
    label: 'Soft Glow', 
    description: 'Subtle brightness transitions',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-amber-500'
  },
  { 
    value: 'ambient_pulse', 
    label: 'Ambient Pulse', 
    description: 'Gentle edge vignette effect',
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-teal-500'
  },
  { 
    value: 'dreamy_reveal', 
    label: 'Dreamy Reveal', 
    description: 'Blur-to-focus reveal effect',
    icon: <Settings className="w-4 h-4" />,
    color: 'bg-pink-500'
  },
  { 
    value: 'stacked_reveal', 
    label: 'Stacked Reveal', 
    description: 'Layered image reveals',
    icon: <Plus className="w-4 h-4" />,
    color: 'bg-indigo-500'
  },
];

const DISPLAY_TIMES = [
  { value: 15, label: '15 seconds', description: 'Quick slideshow' },
  { value: 30, label: '30 seconds', description: 'Standard timing' },
  { value: 60, label: '1 minute', description: 'Comfortable viewing' },
  { value: 120, label: '2 minutes', description: 'Detailed viewing' },
  { value: 300, label: '5 minutes', description: 'Extended viewing' },
];

// Removed TRANSITION_TYPES and PRIORITY_LEVELS - not needed for playlist creation

const STEPS: Step[] = [
  {
    id: 'basic',
    title: 'Basic Info',
    description: 'Name and description',
    icon: <Settings className="w-5 h-5" />,
    completed: false
  },
  {
    id: 'display',
    title: 'Display Settings',
    description: 'Timing and mode',
    icon: <Clock className="w-5 h-5" />,
    completed: false
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Transitions and options',
    icon: <Zap className="w-5 h-5" />,
    completed: false
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Confirm settings',
    icon: <Check className="w-5 h-5" />,
    completed: false
  }
];

const MobilePlaylistCreateModal: React.FC<MobilePlaylistCreateModalProps> = ({
  open,
  onOpenChange,
  onCreatePlaylist,
  loading = false,
  enableHaptic = true,
  enableAutoSave = true,
  autoSaveInterval = 30000 // 30 seconds
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<PlaylistCreateData>({
    name: '',
    description: '',
    display_time_seconds: 30,
    display_mode: 'default',
    is_default: false
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setFormData({
        name: '',
        description: '',
        display_time_seconds: 30,
        display_mode: 'default',
        is_default: false
      });
      setErrors({});
      setSteps(STEPS.map(step => ({ ...step, completed: false })));
      setSubmitError(null);
      setHasUnsavedChanges(false);
      setAutoSaveStatus('idle');
      setLastSaved(null);
    }
  }, [open]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (enableHaptic) hapticPatterns.success();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      if (enableHaptic) hapticPatterns.warning();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableHaptic]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !open) return;

    const saveToLocalStorage = () => {
      try {
        const autoSaveData = {
          formData,
          currentStep,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('playlist-create-autosave', JSON.stringify(autoSaveData));
        setLastSaved(new Date());
        setAutoSaveStatus('saved');
        if (enableHaptic) hapticPatterns.buttonPress();
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('error');
      }
    };

    // Clear existing timeouts
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up auto-save on changes
    if (hasUnsavedChanges) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        setAutoSaveStatus('saving');
        saveToLocalStorage();
        setHasUnsavedChanges(false);
      }, 2000); // Save 2 seconds after last change
    }

    // Set up periodic auto-save
    autoSaveIntervalRef.current = setInterval(() => {
      if (hasUnsavedChanges && isOnline) {
        setAutoSaveStatus('saving');
        saveToLocalStorage();
        setHasUnsavedChanges(false);
      }
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [formData, hasUnsavedChanges, enableAutoSave, open, isOnline, autoSaveInterval, enableHaptic]);

  // Load auto-saved data on mount
  useEffect(() => {
    if (open && enableAutoSave) {
      try {
        const saved = localStorage.getItem('playlist-create-autosave');
        if (saved) {
          const autoSaveData = JSON.parse(saved);
          const savedDate = new Date(autoSaveData.timestamp);
          const now = new Date();
          const diffInMinutes = (now.getTime() - savedDate.getTime()) / (1000 * 60);
          
          // Only restore if saved within last 24 hours
          if (diffInMinutes < 1440) {
            setFormData(autoSaveData.formData);
            setCurrentStep(autoSaveData.currentStep);
            setLastSaved(savedDate);
            setAutoSaveStatus('saved');
          }
        }
      } catch (error) {
        console.error('Failed to load auto-saved data:', error);
      }
    }
  }, [open, enableAutoSave]);

  // Clean up auto-save data on successful submission
  useEffect(() => {
    if (!isSubmitting && !submitError && !open) {
      localStorage.removeItem('playlist-create-autosave');
    }
  }, [isSubmitting, submitError, open]);

  // Update step completion status
  useEffect(() => {
    const updatedSteps = steps.map((step, index) => {
      let completed = false;
      
      switch (step.id) {
        case 'basic':
          completed = !!formData.name.trim();
          break;
        case 'display':
          completed = !!formData.display_mode && formData.display_time_seconds > 0;
          break;
        case 'advanced':
          completed = true; // Advanced step is always complete
          break;
        case 'review':
          completed = !Object.keys(errors).length && !!formData.name.trim();
          break;
      }
      
      return { ...step, completed };
    });
    
    setSteps(updatedSteps);
  }, [formData, errors]);

  const validateStep = (stepId: string): boolean => {
    const newErrors: FormErrors = {};
    
    switch (stepId) {
      case 'basic':
        if (!formData.name.trim()) {
          newErrors.name = 'Playlist name is required';
        } else if (formData.name.length < 3) {
          newErrors.name = 'Name must be at least 3 characters';
        } else if (formData.name.length > 50) {
          newErrors.name = 'Name must be less than 50 characters';
        }
        break;
      case 'display':
        if (formData.display_time_seconds < 5) {
          newErrors.display_time_seconds = 'Display time must be at least 5 seconds';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const currentStepData = steps[currentStep];
    if (validateStep(currentStepData.id)) {
      if (currentStep < steps.length - 1) {
        if (enableHaptic) hapticPatterns.navigation();
        setCurrentStep(currentStep + 1);
        setHasUnsavedChanges(true);
      }
    } else {
      if (enableHaptic) hapticPatterns.error();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      if (enableHaptic) hapticPatterns.navigation();
      setCurrentStep(currentStep - 1);
      setHasUnsavedChanges(true);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep('basic') || !validateStep('display')) {
      if (enableHaptic) hapticPatterns.error();
      setCurrentStep(0);
      return;
    }

    if (enableHaptic) hapticPatterns.buttonPress();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onCreatePlaylist(formData);
      if (enableHaptic) hapticPatterns.success();
      onOpenChange(false);
    } catch (error) {
      if (enableHaptic) hapticPatterns.error();
      setSubmitError(error instanceof Error ? error.message : 'Failed to create playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Removed tag management functions and handleKeyPress - not needed for playlist creation

  const renderStepContent = () => {
    const currentStepData = steps[currentStep];
    
    switch (currentStepData.id) {
      case 'basic':
        return (
          <motion.div
            key="basic"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Playlist Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Enter playlist name"
                  className={cn(
                    "mt-1 text-base touch-target",
                    errors.name && "border-red-500 focus:border-red-500"
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Optional description"
                  rows={3}
                  className="mt-1 text-base resize-none touch-target"
                />
              </div>

              {/* Tags section removed - not needed for playlist creation */}
            </div>
          </motion.div>
        );

      case 'display':
        return (
          <motion.div
            key="display"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Display Mode
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {DISPLAY_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      onClick={() => {
                        if (enableHaptic) hapticPatterns.selection();
                        setFormData(prev => ({ ...prev, display_mode: mode.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all touch-target",
                        "hover:shadow-md active:scale-95",
                        formData.display_mode === mode.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg text-white", mode.color)}>
                          {mode.icon}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{mode.label}</div>
                          <div className="text-xs text-gray-500">{mode.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Display Duration
                </Label>
                <div className="space-y-2">
                  {DISPLAY_TIMES.map((time) => (
                    <button
                      key={time.value}
                      onClick={() => {
                        if (enableHaptic) hapticPatterns.selection();
                        setFormData(prev => ({ ...prev, display_time_seconds: time.value }));
                        setHasUnsavedChanges(true);
                      }}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 text-left transition-all touch-target",
                        "hover:shadow-md active:scale-95",
                        formData.display_time_seconds === time.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{time.label}</div>
                          <div className="text-sm text-gray-500">{time.description}</div>
                        </div>
                        {formData.display_time_seconds === time.value && (
                          <Check className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {errors.display_time_seconds && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.display_time_seconds}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'advanced':
        return (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Additional Options
                </Label>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg touch-target">
                  <div>
                    <div className="font-medium text-sm">Set as Default Playlist</div>
                    <div className="text-xs text-gray-500">Use this playlist for new displays</div>
                  </div>
                  <button
                    onClick={() => {
                      if (enableHaptic) hapticPatterns.selection();
                      setFormData(prev => ({ ...prev, is_default: !prev.is_default }));
                      setHasUnsavedChanges(true);
                    }}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors",
                      formData.is_default ? "bg-blue-500" : "bg-gray-300"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 bg-white rounded-full transition-transform",
                      formData.is_default ? "translate-x-6" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'review':
        return (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">Name</div>
                  <div className="text-base font-semibold">{formData.name}</div>
                </div>
                
                {formData.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">Description</div>
                    <div className="text-sm text-gray-700">{formData.description}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-gray-500">Display Mode</div>
                  <div className="text-sm text-gray-700">
                    {DISPLAY_MODES.find(m => m.value === formData.display_mode)?.label}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Duration</div>
                  <div className="text-sm text-gray-700">
                    {DISPLAY_TIMES.find(t => t.value === formData.display_time_seconds)?.label}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Options</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.is_default && <Badge variant="secondary">Default</Badge>}
                  </div>
                </div>

                {/* Tags display removed - not needed for playlist creation */}
              </div>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{submitError}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={modalRef}
        className="sm:max-w-md max-h-[90vh] overflow-hidden p-0"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Create Playlist
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Step {currentStep + 1} of {steps.length}
                </DialogDescription>
                {/* Auto-save status */}
                {enableAutoSave && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      {autoSaveStatus === 'saving' && (
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      {autoSaveStatus === 'saved' && (
                        <Save className="w-3 h-3 text-green-500" />
                      )}
                      {autoSaveStatus === 'error' && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-xs text-gray-500">
                        {autoSaveStatus === 'saving' && 'Saving...'}
                        {autoSaveStatus === 'saved' && lastSaved && `Saved ${lastSaved.toLocaleTimeString()}`}
                        {autoSaveStatus === 'error' && 'Save failed'}
                      </span>
                    </div>
                    {/* Network status */}
                    <div className="flex items-center gap-1">
                      {isOnline ? (
                        <Wifi className="w-3 h-3 text-green-500" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-xs text-gray-500">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 touch-target"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      step.completed
                        ? "bg-green-500 text-white"
                        : index === currentStep
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    )}>
                      {step.completed ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={cn(
                        "w-8 h-0.5 mx-2 transition-colors",
                        step.completed ? "bg-green-500" : "bg-gray-200"
                      )} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {renderStepContent()}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 touch-target"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentStep === steps.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || loading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 touch-target"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Playlist
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!steps[currentStep].completed}
                  className="flex items-center gap-2 touch-target"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { MobilePlaylistCreateModal };