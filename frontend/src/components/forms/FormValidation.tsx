import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ValidationState {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface FormValidationProps {
  state: ValidationState;
  className?: string;
  showIcon?: boolean;
  animated?: boolean;
}

export const FormValidation: React.FC<FormValidationProps> = ({
  state,
  className,
  showIcon = true,
  animated = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (state.message) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [state.message]);

  const getIcon = () => {
    switch (state.type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (state.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (!state.message) return null;

  if (prefersReducedMotion || !animated) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-md border text-sm",
        getColorClasses(),
        className
      )}>
        {showIcon && getIcon()}
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "flex items-center gap-2 p-3 rounded-md border text-sm",
            getColorClasses(),
            className
          )}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
        >
          {showIcon && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.1,
                duration: 0.3,
                ease: "backOut",
              }}
            >
              {getIcon()}
            </motion.div>
          )}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {state.message}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ShakeAnimationProps {
  children: React.ReactNode;
  shouldShake: boolean;
  className?: string;
}

export const ShakeAnimation: React.FC<ShakeAnimationProps> = ({
  children,
  shouldShake,
  className,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      animate={shouldShake ? {
        x: [-10, 10, -10, 10, -5, 5, 0],
      } : {}}
      transition={{
        duration: 0.5,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
};

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  children,
  loadingText = "Loading...",
  className,
  disabled,
  onClick,
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      disabled={disabled || isLoading}
      onClick={onClick}
      whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
      whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
      transition={{ duration: 0.2 }}
    >
      {isLoading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Loader2 className="h-4 w-4" />
        </motion.div>
      )}
      <motion.span
        animate={{ opacity: isLoading ? 0.7 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {isLoading ? loadingText : children}
      </motion.span>
    </motion.button>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className,
  animated = true,
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("w-full bg-gray-200 rounded-full h-2", className)}>
      <motion.div
        className="bg-primary h-2 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: animated && !prefersReducedMotion ? 0.5 : 0,
          ease: "easeOut",
        }}
      />
    </div>
  );
};
