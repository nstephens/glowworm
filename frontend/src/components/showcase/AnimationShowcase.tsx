import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PageTransition, 
  StaggeredList, 
  FadeIn 
} from '@/components/transitions/PageTransition';
import { 
  SuccessAnimation, 
  LoadingSpinner, 
  PulseAnimation 
} from '@/components/feedback/SuccessAnimation';
import { 
  FormValidation, 
  ShakeAnimation, 
  LoadingButton, 
  ProgressBar 
} from '@/components/forms/FormValidation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const AnimationShowcase: React.FC = () => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showShake, setShowShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationState, setValidationState] = useState({
    isValid: false,
    message: '',
    type: 'info' as const,
  });
  const prefersReducedMotion = useReducedMotion();

  const handleSuccess = () => {
    setShowSuccess(true);
  };

  const handleShake = () => {
    setShowShake(true);
    setTimeout(() => setShowShake(false), 1000);
  };

  const handleLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  const handleProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleValidation = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: 'Form submitted successfully!',
      error: 'Please check your input and try again.',
      warning: 'This action cannot be undone.',
      info: 'Please review your information before submitting.',
    };
    
    setValidationState({
      isValid: type === 'success',
      message: messages[type],
      type,
    });
  };

  const items = [
    { id: 1, title: 'Item 1', description: 'First item in the list' },
    { id: 2, title: 'Item 2', description: 'Second item in the list' },
    { id: 3, title: 'Item 3', description: 'Third item in the list' },
    { id: 4, title: 'Item 4', description: 'Fourth item in the list' },
  ];

  return (
    <PageTransition className="p-6 space-y-8">
      <div className="max-w-4xl mx-auto">
        <FadeIn direction="up">
          <h1 className="text-3xl font-bold mb-2">Animation Showcase</h1>
          <p className="text-muted-foreground mb-6">
            Explore the micro-interactions and animations in the GlowWorm design system.
            {prefersReducedMotion && (
              <span className="block text-sm text-yellow-600 mt-2">
                Reduced motion is enabled. Some animations are disabled for accessibility.
              </span>
            )}
          </p>
        </FadeIn>

        {/* Button Animations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Button Animations</CardTitle>
            <CardDescription>
              Hover and click effects on interactive elements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="success">Success Button</Button>
            </div>
          </CardContent>
        </Card>

        {/* Card Animations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Card Animations</CardTitle>
            <CardDescription>
              Hover effects and interactive cards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card hoverable>
                <CardHeader>
                  <CardTitle>Hoverable Card</CardTitle>
                  <CardDescription>Hover over this card to see the effect</CardDescription>
                </CardHeader>
              </Card>
              <Card interactive onClick={() => alert('Card clicked!')}>
                <CardHeader>
                  <CardTitle>Interactive Card</CardTitle>
                  <CardDescription>Click this card to see the animation</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Static Card</CardTitle>
                  <CardDescription>This card has no animations</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Success Animations */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Success Animations</CardTitle>
            <CardDescription>
              Celebration effects and loading states
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button onClick={handleSuccess}>Show Success Animation</Button>
              <div className="flex items-center gap-4">
                <LoadingSpinner size="sm" />
                <LoadingSpinner size="md" />
                <LoadingSpinner size="lg" />
              </div>
              <PulseAnimation>
                <div className="p-4 bg-blue-100 rounded-lg">
                  <p className="text-blue-800">This text pulses to draw attention</p>
                </div>
              </PulseAnimation>
            </div>
          </CardContent>
        </Card>

        {/* Form Validation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Form Validation Animations</CardTitle>
            <CardDescription>
              Animated feedback for form states
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => handleValidation('success')}>Success State</Button>
              <Button onClick={() => handleValidation('error')}>Error State</Button>
              <Button onClick={() => handleValidation('warning')}>Warning State</Button>
              <Button onClick={() => handleValidation('info')}>Info State</Button>
            </div>
            
            <FormValidation state={validationState} />
            
            <div className="space-y-4">
              <ShakeAnimation shouldShake={showShake}>
                <div className="p-4 border rounded-lg">
                  <p>This element shakes when the button is clicked</p>
                  <Button onClick={handleShake} className="mt-2">Shake Me!</Button>
                </div>
              </ShakeAnimation>
              
              <div className="space-y-2">
                <LoadingButton 
                  isLoading={isLoading} 
                  onClick={handleLoading}
                  loadingText="Processing..."
                >
                  Click to Load
                </LoadingButton>
              </div>
              
              <div className="space-y-2">
                <Button onClick={handleProgress}>Start Progress</Button>
                <ProgressBar progress={progress} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staggered List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Staggered Animations</CardTitle>
            <CardDescription>
              Items animate in sequence for visual hierarchy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaggeredList staggerDelay={0.1} direction="up">
              {items.map((item) => (
                <Card key={item.id} className="mb-2">
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </StaggeredList>
          </CardContent>
        </Card>

        {/* Page Transitions */}
        <Card>
          <CardHeader>
            <CardTitle>Page Transitions</CardTitle>
            <CardDescription>
              Smooth transitions between different states
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FadeIn direction="up" delay={0.1}>
                <div className="p-4 bg-blue-100 rounded-lg text-center">
                  <p className="font-semibold">Fade Up</p>
                </div>
              </FadeIn>
              <FadeIn direction="down" delay={0.2}>
                <div className="p-4 bg-green-100 rounded-lg text-center">
                  <p className="font-semibold">Fade Down</p>
                </div>
              </FadeIn>
              <FadeIn direction="left" delay={0.3}>
                <div className="p-4 bg-yellow-100 rounded-lg text-center">
                  <p className="font-semibold">Fade Left</p>
                </div>
              </FadeIn>
              <FadeIn direction="right" delay={0.4}>
                <div className="p-4 bg-purple-100 rounded-lg text-center">
                  <p className="font-semibold">Fade Right</p>
                </div>
              </FadeIn>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Animation Modal */}
      {showSuccess && (
        <SuccessAnimation
          message="Operation completed successfully!"
          onComplete={() => setShowSuccess(false)}
          showConfetti={!prefersReducedMotion}
        />
      )}
    </PageTransition>
  );
};
