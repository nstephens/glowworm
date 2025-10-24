import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SuccessAnimationProps {
  message: string;
  onComplete?: () => void;
  duration?: number;
  showConfetti?: boolean;
  className?: string;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  message,
  onComplete,
  duration = 2000,
  showConfetti = true,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (showConfetti && !prefersReducedMotion) {
      // Simple confetti effect using CSS
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        background: radial-gradient(circle, transparent 0%, transparent 50%, rgba(34, 197, 94, 0.1) 100%);
        animation: confetti 2s ease-out forwards;
      `;
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes confetti {
          0% { opacity: 1; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(confetti);
      
      setTimeout(() => {
        document.body.removeChild(confetti);
        document.head.removeChild(style);
      }, 2000);
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [onComplete, duration, showConfetti, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div className={cn("flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg", className)}>
        <CheckCircle className="h-6 w-6 text-green-600" />
        <span className="text-green-800 font-medium">{message}</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl p-8 max-w-sm mx-4 text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
              className="flex justify-center mb-4"
            >
              <CheckCircle className="h-16 w-16 text-green-500" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Success!</h3>
              <p className="text-gray-600">{message}</p>
            </motion.div>

            {/* Sparkle effects */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${30 + (i % 2) * 20}%`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    delay: 0.5 + i * 0.1,
                    duration: 1,
                    repeat: 1,
                    repeatDelay: 0.5,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    destructive: 'text-red-500',
  };

  if (prefersReducedMotion) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn("rounded-full border-2 border-gray-300 border-t-transparent", sizeClasses[size])} />
      </div>
    );
  }

  return (
    <motion.div
      className={cn("flex items-center justify-center", className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <div className={cn("rounded-full border-2 border-gray-300 border-t-transparent", sizeClasses[size], colorClasses[color])} />
    </motion.div>
  );
};

interface PulseAnimationProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const PulseAnimation: React.FC<PulseAnimationProps> = ({
  children,
  className,
  duration = 1.5,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={{ 
        scale: [1, 1.05, 1],
        opacity: [0.7, 1, 0.7],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
};
