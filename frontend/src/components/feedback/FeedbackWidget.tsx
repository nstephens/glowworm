import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Star, 
  X, 
  Send, 
  CheckCircle, 
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Bug,
  Lightbulb,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticPatterns } from '@/utils/hapticFeedback';

export interface FeedbackData {
  id: string;
  rating: number;
  category: 'general' | 'bug' | 'feature' | 'ui' | 'performance';
  message: string;
  userAgent: string;
  url: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  deviceInfo?: {
    platform: string;
    screenSize: string;
    orientation: string;
  };
}

export interface FeedbackWidgetProps {
  onSubmit: (feedback: Omit<FeedbackData, 'id' | 'timestamp'>) => Promise<void>;
  userId?: string;
  sessionId?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark' | 'auto';
  compact?: boolean;
  className?: string;
}

/**
 * In-app feedback widget for collecting user feedback
 * Features: Rating system, category selection, message input, haptic feedback
 */
export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  onSubmit,
  userId,
  sessionId,
  position = 'bottom-right',
  theme = 'auto',
  compact = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<'general' | 'bug' | 'feature' | 'ui' | 'performance'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string>('');
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  // Category options
  const categories = [
    { id: 'general', label: 'General', icon: MessageSquare, color: 'text-blue-500' },
    { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
    { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500' },
    { id: 'ui', label: 'UI/UX', icon: Heart, color: 'text-pink-500' },
    { id: 'performance', label: 'Performance', icon: ThumbsUp, color: 'text-green-500' }
  ] as const;

  // Handle widget toggle
  const handleToggle = () => {
    setIsOpen(!isOpen);
    hapticPatterns.light();
    
    if (!isOpen && textareaRef.current) {
      // Focus textarea when opening
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // Handle rating selection
  const handleRatingSelect = (selectedRating: number) => {
    setRating(selectedRating);
    hapticPatterns.medium();
  };

  // Handle category selection
  const handleCategorySelect = (selectedCategory: typeof category) => {
    setCategory(selectedCategory);
    hapticPatterns.light();
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const feedbackData: Omit<FeedbackData, 'id' | 'timestamp'> = {
        rating,
        category,
        message: message.trim(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId,
        sessionId,
        deviceInfo: {
          platform: navigator.platform,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
        }
      };

      await onSubmit(feedbackData);
      
      setIsSubmitted(true);
      hapticPatterns.success();
      
      // Reset form after delay
      setTimeout(() => {
        setIsSubmitted(false);
        setRating(0);
        setCategory('general');
        setMessage('');
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      setError('Failed to submit feedback. Please try again.');
      hapticPatterns.error();
      console.error('Feedback submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (isSubmitted) {
    return (
      <div className={cn(
        'fixed z-50 transition-all duration-300',
        positionClasses[position],
        className
      )}>
        <Card className="w-80 shadow-lg border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-semibold text-green-800">Thank you!</h3>
                <p className="text-sm text-green-600">Your feedback has been submitted.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn(
      'fixed z-50 transition-all duration-300',
      positionClasses[position],
      className
    )} ref={widgetRef}>
      {/* Toggle Button */}
      {!isOpen && (
        <Button
          onClick={handleToggle}
          className={cn(
            'rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95',
            compact ? 'h-12 w-12' : 'h-14 w-14',
            'bg-primary hover:bg-primary/90 text-primary-foreground'
          )}
          aria-label="Open feedback widget"
        >
          <MessageSquare className={cn('h-5 w-5', compact && 'h-4 w-4')} />
        </Button>
      )}

      {/* Feedback Form */}
      {isOpen && (
        <Card className="w-80 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Share Your Feedback</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
                aria-label="Close feedback widget"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Help us improve your experience
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Rating Section */}
            <div>
              <label className="block text-sm font-medium mb-2">
                How would you rate your experience?
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleRatingSelect(value)}
                    className={cn(
                      'flex-1 h-10 rounded-lg border transition-all duration-200',
                      'hover:scale-105 active:scale-95',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      rating >= value
                        ? 'bg-yellow-400 border-yellow-400 text-yellow-900'
                        : 'bg-background border-input hover:border-primary/50'
                    )}
                    aria-pressed={rating >= value}
                    aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                  >
                    <Star className={cn(
                      'h-5 w-5 mx-auto',
                      rating >= value ? 'fill-current' : ''
                    )} />
                  </button>
                ))}
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                What type of feedback is this?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border transition-all duration-200',
                        'hover:scale-105 active:scale-95',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        category === cat.id
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-background border-input hover:border-primary/50'
                      )}
                      aria-pressed={category === cat.id}
                    >
                      <Icon className={cn('h-4 w-4', cat.color)} />
                      <span className="text-xs font-medium">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Input */}
            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium mb-2">
                Tell us more (optional)
              </label>
              <Textarea
                ref={textareaRef}
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your experience or suggestion..."
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground text-right mt-1">
                {message.length}/500
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};






